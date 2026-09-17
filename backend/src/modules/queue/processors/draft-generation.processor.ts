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
  ContactType,
  ProspectResearchStatus,
  ProspectDraftStatus,
  ProspectFailureType,
  NoOutreachAngleReason,
} from '../../prospects/entities/prospect.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { EmailDraft, OutreachDraftStatus } from '../../outreach/entities/email-draft.entity';
import { DraftReasoning } from '../../outreach/entities/draft-reasoning.entity';
import { DraftQuality } from '../../outreach/entities/draft-quality.entity';
import { EmailDraftVariant } from '../../outreach/entities/email-draft-variant.entity';
import { OutreachStrategyEntity } from '../../outreach/entities/outreach-strategy.entity';
import { EmailGenerationService } from '../../outreach/services/email-generation.service';
import { CandidateMatchingService } from '../../outreach/services/candidate-matching.service';
import { DraftVerificationService } from '../../outreach/services/draft-verification.service';

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
    @InjectRepository(OutreachStrategyEntity)
    private readonly strategyRepository: Repository<OutreachStrategyEntity>,
    private readonly emailGenerationService: EmailGenerationService,
    private readonly candidateMatchingService: CandidateMatchingService,
    private readonly draftVerificationService: DraftVerificationService,
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

    // 1. Evaluate V3 Hybrid Relational Matching
    const v3Match = await this.candidateMatchingService.matchCandidateToCompany(
      prospect.companyProfile,
      candidate.id,
      prospect.campaignId,
    );

    if (!v3Match.match) {
      const refusalReason = v3Match.refusalReason || NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH;
      this.logger.warn(`Terminal refusal for prospect ${prospect.email} at ${prospect.companyProfile.companyName}: ${refusalReason}`);

      prospect.draftStatus = ProspectDraftStatus.NO_SUFFICIENT_OUTREACH_ANGLE;
      prospect.noAngleReason = refusalReason;
      await this.prospectRepository.save(prospect);

      return {
        prospectId: prospect.id,
        status: ProspectDraftStatus.NO_SUFFICIENT_OUTREACH_ANGLE,
        refusalReason,
      };
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

      // Save EmailDraft (Initial status: READY_FOR_APPROVAL)
      let draft = await this.emailDraftRepository.findOne({ where: { prospectId: prospect.id } });
      if (!draft) {
        draft = this.emailDraftRepository.create({ prospectId: prospect.id });
      }

      draft.subject = result.subject;
      draft.body = result.body;
      draft.status = OutreachDraftStatus.READY_FOR_APPROVAL;

      const savedDraft = await this.emailDraftRepository.save(draft);

      // Save OutreachStrategyEntity
      let strategy = await this.strategyRepository.findOne({ where: { emailDraftId: savedDraft.id } });
      if (!strategy) {
        strategy = this.strategyRepository.create({
          emailDraftId: savedDraft.id,
          recipientClassification: prospect.contactType === ContactType.ENGINEERING ? 'ENGINEERING_PEER' : 'RECRUITER',
          primaryMatchId: v3Match.match.id,
          objective: 'START_CONVERSATION',
          tone: 'PEER',
          avoidTopics: 'Generic AI boilerplate, desperate asks, ungrounded claims',
          closingStrategy: 'Low-friction conversation starter with resume context',
        });
      } else {
        strategy.primaryMatchId = v3Match.match.id;
      }
      await this.strategyRepository.save(strategy);

      // Save DraftReasoning
      let reasoning = await this.draftReasoningRepository.findOne({ where: { emailDraftId: savedDraft.id } });
      if (!reasoning) {
        reasoning = this.draftReasoningRepository.create({ emailDraftId: savedDraft.id });
      }
      reasoning.chosenProject = v3Match.candidateEvidence?.deliverableName || result.matchResult.chosenProject;
      reasoning.matchScore = v3Match.compositeScore || multiResumeMatch.matchScore;
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

      // 2. Run Adversarial Claim Verification (Provenance check & cross-role bleed check)
      const verification = await this.draftVerificationService.verifyDraft(
        savedDraft.id,
        savedDraft.body,
        candidate.id,
        prospect.companyProfile.id,
        strategy,
      );

      // 3. Human-Gated Workflow:
      // If verification PASS -> READY_FOR_APPROVAL
      // If campaign.autonomousGmailStaging === true -> auto-stage to Gmail
      // Else -> wait for explicit human operator approval in UI!
      const campaign = prospect.campaignId
        ? await this.campaignRepository.findOne({ where: { id: prospect.campaignId } })
        : null;

      if (verification.passed && verification.severity === 'PASS') {
        if (campaign?.autonomousGmailStaging) {
          savedDraft.status = OutreachDraftStatus.APPROVED;
          prospect.draftStatus = ProspectDraftStatus.APPROVED;
          await this.emailDraftRepository.save(savedDraft);
          await this.prospectRepository.save(prospect);

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
          this.logger.log(`[DraftGenerationProcessor] Autonomous Gmail staging triggered for draft ID ${savedDraft.id}`);
        } else {
          savedDraft.status = OutreachDraftStatus.READY_FOR_APPROVAL;
          prospect.draftStatus = ProspectDraftStatus.READY_FOR_APPROVAL;
          await this.emailDraftRepository.save(savedDraft);
          await this.prospectRepository.save(prospect);
          this.logger.log(`[DraftGenerationProcessor] Draft ID ${savedDraft.id} verified with PASS. Locked in READY_FOR_APPROVAL awaiting human operator approval.`);
        }
      } else {
        // Verification issues flagged
        savedDraft.status = OutreachDraftStatus.REVIEW_REQUIRED;
        prospect.draftStatus = ProspectDraftStatus.REVIEW_REQUIRED;
        await this.emailDraftRepository.save(savedDraft);
        await this.prospectRepository.save(prospect);
        this.logger.warn(`[DraftGenerationProcessor] Draft ID ${savedDraft.id} flagged with ${verification.severity}: ${verification.verifierNotes}. Staging halted.`);
      }

      // Increment campaign LLM calls and estimated cost ($0.0015 per LLM generation call)
      if (prospect.campaignId) {
        await this.campaignRepository.increment({ id: prospect.campaignId }, 'llmCalls', 1);
        await this.campaignRepository.createQueryBuilder()
          .update(Campaign)
          .set({ estimatedCostUsd: () => 'estimated_cost_usd + 0.0015' })
          .where('id = :id', { id: prospect.campaignId })
          .execute();
      }

      return {
        draftId: savedDraft.id,
        prospectId: prospect.id,
        status: savedDraft.status,
        confidenceScore: result.quality.confidenceScore,
        verificationSeverity: verification.severity,
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
