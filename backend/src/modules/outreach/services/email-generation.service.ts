import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Prospect, ContactType, PersonalizationLevel } from '../../prospects/entities/prospect.entity';
import {
  CandidateMatchingService,
  CandidateMatchResult,
  CandidateFallbackFacts,
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
  personalizationLevel: PersonalizationLevel;
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
  candidateFacts?: CandidateFallbackFacts;
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
  personalizationLevel: PersonalizationLevel;
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

    const candidateName = candidate?.name?.trim() || v3Match?.candidateFacts?.name || 'Software Engineer';
    const githubUrl = candidate?.links?.github || '';
    const linkedinUrl = candidate?.links?.linkedin || '';
    const signatureParts = [`Best,`, candidateName];
    if (githubUrl) signatureParts.push(`GitHub: ${githubUrl}`);
    if (linkedinUrl) signatureParts.push(`LinkedIn: ${linkedinUrl}`);
    const signature = signatureParts.join('\n');

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
    const candidateEv = v3Match?.candidateEvidence;
    const companyEv = v3Match?.companyEvidence;
    const relationshipMatch = v3Match?.match;
    const candidateFacts = v3Match?.candidateFacts;
    const personalizationLevel = v3Match?.personalizationLevel || PersonalizationLevel.GENERAL_COLD_OUTREACH;

    // Dynamically derive candidate employer and role from candidate profile and evidence (no hardcoding)
    const candidateEmployer =
      candidateEv?.experience?.employer ||
      candidateFacts?.currentOrRecentEmployer ||
      candidate?.experience?.[0]?.company ||
      '';
    const candidateRole =
      candidateEv?.experience?.roleTitle ||
      candidateFacts?.roleTitle ||
      candidate?.title ||
      'Software Engineer';
    const candidateFirstName = candidateName.split(' ')[0];

    // Factual normalization of candidate deliverable/claim
    let cleanCandidateClaim = candidateEv?.deliverableName || candidateEv?.atomicClaim || '';
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
    if (personalizationLevel !== PersonalizationLevel.GENERAL_COLD_OUTREACH) {
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
        cleanCompanySignal = `${company.companyName}'s engineering initiatives`;
      }

      if (cleanCompanySignal.endsWith('.')) {
        cleanCompanySignal = cleanCompanySignal.slice(0, -1);
      }
    }

    // Factual normalization of the pre-established relationship rationale
    let cleanBridge = relationshipMatch?.analyticalRationale || '';
    cleanBridge = cleanBridge.replace(/^(direct\s+match\s+on|alignment\s+on|direct\s+technical\s+match\s+on)\s+/i, '').trim();
    if (cleanBridge.endsWith('.')) {
      cleanBridge = cleanBridge.slice(0, -1);
    }

    // Form the structured context (Isolated data object passed to the writer)
    const structuredContext: StructuredOutreachContext = {
      companyName: company.companyName,
      personalizationLevel,
      companySignal: cleanCompanySignal,
      companySourceQuote: companyEv?.verbatimQuote || companyEv?.atomicClaim || cleanCompanySignal,
      candidateEmployer,
      candidateRole,
      candidateExperience: cleanCandidateClaim,
      candidateSourceBullet: candidateEv?.rawBulletText || cleanCandidateClaim,
      relationshipType: relationshipMatch?.relationshipType || (personalizationLevel === PersonalizationLevel.PERSONALIZED ? 'DIRECT_TECHNICAL' : 'GENERAL_COLD'),
      relationshipExplanation: cleanBridge,
      outreachObjective: recipientClassification.recipientClass === 'ENGINEERING_PEER' ? 'START_CONVERSATION' : 'EXPRESS_INTEREST',
      recipientClass: recipientClassification.recipientClass,
      recipientTitle: recipientClassification.title,
      recipientFirstName,
      recipientEmail,
      candidateFacts,
    };

    // Clean, concise professional introductions
    const roleAtEmployer = candidateEmployer
      ? `${candidateRole} at ${candidateEmployer}`
      : `${candidateRole}`;

    const openingStyles = [
      `I'm ${candidateFirstName}, a ${roleAtEmployer}.`,
      `I'm ${candidateFirstName}. I work as a ${roleAtEmployer}.`,
      `I'm ${candidateFirstName}. Most of my work has been focused on ${candidateRole.toLowerCase()}${candidateEmployer ? ` at ${candidateEmployer}` : ''}.`,
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

    // Reason Contact Chosen description
    const reasonContactChosen =
      recipientClassification.recipientClass === 'ENGINEERING_PEER'
        ? `Engineering peer / lead at ${company.companyName}; ideal peer contact to discuss architecture, backend systems, and team challenges.`
        : `Talent partner at ${company.companyName}; handles software engineering pipelines and hiring considerations.`;

    // 2. V2 PROMPT: Outreach Authoritative Prompt with Research/Output Split + Cardinality + Predicate Bans
    // Note: final rendered word count (hard <=100) includes EVERYTHING the recipient receives:
    // greeting + body + CTA + sign-off + signature ("Best, / Name / GitHub / LinkedIn").
    // Signature is already appended in sanitizeVariant; the validator sees the final rendered body inclusive of signature.
    const systemPrompt = `# RELAY OUTREACH — AUTHORITATIVE WRITING PROMPT V2

## SECTION A: [INTERNAL RESEARCH CONTEXT — DO NOT REPRODUCE, QUOTE, OR PARAPHRASE IN OUTPUT]
The data below is for GROUNDING AND SELECTION ONLY.
None of this section's analytical wording, relationship rationale, scores, or metadata may appear in the final email.
Do not copy the relationship rationale verbatim or near-verbatim; if you reference the link at all, do so only implicitly in plain English.

- Personalization Tier (RELATIONSHIP ONLY; use to choose WHICH approved signal + experience to express):
  ${personalizationLevel}
- Recipient Classification (tone selection only; do not mention in output):
  Recipient Type: ${recipientClassification.recipientClass} (${recipientClassification.title})
  Recipient Goal: ${recipientClassification.goal}
  Recipient Tone Focus: ${recipientClassification.focus}
- Candidate Identity (use VERBATIM for name / role / employer / signature only — do not invent):
  Full Name:  ${candidateName}
  Role:       ${candidateRole}
  Employer:   ${candidateEmployer || 'omitted if not available from DB'}
  GitHub:     ${githubUrl || 'not provided'}
  LinkedIn:   ${linkedinUrl || 'not provided'}
- Approved Candidate Evidence (EXACTLY ONE per email — pick the strongest; never invent, never rename, never abbreviate):
  Verbatim deliverable / capability names from candidate_profile / candidate_experience / candidate_evidence DB rows ONLY:
  ${
    cleanCandidateClaim
      ? `  1. "${cleanCandidateClaim}"`
      : '  (none available; fall back to generic: use only role + employer + core technologies below)'
  }
  Additional DB-backed core technologies (max 3 named; use in P1 or general fallback, NOT as a 2nd "experience"):
  ${candidateFacts?.coreTechnologies?.slice(0, 3).join(', ') || 'NestJS, PostgreSQL, Redis (if verified in DB else do not list)'}
- Approved Company Evidence (EXACTLY ONE per email — pick the strongest; never invent, never rename):
  ${
    cleanCompanySignal
      ? `  1. Company signal / initiative name (verbatim short form): "${cleanCompanySignal}"`
      : '  (NONE VERIFIED — fall back to GENERAL_COLD_OUTREACH below. Do NOT fabricate a company signal.)'
  }
- Approved Relationship Idea (use ONLY to decide HOW the one signal connects to the one experience — DO NOT copy wording):
  Relationship type: ${relationshipMatch?.relationshipType || (personalizationLevel === PersonalizationLevel.PERSONALIZED ? 'DIRECT_TECHNICAL' : 'GENERAL_COLD')}
  Matcher's rationale (for writer's internal sense of what engineering problem is shared, not for direct quotation):
    ${cleanBridge || 'none supplied; fall back to general truthful introduction'}
- REQUIRED Ending CTA (P3 must be one natural sentence that ends with a low-friction ask similar to this exact wording):
  "${rotatedEnding}"
- REQUIRED Signature (MUST appear at the very end of every body verbatim. Signature WORDS COUNT toward the hard 100-word rule. Include every line.):
${signature}

## SECTION B: [RECIPIENT-FACING OUTPUT — EVERYTHING IN THIS SECTION IS WHAT THE RECIPIENT READS]
You are a real engineer writing a short cold email to another professional.
Read like a real person wrote it in 2 minutes — NOT like a research summary, analyst note, or marketing copy.

### PERSONALIZATION-TIER INSTRUCTIONS (3 tiers; match exactly):

TIER: ${personalizationLevel}

${
  personalizationLevel === PersonalizationLevel.GENERAL_COLD_OUTREACH
    ? `**GENERAL_COLD_OUTREACH — no verified company specifics available**
P2 must contain ZERO company-specific signals, ZERO claims of alignment, ZERO product/initiative references.
Your only truthful claims are:
  - who the candidate really is (name, role, employer — from DB only)
  - what technologies / platform areas the candidate actually works with (DB only, max 3 named)
  - sincere interest in learning more about the team at ${company.companyName}
  - the required CTA
DO NOT:
  - use ${company.companyName}'s \`industry\`, \`summary\`, or domain as if they were "research".
  - pretend familiarity or any knowledge of company problems/products.
  - name any candidate project/deliverable UNLESS it appears in Approved Candidate Evidence above with a real DB-verbatim name.
Structure:
  P1: Hi [first name], + 1 sentence self-intro (name, role, employer).
  P2: 1–2 sentences of real candidate engineering focus (role + core tech from DB). No company specifics.
  P3: 1-sentence required CTA + mention attached resume naturally.
  Signature block (as provided, VERBATIM).`
    : personalizationLevel === PersonalizationLevel.PARTIALLY_PERSONALIZED
    ? `**PARTIALLY_PERSONALIZED — broad signal, broad truthful capability**
You have exactly ONE useful company signal (above) and ONE broad candidate capability (above).
The matcher already confirmed a plausible broad overlap. Do not invent a tighter link than that.
DO NOT:
  - invent / rename / rephrase the approved signal or deliverable names. Use them EXACTLY as given in Section A or do not name them.
  - add a 2nd company signal.
  - add a 2nd candidate experience / deliverable.
  - claim direct knowledge of the recipient's team, roadmap, or challenges beyond the one signal named.
Structure (hard):
  P1: Hi [first name], + 1 sentence self-intro (name, role, employer).
  P2: EXACTLY 2 SENTENCES MAX:
       (i) 1 short sentence referencing the ONE chosen company signal. No company description — the recipient already knows their company. DO NOT write sentences of the form "${company.companyName} [provides | delivers | helps | offers | builds | creates | enables | allows | supports | serves] ...". Safe preposition usage: "at ${company.companyName}", "on ${company.companyName}'s team", "${company.companyName}'s recent work on [signal name]".
       (ii) 1 sentence that links the ONE chosen candidate capability to that signal using SIMPLE PLAIN WORDS of your own choosing. Do not copy the rationale wording. Do not claim a perfect/exceptional fit.
  P3: 1-sentence required CTA + mention attached resume naturally.
  Signature block (VERBATIM).`
    : `**PERSONALIZED — specific signal, specific deliverable, clear shared problem**
The matcher has already verified: (a) ONE real company initiative / signal, (b) ONE real candidate deliverable, and (c) a clear shared engineering concern between them.
Your job is ONLY to express that already-verified link naturally — DO NOT DISCOVER NEW RELATIONSHIPS. DO NOT INVENT A STRONGER LINK.
Rules:
  - Use EXACTLY ONE company signal (verbatim short form from Section A). Never name a second.
  - Use EXACTLY ONE candidate deliverable (verbatim name from Section A). Never name a second.
  - State the shared engineering concern in simple language, as one engineer talking to another.
  - Do not copy the matcher's rationale wording. Your P2 link sentence must be your own simple words.
  - Never describe ${company.companyName}'s business model to the recipient.
Structure (hard):
  P1: Hi [first name], + 1 sentence self-intro (name, role, employer).
  P2: EXACTLY 2 SENTENCES:
       (i) 1 short sentence naming the ONE chosen company signal/initiative. Use only safe prepositional phrasing near "${company.companyName}" (see PARTIALLY_PERSONALIZED predicate ban above; banned: provides/delivers/helps/offers/builds/creates/enables/allows/supports/serves).
       (ii) 1 sentence naming the ONE chosen candidate deliverable and stating the concrete shared engineering problem / approach that connects them.
  P3: 1-sentence required CTA + mention attached resume naturally.
  Signature block (VERBATIM).`
}

### NON-NEGOTIABLE GLOBAL RULES — BREAK ANY = FAIL (deterministic validator + semantic auditor both check):
1. **HARD ≤100 WORDS TOTAL.** Count EVERYTHING from greeting ("Hi Sam,") through the last line of signature ("LinkedIn: ...") — every word the recipient receives. Target 70–92 words to leave headroom. If over 100, delete the weakest clause or adjective, then re-count.
2. **CARDINALITY:** ≤1 company signal (zero for GENERAL_COLD) and ≤1 candidate deliverable/experience (zero if DB has no verbatim evidence). Never list multiple.
3. **COMPANY-DESCRIPTION PREDICATE BAN** (applies to any sentence that includes the literal string "${company.companyName}"):
   NEVER write any of these predicates within 5 tokens of "${company.companyName}":
     provides, delivers, helps, offers, builds, makes, creates, enables, allows, supports, serves, focuses, specializes, operates.
   Safe: "at ${company.companyName}", "on ${company.companyName}'s team", "${company.companyName}'s recent work on [signal name]", "reach out to ${company.companyName}".
4. **INVENTED FAMILIARITY BAN:** Never write "I've been following", "I was impressed by", "I admire", "Stumbled on", "Came across", "Tracked", "Reading up on", "Recently noticed", "Saw what you're building". No invented closeness.
5. **UNSUPPORTED ALIGNMENT / FIT BAN:** Never write "aligns perfectly", "aligns with your challenges", "great fit", "synergy", "thrilled", "passionate", "cutting-edge", "world-class team". The only allowed "fit" claim is the implicit one contained in the P2 link sentence (1 sentence max).
6. **CANDIDATE FACT INTEGRITY:** Every named candidate project / deliverable / employer in the email MUST match a verbatim string in the Approved Candidate Evidence list in Section A, OR be the literal role/employer from Section A. If a project name is not in Section A, DO NOT INVENT ONE. Do not paraphrase, shorten, modify, or rebrand a project name.
7. **NO EVIDENCE CORRUPTION:** Do not mangle, fragment, or creatively rephrase company signal names. Use the exact approved string OR omit the name entirely and describe it in generic P2 (PARTIALLY_PERSONALIZED only) with generic wording like "your recent work around caching" — never invent a name.
8. **GRAMMAR:** Perfect English. No "I building", "I designing", missing auxiliaries, run-ons, comma splices. Active voice strongly preferred.
9. **NATURAL HUMAN TONE:** Ban filler/buzzwords: additionally, furthermore, moreover, notably, importantly, incredibly, deeply, extremely, highly, in my current role, i have had the opportunity to, owned and maintained, have successfully, particularly interested in, writing to express interest, rockstar, cutting-edge, game-changing, revolutionary, inspired by, i'm excited to apply, i believe i'd be a great fit, happy to brainstorm, thought i'd reach out, love your thoughts. Write like you'd actually email a stranger.
10. **NO INTERNAL REASONING / SCORING EXPOSED:** Do not output the pre-emit self-audit numbers, confidenceLevel, reasoning, scores, tier labels, or research-speak in any body or subject. The reader never sees them.
11. **SIGNATURE INTEGRITY:** Append the signature VERBATIM at the end of every variant body. Do not reorder, abbreviate, or drop any of its lines. Its words count toward the 100-word limit.

### PRE-EMIT SELF-AUDIT (do silently for each variant before writing the JSON; DO NOT include this audit in any output string shown to the recipient)
  a. Count words of the complete rendered body (greeting through final signature line). If >100, trim. Re-count. Stop when ≤100.
  b. Count distinct company signals referenced by name: ≤1. GENERAL_COLD must have 0.
  c. Count distinct candidate deliverables named: ≤1. If none in DB, 0 is fine.
  d. Scan each sentence that contains "${company.companyName}": check within ±5 tokens for any banned predicate (rule 3). Fail if present.
  e. Scan for banned familiarity phrases (rule 4) and banned alignment adjectives (rule 5). Fail if present.
  f. For every project/deliverable name in the body, confirm exact-string presence in Approved Candidate Evidence section. If not present, remove the name.
  g. Grammar pass: read once, fix any "I <verb>ing" without an auxiliary verb, run-ons, subject-verb disagreement.
  h. Subjects: ≤50 characters. Must contain one of [engineer, engineering, developer, software, resume, backend, platform]. No \n.

### FINAL JSON OUTPUT SCHEMA
Output PURE JSON. No preamble, no prose, no markdown fences. Start with {, end with }.

{
  "technicalVariant": { "subject": "string ≤50 chars, engineer-specific", "body": "string with full rendered body + VERBATIM signature" },
  "startupVariant":   { "subject": "string ≤50 chars", "body": "string with full rendered body + VERBATIM signature" },
  "directVariant":    { "subject": "string ≤50 chars", "body": "string with full rendered body + VERBATIM signature" },
  "whyCompany": "1 short internal-only sentence; NEVER shown to recipient. No recipient-facing copy.",
  "whyMe":      "1 short internal-only sentence; NEVER shown to recipient. No recipient-facing copy.",
  "whyNow":     "1 short internal-only sentence; NEVER shown to recipient. No recipient-facing copy.",
  "confidenceLevel": "HIGH | MEDIUM | LOW",
  "_selfAudit": {
    "wordCounts": { "technicalVariant": number, "startupVariant": number, "directVariant": number },
    "signalsUsed": number,
    "deliverablesUsed": number,
    "bannedPhrasesFound": []
  }
}

Output PURE JSON ONLY. Start with {, end with }. No Markdown fences.`;

    // Tier-specific user prompt is intentionally minimal for V2:
    // the system prompt above already contains the full tiered rules.
    // The user prompt only restates the approved evidence items in labeled form so the writer
    // can see them clearly at the top of the task. No relationship discovery happens here —
    // all selection is already done by the matcher via structuredContext.
    let userPrompt: string;
    const tierLabel = personalizationLevel;
    const coreTechLine = candidateFacts?.coreTechnologies?.slice(0, 3).join(', ') || '(max 3 from DB skills table)';
    if (personalizationLevel === PersonalizationLevel.GENERAL_COLD_OUTREACH) {
      userPrompt = `TIER: ${tierLabel} (GENERAL_COLD_OUTREACH)
APPROVED EVIDENCE (NO company signal verified — do not invent any):
- Candidate Full Name: ${candidateName}
- Candidate Role: ${structuredContext.candidateRole}
- Candidate Employer: ${structuredContext.candidateEmployer || '(not present in DB; omit)'}
- DB-Verified Core Technologies (max 3 to name): ${coreTechLine}
${candidateFacts?.notableAchievements?.[0] ? `- DB-Verified Achievement: ${candidateFacts.notableAchievements[0]}` : ''}
- Company Name (for greeting/prepositions only): ${structuredContext.companyName}
- REQUIRED Signature (INCLUDE VERBATIM at the END of EVERY body; its words COUNT toward the 100-word max):
${signature}
- REQUIRED CTA phrasing direction: "${rotatedEnding}"

Follow Section B GENERAL_COLD_OUTREACH structure exactly. Output pure JSON per schema.`;
    } else if (personalizationLevel === PersonalizationLevel.PARTIALLY_PERSONALIZED) {
      userPrompt = `TIER: ${tierLabel} (PARTIALLY_PERSONALIZED)
APPROVED EVIDENCE — EXACTLY 1 SIGNAL + EXACTLY 1 CAPABILITY MAX. The matcher selected these; you only express the approved link naturally.
- Candidate Full Name: ${candidateName}
- Candidate Role: ${structuredContext.candidateRole}
- Candidate Employer: ${structuredContext.candidateEmployer || '(not present in DB; omit)'}
- DB-Verified Candidate Capability / Deliverable (USE VERBATIM OR DO NOT NAME IT): "${structuredContext.candidateExperience || '(no verbatim deliverable name; fall back to role + core tech)'}"
- DB-Verified Core Technologies (max 3 to name): ${coreTechLine}
- DB-Verified Company Signal / Initiative (USE VERBATIM OR DO NOT NAME IT; 1 MAX): "${structuredContext.companySignal}"
- Approved Shared Concern (for internal sense only — YOUR OWN SIMPLE WORDS, do NOT copy this string verbatim into body): "${structuredContext.relationshipExplanation || '(none; be honest and use PARTIALLY_PERSONALIZED broad language)'}"
- Company Name (safe prepositions only near name): ${structuredContext.companyName}
- REQUIRED Signature (INCLUDE VERBATIM; WORDS COUNT toward 100 max):
${signature}
- REQUIRED CTA phrasing direction: "${rotatedEnding}"

Follow Section B PARTIALLY_PERSONALIZED structure exactly. Output pure JSON per schema.`;
    } else {
      userPrompt = `TIER: ${tierLabel} (PERSONALIZED)
APPROVED EVIDENCE — EXACTLY 1 SIGNAL + EXACTLY 1 DELIVERABLE. The matcher already verified the relationship; you only express it naturally, never discover new ones.
- Candidate Full Name: ${candidateName}
- Candidate Role: ${structuredContext.candidateRole}
- Candidate Employer: ${structuredContext.candidateEmployer || '(not present in DB; omit)'}
- DB-Verified Candidate Deliverable (USE VERBATIM OR DO NOT NAME IT; 1 MAX): "${structuredContext.candidateExperience || '(no verbatim deliverable — use PARTIALLY_PERSONALIZED instead)'}"
- DB-Verified Core Technologies (max 3 named): ${coreTechLine}
- DB-Verified Company Signal / Initiative (USE VERBATIM OR DO NOT NAME IT; 1 MAX): "${structuredContext.companySignal}"
- Approved Shared Engineering Problem (for your internal sense only — rephrase into simple words; do NOT copy this string into body): "${structuredContext.relationshipExplanation || '(none supplied — keep it honest and simple)'}"
- Company Name (safe prepositions only near name): ${structuredContext.companyName}
- REQUIRED Signature (INCLUDE VERBATIM; WORDS COUNT toward 100 max):
${signature}
- REQUIRED CTA phrasing direction: "${rotatedEnding}"

Follow Section B PERSONALIZED structure exactly. Output pure JSON per schema.`;
    }

    const aiResult = await this.aiProviderService.structuredComplete<RawAiMultiVariantResponse>({
      systemPrompt,
      userPrompt,
      feature: 'OUTREACH_GENERATION',
      model: this.writingModel,
      maxTokens: 4096,
      temperature: 0.2,
      metadata: { domain: company.domain, email: recipientEmail },
    });

    const data = aiResult.data;

    // Helper to sanitize each generated variant against guardrails & strict 100-word limit
    const sanitizeVariant = (v: { subject?: string; body?: string }, defaultSubject: string) => {
      let subject = v?.subject?.trim() || defaultSubject;
      let body = v?.body?.trim() || '';

      if (
        !DraftQualityService.hasMandatorySubjectKeyword(subject, candidateName) ||
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
      if (!body.includes(candidateName)) {
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
      multiResumeMatch?.evidenceUsedInEmail ||
      (candidateEv?.deliverableName ? [candidateEv.deliverableName] : candidateFacts?.keyDeliverables?.slice(0, 3)) ||
      [];
    const keyMatches =
      multiResumeMatch?.keyMatches ||
      (matchResult.matchedTechnologies.length > 0
        ? matchResult.matchedTechnologies
        : candidateFacts?.coreTechnologies?.slice(0, 4) || []);
    const projectsReferenced =
      multiResumeMatch?.projectsReferenced ||
      (matchResult.chosenProject ? [matchResult.chosenProject] : candidateFacts?.keyDeliverables?.slice(0, 2) || []);
    const whyMePoints =
      multiResumeMatch?.whyMePoints ||
      (candidateFacts?.coreTechnologies?.length
        ? [`Hands-on expertise with ${candidateFacts.coreTechnologies.slice(0, 4).join(', ')}.`]
        : []);
    const missingSkills = multiResumeMatch?.missingSkills || [];
    const recommendedTalkingPoints =
      multiResumeMatch?.recommendedTalkingPoints || [
        `Explore technical challenges and platform engineering initiatives at ${company.companyName}.`,
      ];

    return {
      personalizationLevel,
      subject: bestVariant.subject,
      body: bestVariant.body,
      selectedVariantType: bestVariant.variantType,
      variants: evaluatedVariants,
      matchResult,
      quality: bestVariant.quality,
      whyCompany:
        data.whyCompany ||
        `${company.companyName} engineering team.`,
      whyMe:
        data.whyMe ||
        `${candidateRole} with verified experience in production systems.`,
      whyNow: data.whyNow || null,
      whyRelevant: cleanBridge || `Outreach at ${personalizationLevel}`,
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
   * Deterministic Validation Gate:
   * Validates word count <= 100 on the FULL rendered email the recipient will see,
   * INCLUDING greeting, body, CTA, sign-off, and signature ("Best, Name, GitHub, LinkedIn").
   * Also checks: grammar, evidence duplication, provenance, relationship existence,
   * internal metadata absence, forbidden filler, forbidden company-description predicates
   * near company name, and signal/deliverable cardinality (≤1 each for non-GENERAL tiers).
   */
  public validateDraftDeterministic(
    subject: string,
    body: string,
    context: StructuredOutreachContext,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    // Body already includes appended signature (sanitizeVariant added it), so this word count
    // correctly counts EVERYTHING the recipient receives — greeting+body+CTA+sign-off+signature.
    const wordCount = calculateRenderedWordCount(body);

    // 1. Strict <= 100 words limit (hard rule 1) — signature included)
    if (wordCount > 100) {
      errors.push(`Email exceeds 100 words hard limit, INCLUDING SIGNATURE (actual: ${wordCount} words)`);
    }
    if (wordCount < 35) {
      errors.push(`Email too brief (actual: ${wordCount} words)`);
    }

    // 2. Grammar check: malformed participle subjects ("I building", "I designing")
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

    // 4. Provenance: company name must be mentioned
    const companyNameLower = (context.companyName || '').toLowerCase();
    const bodyLower = body.toLowerCase();
    if (companyNameLower.length > 0 && !bodyLower.includes(companyNameLower)) {
      errors.push(`Company name not mentioned in draft ('${context.companyName}')`);
    }

    // 4b. Cardinality + provenance of company signal for personalized/partially tiers
    if (context.personalizationLevel !== PersonalizationLevel.GENERAL_COLD_OUTREACH) {
      const companySignalLower = (context.companySignal || '').toLowerCase();
      let signalMentions = 0;
      if (companySignalLower.length > 3) {
        // Direct string
        if (bodyLower.includes(companySignalLower)) signalMentions++;
        // Tokens of length >4 chars: count if present at all
        const tokens = companySignalLower.split(/\s+/).filter((t) => t.length > 4);
        const tokenMatchCount = tokens.filter((t) => bodyLower.includes(t)).length;
        if (signalMentions === 0 && tokenMatchCount === 0) {
          errors.push(`Verified company signal not mentioned in draft ('${context.companySignal}')`);
        }
      }
      // Cardinality: ≤1 distinct company signal. We check for BOTH:
      //  (a) the approved signal only, and
      //  (b) no OTHER company-product/initiative names pulled from evidence repo aren't added.
      // Simple heuristic: count occurrences of tokens of length > 8 chars that look like they are naming
      // signal names — use multiple separate capitalized tokens. If >1 distinct multi-word proper-noun phrase
      // appears with signal-like tokens, flag it as possible multi-signal dump.
      if (companySignalLower.length > 10) {
        // Only check when we have a real signal to gate against
        const sentSplit = bodyLower.split(/[.!?]+/);
        let distinctSignalLike = new Set<string>();
        for (const sent of sentSplit) {
          if (sent.includes(companyNameLower)) continue;
          const longToks = sent.split(/\s+/).filter((t) => t.length >= 6);
          if (longToks.length >= 3) {
            // Only count if has at least one token from the signal — otherwise it's body text
            if (longToks.some((t) => companySignalLower.includes(t))) {
              distinctSignalLike.add(longToks.join(' ').slice(0, 40));
            }
          }
        }
        if (distinctSignalLike.size > 1) {
          errors.push(`Multiple distinct company signals appear to be referenced (${distinctSignalLike.size}); max 1 allowed)`);
        }
      }

      // Cardinality: ≤1 distinct candidate deliverable/experience — checked in section 4c below

      // Relationship must exist
      if (!context.relationshipExplanation || context.relationshipExplanation.trim().length === 0) {
        errors.push('No approved relationship explanation provided');
      }
    } else {
      // GENERAL_COLD: company signal / candidate deliverable named count MUST BE 0 OR not flagged
      // (they can still use employer + role only). No structural check needed;
      // semantic auditor flags company-specific language here if any.
    }

    // 4c. Cardinality of candidate deliverables (≤1) — run for all tiers to prevent multi-dump
    {
      const candExp = (context.candidateExperience || '').trim();
      if (candExp.length > 6) {
        // Approximate distinct proper-noun deliverable names: look for project/platform/system/... matches
        // Heuristic: split body sentences; count distinct capitalized-initial 2-4-word phrases that
        // contain an engineering deliverable keyword but aren't role/employer words.
        const lower = bodyLower;
        const knownDelivKeywords = /\b(platform|system|module|pipeline|engine|cache|caching|audit|notification|survey|gateway|workflow|logging|authorization|service)\b/i;
        const lines = body.split(/\n+/);
        const unique: Set<string> = new Set();
        for (const line of lines) {
          const m = line.match(/\b([A-Z][A-Za-z0-9]{2,}(?:\s+[A-Z][A-Za-z0-9]{2,}){1,3})\b/g);
          if (m) {
            for (const phrase of m) {
              if (knownDelivKeywords.test(phrase) || lower.includes(String(phrase).toLowerCase())) {
                // Skip the candidate's own employer/name — do not count
                const employerLower = (context.candidateEmployer || '').toLowerCase();
                const nameLower = (context.candidateRole || '').toLowerCase();
                if (employerLower.includes(String(phrase).toLowerCase()) || nameLower.includes(String(phrase).toLowerCase())) continue;
                unique.add(String(phrase).toLowerCase().slice(0, 40));
              }
            }
          }
        }
        // Only flag if 2+ distinct deliverable proper nouns are present and neither is
        // a substring of the approved one (so approval substring overlap doesn't trip)
        const approved = candExp.toLowerCase();
        const nonApproved = Array.from(unique).filter((x) => !approved.includes(x) && !x.includes(approved));
        if (nonApproved.length >= 1 && approved.length > 0) {
          // approved must be ≤1 distinct; if 2 distinct are named total, flag
          const total = unique.size;
          if (total > 1) {
            errors.push(`Multiple distinct candidate deliverables named (${total}); exactly 1 allowed. Offenders: ${Array.from(unique).slice(0, 3).join('; ')})`);
          }
        }
      }
    }

    // 5. Candidate provenance: candidate employer or role must be mentioned (same as before)
    if (context.candidateEmployer && !bodyLower.includes(context.candidateEmployer.toLowerCase())) {
      const roleTokens = (context.candidateRole || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4);
      const hasRoleMatch = roleTokens.some((t) => bodyLower.includes(t));
      if (!hasRoleMatch) {
        errors.push(`Candidate employer or role not mentioned in draft ('${context.candidateEmployer}')`);
      }
    }

    // 5b. FORBIDDEN COMPANY-DESCRIPTION PREDICATE near company name (rule 4 / global rule)
    //   Within any sentence containing the company name, check within ±5 tokens for banned predicates.
    if (companyNameLower.length > 0) {
      const bannedPredicates = [
        'provides', 'delivers', 'helps', 'offers', 'builds', 'makes',
        'creates', 'enables', 'allows', 'supports', 'serves',
        'focuses', 'specializes', 'operates',
        'is focused on', 'are focused on', 'specializes in', 'operates in',
      ];
      const sentences = body.split(/(?<=[.!?])\s+/);
      for (const rawSent of sentences) {
        const sent = rawSent.trim();
        if (!sent.toLowerCase().includes(companyNameLower)) continue;
        const tokens = sent.split(/\s+/);
        const companyIdx = tokens.findIndex((t) => t.toLowerCase().includes(companyNameLower.split(/\s+/)[0]));
        if (companyIdx < 0) continue;
        const windowStart = Math.max(0, companyIdx - 6);
        const windowEnd = Math.min(tokens.length, companyIdx + 8);
        const window = tokens.slice(windowStart, windowEnd).join(' ').toLowerCase();
        for (const pred of bannedPredicates) {
          if (window.includes(pred)) {
            errors.push(
              `Forbidden company-description predicate near company name: found "${pred}" within 5 tokens of "${context.companyName}". This recapitulates the recipient's own company to them (rule 4).`,
            );
            break;
          }
        }
      }
    }

    // 6. No forbidden internal metadata
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
      '_selfaudit',
      'selfaudit',
      'bannedphrasesfound',
      'signalsused',
      'deliverablesused',
      'wordcounts',
    ];
    for (const token of forbiddenInternalTokens) {
      if (bodyLower.includes(token)) {
        errors.push(`Forbidden internal metadata / self-audit tokens detected in email body ('${token}')`);
      }
    }

    // 7. No forbidden generic / familiarity / alignment statements
    const forbiddenFiller = [
      'following your work',
      "i've been following",
      'resonated with my background',
      'aligns with your platform challenges',
      'aligns perfectly',
      'great fit',
      'hope this email finds you well',
      'reaching out to express my interest in joining',
      'i was impressed by',
      'i admire',
      'stumbled on',
      'came across',
      'cutting-edge',
      'game-changing',
      'revolutionary',
      'world-class team',
      'passionate about',
      'thrilled',
    ];
    for (const filler of forbiddenFiller) {
      if (bodyLower.includes(filler)) {
        errors.push(`Forbidden phrase detected ('${filler}')`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Regenerates a single draft variant with explicit error feedback if validation failed.
   * Word count hard limit of ≤100 APPLIES TO THE FULL RENDERED EMAIL INCLUDING SIGNATURE.
   */
  public async regenerateDraftWithFeedback(
    context: StructuredOutreachContext,
    candidateName: string,
    signature: string,
    errors: string[],
    previousBody: string,
  ): Promise<{ subject: string; body: string }> {
    this.logger.log(`Regenerating draft with feedback for ${context.recipientEmail}. Issues: ${errors.join(', ')}`);

    const systemPrompt = `# RELAY OUTREACH — DRAFT CORRECTION & REGENERATION (V2 RULES)
You are an expert engineer revising an outreach email that failed deterministic OR semantic quality validation.
Correct every listed issue. Keep authentic engineer-to-engineer tone.

## [INTERNAL RESEARCH — DO NOT QUOTE IN OUTPUT]
- Personalization Tier: ${context.personalizationLevel}
- Candidate (use verbatim only; do not invent projects):
  Full Name: ${candidateName}
  Role: ${context.candidateRole}
  Employer: ${context.candidateEmployer || '(not in DB — omit)'}
- Approved Candidate Deliverable (≤1 allowed; use EXACTLY VERBATIM or do not name it):
  "${context.candidateExperience || '(none verified — use role + core tech only)'}"
- Approved Company Signal (≤1 allowed; use EXACTLY VERBATIM or do not name it; 0 for GENERAL_COLD):
  "${context.companySignal || '(none verified — GENERAL_COLD)'}"
- Approved Shared Concern (rephrase in simple plain words; DO NOT COPY THIS STRING VERBATIM):
  "${context.relationshipExplanation || '(none supplied — use truthful general language)'}"
- REQUIRED Signature (APPEND THIS VERBATIM at END of body. COUNT ITS WORDS toward the hard 100-word limit. Do not drop any line.):
${signature}

## [RECIPIENT-FACING RULES]
All 11 Non-Negotiable Global Rules from the main V2 prompt are in effect.
HIGHLIGHTS FOR CORRECTION:
1. WORD COUNT: TOTAL WORD COUNT FROM FIRST GREETING THROUGH LAST LINE OF SIGNATURE MUST BE ≤100 WORDS. (Ideal 70–92.) Signature words COUNT.
2. CARDINALITY: ≤1 company signal, ≤1 candidate deliverable. GENERAL_COLD = 0 company signals.
3. PREDICATE BAN near "${context.companyName}" (within ±5 tokens of company name in a sentence):
   NEVER: provides, delivers, helps, offers, builds, makes, creates, enables, allows, supports, serves, focuses, specializes, operates.
   SAFE: "at ${context.companyName}", "on ${context.companyName}'s team", "${context.companyName}'s work on…".
4. FAMILIARITY / ALIGNMENT BANS: Never write "I've been following", "I was impressed", "stumbled on", "came across", "aligns perfectly", "great fit", "cutting-edge", "world-class team", "passionate", "thrilled", "hope this email finds you well".
5. STRUCTURE (3 paragraphs):
   P1 = greeting + 1-sentence self-intro (name, role, employer if verified).
   P2 = For PERSONALIZED/PARTIALLY: 2 sentences max (signal → deliverable → simple shared-engineering link).
        For GENERAL_COLD: 1–2 sentences of real role/tech focus. No company specifics.
   P3 = 1 low-friction CTA sentence with natural resume mention.
   LAST = Signature VERBATIM.
6. HALLUCINATION: If a candidate project/deliverable is not listed in Approved Evidence above with a verbatim name, DO NOT INVENT ONE. Use role + employer + core tech only.

## [OUTPUT]
PURE JSON ONLY. No preamble, no fences. Start with {, end with }.

{
  "subject": "string ≤50 chars; must contain one of [engineer, engineering, developer, software, resume, backend, platform]",
  "body":    "string; full email including VERBATIM signature at the end. FINAL COUNT ≤100 words INCLUDING SIGNATURE."
}`;

    const userPrompt = `REVISION TASK — correct every error listed below and re-emit a passing draft.

- Recipient: ${context.recipientFirstName ? context.recipientFirstName : 'Peer'} (${context.recipientTitle}) at ${context.companyName}
- Recipient Class: ${context.recipientClass}
- Tier: ${context.personalizationLevel}
${
  context.personalizationLevel !== PersonalizationLevel.GENERAL_COLD_OUTREACH
    ? `- Approved Company Signal (≤1): "${context.companySignal}"\n- Approved Candidate Deliverable (≤1): "${context.candidateExperience}" at ${context.candidateEmployer}\n- Approved Relationship Rationale (rephrase only): "${context.relationshipExplanation}"`
    : `- Candidate: ${candidateName} (${context.candidateRole}${context.candidateEmployer ? ` at ${context.candidateEmployer}` : ''}) — GENERAL_COLD. No company signals.`
}
- REQUIRED Signature (APPEND VERBATIM; COUNT WORDS):
${signature}

PREVIOUS DRAFT THAT FAILED VALIDATION:
${previousBody}

ERRORS TO FIX (fix all; any remaining = fail):
${errors.map((e, idx) => `${idx + 1}. ${e}`).join('\n')}

Produce a SINGLE revised flawless draft in pure JSON. Final rendered body word count (greeting through last signature line) MUST BE ≤100. No predicate near company name. ≤1 signal, ≤1 deliverable. Match tier rules.`;

    try {
      const result = await this.aiProviderService.structuredComplete<{ subject: string; body: string }>({
        systemPrompt,
        userPrompt,
        feature: 'OUTREACH_GENERATION',
        model: this.writingModel,
        maxTokens: 2500,
        temperature: 0.1,
      });

      let body = result.data.body?.trim() || '';
      let subject = result.data.subject?.trim() || `${candidateName} - Resume`;

      if (!body.includes('GitHub:') && !body.includes('LinkedIn:')) {
        body = `${body}\n\n${signature}`.trim();
      }
      return { subject, body };
    } catch (err: any) {
      this.logger.error(`Regeneration call failed: ${err.message}`);
      throw new Error(`Model regeneration failed: ${err.message}`);
    }
  }
}
