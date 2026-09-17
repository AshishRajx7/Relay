import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QUEUE_COMPANY_RESEARCH,
  JOB_RESEARCH_COMPANY,
  QUEUE_DRAFT_GENERATION,
  JOB_GENERATE_DRAFTS,
  CRAWL_PROVIDER_TOKEN,
} from '../../../common/constants/app.constants';
import { CompanyResearchService } from '../../company-research/company-research.service';
import { CompanyProfileService } from '../../company-research/services/company-profile.service';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Prospect, ProspectResearchStatus } from '../../prospects/entities/prospect.entity';
import { ICrawlProvider } from '../../company-research/providers/crawl-provider.interface';
import { AtsDiscoveryService } from '../../company-research/services/ats-discovery.service';
import { ResearchQualityScorerService } from '../../company-research/services/research-quality-scorer.service';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CompanyPersona } from '../../companies/enums/company-persona.enum';

interface ExtractedCompanyProfileAi {
  persona: CompanyPersona;
  industry: string;
  companySize: string;
  summary: string;
  keywords: string[];
  techStack: string[];
  products: string[];
  targetDepartments: string[];
  locations: string[];
  outreachHooks: {
    whyThisCompany: string;
    whyNow: string;
    keyProblemsSolving: string[];
    engineeringCultureSignals: string[];
    recentMilestones: string[];
  };
}

@Processor(QUEUE_COMPANY_RESEARCH, { concurrency: 3 })
export class CompanyResearchProcessor extends WorkerHost {
  private readonly logger = new Logger(CompanyResearchProcessor.name);

  constructor(
    private readonly researchService: CompanyResearchService,
    private readonly companyProfileService: CompanyProfileService,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectQueue(QUEUE_DRAFT_GENERATION)
    private readonly draftQueue: Queue,
    @Inject(CRAWL_PROVIDER_TOKEN)
    private readonly crawlProvider: ICrawlProvider,
    private readonly atsDiscoveryService: AtsDiscoveryService,
    private readonly qualityScorer: ResearchQualityScorerService,
    private readonly aiProviderService: AIProviderService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[CompanyResearchProcessor] Processing BullMQ job ${job.id} (name: ${job.name})`);

    if (job.name !== JOB_RESEARCH_COMPANY) {
      this.logger.warn(`Unknown job name in ${QUEUE_COMPANY_RESEARCH}: ${job.name}`);
      return null;
    }

    // Phase 2 & 3: Domain-based company profile intelligence
    if (job.data.domain) {
      const { domain, companyName, campaignId, email } = job.data;
      this.logger.log(`[CompanyResearchProcessor] Executing intelligence for domain: ${domain}`);

      // Handle personal/freemail webmail domains without crawling or throwing errors
      if (this.companyProfileService.isFreeMailDomain(domain)) {
        this.logger.log(`[CompanyResearchProcessor] Domain "${domain}" is a personal webmail provider. Marking prospect for manual review.`);
        if (campaignId && email) {
          await this.prospectRepository.update(
            { campaignId, email },
            { researchStatus: ProspectResearchStatus.MANUAL_REVIEW },
          );
        } else if (domain) {
          await this.prospectRepository.update(
            { domain, researchStatus: ProspectResearchStatus.PENDING },
            { researchStatus: ProspectResearchStatus.MANUAL_REVIEW },
          );
        }
        if (campaignId) {
          await this.checkAndTriggerDraftGeneration(campaignId);
        }
        return { domain, isFreeMail: true };
      }

      let profile;
      try {
        profile = await this.companyProfileService.researchAndSaveCompany(domain, companyName);
      } catch (err: any) {
        this.logger.error(`[CompanyResearchProcessor] Failed research for domain "${domain}": ${err.message}`, err.stack);
        // If on last attempt, mark pending prospects for this domain as RESEARCH_RETRY_REQUIRED or FAILED so campaign does not stall
        if (job.attemptsMade >= (job.opts?.attempts || 3) - 1) {
          const targetStatus = err.message?.includes('RESEARCH_RETRY_REQUIRED')
            ? ProspectResearchStatus.RESEARCH_RETRY_REQUIRED
            : ProspectResearchStatus.FAILED;
          await this.prospectRepository.update(
            { domain, researchStatus: ProspectResearchStatus.PENDING },
            { researchStatus: targetStatus, error: err.message },
          );
          if (campaignId) {
            await this.checkAndTriggerDraftGeneration(campaignId);
          }
        }
        throw err;
      }

      // Track campaign cost metrics if campaignId provided
      if (campaignId) {
        await this.campaignRepository.increment({ id: campaignId }, 'crawlCount', 1);
        await this.campaignRepository.increment({ id: campaignId }, 'llmCalls', 1);
        await this.campaignRepository.createQueryBuilder()
          .update(Campaign)
          .set({ estimatedCostUsd: () => 'estimated_cost_usd + 0.0020' })
          .where('id = :id', { id: campaignId })
          .execute();
      }

      // Find all affected campaigns for prospects with this domain
      const affectedProspects = await this.prospectRepository.find({
        where: { domain: profile.domain },
        select: ['campaignId'],
      });
      const campaignIds = Array.from(
        new Set(
          [campaignId, ...affectedProspects.map((p) => p.campaignId)].filter(Boolean) as string[],
        ),
      );

      for (const cId of campaignIds) {
        await this.checkAndTriggerDraftGeneration(cId);
      }

      return { profileId: profile.id, domain: profile.domain, companyName: profile.companyName };
    }

    const { researchId, companyId, website } = job.data;

    try {
      // 1. Mark status as PROCESSING
      await this.researchService.markProcessing(researchId);

      // 2. Scrape website and sub-pages via ICrawlProvider
      const crawlResult = await this.crawlProvider.crawl(website, 3);

      // 3. Perform ATS & Careers detection over HTML links and markdown
      const atsResult = this.atsDiscoveryService.discover(
        website,
        crawlResult.htmlLinks,
        crawlResult.markdown,
      );

      // 4. Extract structured intelligence with AI
      const systemPrompt = `You are a Principal Technical Researcher analyzing company websites to prepare high-conviction job outreach and applications.
Extract structured company intelligence from the website markdown below.

Return a JSON object conforming to this exact JSON schema:
{
  "persona": "STARTUP" | "SCALEUP" | "ENTERPRISE" | "AGENCY" | "CONSULTING" | "SAAS" | "ECOMMERCE" | "FINTECH" | "HEALTHCARE" | "OTHER",
  "industry": "string (e.g. Developer Tools, Cloud Infrastructure, Fintech)",
  "companySize": "string (e.g. 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)",
  "summary": "string (2-3 concise sentences detailing core value proposition and market position)",
  "keywords": ["Domain/product keywords"],
  "techStack": ["Specific programming languages, frameworks, databases, and infrastructure tools"],
  "products": ["Primary product names or platform offerings"],
  "targetDepartments": ["Engineering", "Product", "Infrastructure", "Platform"],
  "locations": ["City, State or Country or Remote"],
  "outreachHooks": {
    "whyThisCompany": "Compelling reasons why a top engineer would want to join this specific company",
    "whyNow": "Recent momentum, active expansion, scaling hurdles, or technology transformation",
    "keyProblemsSolving": ["Core technical challenges they tackle"],
    "engineeringCultureSignals": ["Values like high ownership, speed, autonomous execution, craft"],
    "recentMilestones": ["Notable achievements, growth stats, or product launches"]
  }
}`;

      const userPrompt = `TARGET COMPANY WEBSITE: ${website}\n\nMARKDOWN SCRAPE CONTENT:\n${crawlResult.markdown.slice(0, 18000)}`;

      const aiResponse = await this.aiProviderService.structuredComplete<ExtractedCompanyProfileAi>({
        systemPrompt,
        userPrompt,
        feature: 'COMPANY_RESEARCH',
        maxTokens: 3500,
        temperature: 0.2,
        metadata: { researchId, companyId, website },
      });

      const extracted = aiResponse.data;

      // 5. Score research quality across 4 dimensions (0-100)
      const qualityResult = this.qualityScorer.score(crawlResult, extracted);
      this.logger.log(`Research quality score for ${website}: ${qualityResult.score}/100 (${qualityResult.reason})`);

      const allHiringSignals = Array.from(
        new Set([...(atsResult.hiringSignals || []), ...(extracted.outreachHooks?.recentMilestones || [])]),
      );

      // 6. Persist structured metadata into database
      if (qualityResult.isSufficient) {
        const completed = await this.researchService.markCompleted(researchId, {
          persona: extracted.persona || CompanyPersona.OTHER,
          industry: extracted.industry || null,
          companySize: extracted.companySize || null,
          summary: extracted.summary || null,
          keywords: extracted.keywords || [],
          techStack: extracted.techStack || [],
          products: extracted.products || [],
          rawMarkdown: crawlResult.markdown,
          careersPageUrl: atsResult.careersPageUrl,
          atsProvider: atsResult.atsProvider,
          isHiring: atsResult.isHiring,
          hiringSignals: allHiringSignals,
          genericContactEmails: atsResult.genericContactEmails || [],
          targetDepartments: extracted.targetDepartments || [],
          locations: extracted.locations || [],
          outreachHooks: extracted.outreachHooks || {},
          researchQualityScore: qualityResult.score,
          qualityReason: qualityResult.reason,
          crawlMetadata: {
            ...crawlResult.metadata,
            wordCount: crawlResult.wordCount,
            pageCount: crawlResult.pageCount,
            breakdown: qualityResult.breakdown,
            leadershipPages: atsResult.leadershipPageUrls,
            engineeringBlogPages: atsResult.engineeringBlogUrls,
          },
        });

        this.logger.log(`Successfully completed company research for ${website} (ID: ${completed.id})`);
        return { researchId: completed.id, status: completed.status, score: completed.researchQualityScore };
      } else {
        const insufficient = await this.researchService.markInsufficient(
          researchId,
          qualityResult.reason,
          qualityResult.score,
          {
            summary: extracted.summary || null,
            keywords: extracted.keywords || [],
            techStack: extracted.techStack || [],
            products: extracted.products || [],
            rawMarkdown: crawlResult.markdown,
            careersPageUrl: atsResult.careersPageUrl,
            atsProvider: atsResult.atsProvider,
            isHiring: atsResult.isHiring,
            hiringSignals: allHiringSignals,
            genericContactEmails: atsResult.genericContactEmails || [],
            targetDepartments: extracted.targetDepartments || [],
            locations: extracted.locations || [],
            outreachHooks: extracted.outreachHooks || {},
            crawlMetadata: {
              ...crawlResult.metadata,
              wordCount: crawlResult.wordCount,
              pageCount: crawlResult.pageCount,
              breakdown: qualityResult.breakdown,
            },
          },
        );

        this.logger.warn(`Marked research as INSUFFICIENT for ${website} (score: ${qualityResult.score})`);
        return { researchId: insufficient.id, status: insufficient.status, score: insufficient.researchQualityScore };
      }
    } catch (err: any) {
      this.logger.error(`Error executing research job ${job.id} for ${website}: ${err.message}`, err.stack);
      await this.researchService.markFailed(researchId, err.message || 'Unknown crawl error');
      throw err;
    }
  }

  /**
   * Checks if all prospects in a campaign have finished company research.
   * If all completed, auto-enqueues JOB_GENERATE_DRAFTS with deterministic jobId (exactly once).
   */
  public async checkAndTriggerDraftGeneration(campaignId: string): Promise<boolean> {
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    if (!campaign) return false;

    // Check if any prospects in this campaign are still pending or researching
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

    // All research complete! Check if there are eligible researched/manual-review prospects
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
      `All prospects in campaign "${campaign.name}" completed research (${eligibleCount} eligible). Auto-chaining to draft generation (Job ID: ${jobId})...`
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

