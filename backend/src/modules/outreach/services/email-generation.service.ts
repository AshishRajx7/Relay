import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Prospect, ContactType } from '../../prospects/entities/prospect.entity';
import { CandidateMatchingService, CandidateMatchResult, OutreachStrategy, PersonalizationTier } from './candidate-matching.service';
import { DraftQualityService, DraftQualityScoreResult } from './draft-quality.service';
import { EmailVariantType } from '../entities/email-draft-variant.entity';

export type RecipientClassificationType = 'TYPE_A_HR' | 'TYPE_B_ENGINEERING_MANAGER' | 'TYPE_C_FOUNDER_OR_CTO';

export interface RecipientClassification {
  type: RecipientClassificationType;
  title: string;
  primaryConcern: string;
  focus: string;
  technicalDepth: 'LOW' | 'MEDIUM' | 'MEDIUM-HIGH';
}

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
   * Classifies recipient into TYPE_A_HR, TYPE_B_ENGINEERING_MANAGER, or TYPE_C_FOUNDER_OR_CTO.
   */
  public classifyRecipient(contactType: ContactType, email: string): RecipientClassification {
    const emailLower = (email || '').toLowerCase();

    if (contactType === ContactType.HR || contactType === ContactType.RECRUITER) {
      return {
        type: 'TYPE_A_HR',
        title: 'Recruiter / Talent Acquisition',
        primaryConcern: 'Can this candidate be a fit?',
        focus: 'concise, role alignment, relevant skills, clear ask',
        technicalDepth: 'LOW',
      };
    }

    if (contactType === ContactType.FOUNDER) {
      return {
        type: 'TYPE_C_FOUNDER_OR_CTO',
        title: 'Founder / CTO',
        primaryConcern: 'Can this person create value quickly?',
        focus: 'ownership, execution, initiative, shipped work',
        technicalDepth: 'MEDIUM-HIGH',
      };
    }

    if (contactType === ContactType.ENGINEERING) {
      return {
        type: 'TYPE_B_ENGINEERING_MANAGER',
        title: 'Engineering Manager / Lead',
        primaryConcern: 'Can this person solve problems?',
        focus: 'technical credibility, relevant projects, impact',
        technicalDepth: 'MEDIUM',
      };
    }

    // Inspect email address patterns for GENERAL or PRODUCT
    if (/(hr|recruiter|talent|careers|jobs|people|hiring)/i.test(emailLower)) {
      return {
        type: 'TYPE_A_HR',
        title: 'Recruiter / Talent Acquisition',
        primaryConcern: 'Can this candidate be a fit?',
        focus: 'concise, role alignment, relevant skills, clear ask',
        technicalDepth: 'LOW',
      };
    }

    if (/(founder|ceo|owner|cofounder)/i.test(emailLower)) {
      return {
        type: 'TYPE_C_FOUNDER_OR_CTO',
        title: 'Founder / CTO',
        primaryConcern: 'Can this person create value quickly?',
        focus: 'ownership, execution, initiative, shipped work',
        technicalDepth: 'MEDIUM-HIGH',
      };
    }

    return {
      type: 'TYPE_B_ENGINEERING_MANAGER',
      title: 'Engineering Manager / Lead',
      primaryConcern: 'Can this person solve problems?',
      focus: 'technical credibility, relevant projects, impact',
      technicalDepth: 'MEDIUM',
    };
  }

  private getRecipientFirstName(email?: string): string {
    if (!email) return '';
    const local = email.split('@')[0];
    if (local.includes('.') || local.includes('_')) {
      const part = local.split(/[._]/)[0];
      if (
        part &&
        isNaN(Number(part)) &&
        part.length > 1 &&
        !['admin', 'careers', 'team', 'jobs', 'tech-lead', 'engineering', 'info', 'hello'].includes(part.toLowerCase())
      ) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
    } else if (
      local &&
      isNaN(Number(local)) &&
      local.length > 1 &&
      !['admin', 'careers', 'team', 'jobs', 'tech-lead', 'engineering', 'info', 'support', 'contact', 'hello'].includes(local.toLowerCase())
    ) {
      return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
    }
    return '';
  }

  /**
   * Generates 3 email variants around ONE consistent application narrative,
   * with slight emphasis adaptation based on recipient classification, scores all 3,
   * and selects the draft that maximizes interview conversion rate.
   */
  async generatePersonalizedDraft(
    prospect: Prospect,
    company: CompanyProfile,
    candidate: CandidateProfile,
  ): Promise<GeneratedDraftResult> {
    // 1. Compute Candidate Match & Recipient Classification
    const matchResult = this.candidateMatchingService.matchExperience(company, candidate);
    const contactType = prospect.contactType || ContactType.GENERAL;
    const recipientEmail = prospect.email;
    const recipientClassification = this.classifyRecipient(contactType, recipientEmail);

    const isBusinessOnly = matchResult.strategy === OutreachStrategy.BUSINESS_ONLY;
    const verifiedCompanyTechs = (company.techSignals || []).filter(Boolean);

    const strategyDirectives = isBusinessOnly
      ? `STRATEGY: BUSINESS_ONLY (CRITICAL GROUNDING CONSTRAINTS)
- Zero company technologies were identified in research.
- You are STRICTLY FORBIDDEN from guessing, assuming, or mentioning any programming languages, frameworks, databases, or infrastructure tools used by ${company.companyName}.
- NEVER say "Your company uses...", "I noticed your team builds with...", "your NestJS stack...", etc.
- Focus the opening observation exclusively on what ${company.companyName} does (${company.products?.join(', ') || company.summary || company.industry}).
- Frame candidate's engineering background purely in terms of candidate's own systems and problem-solving (e.g. "My experience building distributed systems and async queues..."), NEVER attributing candidate tools to ${company.companyName}.`
      : `STRATEGY: TECH_STACK_MATCH
- Verified Company Technologies: ${matchResult.matchedTechnologies.join(', ')}
- You may reference that ${company.companyName} utilizes ${matchResult.matchedTechnologies.join(', ')}.
- Do NOT attribute any other unverified technologies to ${company.companyName}.`;

    const candidateName = candidate?.name?.trim() || 'Ashish Raj';
    const candidateTitle = candidate?.title?.trim() || 'Software Engineer';

    // Candidate Education Extraction (V3: Graduated status)
    let candidateEducation = 'Bachelor of Technology in Electronics & Computer Engineering, Vellore Institute of Technology, Chennai (Graduated July 2026)';
    let candidateInstitution = 'VIT Chennai';
    if (Array.isArray(candidate?.education) && candidate.education.length > 0) {
      const edu = candidate.education[0];
      candidateInstitution = edu.institution?.trim() || 'VIT Chennai';
      const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
      const grad = edu.graduationDate ? ` (Graduated ${edu.graduationDate})` : ' (Graduated July 2026)';
      if (degreeField && edu.institution) {
        candidateEducation = `${degreeField} from ${edu.institution}${grad}`;
      }
    }

    // Candidate Current Experience Extraction (V3: The Ninja Studio)
    let candidateCurrentRole = 'Software Engineer at The Ninja Studio';
    if (Array.isArray(candidate?.experience) && candidate.experience.length > 0) {
      const exp = candidate.experience[0];
      if (exp.title && exp.company) {
        candidateCurrentRole = `${exp.title} at ${exp.company}`;
      }
    }

    const candidateSkillsList = [
      ...(candidate?.skills?.languages || []),
      ...(candidate?.skills?.frameworks || []),
      ...(candidate?.skills?.databases || []),
      ...(candidate?.skills?.tools || []),
    ].filter(Boolean);

    const candidateToolsString = candidateSkillsList.length > 0
      ? Array.from(new Set(candidateSkillsList)).join(', ')
      : 'NestJS, TypeScript, PostgreSQL, Redis, BullMQ, TypeORM, Docker, React, TanStack Query';

    const candidateToolsSummary = 'NestJS, PostgreSQL, Redis, TypeORM';

    // Recipient First Name Extraction for natural engineer-to-engineer greeting
    const recipientFirstName = this.getRecipientFirstName(recipientEmail);
    const greetingGuideline = recipientFirstName ? `Hi ${recipientFirstName},` : `Hi,`;

    // Company-Specific Relevance (Section 2, Max 1 sentence, Max 20 words) & Curated Achievements (Section 3, 2-3 items max)
    let companyRelevanceSentence = '';
    let curatedAchievements = '';

    const lowerDomain = (company.domain || '').toLowerCase();
    const lowerName = (company.companyName || '').toLowerCase();

    if (lowerDomain.includes('neon') || lowerName.includes('neon')) {
      companyRelevanceSentence = `Neon's work around serverless Postgres caught my attention because I've spent most of my time working with PostgreSQL systems.`;
      curatedAchievements = `At The Ninja Studio, I optimized PostgreSQL queries that were creating performance bottlenecks, added targeted indexes, and built Redis-based authorization caching.`;
    } else if (lowerDomain.includes('clickhouse') || lowerName.includes('clickhouse')) {
      companyRelevanceSentence = `ClickHouse's focus on high-performance analytical processing is especially interesting to me.`;
      curatedAchievements = `At The Ninja Studio, I optimized PostgreSQL query execution, eliminated inefficient joins, and engineered caching layers for high-throughput reads.`;
    } else if (lowerDomain.includes('resend') || lowerName.includes('resend')) {
      companyRelevanceSentence = `Resend's work on developer-first email infrastructure caught my attention.`;
      curatedAchievements = `At The Ninja Studio, I designed BullMQ notification pipelines with retry handling, batched processing, and idempotent delivery guarantees.`;
    } else if (lowerDomain.includes('linear') || lowerName.includes('linear')) {
      companyRelevanceSentence = `Linear's emphasis on product quality and engineering velocity resonates with how I like building software.`;
      curatedAchievements = `At The Ninja Studio, I built a company-wide audit logging platform across 15+ modules and implemented low-latency Redis caching for branch access.`;
    } else if (lowerDomain.includes('posthog') || lowerName.includes('posthog')) {
      companyRelevanceSentence = `PostHog's focus on developer product analytics and event telemetry is especially interesting to me.`;
      curatedAchievements = `At The Ninja Studio, I built an event-driven audit logging platform across 15+ modules using EventEmitter2 and engineered telemetry data pipelines.`;
    } else if (lowerDomain.includes('supabase') || lowerName.includes('supabase')) {
      companyRelevanceSentence = `Supabase's focus on developer tooling and PostgreSQL is especially interesting to me.`;
      curatedAchievements = `At The Ninja Studio, I built a company-wide audit logging platform across 15+ modules, implemented Redis-based authorization caching, and optimized PostgreSQL query performance.`;
    } else if (lowerDomain.includes('sourcefuse') || lowerName.includes('sourcefuse')) {
      companyRelevanceSentence = `SourceFuse's focus on modern cloud engineering and product delivery caught my attention.`;
      curatedAchievements = `At The Ninja Studio, I built tenant-scoped authorization (BranchGuard) and optimized database query performance. Before this, I founded D'Rons, shipping an end-to-end commerce platform.`;
    } else {
      companyRelevanceSentence = `${company.companyName}'s work building platform infrastructure is especially interesting to me.`;
      curatedAchievements = `At The Ninja Studio, I built a company-wide audit logging platform across 15+ modules, implemented Redis-based authorization caching, and optimized PostgreSQL query performance.`;
    }

    // 2. System Prompt: Relay Outreach V4 — Human-Like Job Application Emails
    const systemPrompt = `# Relay Outreach V4 — Human-Like Job Application Emails

## Primary Objective
The goal is NOT to impress.
The goal is NOT to summarize the candidate's entire career.
The goal is NOT to maximize personalization score.
The goal is to maximize:
1. Resume opens
2. Recruiter replies
3. Interview conversions

Every sentence that does not increase those metrics should be removed.

## Hard Length Limit
Target: 70-120 words.
Maximum: 140 words.
Never exceed 140 words.
The entire email must be readable in under 15 seconds.

## Human Writing Rule
The email must sound like something a real engineer typed in Gmail in under 2 minutes.
It must NOT read like:
- a cover letter
- a blog post
- a LinkedIn post
- an AI generated summary
- a recruiter template

Avoid AI-style phrases (STRICTLY FORBIDDEN):
- Additionally
- Furthermore
- Notably
- I've had the opportunity to
- I've observed that
- My experience aligns with
- I've owned and maintained
- I'm particularly drawn to
- I've built and maintained several production systems

Avoid networking phrases (STRICTLY FORBIDDEN):
- I'd love to chat
- Let's connect
- Thought I'd reach out
- Happy to brainstorm
- Would love your thoughts
- I can help you
- I admire
- I'm inspired by
- I've been following
- I'm excited about
- I love what you're building
- Hope you're doing well
- Hope this email finds you well
- Explore synergies
- Rockstar engineer
- World-class team
- Cutting-edge
- Game-changing
- Revolutionary

## Email Structure
Exactly 4 short sections separated by blank lines.

## Section 1: Introduction (Maximum 2 sentences)
${greetingGuideline}

I graduated from VIT Chennai in July 2026 and currently work as a Software Engineer at The Ninja Studio. I'm reaching out regarding Backend Engineer opportunities at ${company.companyName}.

## Section 2: Company Relevance (Maximum 1 sentence, Maximum 20 words)
Only one sentence. Never two paragraphs. Never company praise. Never fanboy language.
Target sentence:
"${companyRelevanceSentence}"

## Section 3: Proof of Capability (Maximum 2 sentences, ONLY 2-3 strongest achievements)
Do NOT dump all experience. Select ONLY 2-3 strongest achievements.
Target achievements:
"${curatedAchievements}"

## Section 4: CTA (Always exact - No variations)
I've attached my resume and would appreciate consideration for any current or future backend engineering openings.

Thank you for your time.

${candidateName}

## Personalization Rules
Company content must be less than 20% of the email.
Candidate content must be more than 80%.
The email is about the candidate, not the company.

## Candidate Source of Truth
Name: ${candidateName}
Education: B.Tech Electronics & Computer Engineering, VIT Chennai (Graduated July 2026)
Current Role: Software Engineer at The Ninja Studio
Past Experience: Backend Engineering Intern at The Ninja Studio (Feb 2026 - Aug 2026); Founder & Full Stack Lead at D'Rons (2024 - 2025)
Never mention: Goklaim, student looking for opportunities, intern at Goklaim, final year student, pursuing degree. Candidate has already graduated.

## Subject Rules
Keep subjects short:
Backend Engineer Application — ${candidateName}
Software Engineer Application — ${candidateName}
Application for Backend Engineering Opportunities
Interested in Backend Engineering Opportunities

Bad subjects:
Postgres at Scale, Engineering Roadmap Discussion, Audit Trails + PostgreSQL, Scaling Authorization Systems

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
  "whyCompany": "1 sentence relevance summary",
  "whyMe": "1 sentence capability summary",
  "whyNow": "1 sentence role intent",
  "confidenceLevel": "HIGH | MEDIUM | LOW"
}

CRITICAL: Return ONLY a single raw JSON object matching the exact schema above. Do NOT output freeform markdown or plain text. Your output MUST start with "{" and end with "}".`;

    const aiResult = await this.aiProviderService.structuredComplete<RawAiMultiVariantResponse>({
      systemPrompt,
      userPrompt: `Generate the JSON object containing technicalVariant, startupVariant, and directVariant for a concise, human-like job application email (70-120 words, max 140 words) authored by software engineer ${candidateName} applying for Backend Engineer opportunities at ${company.companyName} (${company.domain}), sent to ${recipientClassification.title} (${recipientEmail}). Greeting must be "${greetingGuideline}". Output MUST start with "{" and end with "}".`,
      feature: 'OUTREACH_GENERATION',
      maxTokens: 1500,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    const exactCta = `I've attached my resume and would appreciate consideration for any current or future backend engineering openings.\n\nThank you for your time.\n\n${candidateName}`;

    // Helper to sanitize each generated variant against hard V4 guardrails
    const sanitizeVariant = (v: { subject?: string; body?: string }, defaultSubject: string) => {
      let subject = v?.subject?.trim() || defaultSubject;
      let body = v?.body?.trim() || '';

      // 1. Mandatory subject keyword check & blog-title check
      if (
        !DraftQualityService.hasMandatorySubjectKeyword(subject) ||
        DraftQualityService.isForbiddenSubject(subject)
      ) {
        subject = defaultSubject;
      }

      // 2. Forbidden phrases check and replacement
      const forbiddenPhrase = this.draftQualityService.hasForbiddenPhrase(body);
      if (forbiddenPhrase) {
        body = body.replace(
          new RegExp(forbiddenPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          '',
        );
      }

      // 3. Ensure standard 4-section structure and enforce hard length limit (<= 140 words)
      const intro = `${greetingGuideline}\n\nI graduated from VIT Chennai in July 2026 and currently work as a Software Engineer at The Ninja Studio. I'm reaching out regarding Backend Engineer opportunities at ${company.companyName}.`;
      const relevance = companyRelevanceSentence;
      const achievements = curatedAchievements;

      // Check if body already has the core elements, or construct the canonical clean text
      const currentWordCount = body.split(/\s+/).filter(Boolean).length;
      if (
        currentWordCount > 140 ||
        currentWordCount < 60 ||
        !body.includes('The Ninja Studio') ||
        !body.includes('VIT Chennai') ||
        !body.includes('July 2026')
      ) {
        body = `${intro}\n\n${relevance}\n\n${achievements}\n\n${exactCta}`;
      } else {
        // Enforce the exact Section 4 CTA
        const ctaStart = body.indexOf("I've attached my resume");
        if (ctaStart !== -1) {
          body = body.slice(0, ctaStart).trim() + `\n\n${exactCta}`;
        } else {
          body = body.trim() + `\n\n${exactCta}`;
        }
      }

      // Clean up multiple spaces or empty lines
      body = body.replace(/\n{3,}/g, '\n\n').trim();

      return { subject, body };
    };

    const defaultTier1Subject = `Backend Engineer Application — ${candidateName}`;

    const rawVariants: Array<{ type: EmailVariantType; subject: string; body: string }> = [
      {
        type: EmailVariantType.TECHNICAL,
        ...sanitizeVariant(data.technicalVariant, defaultTier1Subject),
      },
      {
        type: EmailVariantType.STARTUP,
        ...sanitizeVariant(
          data.startupVariant,
          `Software Engineer Application — ${candidateName}`,
        ),
      },
      {
        type: EmailVariantType.DIRECT,
        ...sanitizeVariant(
          data.directVariant,
          `Application for Backend Engineering Opportunities`,
        ),
      },
    ];

    // 3. Assemble and score all 3 variants individually
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

    // Score each variant to maximize RECRUITER RESPONSE RATE (conversionScore), penalizing hallucinations & spam
    let bestIndex = 0;
    let bestScore = -999;

    for (let i = 0; i < evaluatedVariants.length; i++) {
      const v = evaluatedVariants[i];
      const hasHallucination =
        v.quality.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION') ||
        v.quality.flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION') ||
        v.quality.flags.includes('UNVERIFIED_PRODUCT_CLAIM');

      const groundingPenalty = hasHallucination ? 50 : 0;

      // Recipient alignment bonus: slight preference based on recipient classification
      let recipientBonus = 0;
      if (recipientClassification.type === 'TYPE_A_HR' && v.variantType === EmailVariantType.DIRECT) {
        recipientBonus = 5;
      } else if (
        recipientClassification.type === 'TYPE_B_ENGINEERING_MANAGER' &&
        v.variantType === EmailVariantType.TECHNICAL
      ) {
        recipientBonus = 5;
      } else if (
        recipientClassification.type === 'TYPE_C_FOUNDER_OR_CTO' &&
        v.variantType === EmailVariantType.STARTUP
      ) {
        recipientBonus = 5;
      }

      // Relay Outreach V2: Winner optimizes RECRUITER RESPONSE RATE (conversionScore / confidenceScore)
      const conversionScore = v.quality.conversionScore ?? v.quality.confidenceScore;
      const compositeScore =
        conversionScore + recipientBonus - v.quality.spamRiskScore - groundingPenalty;

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
      whyCompany:
        data.whyCompany ||
        `${company.companyName} is building scalable platforms with modern architecture.`,
      whyMe:
        data.whyMe ||
        (matchResult.matchedTechnologies.length > 0
          ? `Experienced in building ${matchResult.chosenProject} with ${matchResult.matchedTechnologies.join(', ')}.`
          : `Experienced in engineering ${matchResult.chosenProject} for distributed systems.`),
      whyNow: data.whyNow || null,
      whyRelevant: matchResult.whyRelevant,
      confidenceLevel: data.confidenceLevel || 'HIGH',
    };
  }
}

