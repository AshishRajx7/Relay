import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DraftVerificationEntity, VerificationSeverity, UnsupportedClaimItem } from '../entities/draft-verification.entity';
import { DraftClaimEntity } from '../entities/draft-claim.entity';
import { CandidateEvidenceEntity } from '../../resume/entities/candidate-evidence.entity';
import { CandidateExperienceEntity } from '../../resume/entities/candidate-experience.entity';
import { ResumeFile } from '../../resume/entities/resume-file.entity';
import { CompanyEvidenceEntity } from '../../company-research/entities/company-evidence.entity';
import { CompanySource } from '../../company-research/entities/company-source.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { PersonalizationLevel } from '../../prospects/entities/prospect.entity';
import { OutreachStrategyEntity } from '../entities/outreach-strategy.entity';
import { AIProviderService } from '../../ai-provider/ai-provider.service';

interface SemanticAuditResponse {
  communicatesRelationship: boolean;
  naturalPeerTone: boolean;
  specificAndGrounded: boolean;
  avoidsPretendFamiliarity: boolean;
  passed: boolean;
  critique: string;
}

@Injectable()
export class DraftVerificationService {
  private readonly logger = new Logger(DraftVerificationService.name);
  private readonly verificationModel: string;

  constructor(
    @InjectRepository(DraftVerificationEntity)
    private readonly verificationRepository: Repository<DraftVerificationEntity>,
    @InjectRepository(DraftClaimEntity)
    private readonly claimRepository: Repository<DraftClaimEntity>,
    @InjectRepository(CandidateEvidenceEntity)
    private readonly candidateEvidenceRepository: Repository<CandidateEvidenceEntity>,
    @InjectRepository(CandidateExperienceEntity)
    private readonly experienceRepository: Repository<CandidateExperienceEntity>,
    @InjectRepository(ResumeFile)
    private readonly resumeFileRepository: Repository<ResumeFile>,
    @InjectRepository(CompanyEvidenceEntity)
    private readonly companyEvidenceRepository: Repository<CompanyEvidenceEntity>,
    @InjectRepository(CompanySource)
    private readonly companySourceRepository: Repository<CompanySource>,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly aiProviderService?: AIProviderService,
  ) {
    this.verificationModel =
      this.configService?.get<string>('ai.verificationModel') ||
      this.configService?.get<string>('ai.model') ||
      'nvidia/nemotron-3-super-120b-a12b';
  }

  /**
   * Performs rigorous two-phase verification:
   * 1. Deterministic sentence-level claim provenance & role attribution verification.
   * 2. Independent semantic verification audit using AI_VERIFICATION_MODEL.
   */
  async verifyDraft(
    emailDraftId: string,
    emailBody: string,
    candidateProfileId: string,
    companyProfileId: string,
    strategy?: OutreachStrategyEntity | null,
  ): Promise<DraftVerificationEntity> {
    this.logger.log(`Starting adversarial claim verification for draft ID: ${emailDraftId}`);

    // 1. Fetch candidate evidence with experiences and resumes
    const candidateEvidences = await this.candidateEvidenceRepository.find({
      where: { candidateProfileId },
      relations: ['experience', 'resumeFile'],
    });

    // 2. Fetch company evidence with sources and company profile
    const companyEvidences = await this.companyEvidenceRepository.find({
      where: { companyProfileId },
      relations: ['source', 'companyProfile'],
    });

    // 2b. Fetch candidate profile for skills & achievements grounding
    const candidateProfile = await this.experienceRepository.manager.getRepository(CandidateProfile).findOne({
      where: { id: candidateProfileId },
    });

    // 3. Clean up any existing claims and verification for this draft
    await this.claimRepository.delete({ emailDraftId });
    await this.verificationRepository.delete({ emailDraftId });

    // 4. Split draft body into sentences
    const rawSentences = emailBody
      .replace(/\r\n/g, '\n')
      .split('\n')
      .flatMap((line) => line.split(/(?<=[.?!])\s+/))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const unsupportedClaims: UnsupportedClaimItem[] = [];
    let crossRoleBleedDetected = false;
    let totalClaimsCount = 0;
    let verifiedClaimsCount = 0;

    const companyName = companyEvidences[0]?.companyProfile?.companyName?.toLowerCase() || '';

    for (let idx = 0; idx < rawSentences.length; idx++) {
      const sentence = rawSentences[idx];
      const lower = sentence.toLowerCase();

      // Skip greetings, sign-offs, and short transitional courtesies
      const candFirst = (candidateProfile?.name || '').trim().split(/\s+/)[0]?.toLowerCase();
      if (
        /^(hi|hello|hey|dear|best|regards|cheers|thanks|sincerely|warmly)\b/i.test(lower) ||
        sentence.length < 18 ||
        (candFirst && candFirst.length > 2 && lower.startsWith(candFirst)) ||
        /attached my resume|learn more about the team|glad to continue/i.test(lower)
      ) {
        continue;
      }

      totalClaimsCount++;
      let isVerified = false;
      let verificationIssue: string | null = null;
      let groundedCandidateEvidenceId: string | null = null;
      let groundedCompanyEvidenceId: string | null = null;

      // Generic classification based on linguistic markers without company/project hardcoding
      const isCandidateSentence =
        /\b(built|worked on|designed|engineered|implemented|developed|rebuilt|optimized|my experience|when building|at my previous)\b/i.test(lower) ||
        candidateEvidences.some((ce) => {
          const deliverable = (ce.deliverableName || '').toLowerCase();
          return deliverable.length > 4 && lower.includes(deliverable);
        });

      const isCompanySentence =
        /\b(noticed|saw that|saw your|your team|your platform|your work|you're building|focusing on)\b/i.test(lower) ||
        (companyName.length > 2 && lower.includes(companyName));

      if (isCandidateSentence) {
        // Trace Candidate Claim -> Experience -> Resume
        let matchedEvidence: CandidateEvidenceEntity | null = null;
        let bestCandidateScore = 0;

        for (const ce of candidateEvidences) {
          const rawBullet = (ce.rawBulletText || '').toLowerCase();
          const deliverable = (ce.deliverableName || '').toLowerCase();
          const technologies = (ce.technologies || '').toLowerCase();

          // Calculate overlap score
          const rawTokens = `${rawBullet} ${deliverable} ${technologies}`
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length >= 4);

          const matchedTokenCount = rawTokens.filter((t) => lower.includes(t)).length;

          let score = matchedTokenCount;
          if (deliverable && lower.includes(deliverable)) score += 5;

          if (score > bestCandidateScore && score >= 2) {
            bestCandidateScore = score;
            matchedEvidence = ce;
          }
        }

        if (matchedEvidence) {
          groundedCandidateEvidenceId = matchedEvidence.id;

          // Generic Role Attribution & Cross-Role Bleed Check:
          // Check if candidate sentence asserts a role title that contradicts the actual experience
          if (matchedEvidence.experience) {
            const exp = matchedEvidence.experience;
            const actualRole = (exp.roleTitle || '').toLowerCase();

            const assertsIntern = lower.includes('intern');
            const assertsFullTime = lower.includes('full-time') || lower.includes('software engineer');

            if (actualRole.includes('intern') && assertsFullTime && !assertsIntern) {
              crossRoleBleedDetected = true;
              verificationIssue = `Cross-role attribution mismatch: Claim attributed to full-time Software Engineer tenure, but verified experience is '${exp.roleTitle}' (${exp.startDate} - ${exp.endDate}).`;
            } else if (!actualRole.includes('intern') && assertsIntern) {
              crossRoleBleedDetected = true;
              verificationIssue = `Cross-role attribution mismatch: Claim attributed to internship, but verified experience is '${exp.roleTitle}'.`;
            } else {
              isVerified = true;
              verifiedClaimsCount++;
            }
          } else {
            isVerified = true;
            verifiedClaimsCount++;
          }
        } else {
          // Check skills section
          const hasSkillMatch = candidateEvidences.some(
            (ce) => ce.sourceType === 'SKILLS_SECTION' && lower.includes((ce.deliverableName || '').toLowerCase()),
          );

          // Check candidate profile skills, technologies, and achievements
          const profileTechs = [
            ...(candidateProfile?.skills?.languages || []),
            ...(candidateProfile?.skills?.frameworks || []),
            ...(candidateProfile?.skills?.databases || []),
            ...(candidateProfile?.skills?.tools || []),
            ...(candidateProfile?.skills?.patterns || []),
          ].map((s) => s.toLowerCase());

          const hasProfileTechMatch = profileTechs.some((tech) => tech.length >= 3 && lower.includes(tech));
          const hasAchievementMatch = (candidateProfile?.achievements || []).some((ach) => {
            const achTokens = ach.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
            return achTokens.filter((t) => lower.includes(t)).length >= 2;
          });

          if (hasSkillMatch || hasProfileTechMatch || hasAchievementMatch) {
            isVerified = true;
            verifiedClaimsCount++;
          } else {
            verificationIssue = `Candidate claim is not grounded in any resume bullet, skill, or verified experience.`;
            unsupportedClaims.push({ sentence, reason: verificationIssue });
          }
        }
      } else if (isCompanySentence) {
        // Trace Company Claim -> Source -> URL
        let matchedCompanyEv: CompanyEvidenceEntity | null = null;
        for (const coe of companyEvidences) {
          const quote = (coe.verbatimQuote || '').toLowerCase();
          const claim = (coe.atomicClaim || '').toLowerCase();

          const tokens = `${quote} ${claim}`.split(/\s+/).filter((t) => t.length > 4);
          const matchingTokens = tokens.filter((t) => lower.includes(t));

          if (
            (quote && lower.includes(quote)) ||
            (tokens.length > 0 && matchingTokens.length >= Math.min(2, tokens.length))
          ) {
            matchedCompanyEv = coe;
            break;
          }
        }

        if (matchedCompanyEv) {
          groundedCompanyEvidenceId = matchedCompanyEv.id;
          if (matchedCompanyEv.source && matchedCompanyEv.source.url) {
            isVerified = true;
            verifiedClaimsCount++;
          } else if (matchedCompanyEv.sourceUrl) {
            isVerified = true;
            verifiedClaimsCount++;
          } else {
            verificationIssue = `Company claim lacks verified source URL provenance.`;
            unsupportedClaims.push({ sentence, reason: verificationIssue });
          }
        } else {
          // Conversational reference to company
          isVerified = true;
          verifiedClaimsCount++;
        }
      } else {
        // Conversational / transition sentence
        isVerified = true;
        verifiedClaimsCount++;
      }

      // Save DraftClaimEntity
      const claimEntity = this.claimRepository.create({
        emailDraftId,
        sentenceIndex: idx,
        sentence,
        claimType: isCandidateSentence
          ? 'CANDIDATE_EXPERIENCE_CLAIM'
          : isCompanySentence
          ? 'COMPANY_ANALYSIS_CLAIM'
          : 'CONVERSATIONAL_OUTREACH',
        isVerified,
        verificationIssue,
        groundedCandidateEvidenceId,
        groundedCompanyEvidenceId,
      });
      await this.claimRepository.save(claimEntity);
    }

    // Phase 2: Semantic Verification Audit using AI_VERIFICATION_MODEL
    let semanticAudit: SemanticAuditResponse | null = null;
    const isGeneralCold = strategy?.personalizationLevel === PersonalizationLevel.GENERAL_COLD_OUTREACH;

    if (this.aiProviderService) {
      try {
        const auditSystemPrompt = `# RELAY OUTREACH: INDEPENDENT EMAIL VERIFICATION AUDITOR
You are an adversarial Quality & Verification Auditor inspecting a generated cold outreach email.
${
  isGeneralCold
    ? `AUDIT MODE: GENERAL COLD OUTREACH
(Company research was general or insufficient. The email is an honest cold introduction based on the candidate's real engineering background.)
Audit the draft against the following 4 criteria:
1. communicatesRelationship: Does the email respectfully introduce the candidate to the target company without fabricating company initiatives or fake alignment? (True if clean, honest cold intro)
2. naturalPeerTone: Does the email sound like a genuine, competent engineer writing to a peer or recruiter? (NOT automated marketing, robotic filler, or sycophantic praise)
3. specificAndGrounded: Is the candidate's background specific and grounded in real engineering work rather than generic buzzwords?
4. avoidsPretendFamiliarity: Does the email avoid faking a prior relationship, claiming to know insider details, or expressing artificial flattery?`
    : `AUDIT MODE: PERSONALIZED OUTREACH
Audit the draft against the following 4 strict qualitative criteria:
1. communicatesRelationship: Does the email clearly and credibly connect the company's verified initiative to the candidate's work?
2. naturalPeerTone: Does the email sound like a genuine, competent engineer writing to a peer? (NOT automated marketing, robotic filler, or sycophantic praise)
3. specificAndGrounded: Is the connection specific and grounded in real engineering work rather than generic tech buzzwords?
4. avoidsPretendFamiliarity: Does the email avoid faking a prior relationship, claiming to know insider details, or expressing artificial flattery?`
}

Output pure JSON conforming to:
{
  "communicatesRelationship": boolean,
  "naturalPeerTone": boolean,
  "specificAndGrounded": boolean,
  "avoidsPretendFamiliarity": boolean,
  "passed": boolean,
  "critique": "string"
}
VALID JSON ONLY: Output ONLY the JSON object, with no markdown explanation, no commentary, and no leading/trailing conversational text.`;

        const auditUserPrompt = `COMPANY: ${companyName || 'Target Company'}
EMAIL DRAFT TO AUDIT:
${emailBody}

EVALUATE AND REPORT STRICT AUDIT VERDICT:`;

        const aiResponse = await this.aiProviderService.structuredComplete<SemanticAuditResponse>({
          systemPrompt: auditSystemPrompt,
          userPrompt: auditUserPrompt,
          feature: 'OUTREACH_GENERATION',
          model: this.verificationModel,
          maxTokens: 2500,
          temperature: 0.0,
        });

        semanticAudit = aiResponse.data;
        this.logger.log(`Semantic Verification Audit for draft ${emailDraftId}: Passed=${semanticAudit?.passed} | Critique: ${semanticAudit?.critique}`);
      } catch (err: any) {
        this.logger.warn(`Semantic verification LLM call failed: ${err.message}. Proceeding with deterministic signals.`);
      }
    }

    const deterministicPassed = unsupportedClaims.length === 0 && !crossRoleBleedDetected;
    const semanticPassed = semanticAudit
      ? isGeneralCold
        ? semanticAudit.naturalPeerTone && semanticAudit.specificAndGrounded && semanticAudit.avoidsPretendFamiliarity
        : semanticAudit.passed
      : true;
    const passed = deterministicPassed && semanticPassed;

    let severity: VerificationSeverity = 'PASS';
    if (
      crossRoleBleedDetected ||
      unsupportedClaims.length > 1 ||
      (!semanticPassed && semanticAudit && (!semanticAudit.specificAndGrounded || !semanticAudit.naturalPeerTone))
    ) {
      severity = 'REJECT';
    } else if (unsupportedClaims.length === 1 || !semanticPassed) {
      severity = 'REVIEW';
    }

    const verifierNotes = passed
      ? `Audit passed. All ${totalClaimsCount} claims verified with complete provenance.${semanticAudit?.critique ? ` [Semantic: ${semanticAudit.critique}]` : ''}`
      : `Audit flagged issues: ${[
          ...unsupportedClaims.map((u) => u.reason),
          crossRoleBleedDetected ? 'Cross-role bleed detected' : null,
          semanticAudit && !semanticAudit.passed ? `Semantic Audit: ${semanticAudit.critique}` : null,
        ]
          .filter(Boolean)
          .join(' | ')}`;

    const verification = this.verificationRepository.create({
      emailDraftId,
      passed,
      severity,
      totalClaimsCount,
      verifiedClaimsCount,
      unsupportedClaims,
      crossRoleBleedDetected,
      verifierNotes,
      verifiedAt: new Date(),
    });

    const savedVerification = await this.verificationRepository.save(verification);
    this.logger.log(
      `Verification completed for draft ID: ${emailDraftId} | Result: ${severity} | Passed: ${passed} | Verified: ${verifiedClaimsCount}/${totalClaimsCount}`,
    );

    return savedVerification;
  }
}
