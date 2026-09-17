import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Prospect, ContactType } from '../../prospects/entities/prospect.entity';
import {
  CandidateMatchingService,
  CandidateMatchResult,
  MultiResumeMatchResult,
  OutreachStrategy,
} from './candidate-matching.service';
import { DraftQualityService, DraftQualityScoreResult } from './draft-quality.service';
import { EmailVariantType } from '../entities/email-draft-variant.entity';

export type RecipientClassificationType = 'ENGINEERING_PEER' | 'RECRUITING_CONTACT';

export interface RecipientClassification {
  recipientClass: RecipientClassificationType;
  type: 'TYPE_A_HR' | 'TYPE_B_ENGINEERING_MANAGER' | 'TYPE_C_FOUNDER_OR_CTO';
  title: string;
  primaryConcern: string;
  focus: string;
  technicalDepth: 'LOW' | 'MEDIUM' | 'MEDIUM-HIGH';
  goal: string;
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
  reasonContactChosen?: string;
  evidenceUsed?: string[];
  keyMatches?: string[];
  whyMePoints?: string[];
  missingSkills?: string[];
  recommendedTalkingPoints?: string[];
  recipientClass: RecipientClassificationType;
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
   * Classifies recipient into ENGINEERING_PEER or RECRUITING_CONTACT.
   * ENGINEERING_PEER: Software Engineer, Senior, Staff, Principal, Lead, EM, VP Engineering, CTO, Founder
   * RECRUITING_CONTACT: Recruiter, Talent Partner, Talent Acquisition, Hiring Manager, Recruiting Coordinator, People Ops
   */
  public classifyRecipient(
    contactType: ContactType,
    email: string,
    roleOrTitle?: string,
  ): RecipientClassification {
    const emailLower = (email || '').toLowerCase();
    const roleLower = (roleOrTitle || '').toLowerCase();
    const combined = `${emailLower} ${roleLower}`;

    // RECRUITING_CONTACT
    // Examples: Recruiter, Talent Partner, Talent Acquisition, Hiring Manager, Recruiting Coordinator, People Operations
    const isRecruitingRole =
      contactType === ContactType.HR ||
      contactType === ContactType.RECRUITER ||
      /(recruiter|talent\s*partner|talent\s*acquisition|hiring\s*manager|recruiting\s*coordinator|people\s*ops|people\s*operations|careers|jobs|talent|sourcer|headhunter|hr)/i.test(
        combined,
      );

    if (isRecruitingRole) {
      return {
        recipientClass: 'RECRUITING_CONTACT',
        type: 'TYPE_A_HR',
        title: roleOrTitle || 'Recruiting Contact / Talent Partner',
        primaryConcern: 'Role alignment and candidate viability',
        focus: 'professional, measured, role alignment without sounding needy',
        technicalDepth: 'LOW',
        goal: 'Express interest in opportunities without sounding needy',
      };
    }

    // ENGINEERING_PEER: Founder / CTO
    if (
      contactType === ContactType.FOUNDER ||
      /(founder|ceo|owner|cofounder)/i.test(combined)
    ) {
      return {
        recipientClass: 'ENGINEERING_PEER',
        type: 'TYPE_C_FOUNDER_OR_CTO',
        title: roleOrTitle || 'Founder / CTO',
        primaryConcern: 'Can this person solve hard problems and create value quickly?',
        focus: 'engineer-to-engineer, problem solving, systems architecture, start a conversation',
        technicalDepth: 'MEDIUM-HIGH',
        goal: 'Start a conversation without directly asking for a job',
      };
    }

    // ENGINEERING_PEER: Software Engineer, Senior, Staff, Principal, Lead, Engineering Manager, VP Engineering
    return {
      recipientClass: 'ENGINEERING_PEER',
      type: 'TYPE_B_ENGINEERING_MANAGER',
      title: roleOrTitle || 'Engineering Peer / Lead',
      primaryConcern: 'Can this engineer solve problems and build reliable systems?',
      focus: 'engineer-to-engineer networking, technical credibility, start a conversation',
      technicalDepth: 'MEDIUM',
      goal: 'Start a conversation without directly asking for a job',
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
   * Generates 3 authentic, engineer-to-engineer email variants, scores them,
   * enforces recipient-tailored endings and clean signatures, and selects the winner.
   */
  async generatePersonalizedDraft(
    prospect: Prospect,
    company: CompanyProfile,
    candidate: CandidateProfile,
    options?: { styleIndex?: number } | MultiResumeMatchResult,
  ): Promise<GeneratedDraftResult> {
    const multiResumeMatch =
      options && 'selectedResumeName' in options ? (options as MultiResumeMatchResult) : undefined;
    const styleIndexOption =
      options && 'styleIndex' in options ? (options as { styleIndex?: number }).styleIndex : undefined;

    // 1. Compute Candidate Match & Recipient Classification
    const matchResult =
      multiResumeMatch?.matchResult || this.candidateMatchingService.matchExperience(company, candidate);
    const contactType = prospect.contactType || ContactType.GENERAL;
    const recipientEmail = prospect.email;
    const recipientClassification = this.classifyRecipient(contactType, recipientEmail);

    const isBusinessOnly = matchResult.strategy === OutreachStrategy.BUSINESS_ONLY;

    const candidateName = candidate?.name?.trim() || 'Ashish Raj';
    const githubUrl = candidate?.links?.github || 'https://github.com/AshishRajx7';
    const linkedinUrl = candidate?.links?.linkedin || 'https://linkedin.com/in/ashishrajx7';
    const signature = `Best,\n${candidateName}\nGitHub: ${githubUrl}\nLinkedIn: ${linkedinUrl}`;

    // Recipient First Name Extraction for natural greeting
    const recipientFirstName = this.getRecipientFirstName(recipientEmail);
    const greetingGuideline = recipientFirstName ? `Hi ${recipientFirstName},` : `Hi,`;

    // Anti-Template Rotation: 10 Distinct Openings
    let openingIndex: number;
    let closingIndex: number;

    if (styleIndexOption !== undefined) {
      openingIndex = ((styleIndexOption % 10) + 10) % 10;
      closingIndex = (((styleIndexOption + 3) % 10) + 10) % 10;
    } else {
      const seed = (recipientEmail + (company.domain || ''))
        .split('')
        .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
      openingIndex = seed % 10;
      closingIndex = (Math.floor(seed / 10) + 3) % 10;
    }

    const openingStyles = [
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I work on backend systems and distributed services at The Ninja Studio here in India.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. Most of my work over the past year has been around databases and platform infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I spend my time building backend services, database layers, and internal APIs at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I've been working on backend systems and queue infrastructure at The Ninja Studio for the past year.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I spend my time building backend APIs and database infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I work on backend systems, data pipelines, and distributed services at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. Most of my work involves building backend services, APIs, and cloud infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I spend my time building backend infrastructure, queues, and internal services at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I spend my days building backend systems, API performance layers, and database infrastructure at The Ninja Studio.`,
      `${greetingGuideline} I'm ${candidateName.split(' ')[0]}. I've spent the past year building distributed backend services and data platforms at The Ninja Studio.`,
    ];
    const rotatedOpening = openingStyles[openingIndex];

    // Conditional Ending Generation Rules
    // ENGINEERING_PEER: Start a conversation. Do NOT ask directly for a job.
    const peerEndings = [
      "Would love to learn more about the team and the problems you're solving if there are relevant opportunities. I've attached my resume for context.",
      "Happy to share more details about my work if it's relevant to what the team is building. I've attached my resume for context.",
      "Would be interested in learning more about the platform team and any challenges you're currently tackling. I've attached my resume.",
      "If my background seems relevant, I'd be glad to continue the conversation. I've attached my resume.",
    ];

    // RECRUITING_CONTACT: Express interest in opportunities without sounding needy.
    const recruitingEndings = [
      "If there are any software engineering opportunities that align with my background, I'd be grateful for the opportunity to be considered. I've attached my resume.",
      "If my experience aligns with any current or upcoming engineering roles, I'd be happy to share additional information. I've attached my resume.",
      "Should there be relevant backend or platform engineering opportunities, I'd welcome the opportunity to be considered. I've attached my resume.",
      "If my background appears relevant to any engineering openings, I'd be glad to discuss further. I've attached my resume.",
    ];

    const endingChoices =
      recipientClassification.recipientClass === 'ENGINEERING_PEER' ? peerEndings : recruitingEndings;
    const rotatedEnding = endingChoices[closingIndex % endingChoices.length];

    // Company Relevance Sentence & Concrete Achievement / Proof Points
    let companyRelevanceSentence = '';
    let singleAchievement = '';

    const lowerDomain = (company.domain || '').toLowerCase();
    const lowerName = (company.companyName || '').toLowerCase();

    if (lowerDomain.includes('neon') || lowerName.includes('neon')) {
      companyRelevanceSentence = `I spend most of my day-to-day work dealing with PostgreSQL internals and query performance, so Neon felt like a natural company to reach out to.`;
      singleAchievement = `I recently overhauled our database query patterns and indexing strategies to resolve production latency bottlenecks across our heaviest tables.`;
    } else if (lowerDomain.includes('clickhouse') || lowerName.includes('clickhouse')) {
      companyRelevanceSentence = `I've spent a fair amount of time dealing with analytics workloads and heavy database reads, so ClickHouse felt worth reaching out to.`;
      singleAchievement = `I spent a few weeks untangling reporting queries and database bottlenecks that had become difficult to scale under high traffic.`;
    } else if (lowerDomain.includes('resend') || lowerName.includes('resend')) {
      companyRelevanceSentence = `I've worked on a few notification systems myself over the past year, which is why Resend stood out as a team to reach out to.`;
      singleAchievement = `I rebuilt our background notification pipeline with BullMQ to make message delivery retries, worker queues, and failure recovery reliable under load.`;
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
    } else if (
      lowerDomain.includes('ibhubs') ||
      lowerName.includes('ibhubs') ||
      lowerDomain.includes('ib hubs') ||
      lowerName.includes('ib hubs')
    ) {
      companyRelevanceSentence = `I've spent a lot of time building asynchronous background systems and core services, so iB Hubs felt like an interesting team to contact.`;
      singleAchievement = `I rebuilt our background notification pipeline to ensure message delivery retries and idempotency remained dependable under load.`;
    } else {
      companyRelevanceSentence = `Most of my work revolves around backend infrastructure and distributed systems, so ${company.companyName} felt like an interesting team to contact.`;
      singleAchievement = `One project I owned was building a centralized audit logging platform that handles structured event logs across core modules.`;
    }

    // Reason Contact Chosen description
    const reasonContactChosen =
      recipientClassification.recipientClass === 'ENGINEERING_PEER'
        ? `Engineering peer / lead at ${company.companyName}; ideal peer contact to discuss architecture, backend systems, and team challenges.`
        : `Talent partner at ${company.companyName}; handles software engineering pipelines and hiring considerations.`;

    // 2. System Prompt: Authentic Engineer Cold Outreach
    const systemPrompt = `# RELAY OUTREACH: AUTHENTIC ENGINEER COLD OUTREACH

OBJECTIVE
You are generating cold outreach emails for software engineering opportunities.
Your objective is to create authentic, professional outreach that sounds like a real engineer contacting another professional, not an AI-generated job application.

CRITICAL RULES:
- Never sound desperate.
- Never beg for a job.
- Never use phrases such as:
  * "I am excited to apply"
  * "I believe I would be a great fit"
  * "I am passionate about"
  * "I would appreciate your consideration"
  * "Please review my resume"
  * "Looking forward to hearing from you"
- Avoid corporate buzzwords and generic filler.
- Keep the tone confident, respectful, and conversational.
- The ending must feel natural for the recipient type.

RECIPIENT CLASSIFICATION:
Recipient Type: ${recipientClassification.recipientClass} (${recipientClassification.title})
Recipient Goal: ${recipientClassification.goal}

ENDING RULES FOR THIS RECIPIENT (${recipientClassification.recipientClass}):
${
  recipientClassification.recipientClass === 'ENGINEERING_PEER'
    ? `Goal: Start a conversation. Do NOT ask directly for a job.
Preferred style:
"Would love to learn more about the team and the problems you're solving if there are relevant opportunities. I've attached my resume for context."
The tone should feel like engineer-to-engineer networking.`
    : `Goal: Express interest in opportunities without sounding needy.
Preferred style:
"If there are any software engineering opportunities that align with my background, I'd be grateful for the opportunity to be considered. I've attached my resume."
The tone should remain professional and measured.`
}

RESUME ATTACHMENT MENTION:
The email must always mention the resume naturally (e.g. "I've attached my resume for context." or "I've attached my resume.").
NEVER use: "Please find my resume attached", "Kindly review the attached resume", or "I request you to review my resume".

SIGNATURE FORMAT:
Always end with:
Best,
${candidateName}
GitHub: ${githubUrl}
LinkedIn: ${linkedinUrl}
No additional motivational statements.
No "Looking forward to hearing from you."
No "Thank you for your time and consideration."

STRUCTURE:
Paragraph 1: Who I am (e.g. "${rotatedOpening}")
Paragraph 2: Why I picked this company (1 sentence observational, e.g. "${companyRelevanceSentence}")
Paragraph 3: One specific concrete project or achievement (e.g. "${singleAchievement}")
Paragraph 4: Audience-tailored closing (e.g. "${rotatedEnding}")
Signature:
${signature}

SUBJECT RULES:
Normal Gmail subject:
- ${candidateName} - Resume
- Resume - ${candidateName}
- Software Engineer - ${candidateName}
- ${candidateName} | Backend Engineer
- ${candidateName}

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

Return ONLY raw JSON starting with "{" and ending with "}".`;

    const aiResult = await this.aiProviderService.structuredComplete<RawAiMultiVariantResponse>({
      systemPrompt,
      userPrompt: `Generate 3 email variants for ${candidateName} contacting ${recipientClassification.title} (${recipientEmail}) at ${company.companyName} (${company.domain}). Recipient Class: ${recipientClassification.recipientClass}. Ending: "${rotatedEnding}". Include clean signature with GitHub and LinkedIn. Output MUST be valid JSON.`,
      feature: 'OUTREACH_GENERATION',
      maxTokens: 1500,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    // Helper to sanitize each generated variant against guardrails
    const sanitizeVariant = (v: { subject?: string; body?: string }, defaultSubject: string) => {
      let subject = v?.subject?.trim() || defaultSubject;
      let body = v?.body?.trim() || '';

      if (
        !DraftQualityService.hasMandatorySubjectKeyword(subject) ||
        DraftQualityService.isForbiddenSubject(subject) ||
        subject.length > 50 ||
        subject.includes('\n')
      ) {
        subject = defaultSubject;
      }
      subject = DraftQualityService.sanitizePunctuation(subject);

      // Clean up whitespace
      body = body.replace(/\n{3,}/g, '\n\n').trim();

      // Guardrail checks
      const forbiddenPhrase = this.draftQualityService.hasForbiddenPhrase(body);
      const hasForbiddenCta = this.draftQualityService.hasForbiddenCta(body);
      const currentWordCount = body.split(/\s+/).filter(Boolean).length;
      const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
      const hasSigOrClosing = DraftQualityService.hasSignatureOrClosingSentence(body);
      const hasResume = this.draftQualityService.hasResumeMention(body);

      // Fallback if AI violated critical rules
      if (
        forbiddenPhrase ||
        hasForbiddenCta ||
        hasSigOrClosing ||
        !hasResume ||
        paragraphs.length < 3 ||
        paragraphs.length > 6 ||
        currentWordCount > 130 ||
        currentWordCount < 40 ||
        !body.includes('The Ninja Studio') ||
        !body.includes(candidateName.split(' ')[0]) ||
        body.includes('graduated') ||
        body.includes('July 2026') ||
        body.includes('VIT Chennai')
      ) {
        body = `${rotatedOpening}\n\n${companyRelevanceSentence}\n\n${singleAchievement}\n\n${rotatedEnding}\n\n${signature}`;
      }

      // Ensure signature is present
      if (!body.includes('GitHub:') && !body.includes('LinkedIn:')) {
        body = `${body.trim()}\n\n${signature}`;
      }

      body = body.replace(/\n{3,}/g, '\n\n').trim();

      return { subject, body };
    };

    const subjectChoices = [
      `${candidateName} - Resume`,
      `Resume - ${candidateName}`,
      `Software Engineer - ${candidateName}`,
      `${candidateName} | Backend Engineer`,
      `${candidateName}`,
      `${candidateName} - Resume`,
      `Software Engineer - ${candidateName}`,
      `${candidateName} | Backend Engineer`,
      `Resume - ${candidateName}`,
      `${candidateName}`,
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

    // Score all 3 variants individually
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

    let bestIndex = 0;
    let bestScore = -999;

    for (let i = 0; i < evaluatedVariants.length; i++) {
      const v = evaluatedVariants[i];
      const hasHallucination =
        v.quality.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION') ||
        v.quality.flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION') ||
        v.quality.flags.includes('UNVERIFIED_PRODUCT_CLAIM');

      const groundingPenalty = hasHallucination ? 50 : 0;

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

    const evidenceUsed =
      multiResumeMatch?.evidenceUsedInEmail || [
        'Centralized Audit Logging Platform',
        'BranchGuard Redis Caching Layer',
        'Leave Management Query Optimization',
      ];
    const keyMatches =
      multiResumeMatch?.keyMatches ||
      (matchResult.matchedTechnologies.length > 0
        ? matchResult.matchedTechnologies
        : ['PostgreSQL', 'Redis', 'NestJS', 'TypeORM']);
    const projectsReferenced =
      multiResumeMatch?.projectsReferenced || [matchResult.chosenProject || 'Audit Logging Platform'];
    const whyMePoints =
      multiResumeMatch?.whyMePoints || [
        `Production experience building ${matchResult.chosenProject} with high reliability.`,
        'Hands-on expertise in query optimization, Redis caching, and distributed queues.',
      ];
    const missingSkills = multiResumeMatch?.missingSkills || [];
    const recommendedTalkingPoints =
      multiResumeMatch?.recommendedTalkingPoints || [
        `Discuss how audit logging and Redis caching scale under load.`,
        `Explore recent database and platform infrastructure challenges at ${company.companyName}.`,
      ];

    return {
      subject: bestVariant.subject,
      body: bestVariant.body,
      selectedVariantType: bestVariant.variantType,
      variants: evaluatedVariants,
      matchResult,
      quality: bestVariant.quality,
      whyCompany:
        data.whyCompany ||
        `${company.companyName} is building scalable platforms with modern engineering standards.`,
      whyMe:
        data.whyMe ||
        (matchResult.matchedTechnologies.length > 0
          ? `Experienced in engineering ${matchResult.chosenProject} using ${matchResult.matchedTechnologies.join(', ')}.`
          : `Experienced in engineering ${matchResult.chosenProject} for distributed backend systems.`),
      whyNow: data.whyNow || null,
      whyRelevant: matchResult.whyRelevant,
      confidenceLevel: data.confidenceLevel || 'HIGH',
      reasonContactChosen,
      evidenceUsed,
      keyMatches,
      whyMePoints,
      missingSkills,
      recommendedTalkingPoints,
      recipientClass: recipientClassification.recipientClass,
    };
  }
}
