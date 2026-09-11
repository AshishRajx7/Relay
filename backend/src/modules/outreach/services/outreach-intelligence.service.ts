import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';

export type ContactType = 'HR' | 'RECRUITER' | 'FOUNDER' | 'ENGINEERING' | 'GENERAL';

export interface CompanyResearchSnapshot {
  summary: string;
  products: string[];
  businessModel: string;
  techSignals: string[];
  hiringSignals: string[];
  recentInitiatives: string[];
}

export interface CompanyProfileSnapshot {
  companyName: string;
  website: string;
  industry: string;
  companySize: string;
  headquarters: string | null;
  foundingYear: number | null;
}

export interface OutreachIntelligenceOutput {
  companyProfile: CompanyProfileSnapshot;
  companyResearchSnapshot: CompanyResearchSnapshot;
  researchScore: number;
  contactType: ContactType;
  chosenProject: string;
  whyRelevant: string;
  whyCompany: string;
  whyMe: string;
  subject: string | null;
  emailBody: string | null;
  requiresManualReview: boolean;
}

@Injectable()
export class OutreachIntelligenceService {
  private readonly logger = new Logger(OutreachIntelligenceService.name);

  // Available candidate experiences for high-conviction proof point selection
  private readonly candidateExperiences = [
    {
      name: 'Activity Log Platform',
      domain: 'Audit logging, event-driven architecture, NestJS EventEmitter2, HR tech, compliance, standardizing audit trails across 15+ modules',
    },
    {
      name: 'BranchGuard Authorization System',
      domain: 'Multi-tenant authorization, branch-based access control, security bypass remediation, Redis caching for auth lookups',
    },
    {
      name: 'BullMQ Notification System',
      domain: 'Idempotent delivery, replay-safe processing, retry backoff, batched queue throughput, paginated in-app feeds, event streaming',
    },
    {
      name: 'Survey Platform',
      domain: 'Complex backend builders, audience targeting, survey analytics, zero-leak anonymity architecture',
    },
    {
      name: 'Redis Performance Optimization',
      domain: 'High-throughput caching, latency reduction, removing database query bottlenecks, PostgreSQL indexing',
    },
    {
      name: 'Sentinel Gateway',
      domain: 'Distributed API gateway, Node.js, Redis rate limiting, OpenTelemetry, Jaeger distributed tracing, Prometheus metrics',
    },
    {
      name: 'Minimal Workflow Engine',
      domain: 'Graph-based workflow orchestration, FastAPI, AsyncIO, WebSockets, directed acyclic graph task execution',
    },
    {
      name: "Founder Experience (D'Rons)",
      domain: 'Quick commerce, vendor onboarding, order workflows, payment integrations, zero-to-one product ownership',
    },
  ];

  constructor(private readonly aiProviderService: AIProviderService) {}

  /**
   * Deterministically classifies contact email into role type.
   */
  public classifyContact(email: string): ContactType {
    if (!email) return 'GENERAL';
    const localPart = email.split('@')[0].toLowerCase();

    // HR patterns
    if (/^(hr|careers|recruitment|jobs|people|talent-acq|hiring)$/.test(localPart) || localPart.startsWith('hr.') || localPart.startsWith('careers.')) {
      return 'HR';
    }

    // Recruiter patterns
    if (/^(recruiter|talent|sourcer|headhunter)$/.test(localPart) || localPart.includes('recruiter') || localPart.includes('sourcer')) {
      return 'RECRUITER';
    }

    // Founder patterns
    if (/^(founder|ceo|co-founder|owner|partner|president)$/.test(localPart) || localPart.includes('founder') || localPart.includes('ceo')) {
      return 'FOUNDER';
    }

    // Engineering patterns
    if (/^(engineering|cto|dev|tech|architect|lead|vpe|vp-eng|infra|backend)$/.test(localPart) || localPart.includes('cto') || localPart.includes('tech-lead')) {
      return 'ENGINEERING';
    }

    return 'GENERAL';
  }

  /**
   * Calculates research quality confidence score (0-100) based on verified data depth.
   */
  public calculateResearchScore(
    company: Partial<CompanyProfile>,
    snapshot: Partial<CompanyResearchSnapshot>,
    crawledPagesCount = 1,
  ): number {
    let score = 0;

    // 0-20: Domain discovery & name
    if (company.domain) score += 10;
    if (company.companyName && company.companyName !== company.domain) score += 10;

    // 20-40: Homepage analysis
    if (snapshot.summary && snapshot.summary.length > 30) score += 20;

    // 40-60: About & Industry understanding
    if (company.industry && company.industry !== 'Unknown') score += 10;
    if (snapshot.businessModel && snapshot.businessModel !== 'Unknown') score += 10;

    // 60-80: Product & Technology extraction
    if (snapshot.products && snapshot.products.length > 0) score += 10;
    if (snapshot.techSignals && snapshot.techSignals.length > 0) score += 10;

    // 80-90: Hiring signals & Careers page
    if (snapshot.hiringSignals && snapshot.hiringSignals.length > 0) score += 10;

    // 90-100: Recent initiatives & deep engineering alignment
    if (snapshot.recentInitiatives && snapshot.recentInitiatives.length > 0 && crawledPagesCount >= 2) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Transforms prospect email, company intelligence, and candidate profile into deep outreach intelligence.
   */
  async generateOutreachIntelligence(
    prospectEmail: string,
    companyProfile: CompanyProfile,
    candidateProfile: CandidateProfile,
    crawledMarkdown?: string,
  ): Promise<OutreachIntelligenceOutput> {
    const contactType = this.classifyContact(prospectEmail);
    const domain = companyProfile.domain;
    const companyName = companyProfile.companyName;

    // 1. Synthesize candidate profile facts
    const candidateSummary = candidateProfile.summary || '';
    const candidateSkills = Object.values(candidateProfile.skills || {}).flat().join(', ');
    const candidateProjects = candidateProfile.projects?.map((p) => `${p.name} (${p.techStack.join(', ')})`).join('; ') || '';

    // 2. AI Intelligence & Personalization Synthesis Prompt
    const systemPrompt = `You are a Principal AI Outreach Intelligence Architect.
Your goal is to perform deep technical research and synthesize a high-conviction, personalized cold outreach package.

Candidate Profile Facts (STRICT - ZERO HALLUCINATION):
- Name: ${candidateProfile.name || 'Ashish Raj'}
- Title: ${candidateProfile.title || 'Software Engineer'}
- Summary: ${candidateSummary}
- Core Skills: ${candidateSkills}
- Key Projects: ${candidateProjects}
- Real Experience:
  1. The Ninja Studio (Software Engineer & Backend Intern): Activity Log platform on NestJS EventEmitter2 across 15+ HR modules, Super Admin impersonation with AsyncLocalStorage audit trails, BranchGuard branch-based authorization, BullMQ idempotent notification engine with retry backoff, Redis caching.
  2. D'Rons (Founder & Full Stack Lead): Quick commerce platform, backend APIs, vendor workflows, payment integrations.
  3. Sentinel Gateway: Distributed API Gateway with Node.js, Redis rate limiting, OpenTelemetry, Jaeger, Prometheus.
  4. Minimal Workflow Engine: Graph-based DAG orchestration in FastAPI, AsyncIO, WebSockets.

Available Projects for "chosenProject":
- "Activity Log Platform"
- "BranchGuard Authorization System"
- "BullMQ Notification System"
- "Survey Platform"
- "Redis Performance Optimization"
- "Sentinel Gateway"
- "Minimal Workflow Engine"
- "Founder Experience (D'Rons)"

Instructions:
1. companyResearchSnapshot:
   - summary: 1-2 sentence core value proposition.
   - products: Specific product lines.
   - businessModel: e.g. "B2B SaaS", "Developer Infrastructure", "Fintech API", "Marketplace".
   - techSignals: Technologies or frameworks relevant to their stack.
   - hiringSignals: Engineering roles or technical focus areas.
   - recentInitiatives: Major product launches, scaling milestones, or platform expansions.
2. chosenProject & whyRelevant:
   - Pick the single strongest match among the candidate's available experiences.
   - whyRelevant: 1 sentence explaining the technical overlap with the company's architecture.
3. whyCompany:
   - 1-2 sentences referencing specific company research observations (no generic flattery).
4. whyMe:
   - 1-2 sentences summarizing candidate's production experience with NestJS, PostgreSQL, Redis, BullMQ, and distributed systems.
5. Email Generation (subject & emailBody):
   - Target recipient role: ${contactType}
   - STRICT LIMIT: Maximum 150 words.
   - Natural, human, peer-to-peer engineer tone.
   - NO AI buzzwords ("thrilled", "cutting-edge", "synergy", "paradigm").
   - Low friction call to action (e.g. "Open to a brief 10-minute chat this week?").

Output pure JSON conforming to this schema:
{
  "companyProfile": {
    "companyName": "${companyName}",
    "website": "${companyProfile.website || `https://${domain}`}",
    "industry": "${companyProfile.industry || 'Technology'}",
    "companySize": "${companyProfile.employeeRange || 'Unknown'}",
    "headquarters": "string or null",
    "foundingYear": 2020
  },
  "companyResearchSnapshot": {
    "summary": "string",
    "products": ["string"],
    "businessModel": "string",
    "techSignals": ["string"],
    "hiringSignals": ["string"],
    "recentInitiatives": ["string"]
  },
  "chosenProject": "BullMQ Notification System",
  "whyRelevant": "string",
  "whyCompany": "string",
  "whyMe": "string",
  "subject": "string",
  "emailBody": "string"
}`;

    const contextText = crawledMarkdown
      ? crawledMarkdown.slice(0, 12000)
      : `Company: ${companyName} (${domain})\nIndustry: ${companyProfile.industry}\nSummary: ${companyProfile.summary}\nProducts: ${companyProfile.products?.join(', ')}\nTechSignals: ${companyProfile.techSignals?.join(', ')}`;

    const aiResult = await this.aiProviderService.structuredComplete<any>({
      systemPrompt,
      userPrompt: `COMPANY CONTEXT:\n${contextText}`,
      feature: 'OUTREACH_GENERATION',
      maxTokens: 3000,
      temperature: 0.2,
      metadata: { domain, prospectEmail },
    });

    const data = aiResult.data;

    // 3. Compute research confidence score
    const pagesCrawled = crawledMarkdown ? 2 : 1;
    const researchScore = this.calculateResearchScore(
      companyProfile,
      data.companyResearchSnapshot || {},
      pagesCrawled,
    );

    // Rule 9: If researchScore < 40, do not generate final outreach email; flag manual review
    const requiresManualReview = researchScore < 40;
    const finalSubject = requiresManualReview ? null : (data.subject || null);
    const finalBody = requiresManualReview ? null : (data.emailBody || null);

    return {
      companyProfile: {
        companyName: data.companyProfile?.companyName || companyName,
        website: data.companyProfile?.website || companyProfile.website || `https://${domain}`,
        industry: data.companyProfile?.industry || companyProfile.industry || 'Technology',
        companySize: data.companyProfile?.companySize || companyProfile.employeeRange || 'Unknown',
        headquarters: data.companyProfile?.headquarters || null,
        foundingYear: typeof data.companyProfile?.foundingYear === 'number' ? data.companyProfile.foundingYear : null,
      },
      companyResearchSnapshot: {
        summary: data.companyResearchSnapshot?.summary || companyProfile.summary || '',
        products: Array.isArray(data.companyResearchSnapshot?.products) ? data.companyResearchSnapshot.products : companyProfile.products || [],
        businessModel: data.companyResearchSnapshot?.businessModel || 'B2B SaaS',
        techSignals: Array.isArray(data.companyResearchSnapshot?.techSignals) ? data.companyResearchSnapshot.techSignals : companyProfile.techSignals || [],
        hiringSignals: Array.isArray(data.companyResearchSnapshot?.hiringSignals) ? data.companyResearchSnapshot.hiringSignals : companyProfile.hiringSignals || [],
        recentInitiatives: Array.isArray(data.companyResearchSnapshot?.recentInitiatives) ? data.companyResearchSnapshot.recentInitiatives : companyProfile.recentInitiatives || [],
      },
      researchScore,
      contactType,
      chosenProject: data.chosenProject || 'BullMQ Notification System',
      whyRelevant: data.whyRelevant || 'Event-driven architecture and asynchronous message processing.',
      whyCompany: data.whyCompany || `The company's focus on scalable platforms aligns with my experience building event-driven backend systems.`,
      whyMe: data.whyMe || `Built production-grade authorization, notification, audit logging and workflow systems using NestJS, PostgreSQL, Redis and BullMQ.`,
      subject: finalSubject,
      emailBody: finalBody,
      requiresManualReview,
    };
  }
}
