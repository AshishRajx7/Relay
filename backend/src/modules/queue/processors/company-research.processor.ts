import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_COMPANY_RESEARCH,
  JOB_RESEARCH_COMPANY,
  CRAWL_PROVIDER_TOKEN,
} from '../../../common/constants/app.constants';
import { CompanyResearchJobData } from '../dto/company-research-job.dto';
import { CompanyResearchService } from '../../company-research/company-research.service';
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
    @Inject(CRAWL_PROVIDER_TOKEN)
    private readonly crawlProvider: ICrawlProvider,
    private readonly atsDiscoveryService: AtsDiscoveryService,
    private readonly qualityScorer: ResearchQualityScorerService,
    private readonly aiProviderService: AIProviderService,
  ) {
    super();
  }

  async process(job: Job<CompanyResearchJobData, any, string>): Promise<any> {
    this.logger.log(`[CompanyResearchProcessor] Processing BullMQ job ${job.id} for research ID: ${job.data.researchId} (${job.data.website})`);

    if (job.name !== JOB_RESEARCH_COMPANY) {
      this.logger.warn(`Unknown job name in ${QUEUE_COMPANY_RESEARCH}: ${job.name}`);
      return null;
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

      // 4. Extract structured intelligence with AI (optimized for future cold outreach)
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
}
