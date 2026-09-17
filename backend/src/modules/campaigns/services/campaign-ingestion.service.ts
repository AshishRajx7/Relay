import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { parse as parseCsv } from 'csv-parse/sync';
import pdfParse from 'pdf-parse';
import { Campaign, CampaignStatus } from '../entities/campaign.entity';
import {
  Prospect,
  ProspectSourceType,
  ProspectResearchStatus,
  ProspectDraftStatus,
  ContactType,
} from '../../prospects/entities/prospect.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CompanyProfileService } from '../../company-research/services/company-profile.service';
import { CompanyDomainService } from '../../company-research/services/company-domain.service';
import { ContactIntelligenceService } from '../../outreach/services/contact-intelligence.service';
import {
  QUEUE_COMPANY_RESEARCH,
  JOB_RESEARCH_COMPANY,
  QUEUE_DRAFT_GENERATION,
  JOB_GENERATE_DRAFTS,
} from '../../../common/constants/app.constants';

export interface IngestionResult {
  total: number;
  queued: number;
  duplicateInFile: number;
  duplicateInQueue: number;
  duplicateInDatabase: number;
  campaignId: string;
  totalParsed: number;
  totalCreated: number;
  totalDuplicates: number;
  freeMailCount: number;
  unsupportedCount: number;
  corporateCount: number;
  cachedCount: number;
  queuedForResearch: number;
}

@Injectable()
export class CampaignIngestionService {
  private readonly logger = new Logger(CampaignIngestionService.name);
  private readonly emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepository: Repository<CompanyProfile>,
    private readonly companyProfileService: CompanyProfileService,
    private readonly domainService: CompanyDomainService,
    private readonly contactIntelligenceService: ContactIntelligenceService,
    @InjectQueue(QUEUE_COMPANY_RESEARCH)
    private readonly researchQueue: Queue,
    @InjectQueue(QUEUE_DRAFT_GENERATION)
    private readonly draftQueue: Queue,
  ) {}

  /**
   * Ingests prospects from a CSV or PDF file buffer into a campaign.
   */
  async ingestFile(
    campaignId: string,
    fileBuffer: Buffer,
    originalFileName: string,
    mimeType: string,
  ): Promise<IngestionResult> {
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    const isPdf = originalFileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';
    const isCsv =
      originalFileName.toLowerCase().endsWith('.csv') ||
      mimeType === 'text/csv' ||
      mimeType === 'application/vnd.ms-excel' ||
      originalFileName.toLowerCase().endsWith('.txt');

    if (!isPdf && !isCsv) {
      throw new BadRequestException('Unsupported file format. Please upload a CSV (.csv) or PDF (.pdf) file.');
    }

    let parsedItems: Array<{ email: string; companyName?: string | null }> = [];
    const sourceType = isPdf ? ProspectSourceType.PDF : ProspectSourceType.CSV;

    if (isCsv) {
      parsedItems = this.parseCsvContent(fileBuffer);
    } else {
      parsedItems = await this.parsePdfContent(fileBuffer);
    }

    if (parsedItems.length === 0) {
      throw new BadRequestException('No valid email addresses were found in the uploaded file.');
    }

    return this.processParsedItems(campaign, parsedItems, sourceType);
  }

  /**
   * Parses CSV buffer and extracts email and optional company name.
   */
  private parseCsvContent(buffer: Buffer): Array<{ email: string; companyName?: string | null }> {
    const content = buffer.toString('utf-8');
    const records = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const items: Array<{ email: string; companyName?: string | null }> = [];

    for (const record of records) {
      // Find email key case-insensitively
      const emailKey = Object.keys(record).find((k) => /email|e-mail|mail/i.test(k.trim()));
      const rawEmail = emailKey ? record[emailKey] : null;

      if (rawEmail && typeof rawEmail === 'string') {
        const cleanEmail = rawEmail.trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          const companyKey = Object.keys(record).find((k) => /company|org|organization|account/i.test(k.trim()));
          const companyName = companyKey && record[companyKey] ? String(record[companyKey]).trim() : null;
          items.push({ email: cleanEmail, companyName });
        }
      }
    }

    // Fallback: line-by-line regex if headers did not match standard format
    if (items.length === 0) {
      const allMatches = content.match(this.emailRegex) || [];
      for (const email of allMatches) {
        items.push({ email: email.trim().toLowerCase(), companyName: null });
      }
    }

    return items;
  }

  /**
   * Extracts text from PDF and scrapes all email tokens without set collapsing,
   * preserving duplicate occurrences for accurate duplicateInFile tracking.
   */
  private async parsePdfContent(buffer: Buffer): Promise<Array<{ email: string; companyName?: string | null }>> {
    let text = '';
    try {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text || '';
    } catch (err: any) {
      // Fallback ascii token scraper
      text = buffer.toString('latin1');
    }

    const matches = text.match(this.emailRegex) || [];

    return matches.map((email) => ({
      email: email.trim().toLowerCase(),
      companyName: null,
    }));
  }

  /**
   * Deduplicates BEFORE queueing and database insert across:
   * 1. Current Batch (duplicateInFile)
   * 2. Existing Database Records (duplicateInDatabase)
   * 3. Existing BullMQ Queue (duplicateInQueue)
   * Uses deterministic BullMQ job IDs `${campaignId}:${normalizedEmail}` to guarantee uniqueness.
   */
  private async processParsedItems(
    campaign: Campaign,
    items: Array<{ email: string; companyName?: string | null }>,
    sourceType: ProspectSourceType,
  ): Promise<IngestionResult> {
    const existingProspects = await this.prospectRepository.find({
      where: { campaignId: campaign.id },
      select: ['email'],
    });
    const dbEmailSet = new Set(existingProspects.map((p) => p.email.trim().toLowerCase()));

    let duplicateInFile = 0;
    let duplicateInDatabase = 0;
    let duplicateInQueue = 0;
    let queued = 0;

    let freeMailCount = 0;
    let unsupportedCount = 0;
    let corporateCount = 0;
    let cachedCount = 0;

    const seenInBatch = new Set<string>();

    for (const item of items) {
      const normalizedEmail = item.email.trim().toLowerCase();

      // 1. Current Batch Check: Deduplicate within the uploaded file itself
      if (seenInBatch.has(normalizedEmail)) {
        duplicateInFile++;
        continue;
      }
      seenInBatch.add(normalizedEmail);

      // 2. Existing Database Records Check: Skip if prospect already exists in this campaign
      if (dbEmailSet.has(normalizedEmail)) {
        duplicateInDatabase++;
        continue;
      }

      // 3. Existing Queue Check: Skip if a queued job already exists for campaignId + email
      // Note: BullMQ explicitly prohibits ':' in custom job IDs because it uses ':' as Redis key delimiter.
      // We use `${campaign.id}__${normalizedEmail}` as the deterministic unique job ID.
      const jobId = `${campaign.id}__${normalizedEmail}`;
      const existingJob = await this.researchQueue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (['waiting', 'active', 'delayed', 'prioritized', 'completed'].includes(state)) {
          duplicateInQueue++;
          continue;
        } else if (state === 'failed') {
          // Remove old failed job so clean retry can occur
          try {
            await existingJob.remove();
          } catch {
            // Ignore if already deleted
          }
        }
      }

      // Admitted: Classify domain and contact intelligence
      const rawDomain = normalizedEmail.split('@')[1] || '';
      const normalizedDomain = this.domainService.normalizeCompanyDomain(rawDomain);
      const isFreeMail = this.companyProfileService.isFreeMailDomain(normalizedDomain);
      const contactType = this.contactIntelligenceService.classifyContact(normalizedEmail);

      const prospect = this.prospectRepository.create({
        campaignId: campaign.id,
        email: normalizedEmail,
        domain: normalizedDomain,
        companyName: item.companyName || (isFreeMail ? null : normalizedDomain.split('.')[0]),
        sourceType,
        contactType,
        draftStatus: ProspectDraftStatus.PENDING,
      });

      // Contact filtering: Skip bot/system addresses
      if (contactType === ContactType.UNSUPPORTED_CONTACT) {
        unsupportedCount++;
        prospect.researchStatus = ProspectResearchStatus.UNSUPPORTED_CONTACT;
        prospect.error = 'No identifiable company or individual (Automated / bot address)';
      } else if (isFreeMail) {
        freeMailCount++;
        prospect.researchStatus = ProspectResearchStatus.MANUAL_REVIEW;
      } else {
        corporateCount++;
        // Check if company profile is already researched and cached (within 30 days)
        const cachedProfile = await this.companyProfileRepository.findOne({ where: { domain: normalizedDomain } });
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (cachedProfile && cachedProfile.summary && cachedProfile.lastResearchedAt && cachedProfile.lastResearchedAt > thirtyDaysAgo) {
          cachedCount++;
          prospect.companyProfileId = cachedProfile.id;
          prospect.companyName = cachedProfile.companyName;
          prospect.researchStatus = ProspectResearchStatus.RESEARCHED;
        } else {
          prospect.researchStatus = ProspectResearchStatus.PENDING;
        }
      }

      // Save prospect to DB and register in dbEmailSet
      await this.prospectRepository.save(prospect);
      dbEmailSet.add(normalizedEmail);

      // Enqueue research job to BullMQ with deterministic jobId (${campaignId}:${normalizedEmail})
      await this.researchQueue.add(
        JOB_RESEARCH_COMPANY,
        {
          domain: normalizedDomain,
          companyName: item.companyName || (isFreeMail ? null : normalizedDomain.split('.')[0]),
          campaignId: campaign.id,
          email: normalizedEmail,
        },
        {
          jobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: true,
        },
      );

      queued++;
    }

    // Update campaign progress metrics
    campaign.totalProspects += queued;
    campaign.completedProspects += cachedCount;
    campaign.manualReviewCount += freeMailCount;
    if (campaign.status === CampaignStatus.CREATED || campaign.status === CampaignStatus.DRAFT) {
      campaign.status = CampaignStatus.PROCESSING;
    }
    await this.campaignRepository.save(campaign);

    this.logger.log(
      `Ingested prospects for campaign "${campaign.name}" | ` +
      `Total: ${items.length} | Queued: ${queued} | DuplicatesInFile: ${duplicateInFile} | ` +
      `DuplicatesInQueue: ${duplicateInQueue} | DuplicatesInDatabase: ${duplicateInDatabase} | ` +
      `Cached: ${cachedCount} | FreeMail: ${freeMailCount} | Unsupported: ${unsupportedCount}`
    );

    // If all newly queued items were already cached or none needed live research, auto-chain to draft generation
    if (queued > 0 && cachedCount === queued) {
      await this.checkAndTriggerDraftGeneration(campaign.id);
    }

    return {
      total: items.length,
      queued,
      duplicateInFile,
      duplicateInQueue,
      duplicateInDatabase,
      campaignId: campaign.id,
      totalParsed: items.length,
      totalCreated: queued,
      totalDuplicates: duplicateInFile + duplicateInQueue + duplicateInDatabase,
      freeMailCount,
      unsupportedCount,
      corporateCount,
      cachedCount,
      queuedForResearch: queued,
    };
  }

  /**
   * Checks if all prospects in a campaign have completed research, and if so,
   * enqueues JOB_GENERATE_DRAFTS with a deterministic jobId (exactly once).
   */
  public async checkAndTriggerDraftGeneration(campaignId: string): Promise<boolean> {
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) return false;

    const pendingCount = await this.prospectRepository.count({
      where: [
        { campaignId, researchStatus: ProspectResearchStatus.PENDING },
        { campaignId, researchStatus: ProspectResearchStatus.RESEARCHING },
      ],
    });

    if (pendingCount > 0) {
      return false;
    }

    const eligibleCount = await this.prospectRepository.count({
      where: [
        { campaignId, researchStatus: ProspectResearchStatus.RESEARCHED },
        { campaignId, researchStatus: ProspectResearchStatus.MANUAL_REVIEW },
      ],
    });

    if (eligibleCount === 0) {
      return false;
    }

    const jobId = `campaign-drafts-${campaignId}`;
    this.logger.log(
      `[CampaignIngestionService] All prospects in campaign "${campaign.name}" finished research. Auto-chaining to draft generation (Job ID: ${jobId})...`
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
}

