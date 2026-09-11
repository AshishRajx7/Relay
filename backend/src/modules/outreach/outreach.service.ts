import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailDraft, OutreachDraftStatus } from './entities/email-draft.entity';
import { DraftReasoning } from './entities/draft-reasoning.entity';
import { DraftQuality } from './entities/draft-quality.entity';
import { EmailDraftVariant, EmailVariantType } from './entities/email-draft-variant.entity';
import { Prospect, ProspectResearchStatus, ProspectDraftStatus } from '../prospects/entities/prospect.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { GmailDraftService, GmailDraftResult } from './services/gmail-draft.service';
import { EmailGenerationService } from './services/email-generation.service';
import {
  QUEUE_DRAFT_GENERATION,
  JOB_GENERATE_DRAFT,
  QUEUE_GMAIL_DRAFT,
  JOB_CREATE_GMAIL_DRAFT,
} from '../../common/constants/app.constants';

export interface UpdateDraftDto {
  subject?: string;
  body?: string;
}

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(
    @InjectRepository(EmailDraft)
    private readonly emailDraftRepository: Repository<EmailDraft>,
    @InjectRepository(DraftReasoning)
    private readonly draftReasoningRepository: Repository<DraftReasoning>,
    @InjectRepository(DraftQuality)
    private readonly draftQualityRepository: Repository<DraftQuality>,
    @InjectRepository(EmailDraftVariant)
    private readonly variantRepository: Repository<EmailDraftVariant>,
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly gmailDraftService: GmailDraftService,
    private readonly emailGenerationService: EmailGenerationService,
    @InjectQueue(QUEUE_DRAFT_GENERATION)
    private readonly draftQueue: Queue,
    @InjectQueue(QUEUE_GMAIL_DRAFT)
    private readonly gmailQueue: Queue,
  ) {}

  /**
   * Enqueues draft generation jobs for all researched prospects inside a campaign.
   */
  async generateDraftsForCampaign(campaignId: string): Promise<{ queuedCount: number; campaignId: string }> {
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    const prospects = await this.prospectRepository.find({
      where: {
        campaignId,
        researchStatus: ProspectResearchStatus.RESEARCHED,
      },
    });

    let queuedCount = 0;

    for (const prospect of prospects) {
      if (prospect.draftStatus !== ProspectDraftStatus.GENERATED && prospect.draftStatus !== ProspectDraftStatus.GMAIL_DRAFT_CREATED) {
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

    this.logger.log(`Enqueued ${queuedCount} draft generation jobs for campaign "${campaign.name}"`);
    return { queuedCount, campaignId };
  }

  /**
   * Lists all drafts for a campaign with full explainability reasoning and quality metrics.
   */
  async findDraftsByCampaign(campaignId: string): Promise<EmailDraft[]> {
    return this.emailDraftRepository
      .createQueryBuilder('draft')
      .innerJoinAndSelect('draft.prospect', 'prospect')
      .leftJoinAndSelect('prospect.companyProfile', 'companyProfile')
      .leftJoinAndSelect('draft.reasoning', 'reasoning')
      .leftJoinAndSelect('draft.quality', 'quality')
      .leftJoinAndSelect('draft.variants', 'variants')
      .where('prospect.campaign_id = :campaignId', { campaignId })
      .orderBy('draft.created_at', 'DESC')
      .getMany();
  }

  /**
   * Finds a single draft by ID with all relations.
   */
  async findDraftById(id: string): Promise<EmailDraft> {
    const draft = await this.emailDraftRepository.findOne({
      where: { id },
      relations: ['prospect', 'prospect.companyProfile', 'prospect.campaign', 'reasoning', 'quality', 'variants'],
    });

    if (!draft) {
      throw new NotFoundException(`Email draft with ID ${id} not found`);
    }

    return draft;
  }

  /**
   * Allows human editing of draft subject and body -> marks status as EDITED.
   */
  async updateDraft(id: string, dto: UpdateDraftDto): Promise<EmailDraft> {
    const draft = await this.findDraftById(id);

    if (dto.subject !== undefined) draft.subject = dto.subject.trim();
    if (dto.body !== undefined) draft.body = dto.body.trim();

    draft.status = OutreachDraftStatus.EDITED;
    return this.emailDraftRepository.save(draft);
  }

  /**
   * Selects a specific generated variant (TECHNICAL, STARTUP, DIRECT) as the active draft.
   */
  async selectVariant(id: string, variantType: EmailVariantType): Promise<EmailDraft> {
    const draft = await this.findDraftById(id);
    const targetVariant = (draft.variants || []).find((v) => v.variantType === variantType);

    if (!targetVariant) {
      throw new BadRequestException(`Variant "${variantType}" not found for draft ${id}`);
    }

    draft.subject = targetVariant.subject;
    draft.body = targetVariant.body;

    // Update isSelected flags on all variants
    for (const v of draft.variants) {
      v.isSelected = v.id === targetVariant.id;
      await this.variantRepository.save(v);
    }

    return this.emailDraftRepository.save(draft);
  }

  /**
   * Approves a draft for Gmail creation.
   */
  async approveDraft(id: string): Promise<EmailDraft> {
    const draft = await this.findDraftById(id);
    draft.status = OutreachDraftStatus.APPROVED;
    draft.prospect.draftStatus = ProspectDraftStatus.APPROVED;
    await this.prospectRepository.save(draft.prospect);
    return this.emailDraftRepository.save(draft);
  }

  /**
   * Rejects a draft.
   */
  async rejectDraft(id: string): Promise<EmailDraft> {
    const draft = await this.findDraftById(id);
    draft.status = OutreachDraftStatus.REJECTED;
    return this.emailDraftRepository.save(draft);
  }

  /**
   * Regenerates AI draft for a prospect.
   */
  async regenerateDraft(id: string): Promise<EmailDraft> {
    const draft = await this.findDraftById(id);
    const prospect = draft.prospect;

    if (!prospect.companyProfile) {
      throw new BadRequestException('Company profile not linked for this prospect');
    }

    const result = await this.emailGenerationService.generatePersonalizedDraft(
      prospect,
      prospect.companyProfile,
      prospect.campaign.candidateProfile,
    );

    draft.subject = result.subject;
    draft.body = result.body;
    draft.status = OutreachDraftStatus.GENERATED;
    const saved = await this.emailDraftRepository.save(draft);

    // Re-save variants
    await this.variantRepository.delete({ emailDraftId: saved.id });
    for (const v of result.variants) {
      const variantEntity = this.variantRepository.create({
        emailDraftId: saved.id,
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

    return this.findDraftById(saved.id);
  }

  /**
   * Creates a Gmail draft in user's Gmail account (MANDATORY APPROVAL CHECK).
   */
  async createGmailDraft(id: string): Promise<GmailDraftResult> {
    const draft = await this.findDraftById(id);

    // Hard Rule: Gmail draft creation must only occur after explicit approval
    if (draft.status !== OutreachDraftStatus.APPROVED && draft.status !== OutreachDraftStatus.EDITED) {
      throw new BadRequestException(
        `Draft cannot be exported to Gmail with status "${draft.status}". Please approve the draft first.`
      );
    }

    const candidateProfileId = draft.prospect.campaign?.candidateProfileId;
    const result = await this.gmailDraftService.createDraft(
      draft.id,
      draft.prospect.email,
      draft.subject,
      draft.body,
      candidateProfileId,
    );

    draft.gmailDraftId = result.gmailDraftId;
    draft.gmailThreadId = result.gmailThreadId;
    draft.status = OutreachDraftStatus.GMAIL_DRAFT_CREATED;
    await this.emailDraftRepository.save(draft);

    draft.prospect.draftStatus = ProspectDraftStatus.GMAIL_DRAFT_CREATED;
    await this.prospectRepository.save(draft.prospect);

    if (draft.prospect.campaignId) {
      await this.campaignRepository.increment(
        { id: draft.prospect.campaignId },
        'gmailDraftCount',
        1,
      );
    }

    return result;
  }
}
