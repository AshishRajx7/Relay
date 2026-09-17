import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { CompanyProfile, CompanyEvidence, DeterministicCoverageMetrics } from '../entities/company-profile.entity';
import { CompanySource } from '../entities/company-source.entity';
import { CompanyEvidenceEntity, CompanyEvidenceCategory } from '../entities/company-evidence.entity';
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
    @InjectRepository(CompanySource)
    private readonly sourceRepository: Repository<CompanySource>,
    @InjectRepository(CompanyEvidenceEntity)
    private readonly evidenceRepository: Repository<CompanyEvidenceEntity>,
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
    const markdownContent = crawlResult.markdown || '';

    // If crawler failed, timed out, or returned blocked/empty content, trigger RESEARCH_RETRY_REQUIRED
    if (!crawlResult.success || !markdownContent || markdownContent.trim().length < 50) {
      this.logger.warn(`Crawler returned insufficient or failed content for domain ${normalizedDomain}. Marking RESEARCH_RETRY_REQUIRED.`);
      await this.markProspectsRetryRequired(normalizedDomain, crawlResult.errorMessage || 'Crawler returned empty or blocked content');
      throw new Error(`RESEARCH_RETRY_REQUIRED: Crawler was unable to extract valid content for ${normalizedDomain}: ${crawlResult.errorMessage || 'insufficient content'}`);
    }

    // 3. Upsert base CompanyProfile entity to obtain ID
    if (!profile) {
      profile = this.companyProfileRepository.create({
        domain: normalizedDomain,
      });
      profile = await this.companyProfileRepository.save(profile);
    }

    // 4. Save raw CompanySource with contentHash and provenance metadata
    const sourceHash = crypto.createHash('sha256').update(markdownContent).digest('hex');
    let source = await this.sourceRepository.findOne({ where: { companyProfileId: profile.id, url: targetUrl } });
    if (!source) {
      source = this.sourceRepository.create({
        companyProfileId: profile.id,
        url: targetUrl,
        section: 'HOMEPAGE',
        rawMarkdown: markdownContent,
        contentHash: sourceHash,
        retrievedAt: new Date(),
        httpStatus: 200,
        wordCount: crawlResult.wordCount || markdownContent.split(/\s+/).length,
      });
    } else {
      source.rawMarkdown = markdownContent;
      source.contentHash = sourceHash;
      source.retrievedAt = new Date();
      source.wordCount = crawlResult.wordCount || markdownContent.split(/\s+/).length;
    }
    const savedSource = await this.sourceRepository.save(source);

    // 5. AI Extraction via NVIDIA NIM
    const systemPrompt = `You are a Principal Company Intelligence Analyst.
Analyze the crawled web text for the company domain "${normalizedDomain}" and extract high-conviction structured company intelligence.

MANDATORY EVIDENCE REQUIREMENT:
For every extracted technology, hiring requirement, or product claim, you MUST include supporting evidence in the "evidence" array with the source page (e.g. "/careers", "/about", "homepage") and exact verbatim quote.
The quote MUST BE an exact contiguous snippet from the crawled text. NEVER fabricate or paraphrase a quote in the evidence array.

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
      "quote": "Exact verbatim contiguous text snippet proving the claim"
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

    // 6. Persist verified CompanyEvidenceEntity records (Zero synthesized quotes)
    await this.evidenceRepository.delete({ companyProfileId: profile.id });
    if (data.evidence && Array.isArray(data.evidence)) {
      const normalizedMarkdown = markdownContent.replace(/\s+/g, ' ');
      for (const item of data.evidence) {
        const cleanQuote = (item.quote || '').trim();
        if (!cleanQuote || cleanQuote.length < 10) continue;

        // Verify quote is genuinely in source markdown (verbatim source fact)
        const isExact = markdownContent.includes(cleanQuote);
        const isNormalizedMatch = !isExact && normalizedMarkdown.includes(cleanQuote.replace(/\s+/g, ' '));

        if (!isExact && !isNormalizedMatch) {
          this.logger.warn(`Rejecting synthesized company quote not present in crawled text: "${cleanQuote.slice(0, 50)}..."`);
          continue;
        }

        let category: CompanyEvidenceCategory = 'PRODUCT';
        const qLower = cleanQuote.toLowerCase();
        if (
          qLower.includes('aws') || qLower.includes('cloud') || qLower.includes('docker') ||
          qLower.includes('kubernetes') || qLower.includes('database') || qLower.includes('postgres') ||
          qLower.includes('redis') || qLower.includes('api') || qLower.includes('nest') || qLower.includes('react')
        ) {
          category = 'TECH_STACK';
        } else if (
          qLower.includes('compliance') || qLower.includes('security') || qLower.includes('hipaa') ||
          qLower.includes('soc2') || qLower.includes('regtech') || qLower.includes('audit')
        ) {
          category = 'CUSTOMER_PROBLEM';
        } else if (qLower.includes('scale') || qLower.includes('microservice') || qLower.includes('architecture')) {
          category = 'ARCHITECTURE';
        } else if (qLower.includes('hiring') || qLower.includes('role') || qLower.includes('engineer')) {
          category = 'INITIATIVE';
        }

        const evidenceEntity = this.evidenceRepository.create({
          companyProfileId: profile.id,
          sourceId: savedSource.id,
          sourceUrl: item.url || targetUrl,
          verbatimQuote: cleanQuote, // SOURCE FACT: verbatim contiguous substring
          atomicClaim: cleanQuote, // normalized paraphrase
          category,
          confidence: 1.0,
          isSourceFact: true,
        });
        await this.evidenceRepository.save(evidenceEntity);
      }
    }

    // 7. Calculate deterministic coverage metrics (Decoupled from relationship quality)
    const totalWords = crawlResult.wordCount || markdownContent.split(/\s+/).length;
    const hasSummary = Boolean(data.summary && data.summary.trim().length >= 20);
    const hasProducts = Boolean(data.products && data.products.length > 0);
    const hasTech = Boolean(data.techSignals && data.techSignals.length > 0);
    const hasHiring = Boolean(data.hiringSignals && data.hiringSignals.length > 0);

    const sections: Array<'HOMEPAGE' | 'ABOUT' | 'SERVICES' | 'CAREERS' | 'BLOG'> = ['HOMEPAGE'];
    if (crawlResult.subpagesCrawled) {
      for (const sub of crawlResult.subpagesCrawled) {
        if (sub.includes('about')) sections.push('ABOUT');
        if (sub.includes('career') || sub.includes('job')) sections.push('CAREERS');
        if (sub.includes('service')) sections.push('SERVICES');
        if (sub.includes('blog')) sections.push('BLOG');
      }
    }

    const gaps: string[] = [];
    if (!hasTech) gaps.push('Missing technical stack indicators');
    if (!hasHiring) gaps.push('Missing explicit hiring signals');
    if (!hasProducts) gaps.push('Missing named customer products');

    let coverageStatus: 'COMPLETE' | 'PARTIAL' | 'MINIMAL' | 'INSUFFICIENT' = 'MINIMAL';
    if (sections.length >= 2 && (hasTech || hasHiring)) {
      coverageStatus = 'COMPLETE';
    } else if (hasSummary && (hasProducts || hasTech)) {
      coverageStatus = 'PARTIAL';
    } else if (totalWords > 100) {
      coverageStatus = 'MINIMAL';
    } else {
      coverageStatus = 'INSUFFICIENT';
    }

    const coverageMetadata: DeterministicCoverageMetrics = {
      pagesAttemptedCount: 1 + (crawlResult.subpagesCrawled?.length || 0),
      pagesSucceededCount: 1 + (crawlResult.subpagesCrawled?.length || 0),
      pagesFailedCount: 0,
      totalWordCount: totalWords,
      sectionsAcquired: Array.from(new Set(sections)),
      hasCoreSummary: hasSummary,
      hasVerifiedProducts: hasProducts,
      hasTechnicalSignals: hasTech,
      hasHiringSignals: hasHiring,
      coverageGaps: gaps,
      coverageStatus,
    };

    // 8. Update CompanyProfile entity
    const researchScore = this.calculateResearchScore(data, true);
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
    profile.coverageMetadata = coverageMetadata;
    profile.researchScore = researchScore;
    profile.lastResearchedAt = new Date();

    const saved = await this.companyProfileRepository.save(profile);
    this.logger.log(`Researched and cached company: "${saved.companyName}" (${saved.domain}) | Score: ${saved.researchScore}/100 | Coverage: ${coverageStatus}`);

    // 9. Link all pending prospects
    await this.linkProspectsToProfile(saved);

    return saved;
  }

  /**
   * Marks prospects for a domain as RESEARCH_RETRY_REQUIRED upon crawler/network failure.
   */
  public async markProspectsRetryRequired(domain: string, errorReason: string): Promise<void> {
    const prospects = await this.prospectRepository.find({
      where: { domain },
    });
    for (const prospect of prospects) {
      if (prospect.researchStatus === ProspectResearchStatus.PENDING || prospect.researchStatus === ProspectResearchStatus.RESEARCHING) {
        prospect.researchStatus = ProspectResearchStatus.RESEARCH_RETRY_REQUIRED;
        prospect.error = errorReason;
        await this.prospectRepository.save(prospect);
      }
    }
  }

  /**
   * Links all prospects matching domain to this company profile and updates status.
   */
  private async linkProspectsToProfile(profile: CompanyProfile): Promise<void> {
    const prospects = await this.prospectRepository.find({
      where: { domain: profile.domain },
    });

    for (const prospect of prospects) {
      prospect.companyProfileId = profile.id;
      prospect.companyName = profile.companyName;
      prospect.researchStatus = ProspectResearchStatus.RESEARCHED;
      await this.prospectRepository.save(prospect);

      // Update campaign completed count
      await this.campaignRepository.increment(
        { id: prospect.campaignId },
        'completedProspects',
        1,
      );
    }
  }
}
