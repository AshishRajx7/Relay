import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QUEUE_DRAFT_GENERATION,
  JOB_GENERATE_DRAFT,
  JOB_GENERATE_DRAFTS,
  QUEUE_GMAIL_DRAFT,
  JOB_CREATE_GMAIL_DRAFT,
} from '../../../common/constants/app.constants';
import {
  Prospect,
  ProspectResearchStatus,
  ProspectDraftStatus,
  ProspectFailureType,
} from '../../prospects/entities/prospect.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { EmailDraft, OutreachDraftStatus } from '../../outreach/entities/email-draft.entity';
import { DraftReasoning } from '../../outreach/entities/draft-reasoning.entity';
import { DraftQuality } from '../../outreach/entities/draft-quality.entity';
import { EmailDraftVariant } from '../../outreach/entities/email-draft-variant.entity';
import { EmailGenerationService } from '../../outreach/services/email-generation.service';
import { CandidateMatchingService } from '../../outreach/services/candidate-matching.service';

@Processor(QUEUE_DRAFT_GENERATION, { concurrency: 5 })
export class DraftGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(DraftGenerationProcessor.name);

  constructor(
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepository: Repository<CompanyProfile>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepository: Repository<CandidateProfile>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(EmailDraft)
    private readonly emailDraftRepository: Repository<EmailDraft>,
    @InjectRepository(DraftReasoning)
    private readonly draftReasoningRepository: Repository<DraftReasoning>,
    @InjectRepository(DraftQuality)
    private readonly draftQualityRepository: Repository<DraftQuality>,
    @InjectRepository(EmailDraftVariant)
    private readonly variantRepository: Repository<EmailDraftVariant>,
    private readonly emailGenerationService: EmailGenerationService,
    private readonly candidateMatchingService: CandidateMatchingService,
    @InjectQueue(QUEUE_DRAFT_GENERATION)
    private readonly draftQueue: Queue,
    @InjectQueue(QUEUE_GMAIL_DRAFT)
    private readonly gmailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === JOB_GENERATE_DRAFTS) {
      const { campaignId } = job.data;
      this.logger.log(`[DraftGenerationProcessor] Processing campaign-level draft generation for campaign ID: ${campaignId}`);
      const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
      if (!campaign) {
        throw new Error(`Campaign with ID ${campaignId} not found`);
      }

      const prospects = await this.prospectRepository.find({
        where: [
          { campaignId, researchStatus: ProspectResearchStatus.RESEARCHED },
          { campaignId, researchStatus: ProspectResearchStatus.MANUAL_REVIEW },
        ],
      });

      let queuedCount = 0;
      for (const prospect of prospects) {
        if (
          prospect.draftStatus !== ProspectDraftStatus.GENERATED &&
          prospect.draftStatus !== ProspectDraftStatus.APPROVED &&
          prospect.draftStatus !== ProspectDraftStatus.GMAIL_DRAFT_CREATED
        ) {
          queuedCount++;
          await this.draftQueue.add(
            JOB_GENERATE_DRAFT,
            {
              prospectId: prospect.id,
              candidateProfileId: campaign.candidateProfileId,
            },
            {
              jobId: `draft-gen-${prospect.id}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 3000 },
              removeOnComplete: true,
            },
          );
        }
      }

      this.logger.log(
        `[DraftGenerationProcessor] Auto-enqueued ${queuedCount} individual draft generation jobs for campaign "${campaign.name}"`
      );
      return { queuedCount, campaignId };
    }

    if (job.name !== JOB_GENERATE_DRAFT) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return null;
    }

    this.logger.log(`[DraftGenerationProcessor] Processing job ${job.id} for prospect ID: ${job.data.prospectId}`);

    const { prospectId, candidateProfileId } = job.data;

    const prospect = await this.prospectRepository.findOne({
      where: { id: prospectId },
      relations: ['companyProfile', 'campaign'],
    });

    if (!prospect) {
      throw new Error(`Prospect with ID ${prospectId} not found`);
    }

    if (!prospect.companyProfile) {
      prospect.draftStatus = ProspectDraftStatus.FAILED;
      prospect.failureType = ProspectFailureType.PERMANENT;
      prospect.error = `Company profile not linked for prospect ${prospect.email}`;
      await this.prospectRepository.save(prospect);
      throw new Error(prospect.error);
    }

    const allCandidates = await this.candidateProfileRepository.find({
      relations: ['resumeFile'],
    });

    if (!allCandidates || allCandidates.length === 0) {
      throw new Error(`No candidate resume profiles found for draft generation`);
    }

    const multiResumeMatch = this.candidateMatchingService.selectBestResumeForCompany(
      allCandidates,
      prospect.companyProfile,
      candidateProfileId,
    );

    const candidate = multiResumeMatch.selectedCandidate;

    // Notice: If company research score < 40, log notice and generate using calibrated LOW_MATCH / generic tier
    if ((prospect.companyProfile.researchScore || 0) < 40) {
      this.logger.log(
        `Company research score for ${prospect.domain} is < 40 (${prospect.companyProfile.researchScore}). Proceeding with outreach generation using calibrated personalization tier.`,
      );
    }

    try {
      prospect.draftStatus = ProspectDraftStatus.GENERATING;
      await this.prospectRepository.save(prospect);

      // Generate personalized draft across 3 variants
      const result = await this.emailGenerationService.generatePersonalizedDraft(
        prospect,
        prospect.companyProfile,
        candidate,
        multiResumeMatch,
      );

      // Save EmailDraft (Auto-approved for seamless automated pipeline)
      let draft = await this.emailDraftRepository.findOne({ where: { prospectId: prospect.id } });
      if (!draft) {
        draft = this.emailDraftRepository.create({ prospectId: prospect.id });
      }

      draft.subject = result.subject;
      draft.body = result.body;
      draft.status = OutreachDraftStatus.APPROVED;

      const savedDraft = await this.emailDraftRepository.save(draft);

      // Save DraftReasoning
      let reasoning = await this.draftReasoningRepository.findOne({ where: { emailDraftId: savedDraft.id } });
      if (!reasoning) {
        reasoning = this.draftReasoningRepository.create({ emailDraftId: savedDraft.id });
      }
      reasoning.chosenProject = result.matchResult.chosenProject;
      reasoning.matchScore = multiResumeMatch.matchScore;
      reasoning.whyCompany = result.whyCompany;
      reasoning.whyMe = result.whyMe;
      reasoning.whyNow = result.whyNow;
      reasoning.whyRelevant = result.whyRelevant;
      reasoning.matchedTechnologies = result.matchResult.matchedTechnologies;
      reasoning.rankedMatches = result.matchResult.rankedMatches;
      reasoning.confidenceLevel = result.confidenceLevel;

      reasoning.selectedResumeId = multiResumeMatch.selectedResumeId || null;
      reasoning.selectedResumeName = multiResumeMatch.selectedResumeName || null;
      reasoning.selectedResumeCategory = multiResumeMatch.selectedResumeCategory || null;
      reasoning.selectionReason = multiResumeMatch.selectionReason || null;
      reasoning.evidenceUsed = multiResumeMatch.evidenceUsedInEmail || [];
      reasoning.projectsReferenced = multiResumeMatch.projectsReferenced || [];
      reasoning.keyMatches = multiResumeMatch.keyMatches || [];
      reasoning.reasonContactChosen = result.reasonContactChosen || null;
      reasoning.whyMePoints = multiResumeMatch.whyMePoints || [];
      reasoning.missingSkills = multiResumeMatch.missingSkills || [];
      reasoning.recommendedTalkingPoints = multiResumeMatch.recommendedTalkingPoints || [];
      reasoning.allResumeScores = multiResumeMatch.allResumeScores || [];
      await this.draftReasoningRepository.save(reasoning);

      // Save DraftQuality
      let quality = await this.draftQualityRepository.findOne({ where: { emailDraftId: savedDraft.id } });
      if (!quality) {
        quality = this.draftQualityRepository.create({ emailDraftId: savedDraft.id });
      }
      quality.personalizationScore = result.quality.personalizationScore;
      quality.relevanceScore = result.quality.relevanceScore;
      quality.spamRiskScore = result.quality.spamRiskScore;
      quality.technicalAlignmentScore = result.quality.technicalAlignmentScore;
      quality.confidenceScore = result.quality.confidenceScore;
      quality.requiresManualReview = result.quality.requiresManualReview;
      quality.flags = result.quality.flags;
      await this.draftQualityRepository.save(quality);

      // Save all 3 EmailDraftVariants into email_draft_variants table
      await this.variantRepository.delete({ emailDraftId: savedDraft.id });
      for (const v of result.variants) {
        const variantEntity = this.variantRepository.create({
          emailDraftId: savedDraft.id,
          variantType: v.variantType,
          subject: v.subject,
          body: v.body,
          wordCount: v.wordCount,
          personalizationScore: v.quality.personalizationScore,
          relevanceScore: v.quality.relevanceScore,
          spamRiskScore: v.quality.spamRiskScore,
          technicalAlignmentScore: v.quality.technicalAlignmentScore,
          confidenceScore: v.quality.confidenceScore,
          isSelected: v.isSelected,
        });
        await this.variantRepository.save(variantEntity);
      }

      // Update prospect draft status (Auto-approved for seamless automated pipeline)
      prospect.draftStatus = ProspectDraftStatus.APPROVED;
      prospect.failureType = null;
      await this.prospectRepository.save(prospect);

      // Increment campaign LLM calls and estimated cost ($0.0015 per LLM generation call)
      if (prospect.campaignId) {
        await this.campaignRepository.increment({ id: prospect.campaignId }, 'llmCalls', 1);
        await this.campaignRepository.createQueryBuilder()
          .update(Campaign)
          .set({ estimatedCostUsd: () => 'estimated_cost_usd + 0.0015' })
          .where('id = :id', { id: prospect.campaignId })
          .execute();
      }

      this.logger.log(
        `Draft generated for ${prospect.email} | Selected: ${result.selectedVariantType} | ` +
        `Quality Score: ${result.quality.confidenceScore}/100 | Status: ${draft.status}`
      );

      // Task 3: Auto-chain Draft Generation -> Gmail Draft Creation
      await this.gmailQueue.add(
        JOB_CREATE_GMAIL_DRAFT,
        { draftId: savedDraft.id },
        {
          jobId: `gmail-draft-${savedDraft.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(
        `[DraftGenerationProcessor] Auto-enqueued Gmail draft creation for draft ID ${savedDraft.id} (${prospect.email})`
      );

      return {
        draftId: savedDraft.id,
        prospectId: prospect.id,
        status: draft.status,
        confidenceScore: result.quality.confidenceScore,
      };
    } catch (err: any) {
      this.logger.error(`Failed to generate draft for ${prospect.email}: ${err.message}`, err.stack);
      prospect.draftStatus = ProspectDraftStatus.FAILED;
      prospect.failureType = ProspectFailureType.RETRYABLE;
      prospect.error = err.message;
      await this.prospectRepository.save(prospect);
      throw err;
    }
  }
}
