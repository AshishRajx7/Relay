import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_DRAFT_GENERATION, JOB_GENERATE_DRAFT } from '../../../common/constants/app.constants';
import {
  Prospect,
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
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[DraftGenerationProcessor] Processing job ${job.id} for prospect ID: ${job.data.prospectId}`);

    if (job.name !== JOB_GENERATE_DRAFT) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return null;
    }

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

    const candidate = await this.candidateProfileRepository.findOne({
      where: { id: candidateProfileId || prospect.campaign.candidateProfileId },
    });

    if (!candidate) {
      throw new Error(`Candidate profile not found`);
    }

    // Safety check: If company research score < 40, stop generation
    if ((prospect.companyProfile.researchScore || 0) < 40) {
      this.logger.warn(`Company research score for ${prospect.domain} is < 40 (${prospect.companyProfile.researchScore}). Flagging manual review.`);
      prospect.draftStatus = ProspectDraftStatus.REVIEW_REQUIRED;
      await this.prospectRepository.save(prospect);
      return { prospectId, status: 'MANUAL_REVIEW_REQUIRED' };
    }

    try {
      prospect.draftStatus = ProspectDraftStatus.GENERATING;
      await this.prospectRepository.save(prospect);

      // Generate personalized draft across 3 variants
      const result = await this.emailGenerationService.generatePersonalizedDraft(
        prospect,
        prospect.companyProfile,
        candidate,
      );

      // Save EmailDraft
      let draft = await this.emailDraftRepository.findOne({ where: { prospectId: prospect.id } });
      if (!draft) {
        draft = this.emailDraftRepository.create({ prospectId: prospect.id });
      }

      draft.subject = result.subject;
      draft.body = result.body;
      draft.status = result.quality.requiresManualReview
        ? OutreachDraftStatus.REVIEW_REQUIRED
        : OutreachDraftStatus.GENERATED;

      const savedDraft = await this.emailDraftRepository.save(draft);

      // Save DraftReasoning
      let reasoning = await this.draftReasoningRepository.findOne({ where: { emailDraftId: savedDraft.id } });
      if (!reasoning) {
        reasoning = this.draftReasoningRepository.create({ emailDraftId: savedDraft.id });
      }
      reasoning.chosenProject = result.matchResult.chosenProject;
      reasoning.matchScore = result.matchResult.matchScore;
      reasoning.whyCompany = result.whyCompany;
      reasoning.whyMe = result.whyMe;
      reasoning.whyNow = result.whyNow;
      reasoning.whyRelevant = result.whyRelevant;
      reasoning.matchedTechnologies = result.matchResult.matchedTechnologies;
      reasoning.rankedMatches = result.matchResult.rankedMatches;
      reasoning.confidenceLevel = result.confidenceLevel;
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

      // Update prospect draft status
      prospect.draftStatus = result.quality.requiresManualReview
        ? ProspectDraftStatus.REVIEW_REQUIRED
        : ProspectDraftStatus.GENERATED;
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
