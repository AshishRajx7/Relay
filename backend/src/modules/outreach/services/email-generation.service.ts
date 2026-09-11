import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Prospect, ContactType } from '../../prospects/entities/prospect.entity';
import { CandidateMatchingService, CandidateMatchResult } from './candidate-matching.service';
import { DraftQualityService, DraftQualityScoreResult } from './draft-quality.service';
import { EmailVariantType } from '../entities/email-draft-variant.entity';

export interface EvaluatedEmailVariant {
  variantType: EmailVariantType;
  subject: string;
  body: string;
  wordCount: number;
  quality: DraftQualityScoreResult;
  isSelected: boolean;
}

export interface GeneratedDraftResult {
  subject: string;
  body: string;
  selectedVariantType: EmailVariantType;
  variants: EvaluatedEmailVariant[];
  matchResult: CandidateMatchResult;
  quality: DraftQualityScoreResult;
  whyCompany: string;
  whyMe: string;
  whyNow: string | null;
  whyRelevant: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface RawAiMultiVariantResponse {
  technicalVariant: { subject: string; body: string };
  startupVariant: { subject: string; body: string };
  directVariant: { subject: string; body: string };
  whyCompany: string;
  whyMe: string;
  whyNow: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

@Injectable()
export class EmailGenerationService {
  private readonly logger = new Logger(EmailGenerationService.name);

  constructor(
    private readonly aiProviderService: AIProviderService,
    private readonly candidateMatchingService: CandidateMatchingService,
    private readonly draftQualityService: DraftQualityService,
  ) {}

  /**
   * Generates 3 email variants (Technical, Startup, Direct), scores all 3, and selects the highest-scoring draft.
   */
  async generatePersonalizedDraft(
    prospect: Prospect,
    company: CompanyProfile,
    candidate: CandidateProfile,
  ): Promise<GeneratedDraftResult> {
    // 1. Compute Candidate Match
    const matchResult = this.candidateMatchingService.matchExperience(company, candidate);
    const contactType = prospect.contactType || ContactType.GENERAL;
    const recipientEmail = prospect.email;

    // 2. Multi-variant generation prompt
    const systemPrompt = `You are a Principal AI Outreach Writer crafting authentic, peer-to-peer cold emails for software engineers.

CANDIDATE FACTS (STRICT - NO HALLUCINATIONS):
- Name: ${candidate.name || 'Ashish Raj'}
- Title: ${candidate.title || 'Software Engineer'}
- Chosen Proof Point: ${matchResult.chosenProject}
- Relevance Summary: ${matchResult.whyRelevant}
- Production Stack: NestJS, PostgreSQL, Redis, BullMQ, TypeScript, Docker, OpenTelemetry

TARGET COMPANY:
- Company Name: ${company.companyName}
- Domain: ${company.domain}
- Industry: ${company.industry}
- Business Model: ${company.businessModel || 'B2B SaaS'}
- Summary: ${company.summary}
- Products: ${company.products?.join(', ')}
- Tech Signals: ${company.techSignals?.join(', ')}
- Hiring Signals: ${company.hiringSignals?.join(', ')}
- Recent Initiatives: ${company.recentInitiatives?.join(', ')}
- Recipient Persona: ${contactType} (${recipientEmail})

HARD RULES:
1. Every variant MUST be under 150 words (Direct variant strictly under 80 words).
2. Sound like an engineer reaching out to a peer. No sales pitches, no marketing fluff, no excessive flattery, no AI buzzwords ("thrilled", "revolutionize", "cutting-edge").
3. Structure: 1 Opening observation -> 2 Why company -> 3 Relevant proof point -> 4 Low-friction CTA.

Generate 3 Distinct Variants:
- "technicalVariant": Focus on architecture, concurrency, distributed queues, performance, and infrastructure.
- "startupVariant": Focus on extreme ownership, 0-to-1 execution, velocity, and founder agency.
- "directVariant": Ultra-concise, punchy, under 80 words.

Output pure JSON conforming to this schema:
{
  "technicalVariant": {
    "subject": "string",
    "body": "string"
  },
  "startupVariant": {
    "subject": "string",
    "body": "string"
  },
  "directVariant": {
    "subject": "string",
    "body": "string"
  },
  "whyCompany": "1 sentence research-backed reason",
  "whyMe": "1 sentence proof-point summary",
  "whyNow": "1 sentence hiring or growth signal",
  "confidenceLevel": "HIGH | MEDIUM | LOW"
}`;

    const aiResult = await this.aiProviderService.structuredComplete<RawAiMultiVariantResponse>({
      systemPrompt,
      userPrompt: `Generate outreach for ${company.companyName} (${company.domain}) to ${contactType} contact ${recipientEmail}`,
      feature: 'OUTREACH_GENERATION',
      maxTokens: 3000,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    // 3. Assemble and score all 3 variants individually
    const rawVariants: Array<{ type: EmailVariantType; subject: string; body: string }> = [
      {
        type: EmailVariantType.TECHNICAL,
        subject: data.technicalVariant?.subject || `Backend & distributed systems background`,
        body: data.technicalVariant?.body || '',
      },
      {
        type: EmailVariantType.STARTUP,
        subject: data.startupVariant?.subject || `Building high-velocity systems at ${company.companyName}`,
        body: data.startupVariant?.body || '',
      },
      {
        type: EmailVariantType.DIRECT,
        subject: data.directVariant?.subject || `Quick question re: backend engineering`,
        body: data.directVariant?.body || '',
      },
    ];

    const evaluatedVariants: EvaluatedEmailVariant[] = rawVariants.map((v) => {
      const wordCount = v.body.split(/\s+/).filter(Boolean).length;
      const quality = this.draftQualityService.evaluateDraft(v.subject, v.body, company, matchResult);
      return {
        variantType: v.type,
        subject: v.subject,
        body: v.body,
        wordCount,
        quality,
        isSelected: false,
      };
    });

    // Score each variant and pick the highest composite score (relevance + personalization - spamRisk)
    let bestIndex = 0;
    let bestScore = -999;

    for (let i = 0; i < evaluatedVariants.length; i++) {
      const v = evaluatedVariants[i];
      const compositeScore = v.quality.confidenceScore + v.quality.personalizationScore - v.quality.spamRiskScore;
      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestIndex = i;
      }
    }

    evaluatedVariants[bestIndex].isSelected = true;
    const bestVariant = evaluatedVariants[bestIndex];

    return {
      subject: bestVariant.subject,
      body: bestVariant.body,
      selectedVariantType: bestVariant.variantType,
      variants: evaluatedVariants,
      matchResult,
      quality: bestVariant.quality,
      whyCompany: data.whyCompany || `${company.companyName} is building scalable platforms with modern architecture.`,
      whyMe: data.whyMe || `Experienced in building ${matchResult.chosenProject} with ${matchResult.matchedTechnologies.join(', ')}.`,
      whyNow: data.whyNow || null,
      whyRelevant: matchResult.whyRelevant,
      confidenceLevel: data.confidenceLevel || 'HIGH',
    };
  }
}
