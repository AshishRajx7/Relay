import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyProfile, CompanyEvidence } from '../entities/company-profile.entity';
import { Prospect, ProspectResearchStatus } from '../../prospects/entities/prospect.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { ICrawlProvider } from '../providers/crawl-provider.interface';
import { CompanyDomainService } from './company-domain.service';
import { CRAWL_PROVIDER_TOKEN } from '../../../common/constants/app.constants';

export interface CompanyIntelligenceV2Data {
  companyName: string;
  website: string;
  industry: string;
  businessModel: string;
  companyStage: string;
  employeeRange: string;
  summary: string;
  products: string[];
  techSignals: string[];
  hiringSignals: string[];
  recentInitiatives: string[];
  evidence: Array<{ source: string; quote: string; url?: string; type?: string }>;
}

@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepository: Repository<CompanyProfile>,
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly aiProviderService: AIProviderService,
    private readonly domainService: CompanyDomainService,
    @Inject(CRAWL_PROVIDER_TOKEN)
    private readonly crawlProvider: ICrawlProvider,
  ) {}

  /**
   * Normalizes domain to canonical form using domain service
   */
  public normalizeDomain(rawDomainOrUrl: string): string {
    return this.domainService.normalizeCompanyDomain(rawDomainOrUrl);
  }

  /**
   * Checks if domain is a personal/free webmail provider.
   */
  public isFreeMailDomain(domain: string): boolean {
    const freeDomains = new Set([
      'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
      'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
      'protonmail.com', 'proton.me', 'mail.com', 'aol.com', 'zoho.com', 'yandex.com',
    ]);
    const root = this.domainService.extractRootDomain(domain);
    return freeDomains.has(root.toLowerCase());
  }

  /**
   * Calculates research confidence score strictly according to the formula (0-100):
   * 20 Domain Identified
   * 20 Company Summary
   * 20 Industry + Business Model
   * 20 Tech Signals
   * 10 Hiring Signals
   * 10 Recent Initiatives
   */
  public calculateResearchScore(data: Partial<CompanyIntelligenceV2Data>, hasDomain: boolean): number {
    let score = 0;

    // 20 Domain Identified
    if (hasDomain) score += 20;

    // 20 Company Summary
    if (data.summary && data.summary.trim().length >= 20) score += 20;

    // 20 Industry + Business Model
    if (data.industry && data.industry !== 'Unknown') score += 10;
    if (data.businessModel && data.businessModel !== 'Unknown') score += 10;

    // 20 Tech Signals
    if (data.techSignals && data.techSignals.length > 0) score += 20;

    // 10 Hiring Signals
    if (data.hiringSignals && data.hiringSignals.length > 0) score += 10;

    // 10 Recent Initiatives
    if (data.recentInitiatives && data.recentInitiatives.length > 0) score += 10;

    return Math.min(100, score);
  }

  /**
   * Finds existing cached company profile by normalized domain.
   */
  async findByDomain(domain: string): Promise<CompanyProfile | null> {
    const normalized = this.normalizeDomain(domain);
    return this.companyProfileRepository.findOne({ where: { domain: normalized } });
  }

  /**
   * Researches a company website (max 3 pages: homepage, /about, /careers),
   * extracts structured intelligence with strict evidence citations, scores research, and saves in PostgreSQL.
   */
  async researchAndSaveCompany(domain: string, preferredCompanyName?: string | null): Promise<CompanyProfile> {
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) {
      throw new Error(`Invalid domain provided: ${domain}`);
    }

    if (this.isFreeMailDomain(normalizedDomain)) {
      throw new Error(`Domain ${normalizedDomain} is a personal webmail provider and cannot be researched as a corporate entity.`);
    }

    // 1. Check existing cached profile (within 30 days)
    let profile = await this.findByDomain(normalizedDomain);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (profile && profile.summary && profile.lastResearchedAt && profile.lastResearchedAt > thirtyDaysAgo) {
      this.logger.log(`Using cached intelligence for company domain: ${normalizedDomain} (Score: ${profile.researchScore}/100)`);
      await this.linkProspectsToProfile(profile);
      return profile;
    }

    const targetUrl = `https://${normalizedDomain}`;
    this.logger.log(`Researching company domain: ${normalizedDomain} (Max 3 pages)`);

    // 2. Crawl homepage, /about, /careers (max 3 subpages)
    const crawlResult = await this.crawlProvider.crawl(targetUrl, 2);
    const markdownContent = crawlResult.markdown || `Company website: ${targetUrl}`;

    // 3. AI Extraction via NVIDIA NIM
    const systemPrompt = `You are a Principal Company Intelligence Analyst.
Analyze the crawled web text for the company domain "${normalizedDomain}" and extract high-conviction structured company intelligence.

MANDATORY EVIDENCE REQUIREMENT:
For every extracted technology, hiring requirement, or product claim, you MUST include supporting evidence in the "evidence" array with the source page (e.g. "/careers", "/about", "homepage") and exact or near-exact quote.

Output pure JSON conforming to this schema:
{
  "companyName": "Canonical brand name (e.g. Stripe, Linear)",
  "website": "https://${normalizedDomain}",
  "industry": "e.g. Developer Tools, Fintech, B2B SaaS, HealthTech",
  "businessModel": "e.g. B2B SaaS, Usage-based API, Marketplace, Enterprise Platform",
  "companyStage": "e.g. Seed, Series A/B, Scaleup (50-200), Enterprise",
  "employeeRange": "e.g. 1-10, 11-50, 51-200, 201-500, 500+",
  "summary": "2-3 concise sentences detailing core product, target audience, and primary value proposition",
  "products": ["Specific product or feature names"],
  "techSignals": ["Specific languages, frameworks, databases, and infrastructure tools"],
  "hiringSignals": ["Specific open engineering roles, tech requirements, or growth areas"],
  "recentInitiatives": ["Recent launches, expansions, compliance upgrades, or scaling milestones"],
  "evidence": [
    {
      "source": "homepage | /about | /careers",
      "url": "https://${normalizedDomain}/careers",
      "type": "CAREERS | ABOUT | HOMEPAGE",
      "quote": "Direct text snippet proving the claim"
    }
  ]
}`;

    const truncatedMarkdown = markdownContent.length > 20000 ? markdownContent.substring(0, 20000) + '\n...[TRUNCATED]' : markdownContent;

    const aiResult = await this.aiProviderService.structuredComplete<CompanyIntelligenceV2Data>({
      systemPrompt,
      userPrompt: `CRAWLED CONTENT FOR ${normalizedDomain}:\n\n${truncatedMarkdown}`,
      feature: 'COMPANY_RESEARCH',
      maxTokens: 3500,
      temperature: 0.1,
    });

    const data = aiResult.data;

    // 4. Calculate exact research score (0-100)
    const researchScore = this.calculateResearchScore(data, true);

    // 5. Upsert CompanyProfile entity
    if (!profile) {
      profile = this.companyProfileRepository.create({
        domain: normalizedDomain,
      });
    }

    profile.companyName = data.companyName || preferredCompanyName || normalizedDomain.split('.')[0];
    profile.website = data.website || targetUrl;
    profile.industry = data.industry || 'Technology';
    profile.businessModel = data.businessModel || 'B2B SaaS';
    profile.companyStage = data.companyStage || 'Scaleup';
    profile.employeeRange = data.employeeRange || '51-200';
    profile.summary = data.summary || null;
    profile.products = Array.isArray(data.products) ? data.products : [];
    profile.techSignals = Array.isArray(data.techSignals) ? data.techSignals : [];
    profile.hiringSignals = Array.isArray(data.hiringSignals) ? data.hiringSignals : [];
    profile.recentInitiatives = Array.isArray(data.recentInitiatives) ? data.recentInitiatives : [];
    profile.evidence = Array.isArray(data.evidence) ? data.evidence : [];
    profile.researchScore = researchScore;
    profile.lastResearchedAt = new Date();

    const saved = await this.companyProfileRepository.save(profile);
    this.logger.log(`Researched and cached company: "${saved.companyName}" (${saved.domain}) | Score: ${saved.researchScore}/100`);

    // 6. Link all pending prospects
    await this.linkProspectsToProfile(saved);

    return saved;
  }

  /**
   * Links all prospects matching domain to this company profile and updates status.
   */
  private async linkProspectsToProfile(profile: CompanyProfile): Promise<void> {
    const prospects = await this.prospectRepository.find({
      where: { domain: profile.domain },
    });

    const requiresManualReview = profile.researchScore < 40;

    for (const prospect of prospects) {
      prospect.companyProfileId = profile.id;
      prospect.companyName = profile.companyName;
      if (requiresManualReview) {
        prospect.researchStatus = ProspectResearchStatus.MANUAL_REVIEW;
      } else {
        prospect.researchStatus = ProspectResearchStatus.RESEARCHED;
      }
      await this.prospectRepository.save(prospect);

      // Update campaign completed count
      await this.campaignRepository.increment(
        { id: prospect.campaignId },
        'completedProspects',
        1,
      );

      if (requiresManualReview) {
        await this.campaignRepository.increment(
          { id: prospect.campaignId },
          'manualReviewCount',
          1,
        );
      }
    }
  }
}
