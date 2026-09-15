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
    options?: { styleIndex?: number },
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

    // Candidate Education Extraction (Graduation not mentioned in outreach unless requested)
    let candidateEducation = 'Bachelor of Technology in Electronics & Computer Engineering, Vellore Institute of Technology, Chennai';
    let candidateInstitution = 'VIT Chennai';
    if (Array.isArray(candidate?.education) && candidate.education.length > 0) {
      const edu = candidate.education[0];
      candidateInstitution = edu.institution?.trim() || 'VIT Chennai';
      const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
      if (degreeField && edu.institution) {
        candidateEducation = `${degreeField} from ${edu.institution}`;
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

    // Anti-Template Rotation: 10 Distinct Opening Styles and 10 Distinct Closing Styles
    let openingIndex: number;
    let closingIndex: number;

    if (options?.styleIndex !== undefined) {
      openingIndex = ((options.styleIndex % 10) + 10) % 10;
      closingIndex = (((options.styleIndex + 3) % 10) + 10) % 10;
    } else {
      const seed = (recipientEmail + (company.domain || '')).split('').reduce((acc, c, idx) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
      openingIndex = seed % 10;
      closingIndex = (Math.floor(seed / 10) + 3) % 10;
    }

    const openingStyles = [
      `${greetingGuideline}\n\nI'm Ashish, a backend engineer working on distributed services at The Ninja Studio.`,
      `${greetingGuideline}\n\nMy name is Ashish and I work on backend systems and infrastructure at The Ninja Studio.`,
      `${greetingGuideline}\n\nI'm a software engineer at The Ninja Studio focused on backend systems and databases.`,
      `${greetingGuideline}\n\nI've been working on backend services and queue infrastructure at The Ninja Studio.`,
      `${greetingGuideline}\n\nI'm Ashish, currently building distributed backend services and APIs at The Ninja Studio.`,
      `${greetingGuideline}\n\nI build backend systems and distributed services at The Ninja Studio.`,
      `${greetingGuideline}\n\nI'm a backend engineer building scalable data pipelines and backend systems at The Ninja Studio.`,
      `${greetingGuideline}\n\nI'm Ashish, a software engineer building core backend infrastructure at The Ninja Studio.`,
      `${greetingGuideline}\n\nI work on backend systems, APIs, and database performance at The Ninja Studio.`,
      `${greetingGuideline}\n\nI've spent the past year building backend systems and services at The Ninja Studio.`,
    ];
    const rotatedOpening = openingStyles[openingIndex];

    const resumeMentionStyles = [
      `Attached my resume in case it's useful.`,
      `I've attached my resume for reference.`,
      `Attached my resume below in case you're interested.`,
      `I've attached my resume here for context.`,
      `Attached my resume in case your team finds it helpful.`,
      `I've attached my resume below.`,
      `My resume is attached for reference.`,
      `Attached my resume here.`,
      `I've attached my resume for quick review.`,
      `Resume is attached below for context.`,
    ];
    const rotatedResume = resumeMentionStyles[closingIndex];

    const signoffStyles = [
      `Best,\nAshish`,
      `Thanks,\nAshish`,
      `Regards,\nAshish Raj`,
      `Best regards,\nAshish`,
      `Ashish Raj`,
      `Best,\nAshish Raj`,
      `Thanks,\nAshish Raj`,
      `Best regards,\nAshish Raj`,
      `Regards,\nAshish`,
      `Cheers,\nAshish`,
    ];
    const rotatedSignoff = signoffStyles[closingIndex];

    const rotatedClosing = `${rotatedResume}\n\n${rotatedSignoff}`;

    // Conversational Company Sentence (conversational, not marketing copy, NO "very relevant" or "directly relevant") & Single Relevant Achievement (ONLY ONE)
    let companyRelevanceSentence = '';
    let singleAchievement = '';

    const lowerDomain = (company.domain || '').toLowerCase();
    const lowerName = (company.companyName || '').toLowerCase();

    if (lowerDomain.includes('neon') || lowerName.includes('neon')) {
      companyRelevanceSentence = `I spend most of my time working with PostgreSQL, so Neon felt like a natural company to reach out to.`;
      singleAchievement = `At The Ninja Studio, I optimized PostgreSQL queries that were bottlenecking production and added targeted indexes that cut latency significantly.`;
    } else if (lowerDomain.includes('clickhouse') || lowerName.includes('clickhouse')) {
      companyRelevanceSentence = `I've spent a lot of time thinking about database performance, which is why ClickHouse stood out.`;
      singleAchievement = `At The Ninja Studio, I redesigned our reporting database queries by removing heavy joins and adding Redis caching for high-throughput reads.`;
    } else if (lowerDomain.includes('resend') || lowerName.includes('resend')) {
      companyRelevanceSentence = `I've built background delivery pipelines myself and really like how developer-friendly Resend made email.`;
      singleAchievement = `At The Ninja Studio, I built our background notification pipeline using BullMQ with automated retry handling and idempotent delivery guarantees.`;
    } else if (lowerDomain.includes('linear') || lowerName.includes('linear')) {
      companyRelevanceSentence = `I care a lot about high-performance software and craftsmanship, which is what drew me to Linear.`;
      singleAchievement = `At The Ninja Studio, I built a centralized audit logging platform across 15+ modules with sub-millisecond overhead.`;
    } else if (lowerDomain.includes('posthog') || lowerName.includes('posthog')) {
      companyRelevanceSentence = `I've been following how you approach open telemetry and product analytics, and really appreciate how transparently your team builds.`;
      singleAchievement = `At The Ninja Studio, I engineered an event-driven audit logging system handling asynchronous telemetry across 15+ modules.`;
    } else if (lowerDomain.includes('supabase') || lowerName.includes('supabase')) {
      companyRelevanceSentence = `Most of my database work is in Postgres and auth systems, so I've naturally followed Supabase for a while.`;
      singleAchievement = `At The Ninja Studio, I built tenant-scoped authorization (BranchGuard) with Redis caching to eliminate redundant database checks.`;
    } else if (lowerDomain.includes('sourcefuse') || lowerName.includes('sourcefuse')) {
      companyRelevanceSentence = `Most of my work revolves around cloud backend infrastructure, so SourceFuse felt like a natural team to check out.`;
      singleAchievement = `At The Ninja Studio, I built tenant-scoped authorization (BranchGuard) with Redis caching and cut query latency significantly.`;
    } else if (lowerDomain.includes('perennial') || lowerName.includes('perennial')) {
      companyRelevanceSentence = `Most of my work revolves around backend infrastructure and enterprise services, so Perennial felt worth reaching out to.`;
      singleAchievement = `At The Ninja Studio, I built a centralized audit logging platform across 15+ modules and implemented Redis-based authorization caching.`;
    } else if (lowerDomain.includes('ibhubs') || lowerName.includes('ibhubs') || lowerDomain.includes('ib hubs') || lowerName.includes('ib hubs')) {
      companyRelevanceSentence = `I've spent most of my time building platform infrastructure, so iB Hubs felt like an interesting team to look at.`;
      singleAchievement = `At The Ninja Studio, I built our background notification pipeline using BullMQ with automated retry handling and idempotent delivery guarantees.`;
    } else {
      companyRelevanceSentence = `Most of my work revolves around backend infrastructure and distributed systems, so ${company.companyName} stood out to me.`;
      singleAchievement = `At The Ninja Studio, I built a centralized audit logging platform across 15+ modules and implemented Redis-based authorization caching.`;
    }

    // 2. System Prompt: Relay Outreach V5 — Human Engineer Emails
    const systemPrompt = `# RELAY OUTREACH V5 — HUMAN ENGINEER EMAILS

You are generating job application emails, NOT sales outreach, networking emails, cover letters, recruiting messages, or marketing copy.
The output must feel like a software engineer personally wrote a short email from Gmail after finding a company they would genuinely like to work at.

## PRIMARY GOAL
The email has only four jobs:
1. Introduce the candidate.
2. Explain why this specific company was chosen.
3. Mention ONE relevant accomplishment.
4. Mention that the resume is attached.
Nothing else.

## LENGTH REQUIREMENTS
- Target: 55-90 words
- Hard maximum: 100 words
- If the email exceeds 100 words, regenerate.
- The entire email should be readable in under 15 seconds.

## VOICE REQUIREMENTS
- A backend engineer sending a real email to another engineer, founder, CTO, hiring manager, or recruiter.
- Casually professional, natural, simple, direct.
- NOT like ChatGPT, Claude, a recruiter, salesperson, marketing writer, or networking expert.

## ABSOLUTELY FORBIDDEN PHRASES (Must NEVER appear in the email)
- caught my attention
- aligns with my experience / aligns with my background / aligns with
- relevant to my experience / relevant to my background / very relevant / directly relevant
- particularly drawn to
- resonates with me / resonates with how / resonates with
- excited about
- reaching out regarding / reaching out about
- would appreciate consideration
- current or future opportunities / current or future openings / current or future / current and future
- backend openings / engineering openings
- opportunity to discuss
- would love to chat / let's connect / happy to connect / happy to chat
- introductory conversation / brief call / quick call / coffee chat
- explore synergies
- looking forward to hearing from you

## NO AI WRITING PATTERNS
- Additionally / Furthermore / Moreover / Notably / Importantly
- In my current role
- I have had the opportunity to / I have owned and maintained / I have successfully
- I am particularly interested in / I am excited to apply / I am writing to express interest

## COMPANY SENTENCE RULE
The company sentence must sound conversational:
"I spend most of my time working with PostgreSQL, so Neon felt like a natural company to reach out to."
"I've spent a lot of time thinking about database performance, which is why ClickHouse stood out."
Do not sound like marketing copy. Do not sound like a website summary. Do not repeat company slogans.

## ACHIEVEMENT RULE
Mention EXACTLY ONE achievement. Never mention multiple achievements. Never list accomplishments. Never stack technologies.
Only ONE proof point.

## GRADUATION RULE
Do NOT mention: VIT Chennai, Graduation year, CGPA, Student status. Lead with professional experience.

## CTA RULE
Do NOT ask for: a call, a meeting, a chat, a conversation, a reply, time.
The email ends naturally:
"Attached my resume in case it's useful." or "I've attached my resume for reference."
Then sign off.

## Structure & Rotation
Exactly 4 short paragraphs separated by blank lines:

1. Opening (Natural, non-templated engineer intro):
${rotatedOpening}

2. Company Context (Conversational, ~15-20 words):
${companyRelevanceSentence}

3. Single Relevant Achievement (ONLY ONE achievement, ~15-20 words):
${singleAchievement}

4. Closing & Resume Mention (Natural engineer signoff):
${rotatedClosing}

## Candidate Source of Truth
Name: ${candidateName}
Current Role: Software Engineer at The Ninja Studio
Never mention: Goklaim, student, intern at Goklaim, final year student.

## Subject Guidelines
Keep subjects short and human:
- Backend Engineer - ${candidateName}
- Software Engineer - ${candidateName}
- ${candidateName} - Backend Engineer
- Backend Engineer application - ${candidateName}
- Software Engineer role - ${candidateName}

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

CRITICAL: Return ONLY a single raw JSON object matching the exact schema above.`;

    const aiResult = await this.aiProviderService.structuredComplete<RawAiMultiVariantResponse>({
      systemPrompt,
      userPrompt: `Generate the JSON object containing technicalVariant, startupVariant, and directVariant for a concise, human-like engineer email (55-90 words, hard max 100 words) authored by software engineer ${candidateName} for ${company.companyName} (${company.domain}), sent to ${recipientClassification.title} (${recipientEmail}). Opening style: "${rotatedOpening}". Closing style: "${rotatedClosing}". Strictly adhere to 55-90 words. Output MUST start with "{" and end with "}".`,
      feature: 'OUTREACH_GENERATION',
      maxTokens: 1500,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    // Helper to sanitize each generated variant against hard V5 humanization guardrails
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
      subject = DraftQualityService.sanitizePunctuation(subject);

      // 2. Forbidden phrases, forbidden CTA, and word count validation
      const forbiddenPhrase = this.draftQualityService.hasForbiddenPhrase(body);
      const hasForbiddenCta = this.draftQualityService.hasForbiddenCta(body);
      const currentWordCount = body.split(/\s+/).filter(Boolean).length;

      // 3. Fallback to calibrated V5 humanized structure if AI introduced forbidden phrases, CTA asks, improper word count, or missing paragraph breaks
      if (
        forbiddenPhrase ||
        hasForbiddenCta ||
        currentWordCount > 95 ||
        currentWordCount < 55 ||
        !body.includes('The Ninja Studio') ||
        body.includes('graduated') ||
        body.includes('July 2026') ||
        body.includes('VIT Chennai') ||
        body.includes('openings') ||
        !body.includes('\n\n')
      ) {
        body = `${rotatedOpening}\n\n${companyRelevanceSentence}\n\n${singleAchievement}\n\n${rotatedClosing}`;
      }

      // Clean up multiple spaces or excessive empty lines
      body = body.replace(/\n{3,}/g, '\n\n').trim();

      return { subject, body };
    };

    const subjectChoices = [
      `Backend Engineer - ${candidateName}`,
      `Software Engineer - ${candidateName}`,
      `${candidateName} - Backend Engineer`,
      `Backend Engineer application - ${candidateName}`,
      `Software Engineer role - ${candidateName}`,
      `Backend Engineer - ${candidateName}`,
      `Software Engineer - ${candidateName}`,
      `${candidateName} - Backend Engineer`,
      `Backend Engineer application - ${candidateName}`,
      `Software Engineer role - ${candidateName}`,
    ];
    const defaultTier1Subject = subjectChoices[openingIndex];

    const rawVariants: Array<{ type: EmailVariantType; subject: string; body: string }> = [
      {
        type: EmailVariantType.TECHNICAL,
        ...sanitizeVariant(data.technicalVariant, defaultTier1Subject),
      },
      {
        type: EmailVariantType.STARTUP,
        ...sanitizeVariant(
          data.startupVariant,
          subjectChoices[(openingIndex + 1) % subjectChoices.length],
        ),
      },
      {
        type: EmailVariantType.DIRECT,
        ...sanitizeVariant(
          data.directVariant,
          subjectChoices[(openingIndex + 2) % subjectChoices.length],
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

