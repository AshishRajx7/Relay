import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';

/**
 * @deprecated V2 OUTREACH LEGACY MODULE — DO NOT ROUTE NEW CALLS HERE.
 *
 * Active production pipeline is V3:
 *   DraftGenerationProcessor -> CandidateMatchingService.matchCandidateToCompany
 *   -> EmailGenerationService.generatePersonalizedDraft
 *   -> validateDraftDeterministic -> DraftVerificationService.verifyDraft
 *   -> OutreachService.approveDraft -> GmailDraftService.createDraft
 *
 * This module previously contained:
 *   - hardcoded candidate experiences (violates global rule 7)
 *   - hardcoded 'Ashish Raj' name fallback (violates rule 7)
 *   - researchScore < 40 => halt outreach (violates rule 6; every valid prospect must continue)
 *   - 150-word limit (conflicts rule 1's hard <=100 including signature)
 * All four have been corrected in this quarantine, but the module still must not
 * be wired into the active queue. Any accidental future wiring throws runtime error.
 */
const OUTREACH_INTELLIGENCE_QUARANTINED: boolean = true;
function quarantineGuard(caller: string) {
  if (OUTREACH_INTELLIGENCE_QUARANTINED) {
    throw new Error(
      `[LEGACY-QUARANTINE] ${caller}: OutreachIntelligenceService is deprecated. ` +
        `Use CandidateMatchingService.matchCandidateToCompany + EmailGenerationService (V3 pipeline) instead. ` +
        `This legacy module had rule-6/7/1 conflicts and is quarantined.`,
    );
  }
}

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

  // Candidate experiences are derived from DB (candidate_experience, candidate_profile projects/skills).
  // Previously hardcoded list REMOVED per global rule 7. If this legacy module is invoked (quarantine off),
  // it must read from the candidate profile DB entities, never from an in-code list.
  private readonly candidateExperiences: Array<{ name: string; domain: string }> = [];

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
   * @deprecated V2 legacy endpoint — quarantined. See file-level JSDoc.
   * All rule conflicts (hardcoded facts, researchScore<40 halt, 150-word limit)
   * are corrected in this quarantined copy, but the active V3 pipeline must be used.
   */
  async generateOutreachIntelligence(
    prospectEmail: string,
    companyProfile: CompanyProfile,
    candidateProfile: CandidateProfile,
    crawledMarkdown?: string,
  ): Promise<OutreachIntelligenceOutput> {
    quarantineGuard('OutreachIntelligenceService.generateOutreachIntelligence');
    const contactType = this.classifyContact(prospectEmail);
    const domain = companyProfile.domain;
    const companyName = companyProfile.companyName;

    // 1. Synthesize candidate profile facts EXCLUSIVELY from candidate_profile DB fields.
    // No hardcoded name fallback, no hardcoded real-experience bullets (rule 7).
    const candidateSummary = candidateProfile.summary || '';
    const candidateSkills = Object.values(candidateProfile.skills || {}).flat().join(', ');
    const candidateProjects = candidateProfile.projects?.map((p) => `${p.name} (${p.techStack.join(', ')})`).join('; ') || '';
    const candidateExperiencesFromDb = Array.isArray(candidateProfile.experience)
      ? candidateProfile.experience
          .slice(0, 4)
          .map(
            (e, i) =>
              `  ${i + 1}. ${e.company || 'Previous role'} (${e.title || 'Software Engineer'}): ${
                e.highlights?.slice(0, 2).join('; ') || e.sourceBullets?.slice(0, 2).join('; ') || ''
              }`,
          )
          .filter((line) => line.trim().length > 8)
          .join('\n')
      : '';
    const availableProjectsFromDb = (candidateProfile.projects || []).map((p: any) => `"${p.name}"`);

    // 2. AI Intelligence & Personalization Synthesis Prompt
    const systemPrompt = `You are a Principal AI Outreach Intelligence Architect.
Your goal is to perform deep technical research and synthesize a truthful, personalized cold outreach package.

Candidate Profile Facts (STRICT - ZERO HALLUCINATION, facts ONLY from the candidate_profile DB record):
- Name: ${candidateProfile.name ? candidateProfile.name : 'USE CANDIDATE NAME FROM DATABASE OR LEAVE EMPTY'}
- Title: ${candidateProfile.title ? candidateProfile.title : 'Software Engineer (from profile)'}
- Summary: ${candidateSummary}
- Core Skills: ${candidateSkills}
- Key Projects: ${candidateProjects}
${candidateExperiencesFromDb ? `- Verified Experience (from candidate_profile.experience rows only):\n${candidateExperiencesFromDb}\n` : ''}
- Available Projects for "chosenProject" (candidate_profile.projects DB rows only; DO NOT INVENT NAMES): [${availableProjectsFromDb.join(', ') || 'no named projects in DB; choose one from the experience descriptions above or leave empty'}]

Instructions:
1. companyResearchSnapshot:
   - summary: 1-2 sentence core value proposition.
   - products: Specific product lines.
   - businessModel: e.g. "B2B SaaS", "Developer Infrastructure", "Fintech API", "Marketplace".
   - techSignals: Technologies or frameworks relevant to their stack.
   - hiringSignals: Engineering roles or technical focus areas.
   - recentInitiatives: Major product launches, scaling milestones, or platform expansions.
2. chosenProject & whyRelevant:
   - Pick the single strongest match among the candidate's VERIFIED DB experiences only.
   - If no verified DB project/experience names are present, leave chosenProject empty string and write whyRelevant as a generic truthful note based on role + core tech.
   - whyRelevant: 1 sentence explaining the technical overlap with the company's architecture.
3. whyCompany:
   - 1-2 sentences referencing specific company research observations (no generic flattery).
4. whyMe:
   - 1-2 sentences summarizing candidate's production experience using ONLY verified core technologies present in candidate_profile.skills.
5. Email Generation (subject & emailBody):
   - Target recipient role: ${contactType}
   - STRICT LIMIT: Maximum 100 words, COUNTING EVERYTHING THE RECIPIENT RECEIVES (greeting + body + CTA + sign-off + signature). Rule 1.
   - Natural, human, peer-to-peer engineer tone.
   - NO AI buzzwords ("thrilled", "cutting-edge", "synergy", "paradigm").
   - Low friction call to action (e.g. "Open to a brief 10-minute chat this week?").
   - Weak company research MUST produce a truthful GENERAL cold email (researchScore low means use only verified candidate facts, generic intro); NEVER HALT OUTPUT, NEVER RETURN EMPTY emailBody. Rule 6.

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
  "chosenProject": "string (empty if no verified DB evidence)",
  "whyRelevant": "string",
  "whyCompany": "string",
  "whyMe": "string",
  "subject": "string",
  "emailBody": "string (always return a truthful general body if researchScore<40; rule 6 prohibits halting)"
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

    // Rule 6 CORRECTED (was rule 9): Every valid imported prospect continues.
    // researchScore < 40 MUST fall back to a truthful general cold email,
    // it MUST NOT halt output or return null subject/body.
    // We flag manual review for operator visibility, but we still continue to draft.
    const requiresManualReview = researchScore < 40;
    const finalSubject = (data.subject || `Software engineer reaching out — ${candidateProfile.name || 'candidate'}`).slice(0, 78);
    const finalBody = (data.emailBody || '').trim() ||
      `Hi, I'm ${candidateProfile.name || 'a software engineer'}, ${candidateProfile.title || 'a software engineer'} with experience in ${candidateSkills || 'production backend systems'}. Reaching out to learn more about your team and any relevant engineering opportunities. Resume attached. Best, ${candidateProfile.name || ''}`;
    // For legacy quarantined path only: enforce ≤100 words (rule 1) even though outputting
    const finalBodyClipped = finalBody.split(/\s+/).filter(Boolean).slice(0, 96).join(' ');

    // Chosen project and rationale fallbacks ONLY from DB evidence actually present,
    // no hardcoded defaults (rule 7).
    const dbProjectFallback = (candidateProfile.projects?.[0] as any)?.name ||
      candidateProfile.experience?.[0]?.whatWasBuilt?.[0] ||
      '';
    const whyRelevantFallback =
      dbProjectFallback ? `Relevant engineering background.` : `General software engineering interest in ${companyName}.`;
    const dbWhyMeFallback =
      candidateSkills ? `Core technical skills: ${candidateSkills.split(',').slice(0, 5).join(', ')}.` :
      `Production software engineering experience.`;
    const dbWhyCompanyFallback = `Interested in learning more about the team at ${companyName}.`;

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
      chosenProject: (data.chosenProject && String(data.chosenProject).trim().length > 0) ? data.chosenProject : dbProjectFallback,
      whyRelevant: data.whyRelevant || whyRelevantFallback,
      whyCompany: data.whyCompany || dbWhyCompanyFallback,
      whyMe: data.whyMe || dbWhyMeFallback,
      subject: finalSubject,
      emailBody: finalBodyClipped,
      requiresManualReview,
    };
  }
}
