import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Prospect, ContactType } from '../../prospects/entities/prospect.entity';
import {
  CandidateMatchingService,
  CandidateMatchResult,
  MultiResumeMatchResult,
  OutreachStrategy,
  V3MatchOutput,
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

export interface StructuredOutreachContext {
  companyName: string;
  companySignal: string;
  companySourceQuote: string;
  candidateEmployer: string;
  candidateRole: string;
  candidateExperience: string;
  candidateSourceBullet: string;
  relationshipType: string;
  relationshipExplanation: string;
  outreachObjective: 'START_CONVERSATION' | 'EXPRESS_INTEREST';
  recipientClass: RecipientClassificationType;
  recipientTitle: string;
  recipientFirstName: string;
  recipientEmail: string;
}

export function calculateRenderedWordCount(renderedText: string): number {
  if (!renderedText) return 0;
  return renderedText.trim().split(/\s+/).filter(Boolean).length;
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
  structuredContext?: StructuredOutreachContext;
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
  private readonly writingModel: string;

  constructor(
    private readonly aiProviderService: AIProviderService,
    private readonly candidateMatchingService: CandidateMatchingService,
    private readonly draftQualityService: DraftQualityService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.writingModel =
      this.configService?.get<string>('ai.writingModel') ||
      this.configService?.get<string>('ai.model') ||
      'nvidia/nemotron-3-super-120b-a12b';
  }

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
    v3MatchOrOptions?: V3MatchOutput | MultiResumeMatchResult | { styleIndex?: number },
    options?: { styleIndex?: number } | MultiResumeMatchResult,
  ): Promise<GeneratedDraftResult> {
    let v3Match: V3MatchOutput | undefined;
    let multiResumeMatch: MultiResumeMatchResult | undefined;
    let styleIndexOption: number | undefined;

    if (v3MatchOrOptions && 'match' in v3MatchOrOptions) {
      v3Match = v3MatchOrOptions as V3MatchOutput;
    } else if (v3MatchOrOptions && 'selectedResumeName' in v3MatchOrOptions) {
      multiResumeMatch = v3MatchOrOptions as MultiResumeMatchResult;
    } else if (v3MatchOrOptions && 'styleIndex' in v3MatchOrOptions) {
      styleIndexOption = (v3MatchOrOptions as { styleIndex?: number }).styleIndex;
    }

    if (options && 'selectedResumeName' in options) {
      multiResumeMatch = options as MultiResumeMatchResult;
    } else if (options && 'styleIndex' in options) {
      styleIndexOption = (options as { styleIndex?: number }).styleIndex;
    }

    // If v3Match was not supplied by caller, compute it to guarantee high-conviction relational grounding
    if (!v3Match) {
      try {
        v3Match = await this.candidateMatchingService.matchCandidateToCompany(
          company,
          candidate.id,
          prospect.campaignId,
        );
      } catch (err: any) {
        this.logger.warn(`Could not compute v3Match in email-generation: ${err.message}`);
      }
    }

    // 1. Compute Candidate Match & Recipient Classification
    const matchResult =
      multiResumeMatch?.matchResult || this.candidateMatchingService.matchExperience(company, candidate);
    const contactType = prospect.contactType || ContactType.GENERAL;
    const recipientEmail = prospect.email;
    const recipientClassification = this.classifyRecipient(contactType, recipientEmail);

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

    // Extract structured evidence from v3Match (Ground truth from relational matcher)
    // Extract structured evidence from v3Match (Ground truth from relational matcher)
    const candidateEv = v3Match?.candidateEvidence;
    const companyEv = v3Match?.companyEvidence;
    const relationshipMatch = v3Match?.match;

    const candidateEmployer = candidateEv?.experience?.employer || 'The Ninja Studio';
    const candidateRole = candidateEv?.experience?.roleTitle || 'Backend Engineer';
    const candidateFirstName = candidateName.split(' ')[0];

    // Factual normalization of candidate deliverable/claim
    let cleanCandidateClaim = candidateEv?.deliverableName || candidateEv?.atomicClaim || 'distributed backend platform services';
    cleanCandidateClaim = cleanCandidateClaim
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (cleanCandidateClaim.endsWith('.')) {
      cleanCandidateClaim = cleanCandidateClaim.slice(0, -1);
    }
    // Remove leading participle to enable active sentence construction
    cleanCandidateClaim = cleanCandidateClaim.replace(/^building\s+/i, '').replace(/^built\s+/i, '').trim();

    // Factual normalization of company signal
    let cleanCompanySignal = '';
    if (company.products && company.products.length > 0 && company.products[0].length > 1) {
      cleanCompanySignal = company.products[0];
    } else if (companyEv?.atomicClaim && companyEv.atomicClaim.length > 5) {
      cleanCompanySignal = companyEv.atomicClaim.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
      if (cleanCompanySignal.length > 60) {
        const parts = cleanCompanySignal.split(/[.;]/);
        cleanCompanySignal = parts[0].trim();
      }
    } else if (company.recentInitiatives && company.recentInitiatives.length > 0) {
      cleanCompanySignal = `${company.recentInitiatives[0]}`;
    } else {
      cleanCompanySignal = `${company.companyName}'s platform engineering initiatives`;
    }

    if (cleanCompanySignal.endsWith('.')) {
      cleanCompanySignal = cleanCompanySignal.slice(0, -1);
    }

    // Factual normalization of the pre-established relationship rationale
    let cleanBridge = relationshipMatch?.analyticalRationale || 'similar distributed backend architecture and reliability requirements';
    cleanBridge = cleanBridge.replace(/^(direct\s+match\s+on|alignment\s+on|direct\s+technical\s+match\s+on)\s+/i, '').trim();
    if (cleanBridge.endsWith('.')) {
      cleanBridge = cleanBridge.slice(0, -1);
    }

    // Form the structured context (Isolated data object passed to the writer)
    const structuredContext: StructuredOutreachContext = {
      companyName: company.companyName,
      companySignal: cleanCompanySignal,
      companySourceQuote: companyEv?.verbatimQuote || companyEv?.atomicClaim || cleanCompanySignal,
      candidateEmployer,
      candidateRole,
      candidateExperience: cleanCandidateClaim,
      candidateSourceBullet: candidateEv?.rawBulletText || cleanCandidateClaim,
      relationshipType: relationshipMatch?.relationshipType || 'DIRECT_TECHNICAL',
      relationshipExplanation: cleanBridge,
      outreachObjective: recipientClassification.recipientClass === 'ENGINEERING_PEER' ? 'START_CONVERSATION' : 'EXPRESS_INTEREST',
      recipientClass: recipientClassification.recipientClass,
      recipientTitle: recipientClassification.title,
      recipientFirstName,
      recipientEmail,
    };

    // Clean, concise professional introductions (Rule 2 & Rule 7: strictly short)
    const openingStyles = [
      `I'm ${candidateFirstName}, a backend engineer at ${candidateEmployer}.`,
      `I'm ${candidateFirstName}. I build backend systems and distributed services at ${candidateEmployer}.`,
      `I'm ${candidateFirstName}. Most of my work has been around database and platform infrastructure at ${candidateEmployer}.`,
      `I'm ${candidateFirstName}. I focus on backend services, database layers, and APIs at ${candidateEmployer}.`,
      `I'm ${candidateFirstName}. I've been building backend systems and queue infrastructure at ${candidateEmployer}.`,
    ];
    const rotatedOpening = openingStyles[openingIndex % openingStyles.length];

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

    // Build the clean, deterministic fallback: genuine relational connection, active voice, <=100 words
    const fallbackP1 = `${greetingGuideline}\n\n${rotatedOpening}`;
    const fallbackP2 = `I noticed ${structuredContext.companyName}'s work on ${structuredContext.companySignal}. When building ${structuredContext.candidateExperience} at ${structuredContext.candidateEmployer}, we focused on similar ${structuredContext.relationshipExplanation}.`;
    const fallbackP3 = rotatedEnding;
    const cleanFallbackBody = `${fallbackP1}\n\n${fallbackP2}\n\n${fallbackP3}\n\n${signature}`.replace(/\n{3,}/g, '\n\n').trim();

    // Reason Contact Chosen description
    const reasonContactChosen =
      recipientClassification.recipientClass === 'ENGINEERING_PEER'
        ? `Engineering peer / lead at ${company.companyName}; ideal peer contact to discuss architecture, backend systems, and team challenges.`
        : `Talent partner at ${company.companyName}; handles software engineering pipelines and hiring considerations.`;

    // 2. System Prompt: 10 Global Email-Generation Rules
    const systemPrompt = `# RELAY OUTREACH: 10 GLOBAL COLD OUTREACH RULES

You are an expert engineer writing concise, high-conviction cold outreach to another professional.
Your objective is to create authentic, professional outreach that sounds like a real engineer contacting another professional personally, NOT an automated report or marketing bot.

MANDATORY GLOBAL RULES:
1. THE RECIPIENT ALREADY KNOWS THEIR COMPANY:
   Never explain, summarize, or advertise the recipient's company back to them.
   NEVER write:
   - "Company X is focused on..."
   - "Company X specializes in..."
   - "Company X operates in..."
   - "Company X works across..."
   The company initiative is strictly an observational reference point to connect with candidate experience.

2. RESEARCH IS FOR FINDING AN ANGLE, NOT DUMPING FACTS:
   Follow this concise 3-paragraph structure:
   Paragraph 1: Personal introduction (e.g. "${greetingGuideline}\n\n${rotatedOpening}")
   Paragraph 2: Specific company signal & relevant candidate experience connecting them in 1-2 natural sentences.
   Paragraph 3: Audience-tailored low-friction closing (e.g. "${rotatedEnding}")
   Signature:
   ${signature}

3. ONE STRONG CONNECTION, NO KEYWORD SOUP:
   Focus on ONE specific, defensible relationship between company evidence and candidate evidence.
   Never concatenate lists of industries, products, technologies, or keywords.

4. NEVER FORCE A MATCH:
   Do not claim an alignment that isn't justified by the evidence.

5. PRESERVE CANDIDATE EVIDENCE FACTUALLY:
   Never duplicate, nest, or corrupt resume bullets (e.g. never generate "Foo, built (Foo...)"). Write natural prose.

6. NO UNSUPPORTED CLAIMS:
   NEVER use:
   - "I've been following..."
   - "I was impressed by..."
   - "your team is solving..."
   - "this aligns perfectly with..."
   - "I know you're hiring for..."
   - "I am excited to apply"
   - "I believe I would be a great fit"
   - "I am passionate about"
   - "Please review my resume"
   - "Looking forward to hearing from you"

7. HARD 100-WORD LIMIT:
   The complete generated email body, from greeting through sign-off, MUST CONTAIN 100 WORDS OR FEWER.
   Target length: 65 - 80 words. Any draft over 100 words will be rejected.

8. KEEP RESEARCH METADATA OUT OF THE EMAIL:
   Never expose scores, evidence IDs, taxonomy categories, crawl statistics, or matching labels.

9. COMPANY-AGNOSTIC ARCHITECTURE:
   The writing rules apply identically across every company, industry, and domain.

10. OPTIMIZE FOR A REAL CONVERSATION:
    Give the recipient a credible, respectful reason to reply. Sound like a humble, competent peer.

RECIPIENT CLASSIFICATION:
Recipient Type: ${recipientClassification.recipientClass} (${recipientClassification.title})
Recipient Goal: ${recipientClassification.goal}

ENDING RULES FOR THIS RECIPIENT (${recipientClassification.recipientClass}):
${
  recipientClassification.recipientClass === 'ENGINEERING_PEER'
    ? `Goal: Start a conversation. Do NOT ask directly for a job.
Preferred style: "${peerEndings[0]}"
The tone should feel like engineer-to-engineer networking.`
    : `Goal: Express interest in opportunities without sounding needy.
Preferred style: "${recruitingEndings[0]}"
The tone should remain professional and measured.`
}

RESUME ATTACHMENT MENTION:
The email must always mention the resume naturally (e.g. "I've attached my resume for context." or "I've attached my resume.").
NEVER use: "Please find my resume attached" or "Kindly review the attached resume".

SUBJECT RULES:
Normal concise subjects:
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

    const userPrompt = `Draft 3 email variants based ONLY on this approved relationship context:
- Recipient: ${structuredContext.recipientFirstName ? structuredContext.recipientFirstName : 'Peer'} (${structuredContext.recipientTitle}) at ${structuredContext.companyName}
- Recipient Category: ${structuredContext.recipientClass} (Objective: ${structuredContext.outreachObjective})
- Candidate: ${candidateName} (${structuredContext.candidateRole} at ${structuredContext.candidateEmployer})
- Verified Company Signal: "${structuredContext.companySignal}"
- Verified Candidate Experience: "${structuredContext.candidateExperience}"
- Approved Relationship Explanation: "${structuredContext.relationshipExplanation}"
- Required Ending CTA: "${rotatedEnding}"

CRITICAL MANDATES:
1. Express the connection naturally in Paragraph 2: explain WHY what the candidate built connects to the company's verified initiative.
2. Active voice only ("When building ${structuredContext.candidateExperience} at ${structuredContext.candidateEmployer}, we tackled similar [challenges]..."). NEVER write "I building".
3. STRICT WORD COUNT: The entire rendered email (Greeting + Intro + Bridge + CTA + Sign-off) MUST be 60-80 words (ABSOLUTE MAXIMUM: 100 words).
4. Output valid JSON adhering to the schema.`;

    const aiResult = await this.aiProviderService.structuredComplete<RawAiMultiVariantResponse>({
      systemPrompt,
      userPrompt,
      feature: 'OUTREACH_GENERATION',
      model: this.writingModel,
      maxTokens: 1200,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    // Helper to sanitize each generated variant against guardrails & strict 100-word limit
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

      // Ensure signature is present
      if (!body.includes('GitHub:') && !body.includes('LinkedIn:')) {
        body = `${body.trim()}\n\n${signature}`;
      }

      body = body.replace(/\n{3,}/g, '\n\n').trim();

      // Guardrail checks & grammar check
      const forbiddenPhrase = this.draftQualityService.hasForbiddenPhrase(body);
      const hasForbiddenCta = this.draftQualityService.hasForbiddenCta(body);
      const currentWordCount = calculateRenderedWordCount(body);
      const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
      const hasSigOrClosing = DraftQualityService.hasSignatureOrClosingSentence(body);
      const hasResume = this.draftQualityService.hasResumeMention(body);
      const hasParticipleBug = /\bI\s+[a-z]+ing\b/i.test(body);

      // Fallback if AI violated critical rules, generated excessive length (>100 words), or had participle error
      if (
        forbiddenPhrase ||
        hasForbiddenCta ||
        hasSigOrClosing ||
        !hasResume ||
        paragraphs.length < 3 ||
        paragraphs.length > 5 ||
        currentWordCount > 100 ||
        currentWordCount < 35 ||
        hasParticipleBug ||
        !body.includes(candidateEmployer) ||
        !body.includes(candidateFirstName) ||
        body.includes('graduated') ||
        body.includes('July 2026') ||
        body.includes('VIT Chennai')
      ) {
        body = cleanFallbackBody;
      }

      // Final deterministic safety clamp: enforce HARD <= 100 words under any circumstance
      if (calculateRenderedWordCount(body) > 100) {
        body = cleanFallbackBody;
      }

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
      structuredContext,
    };
  }

  /**
   * Deterministic Validation Gate (Rule 7):
   * Validates word count <= 100 on rendered email, syntax/grammar, phrase duplication,
   * provenance, relationship existence, and absence of internal metadata/forbidden filler.
   */
  public validateDraftDeterministic(
    subject: string,
    body: string,
    context: StructuredOutreachContext,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const wordCount = calculateRenderedWordCount(body);

    // 1. Strict <= 100 words limit
    if (wordCount > 100) {
      errors.push(`Email exceeds 100 words limit (actual: ${wordCount} words)`);
    }
    if (wordCount < 35) {
      errors.push(`Email too brief (actual: ${wordCount} words)`);
    }

    // 2. Grammar check: malformed participle subjects
    if (/\bI\s+[a-z]+ing\b/i.test(body)) {
      const match = body.match(/\bI\s+[a-z]+ing\b/i);
      errors.push(`Grammar error: malformed subject-verb participle ('${match ? match[0] : ''}')`);
    }

    // 3. No repeated candidate phrases across paragraphs
    const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
    const candidateDeliverableLower = (context.candidateExperience || '').toLowerCase();
    if (candidateDeliverableLower.length > 3) {
      let occurrences = 0;
      for (const p of paragraphs) {
        if (p.toLowerCase().includes(candidateDeliverableLower)) {
          occurrences++;
        }
      }
      if (occurrences > 1) {
        errors.push(`Duplicated candidate deliverable across paragraphs ('${context.candidateExperience}')`);
      }
    }

    // 4. Provenance: company signal must be mentioned
    const companySignalLower = (context.companySignal || '').toLowerCase();
    const companyNameLower = (context.companyName || '').toLowerCase();
    const bodyLower = body.toLowerCase();
    if (!bodyLower.includes(companyNameLower)) {
      errors.push(`Company name not mentioned in draft ('${context.companyName}')`);
    }
    if (companySignalLower.length > 3 && !bodyLower.includes(companySignalLower)) {
      const tokens = companySignalLower.split(/\s+/).filter((t) => t.length > 4);
      const tokenMatch = tokens.some((t) => bodyLower.includes(t));
      if (!tokenMatch) {
        errors.push(`Verified company signal not mentioned in draft ('${context.companySignal}')`);
      }
    }

    // 5. Candidate provenance: candidate employer must be mentioned
    if (!bodyLower.includes(context.candidateEmployer.toLowerCase())) {
      errors.push(`Candidate employer not mentioned in draft ('${context.candidateEmployer}')`);
    }

    // 6. Relationship exists
    if (!context.relationshipExplanation || context.relationshipExplanation.trim().length === 0) {
      errors.push('No approved relationship explanation provided');
    }

    // 7. No forbidden internal metadata
    const forbiddenInternalTokens = [
      'v3match',
      'direct_technical',
      'domain_alignment',
      'compositescore',
      'confidencescore',
      'atomicclaim',
      'groundedevidence',
      'research summary',
      'tier 1',
      'tier 2',
      'scoring',
      'ranking_score',
    ];
    for (const token of forbiddenInternalTokens) {
      if (bodyLower.includes(token)) {
        errors.push(`Forbidden internal metadata detected in email body ('${token}')`);
      }
    }

    // 8. No forbidden generic statements
    const forbiddenFiller = [
      'following your work',
      'resonated with my background',
      'aligns with your platform challenges',
      'hope this email finds you well',
      'reaching out to express my interest in joining',
    ];
    for (const filler of forbiddenFiller) {
      if (bodyLower.includes(filler)) {
        errors.push(`Forbidden generic filler phrase detected ('${filler}')`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Regenerates a single draft variant with explicit error feedback if validation failed.
   */
  public async regenerateDraftWithFeedback(
    context: StructuredOutreachContext,
    candidateName: string,
    signature: string,
    errors: string[],
    previousBody: string,
  ): Promise<{ subject: string; body: string }> {
    this.logger.log(`Regenerating draft with feedback for ${context.recipientEmail}. Issues: ${errors.join(', ')}`);

    const systemPrompt = `# RELAY OUTREACH: DRAFT CORRECTION & REGENERATION
You are an expert engineer revising an outreach email that failed quality validation.
You MUST correct all identified issues while preserving the authentic engineer-to-engineer tone.

CRITICAL RULES:
1. TOTAL WORD COUNT MUST BE UNDER 100 WORDS (Ideal: 65-80 words).
2. EXPRESS PRE-ESTABLISHED RELATIONSHIP:
   Connect [Company Signal] to [Candidate Experience] using [Relationship Explanation].
   Active verbs only ("When building X, we tackled Y..."). NEVER write "I building".
3. RECIPIENT ALREADY KNOWS THEIR COMPANY: Never summarize or explain the recipient's company.
4. Mention resume naturally (e.g. "I've attached my resume for context.").
5. Include signature:
${signature}

Output pure JSON conforming to:
{
  "subject": "string",
  "body": "string"
}`;

    const userPrompt = `REVISION TASK:
- Recipient: ${context.recipientFirstName ? context.recipientFirstName : 'Peer'} (${context.recipientTitle}) at ${context.companyName}
- Company Signal: "${context.companySignal}"
- Candidate Experience: "${context.candidateExperience}" at ${context.candidateEmployer}
- Relationship Explanation: "${context.relationshipExplanation}"
- Previous Draft that Failed Validation:
${previousBody}

ERRORS TO FIX:
${errors.map((e, idx) => `${idx + 1}. ${e}`).join('\n')}

Produce a revised, flawless draft in pure JSON with word count <= 100 words.`;

    try {
      const result = await this.aiProviderService.structuredComplete<{ subject: string; body: string }>({
        systemPrompt,
        userPrompt,
        feature: 'OUTREACH_GENERATION',
        model: this.writingModel,
        maxTokens: 600,
        temperature: 0.1,
      });

      let body = result.data.body?.trim() || '';
      let subject = result.data.subject?.trim() || `${candidateName} - Resume`;

      if (!body.includes('GitHub:') && !body.includes('LinkedIn:')) {
        body = `${body}\n\n${signature}`.trim();
      }

      if (calculateRenderedWordCount(body) > 100 || /\bI\s+[a-z]+ing\b/i.test(body)) {
        body = `Hi ${context.recipientFirstName || ''},\n\nI'm ${candidateName.split(' ')[0]}, a ${context.candidateRole} at ${context.candidateEmployer}.\n\nI noticed ${context.companyName}'s work on ${context.companySignal}. When building ${context.candidateExperience} at ${context.candidateEmployer}, we focused on similar ${context.relationshipExplanation}.\n\n${
          context.recipientClass === 'ENGINEERING_PEER'
            ? "Happy to share more details about my work if it's relevant to what the team is building. I've attached my resume for context."
            : "If there are software engineering opportunities aligned with my background, I'd welcome the opportunity to be considered. I've attached my resume."
        }\n\n${signature}`.replace(/\n{3,}/g, '\n\n').trim();
      }

      return { subject, body };
    } catch (err: any) {
      this.logger.error(`Regeneration call failed: ${err.message}`);
      const body = `Hi ${context.recipientFirstName || ''},\n\nI'm ${candidateName.split(' ')[0]}, a ${context.candidateRole} at ${context.candidateEmployer}.\n\nI noticed ${context.companyName}'s work on ${context.companySignal}. When building ${context.candidateExperience} at ${context.candidateEmployer}, we focused on similar ${context.relationshipExplanation}.\n\n${
        context.recipientClass === 'ENGINEERING_PEER'
          ? "Happy to share more details about my work if it's relevant to what the team is building. I've attached my resume for context."
          : "If there are software engineering opportunities aligned with my background, I'd welcome the opportunity to be considered. I've attached my resume."
      }\n\n${signature}`.replace(/\n{3,}/g, '\n\n').trim();

      return {
        subject: `${candidateName} - Resume`,
        body,
      };
    }
  }
}
