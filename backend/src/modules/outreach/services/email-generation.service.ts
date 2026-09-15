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
      `${greetingGuideline} I'm Ashish. I work on backend systems and distributed services at The Ninja Studio here in India.`,
      `${greetingGuideline} I'm Ashish. Most of my work over the past year has been around databases and platform infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. I spend my time building backend services, database layers, and internal APIs at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. I've been working on backend systems and queue infrastructure at The Ninja Studio for the past year.`,
      `${greetingGuideline} I'm Ashish. I spend my time building backend APIs and database infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. I work on backend systems, data pipelines, and distributed services at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. Most of my work involves building backend services, APIs, and cloud infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. I spend my time building backend infrastructure, queues, and internal services at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. I spend my days building backend systems, API performance layers, and database infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm Ashish. I've spent the past year building distributed backend services and data platforms at The Ninja Studio.`,
    ];
    const rotatedOpening = openingStyles[openingIndex];

    const endingStyles = [
      "I've attached my resume.",
      'Resume attached.',
      'Attached my resume.',
    ];
    const rotatedEnding = endingStyles[closingIndex % 3];

    // Conversational Company Sentence (one sentence, personal, observational, no marketing praise) & Single Relevant Achievement (one sentence, one achievement, no repeating 'At The Ninja Studio...')
    let companyRelevanceSentence = '';
    let singleAchievement = '';

    const lowerDomain = (company.domain || '').toLowerCase();
    const lowerName = (company.companyName || '').toLowerCase();

    if (lowerDomain.includes('neon') || lowerName.includes('neon')) {
      companyRelevanceSentence = `I spend most of my day-to-day work dealing with PostgreSQL internals and performance, so Neon felt like a natural company to reach out to.`;
      singleAchievement = `I recently overhauled our database query patterns and indexing strategies to resolve production latency bottlenecks across our heaviest tables.`;
    } else if (lowerDomain.includes('clickhouse') || lowerName.includes('clickhouse')) {
      companyRelevanceSentence = `I've spent a fair amount of time dealing with analytics workloads and heavy database reads, so ClickHouse felt worth reaching out to.`;
      singleAchievement = `I spent a few weeks untangling reporting queries and database bottlenecks that had become difficult to scale under high traffic.`;
    } else if (lowerDomain.includes('resend') || lowerName.includes('resend')) {
      companyRelevanceSentence = `I've worked on a few notification systems myself over the past year, which is why Resend stood out as a team to reach out to.`;
      singleAchievement = `I rebuilt our background notification pipeline to make message delivery retries, worker queues, and failure recovery reliable under load.`;
    } else if (lowerDomain.includes('linear') || lowerName.includes('linear')) {
      companyRelevanceSentence = `I care a lot about high-performance software and craftsmanship in tooling, so Linear felt like an obvious team to write to.`;
      singleAchievement = `One project I worked on was a centralized audit logging platform engineered to handle structured events across all product services.`;
    } else if (lowerDomain.includes('posthog') || lowerName.includes('posthog')) {
      companyRelevanceSentence = `A lot of my recent work has been around event processing and telemetry pipelines, which is why PostHog stood out.`;
      singleAchievement = `One project I owned was building an event logging pipeline used across our core services to trace user activity reliably.`;
    } else if (lowerDomain.includes('supabase') || lowerName.includes('supabase')) {
      companyRelevanceSentence = `Most of my recent database work is in Postgres and access control, so Supabase felt like a very natural team to send a note to.`;
      singleAchievement = `I recently built a tenant-scoped authorization system used across multiple product modules to isolate customer data cleanly.`;
    } else if (lowerDomain.includes('sourcefuse') || lowerName.includes('sourcefuse')) {
      companyRelevanceSentence = `A lot of my recent projects have centered on scalable cloud backends and databases, so SourceFuse felt like a natural team to reach out to.`;
      singleAchievement = `One system I built was a multi-tenant authorization layer to safeguard customer data and control service permissions.`;
    } else if (lowerDomain.includes('perennial') || lowerName.includes('perennial')) {
      companyRelevanceSentence = `Most of my day-to-day work revolves around enterprise backend services and distributed infrastructure, so Perennial felt like a very natural team to reach out to.`;
      singleAchievement = `One project I owned was building a centralized audit logging platform that handles sensitive events across all internal modules.`;
    } else if (lowerDomain.includes('ibhubs') || lowerName.includes('ibhubs') || lowerDomain.includes('ib hubs') || lowerName.includes('ib hubs')) {
      companyRelevanceSentence = `I've spent a lot of time building asynchronous background systems and core services, so iB Hubs felt like an interesting team to contact.`;
      singleAchievement = `I rebuilt our background notification pipeline to ensure message delivery retries and idempotency remained dependable under load.`;
    } else {
      companyRelevanceSentence = `Most of my work revolves around backend infrastructure and distributed systems, so ${company.companyName} felt like an interesting team to contact.`;
      singleAchievement = `One project I owned was building a centralized audit logging platform that handles structured event logs across core modules.`;
    }

    // 2. System Prompt: RELAY OUTREACH V7
    const systemPrompt = `# RELAY OUTREACH V7

OBJECTIVE
Write a cold job application email that feels like it was manually typed by a software engineer in Gmail.
The reader should never think: "This was generated."
The reader should think: "A developer spent a minute writing me a quick note."
The goal is not to impress, not to persuade, not to sell.
The goal is simply to introduce the candidate, establish relevance, show one proof point, and attach a resume.

LENGTH
Preferred: 65-80 words.
Acceptable: 55-90 words.
Hard maximum: 95 words.
Avoid emails under 60 words unless adding more would create filler. Every sentence must earn its place.

STRUCTURE
Paragraph 1: Who I am. (Natural rotation, do not repeatedly use "I'm a backend engineer")
Paragraph 2: Why I picked this company. (One sentence only, personal, observational, no praise)
Paragraph 3: One specific achievement. (One sentence only, do NOT always start with "At The Ninja Studio...")
Paragraph 4: Resume attached. (One sentence only: "Resume attached." OR "I've attached my resume." OR "Attached my resume.")

CRITICAL CONSTRAINTS:
- Exactly four paragraphs separated by a blank line (\\n\\n).
- No extra paragraph.
- No signature block. (No sign-off, no name at the end, no "Best", "Thanks", etc.)
- No thank you.
- No closing sentence.
- The email must end immediately after the resume sentence.

SUBJECT RULES:
Subject should feel like a normal Gmail subject:
Prefer:
- Ashish Raj
- Ashish Raj - Resume
- Resume - Ashish Raj
- Software Engineer - Ashish Raj
- Ashish Raj | Backend Engineer
Avoid:
- Application for Backend Engineer
- Backend Engineer Application
- Job Inquiry
- Seeking Opportunities
- Interest in Opportunities
- Current or Future Opportunities

VOICE
Write like an engineer. Not a recruiter, marketer, founder, or cover letter.
Simple language, short sentences, natural wording. Contractions are fine (I'm, I've, I'd).

COMPANY PARAGRAPH
One sentence only. Explains why this company specifically. Personal and observational.
Must NOT sound researched. Must NOT praise the company.

ACHIEVEMENT PARAGRAPH
Exactly ONE sentence. Exactly ONE achievement. No lists, no comma-separated accomplishments, no stacked metrics, no technology dumps.
Rotate naturally. Do NOT always start with "At The Ninja Studio...".

FORBIDDEN CONTENT
Never mention:
- backend openings
- engineering openings
- job openings
- current or future opportunities
- would appreciate consideration
- reaching out regarding
- reaching out about
- caught my attention
- aligns with
- relevant to my experience
- relevant to my background
- very relevant
- directly relevant
- saw what you're building
- opportunity to discuss
- conversation
- call
- meeting
- chat
- connect
- follow up
- circle back
- touch base
- happy to chat
- love to chat
- let's connect
- thank you for your time

ENDING
Only one sentence. Choose one:
- Resume attached.
- I've attached my resume.
- Attached my resume.
Nothing else.

Draft Structure:
Paragraph 1:
${rotatedOpening}

Paragraph 2:
${companyRelevanceSentence}

Paragraph 3:
${singleAchievement}

Paragraph 4:
${rotatedEnding}

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
      userPrompt: `Generate the JSON object containing technicalVariant, startupVariant, and directVariant for a human engineer email (preferred 65-80 words, acceptable 55-90 words, hard max 95 words) authored by software engineer ${candidateName} for ${company.companyName} (${company.domain}), sent to ${recipientClassification.title} (${recipientEmail}). Opening style: "${rotatedOpening}". Ending style: "${rotatedEnding}". Strictly 4 paragraphs. No signature block. Normal Gmail subject. Output MUST start with "{" and end with "}".`,
      feature: 'OUTREACH_GENERATION',
      maxTokens: 1500,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    // Helper to sanitize each generated variant against hard V7 humanization guardrails
    const sanitizeVariant = (v: { subject?: string; body?: string }, defaultSubject: string) => {
      let subject = v?.subject?.trim() || defaultSubject;
      let body = v?.body?.trim() || '';

      // 1. Mandatory subject keyword check, blog-title check, and length/greeting check
      if (
        !DraftQualityService.hasMandatorySubjectKeyword(subject) ||
        DraftQualityService.isForbiddenSubject(subject) ||
        subject.length > 45 ||
        subject.includes('\n') ||
        /^(hi|hello|hey)\b/i.test(subject) ||
        /\b(experience in|working on|focused on|application for)\b/i.test(subject)
      ) {
        subject = defaultSubject;
      }
      subject = DraftQualityService.sanitizePunctuation(subject);

      // Clean up multiple spaces or excessive empty lines
      body = body.replace(/\n{3,}/g, '\n\n').trim();

      // 2. Forbidden phrases, forbidden CTA, word count, and signature validation
      const forbiddenPhrase = this.draftQualityService.hasForbiddenPhrase(body);
      const hasForbiddenCta = this.draftQualityService.hasForbiddenCta(body);
      const currentWordCount = body.split(/\s+/).filter(Boolean).length;
      const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
      const hasSigOrClosing = DraftQualityService.hasSignatureOrClosingSentence(body);

      // 3. Fallback to calibrated V7 humanized structure if AI violated any V7 rules
      if (
        forbiddenPhrase ||
        hasForbiddenCta ||
        hasSigOrClosing ||
        paragraphs.length !== 4 ||
        currentWordCount > 95 ||
        currentWordCount < 55 ||
        !body.includes('The Ninja Studio') ||
        !body.includes('Ashish') ||
        body.includes('graduated') ||
        body.includes('July 2026') ||
        body.includes('VIT Chennai') ||
        body.includes('openings')
      ) {
        body = `${rotatedOpening}\n\n${companyRelevanceSentence}\n\n${singleAchievement}\n\n${rotatedEnding}`;
      }

      body = body.replace(/\n{3,}/g, '\n\n').trim();

      return { subject, body };
    };

    const subjectChoices = [
      `Ashish Raj - Resume`,
      `Resume - Ashish Raj`,
      `Software Engineer - Ashish Raj`,
      `Ashish Raj | Backend Engineer`,
      `Ashish Raj`,
      `Ashish Raj - Resume`,
      `Software Engineer - Ashish Raj`,
      `Ashish Raj | Backend Engineer`,
      `Resume - Ashish Raj`,
      `Ashish Raj`,
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

