import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { Company } from '../../companies/entities/company.entity';
import { CompanyResearch } from '../../company-research/entities/company-research.entity';
import { DraftReasoningJson } from '../entities/email-draft.entity';

/**
 * @deprecated V1 OUTREACH LEGACY MODULE — DO NOT ROUTE NEW CALLS HERE.
 *
 * Active production pipeline is V3:
 *   DraftGenerationProcessor -> EmailGenerationService.generatePersonalizedDraft
 *   -> validateDraftDeterministic -> DraftVerificationService.verifyDraft
 *   -> OutreachService.approveDraft -> GmailDraftService.createDraft
 *
 * This module is retained only for historical reference / comparison scripts.
 * It contains incorrect word limits (75-125 vs required hard <=100 including signature)
 * and a career-strategist framing that conflicts with the 10 global outreach rules.
 * Any accidental future wiring will throw a runtime quarantine error.
 */
const COLD_EMAIL_GENERATOR_QUARANTINED: boolean = true;
function quarantineGuard(caller: string) {
  if (COLD_EMAIL_GENERATOR_QUARANTINED) {
    throw new Error(
      `[LEGACY-QUARANTINE] ${caller}: ColdEmailGeneratorService is deprecated. ` +
        `Use EmailGenerationService.generatePersonalizedDraft (V3 pipeline) instead. ` +
        `This legacy module has incorrect word limits and does not enforce the 10 global rules.`,
    );
  }
}

export interface GeneratedDraftResult {
  subject: string;
  subjectVariations: string[];
  bodyText: string;
  wordCount: number;
  personalizationScore: number;
  reasoning: DraftReasoningJson;
}

interface AiDraftResponse {
  selectedSubject: string;
  subjectVariations: string[];
  bodyText: string;
  personalizationScore: number;
  reasoning: {
    whyCompany: string;
    whyNow: string;
    whyMe: string;
    matchingProjects: Array<{
      projectName: string;
      relevantTech: string[];
      pitchRelevance: string;
    }>;
    talkingPoints: string[];
  };
}

@Injectable()
export class ColdEmailGeneratorService {
  private readonly logger = new Logger(ColdEmailGeneratorService.name);

  constructor(private readonly aiProvider: AIProviderService) {}

  /**
   * @deprecated V1 legacy endpoint — quarantined. See class-level JSDoc.
   * Word limit corrected from 75-125 to max 100 (consistent with global rule 1)
   * even though this module is not in the active pipeline.
   */
  async generateEmail(
    candidate: CandidateProfile,
    contact: Contact,
    company: Company,
    research?: CompanyResearch | null,
  ): Promise<GeneratedDraftResult> {
    quarantineGuard('ColdEmailGeneratorService.generateEmail');
    const candidateName = candidate.name || 'Software Engineer';
    const candidateTitle = candidate.title || 'Software Engineer';
    const candidateSkills = [
      ...(candidate.skills?.languages || []),
      ...(candidate.skills?.frameworks || []),
      ...(candidate.skills?.databases || []),
      ...(candidate.skills?.tools || []),
    ].join(', ');

    const candidateProjects = (candidate.projects || [])
      .slice(0, 3)
      .map((p) => `- ${p.name}: ${p.description} (Tech: ${p.techStack?.join(', ') || 'N/A'})`)
      .join('\n');

    const candidateExperience = (candidate.experience || [])
      .slice(0, 2)
      .map((e) => `- ${e.title} at ${e.company}: ${e.highlights?.slice(0, 2).join('; ')}`)
      .join('\n');

    const recipientName = contact.name || 'Hiring Leader';
    const recipientTitle = contact.title || 'Engineering Leader';

    const companyName = company.name;
    const companySummary = research?.summary || 'high-growth technology company';
    const companyTech = (research?.techStack || []).join(', ') || 'modern backend technologies';
    const companyProducts = (research?.products || []).join(', ') || 'core platform';
    const outreachHooks = research?.outreachHooks || {};
    const whyCompanyHook = outreachHooks.whyThisCompany || `${companyName}'s innovation in ${research?.industry || 'tech'}`;
    const whyNowHook = outreachHooks.whyNow || 'active expansion and team growth';
    const recentMilestones = (outreachHooks.recentMilestones || []).join(', ') || 'platform scaling';

    const systemPrompt = `You are an elite software engineering career strategist and executive outreach copywriter.
Your goal is to write a concise, compelling, high-conviction cold email from a software engineer candidate to an engineering leader or founder.

CRITICAL RULES (legacy path — corrected to align with global rule 1 even though this path is quarantined):
1. Target Length: STRICTLY ≤100 words INCLUDING GREETING + BODY + CTA + SIGN-OFF + SIGNATURE.
   No fluff, no boilerplate ("I hope this email finds you well" is FORBIDDEN).
2. Tone: Direct, respectful, peer-to-peer technical engineer. High agency and concrete.
3. Structure:
   - Line 1 (Hook / Why Company): Specifically reference their tech stack, recent milestone, or core technical problem space from the company research.
   - Line 2-3 (Proof / Why Candidate): Highlight 1 specific past project, metric, or technical achievement from the candidate profile that directly mirrors their architecture.
   - Line 4 (Low-friction Call to Action): Request a quick 10-minute coffee chat or sync this week.
   - Sign-off: Candidate first name only.
4. Subject Lines: Provide 3 high-open, low-hype subject variations (e.g. "Scaling {{company}}'s backend", "{{candidate}} <> {{company}} engineering").
5. Output format: Valid JSON conforming to the schema.

Return a JSON object conforming to this exact JSON schema:
{
  "selectedSubject": "string (the best subject line)",
  "subjectVariations": ["Subject variation 1", "Subject variation 2", "Subject variation 3"],
  "bodyText": "string (75-125 word cold email body)",
  "personalizationScore": number (80-100 based on depth of company research integration),
  "reasoning": {
    "whyCompany": "string (1 sentence citing specific company research hook)",
    "whyNow": "string (1 sentence on company momentum/expansion)",
    "whyMe": "string (1 sentence explaining why candidate's experience fits their tech stack)",
    "matchingProjects": [
      {
        "projectName": "string",
        "relevantTech": ["Tech1", "Tech2"],
        "pitchRelevance": "string"
      }
    ],
    "talkingPoints": ["High-impact metric or architecture skill to mention"]
  }
}`;

    const userPrompt = `CANDIDATE INFORMATION:
Name: ${candidateName}
Current Title: ${candidateTitle}
Total Experience: ${candidate.totalYearsExperience || 5}+ years
Key Skills: ${candidateSkills}
Recent Experience:
${candidateExperience}
Key Technical Projects:
${candidateProjects}

RECIPIENT INFORMATION:
Name: ${recipientName}
Title: ${recipientTitle}
Company: ${companyName} (${company.website})

COMPANY RESEARCH & OUTREACH INTEL:
Summary: ${companySummary}
Tech Stack: ${companyTech}
Products: ${companyProducts}
Why Company: ${whyCompanyHook}
Why Now: ${whyNowHook}
Recent Milestones: ${recentMilestones}
Is Actively Hiring: ${research?.isHiring ? 'Yes' : 'Unspecified'}`;

    this.logger.log(`Synthesizing tailored cold email draft for ${contact.email} at ${company.name}`);

    const aiResponse = await this.aiProvider.structuredComplete<AiDraftResponse>({
      systemPrompt,
      userPrompt,
      feature: 'COLD_EMAIL_GENERATE',
      maxTokens: 2500,
      temperature: 0.3,
      metadata: {
        contactId: contact.id,
        companyId: company.id,
        candidateProfileId: candidate.id,
      },
    });

    const data = aiResponse.data;
    const bodyText = (data.bodyText || '').trim();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    return {
      subject: data.selectedSubject || `Scaling ${companyName}'s backend architecture`,
      subjectVariations: data.subjectVariations || [data.selectedSubject],
      bodyText,
      wordCount,
      personalizationScore: data.personalizationScore || 90,
      reasoning: data.reasoning || {
        whyCompany: whyCompanyHook,
        whyNow: whyNowHook,
        whyMe: `Deep experience in ${companyTech}`,
        matchingProjects: [],
        talkingPoints: [],
      },
    };
  }
}
