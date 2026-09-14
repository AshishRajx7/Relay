import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Campaign, CampaignStatus } from './entities/campaign.entity';
import { CandidateProfile } from '../resume/entities/candidate-profile.entity';
import {
  Prospect,
  ProspectResearchStatus,
  ProspectDraftStatus,
  ProspectFailureType,
  ContactType,
} from '../prospects/entities/prospect.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import {
  QUEUE_COMPANY_RESEARCH,
  JOB_RESEARCH_COMPANY,
  QUEUE_DRAFT_GENERATION,
  JOB_GENERATE_DRAFT,
  JOB_GENERATE_DRAFTS,
} from '../../common/constants/app.constants';

export interface CampaignOverviewDto {
  campaignId: string;
  name: string;
  status: CampaignStatus;
  progressPercentage: number;
  totalProspects: number;
  processedProspects: number;
  researchedProspects: number;
  draftsGenerated: number;
  manualReviewCount: number;
  failedCount: number;
  gmailDraftCount: number;
  cost: {
    crawlCount: number;
    llmCalls: number;
    estimatedCostUsd: number;
  };
  duplicateAnalysis: {
    uniqueCompaniesCount: number;
    duplicateCompanyCount: number;
    duplicateDraftCount: number;
    warnings: string[];
  };
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepository: Repository<CandidateProfile>,
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectQueue(QUEUE_COMPANY_RESEARCH)
    private readonly researchQueue: Queue,
    @InjectQueue(QUEUE_DRAFT_GENERATION)
    private readonly draftQueue: Queue,
  ) {}

  async createCampaign(dto: CreateCampaignDto): Promise<Campaign> {
    const profile = await this.candidateProfileRepository.findOne({
      where: { id: dto.candidateProfileId },
    });
    if (!profile) {
      throw new NotFoundException(`Candidate profile with ID ${dto.candidateProfileId} not found`);
    }

    const campaign = this.campaignRepository.create({
      name: dto.name.trim(),
      candidateProfileId: dto.candidateProfileId,
      status: CampaignStatus.CREATED,
      totalProspects: 0,
      completedProspects: 0,
      manualReviewCount: 0,
      gmailDraftCount: 0,
      crawlCount: 0,
      llmCalls: 0,
      estimatedCostUsd: 0,
    });

    return this.campaignRepository.save(campaign);
  }

  async findAll(): Promise<Campaign[]> {
    return this.campaignRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['candidateProfile'],
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
    return campaign;
  }

  /**
   * Generates comprehensive campaign overview with execution metrics, cost tracking, and duplicate warnings.
   */
  async getOverview(id: string): Promise<CampaignOverviewDto> {
    const campaign = await this.findOne(id);
    const prospects = await this.prospectRepository.find({ where: { campaignId: id } });

    const totalProspects = prospects.length;
    let researchedProspects = 0;
    let draftsGenerated = 0;
    let manualReviewCount = 0;
    let failedCount = 0;
    let gmailDraftCount = 0;
    let processedProspects = 0;

    // Group prospects by normalized domain for duplicate detection
    const companyContactMap = new Map<string, { companyName: string; contacts: Prospect[] }>();

    for (const p of prospects) {
      if (p.researchStatus === ProspectResearchStatus.RESEARCHED) researchedProspects++;
      if (p.researchStatus === ProspectResearchStatus.MANUAL_REVIEW || p.draftStatus === ProspectDraftStatus.REVIEW_REQUIRED) {
        manualReviewCount++;
      }
      if (p.researchStatus === ProspectResearchStatus.FAILED || p.draftStatus === ProspectDraftStatus.FAILED) {
        failedCount++;
      }
      if (
        p.draftStatus === ProspectDraftStatus.GENERATED ||
        p.draftStatus === ProspectDraftStatus.APPROVED ||
        p.draftStatus === ProspectDraftStatus.GMAIL_DRAFT_CREATED
      ) {
        draftsGenerated++;
      }
      if (p.draftStatus === ProspectDraftStatus.GMAIL_DRAFT_CREATED) {
        gmailDraftCount++;
      }
      if (p.draftStatus !== ProspectDraftStatus.PENDING || p.researchStatus === ProspectResearchStatus.UNSUPPORTED_CONTACT) {
        processedProspects++;
      }

      // Group for duplicate corporate outreach analysis (excluding freemail and bot addresses)
      const domainKey = p.domain || 'unknown';
      const isFreeMail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com', 'proton.me', 'mail.com', 'aol.com', 'zoho.com'].includes(domainKey.toLowerCase());
      if (domainKey !== 'unknown' && !isFreeMail && p.contactType !== ContactType.UNSUPPORTED_CONTACT) {
        if (!companyContactMap.has(domainKey)) {
          companyContactMap.set(domainKey, {
            companyName: p.companyName || domainKey.split('.')[0],
            contacts: [],
          });
        }
        companyContactMap.get(domainKey)!.contacts.push(p);
      }
    }

    // Duplicate detection & warnings
    let duplicateCompanyCount = 0;
    let duplicateDraftCount = 0;
    const warnings: string[] = [];

    for (const [domain, group] of companyContactMap.entries()) {
      if (domain !== 'unknown' && group.contacts.length > 1) {
        duplicateCompanyCount++;
        duplicateDraftCount += (group.contacts.length - 1);
        warnings.push(
          `${group.contacts.length} contacts belong to the same company (${group.companyName}). Review before generating additional drafts.`
        );
      }
    }

    // Progress percentage
    const progressPercentage = totalProspects > 0
      ? Math.min(100, Math.round((processedProspects / totalProspects) * 100))
      : 0;

    // Dynamic campaign status determination
    let currentStatus = campaign.status;
    if (totalProspects > 0) {
      if (progressPercentage === 100) {
        currentStatus = failedCount > 0 ? CampaignStatus.PARTIAL_SUCCESS : CampaignStatus.COMPLETED;
      } else if (processedProspects > 0) {
        currentStatus = CampaignStatus.PROCESSING;
      }
    }

    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: currentStatus,
      progressPercentage,
      totalProspects,
      processedProspects,
      researchedProspects,
      draftsGenerated,
      manualReviewCount,
      failedCount,
      gmailDraftCount,
      cost: {
        crawlCount: campaign.crawlCount || 0,
        llmCalls: campaign.llmCalls || 0,
        estimatedCostUsd: Number(campaign.estimatedCostUsd || 0),
      },
      duplicateAnalysis: {
        uniqueCompaniesCount: companyContactMap.size,
        duplicateCompanyCount,
        duplicateDraftCount,
        warnings,
      },
    };
  }

  /**
   * Retries only failed prospects that are marked RETRYABLE.
   */
  async retryFailedProspects(campaignId: string): Promise<{ retriedCount: number; message: string }> {
    const campaign = await this.findOne(campaignId);
    const failedProspects = await this.prospectRepository.find({
      where: {
        campaignId,
        failureType: ProspectFailureType.RETRYABLE,
      },
    });

    let retriedCount = 0;
    for (const p of failedProspects) {
      p.draftStatus = ProspectDraftStatus.PENDING;
      p.error = null;
      await this.prospectRepository.save(p);

      if (p.researchStatus === ProspectResearchStatus.RESEARCHED) {
        await this.draftQueue.add(
          JOB_GENERATE_DRAFT,
          {
            prospectId: p.id,
            candidateProfileId: campaign.candidateProfileId,
          },
          {
            jobId: `retry-draft-${p.id}-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: true,
          },
        );
        retriedCount++;
      } else {
        await this.researchQueue.add(
          JOB_RESEARCH_COMPANY,
          {
            domain: p.domain,
            campaignId: campaign.id,
          },
          {
            jobId: `retry-research-${p.domain}-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: true,
          },
        );
        retriedCount++;
      }
    }

    this.logger.log(`Retried ${retriedCount} failed prospects for campaign ${campaign.name}`);
    return {
      retriedCount,
      message: `Enqueued ${retriedCount} retryable jobs for campaign ${campaign.name}`,
    };
  }

  /**
   * Checks if all prospects in a campaign have completed research, and if so,
   * enqueues JOB_GENERATE_DRAFTS with a deterministic jobId (exactly once).
   */
  async checkAndAutoTriggerDrafts(campaignId: string): Promise<boolean> {
    const campaign = await this.findOne(campaignId);
    const pendingCount = await this.prospectRepository.count({
      where: [
        { campaignId, researchStatus: ProspectResearchStatus.PENDING },
        { campaignId, researchStatus: ProspectResearchStatus.RESEARCHING },
      ],
    });

    if (pendingCount > 0) {
      this.logger.log(
        `Campaign "${campaign.name}" (${campaignId}) has ${pendingCount} prospects still awaiting research.`
      );
      return false;
    }

    const eligibleCount = await this.prospectRepository.count({
      where: [
        { campaignId, researchStatus: ProspectResearchStatus.RESEARCHED },
        { campaignId, researchStatus: ProspectResearchStatus.MANUAL_REVIEW },
      ],
    });

    if (eligibleCount === 0) {
      this.logger.warn(`Campaign "${campaign.name}" (${campaignId}) has no eligible prospects for draft generation.`);
      return false;
    }

    const jobId = `campaign-drafts-${campaignId}`;
    this.logger.log(
      `[CampaignsService] All prospects in campaign "${campaign.name}" completed research (${eligibleCount} eligible). Auto-chaining to draft generation (Job ID: ${jobId})...`
    );

    await this.draftQueue.add(
      JOB_GENERATE_DRAFTS,
      { campaignId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
      },
    );

    return true;
  }

  /**
   * Starts a campaign: sets status to PROCESSING and triggers draft generation if research is ready.
   */
  async startCampaign(id: string): Promise<{ campaignId: string; status: CampaignStatus; message: string }> {
    const campaign = await this.findOne(id);
    campaign.status = CampaignStatus.PROCESSING;
    await this.campaignRepository.save(campaign);

    await this.checkAndAutoTriggerDrafts(id);

    return {
      campaignId: campaign.id,
      status: campaign.status,
      message: `Campaign "${campaign.name}" started successfully. Research, draft generation, and Gmail drafts will process automatically.`,
    };
  }
}

