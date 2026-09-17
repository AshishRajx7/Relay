import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { RankedMatch } from '../entities/draft-reasoning.entity';
import { CandidateEvidenceEntity } from '../../resume/entities/candidate-evidence.entity';
import { CandidateExperienceEntity } from '../../resume/entities/candidate-experience.entity';
import { CompanyEvidenceEntity } from '../../company-research/entities/company-evidence.entity';
import { CompanySource } from '../../company-research/entities/company-source.entity';
import { RelationshipMatchEntity, RelationshipQuality, RelationshipType } from '../entities/relationship-match.entity';
import { OutreachStrategyEntity } from '../entities/outreach-strategy.entity';
import { AIProviderService } from '../../ai-provider/ai-provider.service';
import { NoOutreachAngleReason } from '../../prospects/entities/prospect.entity';

export enum OutreachStrategy {
  TECH_STACK_MATCH = 'TECH_STACK_MATCH',
  BUSINESS_ONLY = 'BUSINESS_ONLY',
}

export enum PersonalizationTier {
  HIGH_MATCH = 'HIGH_MATCH',
  MEDIUM_MATCH = 'MEDIUM_MATCH',
  LOW_MATCH = 'LOW_MATCH',
}

export interface CandidateMatchResult {
  chosenProject: string;
  matchScore: number;
  matchedTechnologies: string[];
  matchedSkills: string[];
  whyRelevant: string;
  rankedMatches: RankedMatch[];
  strategy?: OutreachStrategy;
  personalizationTier: PersonalizationTier;
}

export interface MultiResumeMatchResult {
  selectedCandidate: CandidateProfile;
  selectedResumeId?: string;
  selectedResumeName: string;
  selectedResumeCategory: string;
  matchScore: number;
  selectionReason: string;
  evidenceUsedInEmail: string[];
  keyMatches: string[];
  projectsReferenced: string[];
  missingSkills: string[];
  recommendedTalkingPoints: string[];
  whyMePoints: string[];
  allResumeScores: Array<{
    resumeId: string;
    resumeName: string;
    category: string;
    score: number;
    reason: string;
    isSelected: boolean;
  }>;
  matchResult: CandidateMatchResult;
}

export interface V3MatchOutput {
  match: RelationshipMatchEntity | null;
  candidateEvidence: CandidateEvidenceEntity | null;
  companyEvidence: CompanyEvidenceEntity | null;
  refusalReason?: NoOutreachAngleReason;
  compositeScore: number;
}

interface ExperienceCatalogItem {
  name: string;
  keywords: string[];
  technologies: string[];
  description: string;
  relevantDomains: string[];
}

@Injectable()
export class CandidateMatchingService {
  private readonly logger = new Logger(CandidateMatchingService.name);
  private readonly matchingModel: string;

  constructor(
    @InjectRepository(CandidateEvidenceEntity)
    private readonly candidateEvidenceRepo: Repository<CandidateEvidenceEntity>,
    @InjectRepository(CandidateExperienceEntity)
    private readonly experienceRepo: Repository<CandidateExperienceEntity>,
    @InjectRepository(CompanyEvidenceEntity)
    private readonly companyEvidenceRepo: Repository<CompanyEvidenceEntity>,
    @InjectRepository(CompanySource)
    private readonly companySourceRepo: Repository<CompanySource>,
    @InjectRepository(RelationshipMatchEntity)
    private readonly matchRepo: Repository<RelationshipMatchEntity>,
    @InjectRepository(OutreachStrategyEntity)
    private readonly strategyRepo: Repository<OutreachStrategyEntity>,
    private readonly aiProviderService: AIProviderService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.matchingModel =
      this.configService?.get<string>('ai.matchingModel') ||
      this.configService?.get<string>('ai.model') ||
      'meta/llama-3.2-11b-vision-instruct';
  }

  /**
   * Generates dynamic ExperienceCatalogItem array from CandidateProfile data.
   * Maps projects and professional experience into catalog items.
   * Falls back to defaultFallbackCatalog if both are empty.
   */
  public buildCatalogFromProfile(candidate?: CandidateProfile): ExperienceCatalogItem[] {
    const catalog: ExperienceCatalogItem[] = [];

    // 1. Ingest parsed candidate projects
    if (Array.isArray(candidate?.projects)) {
      for (const p of candidate.projects) {
        if (!p?.name || p.name.trim().length === 0) continue;
        const techs = Array.isArray(p.techStack) ? p.techStack.filter(Boolean) : [];
        const description = p.description || '';

        // Simple word extraction: tokens of length >= 3 from name, description, and technologies
        const rawTokens = `${p.name} ${description}`.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
        const stopwords = new Set(['the', 'and', 'with', 'for', 'from', 'this', 'that', 'built', 'using', 'system', 'application', 'features']);
        const keywords = Array.from(new Set([...rawTokens.filter((w) => !stopwords.has(w)), ...techs.map((t) => t.toLowerCase())]));

        catalog.push({
          name: p.name.trim(),
          keywords,
          technologies: techs,
          description,
          relevantDomains: ['b2b saas', 'platform engineering', 'cloud services', 'developer tools'],
        });
      }
    }

    // 2. Ingest significant professional experience roles
    if (Array.isArray(candidate?.experience)) {
      for (const exp of candidate.experience) {
        if (!exp?.company || !exp?.title) continue;
        const highlights = Array.isArray(exp.highlights) ? exp.highlights.join('. ') : '';
        const roleName = `${exp.title.trim()} at ${exp.company.trim()}`;

        const rawTokens = `${roleName} ${highlights}`.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
        const keywords = Array.from(new Set(rawTokens));

        // Use candidate skills mentioned in highlights or first 3 skills
        const candidateSkills = [
          ...(candidate?.skills?.languages || []),
          ...(candidate?.skills?.frameworks || []),
          ...(candidate?.skills?.databases || []),
          ...(candidate?.skills?.tools || []),
        ].filter(Boolean);
        const roleTechs = candidateSkills.filter((s) => this.matchesWholeWord(highlights, s));

        let addedDeliverable = false;

        // Ingest specific concrete deliverables (what was built, scale, impact)
        if (Array.isArray(exp.whatWasBuilt) && exp.whatWasBuilt.length > 0) {
          for (const built of exp.whatWasBuilt) {
            if (!built || built.trim().length === 0) continue;
            let projName = built.replace(/^(built|architected|developed|engineered|created|implemented|designed)\s+/i, '').trim();
            projName = projName.charAt(0).toUpperCase() + projName.slice(1);
            if (projName.length > 45) projName = projName.slice(0, 45).trim();
            const rawTokens = `${built}`.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
            catalog.push({
              name: projName,
              keywords: Array.from(new Set(rawTokens)),
              technologies: roleTechs.length > 0 ? roleTechs : candidateSkills.slice(0, 3),
              description: built,
              relevantDomains: ['platform engineering', 'backend systems', 'b2b saas', 'enterprise software', 'developer tools'],
            });
            addedDeliverable = true;
          }
        }

        if (Array.isArray(exp.scaleAndOwnership) && exp.scaleAndOwnership.length > 0) {
          for (const item of exp.scaleAndOwnership) {
            if (!item || item.trim().length === 0) continue;
            let projName = item.replace(/^(designed|owned|led|built|scaled)\s+/i, '').trim();
            projName = projName.charAt(0).toUpperCase() + projName.slice(1);
            if (projName.length > 45) projName = projName.slice(0, 45).trim();
            const rawTokens = `${item}`.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
            catalog.push({
              name: projName,
              keywords: Array.from(new Set(rawTokens)),
              technologies: roleTechs.length > 0 ? roleTechs : candidateSkills.slice(0, 3),
              description: item,
              relevantDomains: ['platform engineering', 'cloud infrastructure', 'security', 'caching'],
            });
            addedDeliverable = true;
          }
        }

        if (Array.isArray(exp.measurableImpact) && exp.measurableImpact.length > 0) {
          for (const impact of exp.measurableImpact) {
            if (!impact || impact.trim().length === 0) continue;
            let projName = impact.replace(/^(optimized|reduced|improved|increased)\s+/i, '').trim();
            projName = projName.charAt(0).toUpperCase() + projName.slice(1);
            if (projName.length > 45) projName = projName.slice(0, 45).trim();
            const rawTokens = `${impact}`.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
            catalog.push({
              name: projName,
              keywords: Array.from(new Set(rawTokens)),
              technologies: roleTechs.length > 0 ? roleTechs : candidateSkills.slice(0, 3),
              description: impact,
              relevantDomains: ['database optimization', 'performance engineering', 'indexing'],
            });
            addedDeliverable = true;
          }
        }

        if (!addedDeliverable) {
          catalog.push({
            name: roleName,
            keywords,
            technologies: roleTechs.length > 0 ? roleTechs : candidateSkills.slice(0, 3),
            description: highlights || `${exp.title} at ${exp.company}`,
            relevantDomains: ['platform engineering', 'backend systems', 'b2b saas', 'enterprise software', 'developer tools'],
          });
        }
      }
    }

    // 3. Fallback logic: If no projects and no experience exist, return empty catalog
    if (catalog.length === 0) {
      return [];
    }

    return catalog;
  }

  /**
   * Matches a term within text using whole-word boundaries, preventing substring false positives.
   * e.g., 'go' will not match 'google' or 'algorithm', 'hr' will not match 'throughput' or 'chrome'.
   */
  public matchesWholeWord(text: string, term: string): boolean {
    if (!text || !term) return false;
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(text);
  }

  /**
   * Evaluates technology match with alias normalization (e.g. node.js <-> nodejs, postgres <-> postgresql)
   * and whole-word boundary verification.
   */
  public techMatches(candidateTech: string, companyTech: string): boolean {
    if (!candidateTech || !companyTech) return false;
    const c1 = candidateTech.trim().toLowerCase();
    const c2 = companyTech.trim().toLowerCase();
    if (c1 === c2) return true;

    // Alias normalization
    if ((c1 === 'node.js' && c2 === 'nodejs') || (c1 === 'nodejs' && c2 === 'node.js')) return true;
    if ((c1 === 'postgres' && c2 === 'postgresql') || (c1 === 'postgresql' && c2 === 'postgres')) return true;

    return this.matchesWholeWord(c2, c1) || this.matchesWholeWord(c1, c2);
  }

  /**
   * Option D: Monotonic calibration curve converting raw weighted scores into well-separated,
   * percentile-calibrated match scores:
   * - 68..98 -> 75..96 (Tier 1: Exceptional Fit, 10-20%)
   * - 50..67 -> 50..74 (Tier 2: Strong Fit, 30-40%)
   * - 35..49 -> 35..49 (Tier 3: Moderate Fit, 25-35%)
   * - 20..34 -> 20..34 (Tier 4: Low Fit, 15-25%)
   * -  0..19 ->  0..19 (Tier 5: Generic Fit, 5-10%)
   */
  public calibrateScore(rawScore: number): number {
    if (rawScore <= 0) return 0;
    if (rawScore < 20) return Math.min(19, rawScore);
    if (rawScore < 35) return rawScore; // 20-34
    if (rawScore < 50) return rawScore; // 35-49
    if (rawScore < 68) {
      // Map raw 50..67 onto 50..74
      const ratio = (rawScore - 50) / 17;
      return Math.round(50 + ratio * 24);
    }
    // Map raw 68..85+ onto 75..96
    const ratio = Math.min(1.0, (rawScore - 68) / 18);
    return Math.round(75 + ratio * 21);
  }

  /**
   * Matches company profile intelligence against candidate portfolio and ranks top 3 experiences
   * using an opportunity-focused 3-factor model tailored for job-seeker outreach.
   */
  public matchExperience(
    company: CompanyProfile,
    candidate: CandidateProfile,
  ): CandidateMatchResult {
    const companyTechSignals = (company?.techSignals || []).map((t) => t.toLowerCase());
    const companyIndustry = (company?.industry || '').toLowerCase();
    const companyBusinessModel = (company?.businessModel || '').toLowerCase();
    const hiringSignals = (company?.hiringSignals || []).map((h) => h.toLowerCase());
    const companySummary = (company?.summary || '').toLowerCase();

    // Problem context incorporates summary, verified products, and hiring signals
    const problemContext = [
      companySummary,
      ...(company?.products || []),
      ...hiringSignals,
    ].join(' ').toLowerCase();

    const scoredProjects: Array<{
      item: ExperienceCatalogItem;
      score: number;
      matchedTechs: string[];
      matchedKeywords: string[];
    }> = [];

    const catalog = this.buildCatalogFromProfile(candidate);

    for (const exp of catalog) {
      const matchedTechs: string[] = [];
      const matchedKeywords: string[] = [];
      const matchedDomains: string[] = [];

      // 1. Tech Overlap (Strict against verified company tech signals)
      for (const tech of exp.technologies) {
        if (companyTechSignals.some((ct) => this.techMatches(tech, ct))) {
          matchedTechs.push(tech);
        }
      }

      // 2. Problem / Keyword Overlap (Whole-word matching against problem context)
      for (const kw of exp.keywords) {
        if (this.matchesWholeWord(problemContext, kw)) {
          matchedKeywords.push(kw);
        }
      }

      // 3. Domain Alignment (Whole-word matching against industry, business model, and summary)
      for (const domain of exp.relevantDomains) {
        if (
          this.matchesWholeWord(companyIndustry, domain) ||
          this.matchesWholeWord(companyBusinessModel, domain) ||
          this.matchesWholeWord(companySummary, domain)
        ) {
          matchedDomains.push(domain);
        }
      }

      const uniqueMatchedTechs = Array.from(new Set(matchedTechs));
      const uniqueMatchedKeywords = Array.from(new Set(matchedKeywords));
      const uniqueMatchedDomains = Array.from(new Set(matchedDomains));

      // Factor 1: Tech Stack Overlap (Option A: Compressed tech normalization)
      // 1 tech match => 40, 2 tech matches => 70, 3+ tech matches => 100
      let techScore = 0;
      if (uniqueMatchedTechs.length === 1) {
        techScore = 40;
      } else if (uniqueMatchedTechs.length === 2) {
        techScore = 70;
      } else if (uniqueMatchedTechs.length >= 3) {
        techScore = 100;
      }

      // Factor 2: Domain Alignment (Option C: Reduced domain contribution)
      // 30 per matched domain, capped at 100
      const domainScore = uniqueMatchedDomains.length > 0
        ? Math.min(100, uniqueMatchedDomains.length * 30)
        : 0;

      // Factor 3: Problem Alignment (25 per matched keyword, capped at 100)
      const problemScore = Math.min(100, uniqueMatchedKeywords.length * 25);

      // 3-Factor Scoring Model:
      let calculatedScore = 0;
      if (uniqueMatchedTechs.length > 0) {
        // TECH_STACK_MATCH: 0.55 * tech + 0.25 * domain + 0.20 * problem + 5 (Option B: calibrated boost)
        calculatedScore = Math.round(
          (0.55 * techScore) + (0.25 * domainScore) + (0.20 * problemScore) + 5
        );
      } else {
        // BUSINESS_ONLY: 0.40 * domain + 0.40 * problem
        calculatedScore = Math.round((0.40 * domainScore) + (0.40 * problemScore));
      }

      // Option D: Monotonic calibration curve preventing score compression
      const finalScore = Math.min(98, Math.max(0, this.calibrateScore(calculatedScore)));

      scoredProjects.push({
        item: exp,
        score: finalScore,
        matchedTechs: uniqueMatchedTechs,
        matchedKeywords: uniqueMatchedKeywords,
      });
    }

    // Sort: If any project has verified tech overlap with the company,
    // prioritize concrete technical overlap over generic domain matches.
    const anyProjectHasTechOverlap = scoredProjects.some((p) => p.matchedTechs.length > 0);

    scoredProjects.sort((a, b) => {
      if (anyProjectHasTechOverlap) {
        const aHasTech = a.matchedTechs.length > 0;
        const bHasTech = b.matchedTechs.length > 0;
        if (aHasTech && !bHasTech) return -1;
        if (!aHasTech && bHasTech) return 1;
      }
      return b.score - a.score;
    });

    const topMatch = scoredProjects[0];
    const topSliceCount = Math.min(3, scoredProjects.length);
    const rankedMatches: RankedMatch[] = scoredProjects.slice(0, topSliceCount).map((p, idx) => ({
      rank: idx + 1,
      project: p.item.name,
      score: p.score,
    }));

    const hasTechMatch = topMatch.matchedTechs.length > 0;
    const matchedTechnologies = hasTechMatch ? Array.from(new Set(topMatch.matchedTechs)) : [];
    const strategy = hasTechMatch ? OutreachStrategy.TECH_STACK_MATCH : OutreachStrategy.BUSINESS_ONLY;

    let personalizationTier: PersonalizationTier;
    if (topMatch.score >= 70) {
      personalizationTier = PersonalizationTier.HIGH_MATCH;
    } else if (topMatch.score >= 40) {
      personalizationTier = PersonalizationTier.MEDIUM_MATCH;
    } else {
      personalizationTier = PersonalizationTier.LOW_MATCH;
    }

    let whyRelevant: string;
    if (personalizationTier === PersonalizationTier.HIGH_MATCH) {
      whyRelevant = `${company?.companyName || 'The company'} utilizes ${matchedTechnologies.join(', ')}. Candidate's production work on ${topMatch.item.name} directly mirrors this technical stack.`;
    } else if (personalizationTier === PersonalizationTier.MEDIUM_MATCH) {
      whyRelevant = `${company?.companyName || 'The company'} is focused on ${company?.industry || 'modern software engineering'} and ${company?.businessModel || 'platform solutions'}. Candidate's engineering work on ${topMatch.item.name} (${topMatch.item.description}) aligns with their platform challenges.`;
    } else {
      whyRelevant = `General software engineering inquiry. Candidate's experience building ${topMatch.item.name} showcases core backend engineering, distributed systems, and rapid learning ability.`;
    }

    return {
      chosenProject: topMatch.item.name,
      matchScore: topMatch.score,
      matchedTechnologies,
      matchedSkills: topMatch.matchedKeywords.slice(0, 5),
      whyRelevant,
      rankedMatches,
      strategy,
      personalizationTier,
    };
  }

  /**
   * Scores multiple candidate resumes against a target company and automatically selects the best match,
   * factoring in resume category fit (BACKEND, AI_ML, FULL_STACK) and technical overlap.
   */
  public selectBestResumeForCompany(
    candidates: Array<CandidateProfile & { resumeFile?: any }>,
    company: CompanyProfile,
    overrideResumeId?: string,
  ): MultiResumeMatchResult {
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidate profiles provided for multi-resume evaluation');
    }

    const companyTechSignals = (company?.techSignals || []).map((t) => t.toLowerCase());
    const companySummary = (company?.summary || '').toLowerCase();
    const companyIndustry = (company?.industry || '').toLowerCase();
    const isAiMlCompany = /ai|machine learning|llm|deep learning|vision|nlp|data science/i.test(
      companyIndustry + ' ' + companySummary,
    );

    const scoredResumes: Array<{
      candidate: CandidateProfile & { resumeFile?: any };
      score: number;
      matchResult: CandidateMatchResult;
      reason: string;
      category: string;
      resumeName: string;
    }> = [];

    for (const cand of candidates) {
      const matchResult = this.matchExperience(company, cand);
      const cat = (cand.resumeFile?.category || 'BACKEND').toUpperCase();
      let adjustedScore = matchResult.matchScore;

      // Category fit weighting
      if (isAiMlCompany && cat === 'AI_ML') {
        adjustedScore = Math.min(99, adjustedScore + 8);
      } else if (!isAiMlCompany && cat === 'BACKEND') {
        adjustedScore = Math.min(99, adjustedScore + 5);
      }

      const candSkills = [
        ...(cand.skills?.languages || []),
        ...(cand.skills?.frameworks || []),
        ...(cand.skills?.databases || []),
        ...(cand.skills?.tools || []),
      ];
      const matched = candSkills.filter((s) =>
        companyTechSignals.some((ct) => this.techMatches(s, ct)),
      );
      const resumeName = cand.resumeFile?.label || cand.name || `${cat} Resume`;

      let reason = `Strong alignment with ${company.companyName || 'target company'}`;
      if (matched.length > 0) {
        reason = `Direct match on ${matched.slice(0, 4).join(', ')} and ${cat.replace('_', '/')} background.`;
      } else if (matchResult.matchedTechnologies.length > 0) {
        reason = `Proven experience in ${matchResult.matchedTechnologies.join(', ')} and distributed systems.`;
      }

      scoredResumes.push({
        candidate: cand,
        score: adjustedScore,
        matchResult,
        reason,
        category: cat,
        resumeName,
      });
    }

    // Sort by adjusted score descending
    scoredResumes.sort((a, b) => b.score - a.score);

    // Check if user specifically requested an override
    let selectedItem = scoredResumes[0];
    if (overrideResumeId) {
      const foundOverride = scoredResumes.find(
        (r) =>
          r.candidate.id === overrideResumeId ||
          r.candidate.resumeFile?.id === overrideResumeId ||
          r.candidate.resumeFileId === overrideResumeId,
      );
      if (foundOverride) {
        selectedItem = foundOverride;
      }
    }

    const selectedCand = selectedItem.candidate;
    const candSkills = [
      ...(selectedCand.skills?.languages || []),
      ...(selectedCand.skills?.frameworks || []),
      ...(selectedCand.skills?.databases || []),
      ...(selectedCand.skills?.tools || []),
    ];

    const keyMatches = Array.from(
      new Set([
        ...selectedItem.matchResult.matchedTechnologies,
        ...candSkills.filter((s) => companyTechSignals.some((ct) => this.techMatches(s, ct))),
      ]),
    );

    const missingSkills = companyTechSignals
      .filter((ct) => !candSkills.some((s) => this.techMatches(s, ct)))
      .slice(0, 4)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

    // Extract concrete evidence points used in email
    const evidenceUsedInEmail: string[] = [];
    if (selectedItem.matchResult.chosenProject) {
      evidenceUsedInEmail.push(selectedItem.matchResult.chosenProject);
    }
    if (Array.isArray(selectedCand.experience)) {
      for (const exp of selectedCand.experience) {
        if (Array.isArray(exp.whatWasBuilt) && exp.whatWasBuilt.length > 0) {
          for (const b of exp.whatWasBuilt) {
            if (evidenceUsedInEmail.length < 3 && !evidenceUsedInEmail.includes(b)) {
              evidenceUsedInEmail.push(b);
            }
          }
        }
        if (Array.isArray(exp.scaleAndOwnership) && exp.scaleAndOwnership.length > 0) {
          for (const s of exp.scaleAndOwnership) {
            if (evidenceUsedInEmail.length < 3 && !evidenceUsedInEmail.includes(s)) {
              evidenceUsedInEmail.push(s);
            }
          }
        }
      }
    }
    if (evidenceUsedInEmail.length === 0) {
      evidenceUsedInEmail.push(
        'Audit Logging Platform',
        'BranchGuard Redis Caching',
        'Leave Management Optimization',
      );
    }

    const whyMePoints = [
      `Production backend engineering across ${keyMatches.slice(0, 3).join(', ') || 'distributed systems'}`,
      `Built idempotent, high-concurrency event pipelines and caching layers`,
      `Direct experience solving database query bottlenecks and index performance`,
      `Autonomous full-lifecycle ownership from database schema to API delivery`,
    ];

    const recommendedTalkingPoints = [
      `Discuss architecture for high-throughput event processing and audit trails`,
      `Share benchmark results from Redis caching optimizations and latency reductions`,
      `Exchange perspectives on database isolation patterns and multi-tenant authorization`,
    ];

    const allResumeScores = scoredResumes.map((r) => ({
      resumeId: r.candidate.resumeFile?.id || r.candidate.id,
      resumeName: r.resumeName,
      category: r.category,
      score: r.score,
      reason: r.reason,
      isSelected:
        r.candidate.id === selectedCand.id ||
        r.candidate.resumeFile?.id === selectedCand.resumeFile?.id ||
        r.candidate.resumeFileId === selectedCand.resumeFileId,
    }));

    return {
      selectedCandidate: selectedCand,
      selectedResumeId: selectedCand.resumeFile?.id || selectedCand.resumeFileId || selectedCand.id,
      selectedResumeName: selectedItem.resumeName,
      selectedResumeCategory: selectedItem.category,
      matchScore: selectedItem.score,
      selectionReason: selectedItem.reason,
      evidenceUsedInEmail,
      keyMatches,
      projectsReferenced: evidenceUsedInEmail,
      missingSkills,
      recommendedTalkingPoints,
      whyMePoints,
      allResumeScores,
      matchResult: selectedItem.matchResult,
    };
  }

  /**
   * Relay V3: 3-step hybrid candidate ↔ company relational matcher.
   * Step 1: High-recall deterministic candidate pair generation (RESUME_BULLET > SKILLS_SECTION).
   * Step 2: Semantic LLM relationship evaluation.
   * Step 3: Deterministic provenance validation & terminal refusal code assignment.
   */
  async matchCandidateToCompany(
    company: CompanyProfile,
    candidateProfileId: string,
    campaignId?: string,
  ): Promise<V3MatchOutput> {
    this.logger.log(`Executing V3 hybrid relational matching for company "${company.companyName}" and candidate profile ${candidateProfileId}`);

    // 1. Load candidate evidence
    let candidateEvidences = await this.candidateEvidenceRepo.find({
      where: { candidateProfileId },
      relations: ['experience', 'resumeFile'],
    });

    if (!candidateEvidences || candidateEvidences.length === 0) {
      this.logger.warn(`Candidate profile ${candidateProfileId} has no normalized evidence claims`);
      return {
        match: null,
        candidateEvidence: null,
        companyEvidence: null,
        refusalReason: NoOutreachAngleReason.INSUFFICIENT_CANDIDATE_EVIDENCE,
        compositeScore: 0,
      };
    }

    // 2. Load company evidence
    let companyEvidences = await this.companyEvidenceRepo.find({
      where: { companyProfileId: company.id },
      relations: ['source'],
    });

    // If company has no evidence claims, check if company research was deficient
    const hasCompanySignals =
      (company.techSignals && company.techSignals.length > 0) ||
      (company.products && company.products.length > 0) ||
      (company.summary && company.summary.trim().length > 20);

    if (!hasCompanySignals && companyEvidences.length === 0) {
      return {
        match: null,
        candidateEvidence: null,
        companyEvidence: null,
        refusalReason: NoOutreachAngleReason.INSUFFICIENT_COMPANY_RESEARCH,
        compositeScore: 0,
      };
    }

    // Prioritize RESUME_BULLET evidence over SKILLS_SECTION
    const bulletEvidences = candidateEvidences.filter((e) => e.sourceType === 'RESUME_BULLET');
    const projectEvidences = candidateEvidences.filter((e) => e.sourceType === 'PROJECT_ENTRY');
    const primaryCandidateEvidences =
      bulletEvidences.length > 0
        ? bulletEvidences
        : projectEvidences.length > 0
        ? projectEvidences
        : candidateEvidences;

    // 3. Step 1: Open-Ended High-Recall Deterministic Candidate Pair Generation
    // Extracts clean semantic tokens (>= 3 chars, lowercase, no common stop words)
    const STOP_WORDS = new Set([
      'and', 'the', 'with', 'for', 'from', 'into', 'using', 'that', 'this',
      'our', 'your', 'their', 'across', 'over', 'both', 'such', 'also', 'than',
      'then', 'each', 'more', 'most', 'some', 'well', 'been', 'were', 'have',
    ]);
    const extractTokens = (text: string): string[] => {
      return (text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
    };

    interface CandidatePairCandidate {
      candidateEv: CandidateEvidenceEntity;
      companyEv: CompanyEvidenceEntity;
      recallScore: number;
    }

    const plausiblePairs: CandidatePairCandidate[] = [];

    // Extract all company context tokens
    const companyContextText = `${company.companyName} ${company.industry || ''} ${company.summary || ''} ${(company.products || []).join(' ')} ${(company.techSignals || []).join(' ')}`.toLowerCase();
    const companyContextTokens = extractTokens(companyContextText);

    // If company evidence records are missing, synthesize temporary company evidence representation from summary
    let evaluationCompanyEvidences = companyEvidences;
    if (evaluationCompanyEvidences.length === 0 && hasCompanySignals) {
      evaluationCompanyEvidences = [
        this.companyEvidenceRepo.create({
          companyProfileId: company.id,
          verbatimQuote: company.summary || (company.products || []).join(', '),
          atomicClaim: company.summary || 'Company engineering initiative',
          category: 'PRODUCT',
          confidence: 1.0,
          isSourceFact: true,
        }),
      ];
    }

    for (const cEv of primaryCandidateEvidences) {
      const cText = `${cEv.deliverableName} ${cEv.atomicClaim} ${cEv.technologies || ''} ${cEv.rawBulletText || ''}`.toLowerCase();
      const cTokens = extractTokens(cText);

      for (const coEv of evaluationCompanyEvidences) {
        const coText = `${coEv.atomicClaim} ${coEv.verbatimQuote} ${coEv.category || ''}`.toLowerCase();
        const coTokens = extractTokens(coText);

        let recallScore = 0;

        // A. Token overlap between candidate deliverable/claim and company evidence
        for (const ct of cTokens) {
          if (coTokens.includes(ct)) {
            recallScore += 15;
          } else if (companyContextTokens.includes(ct)) {
            recallScore += 5;
          }
        }

        // B. Prefix / root match (>= 4 chars) for conceptual variants (e.g. authoriz*, tenant*, cache*, queu*, commerc*, audit*)
        for (const ct of cTokens) {
          if (ct.length >= 4) {
            const prefix = ct.slice(0, 4);
            const matchesCo = coTokens.some((t) => t.length >= 4 && t.startsWith(prefix) && t !== ct);
            if (matchesCo) recallScore += 10;
          }
        }

        // C. Direct technology overlap
        const directTechs = (cEv.technologies || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        for (const tech of directTechs) {
          if (coText.includes(tech) || companyContextText.includes(tech)) {
            recallScore += 12;
          }
        }

        if (recallScore > 0 || plausiblePairs.length < 12) {
          plausiblePairs.push({
            candidateEv: cEv,
            companyEv: coEv,
            recallScore,
          });
        }
      }
    }

    // Ensure broad coverage across distinct candidate deliverables if keyword overlaps were sparse:
    // Guarantees non-obvious conceptual relationships are NEVER prematurely discarded
    if (evaluationCompanyEvidences.length > 0) {
      const representedDeliverables = new Set(
        plausiblePairs.filter((p) => p.recallScore > 0).map((p) => p.candidateEv.deliverableName),
      );
      for (const cEv of primaryCandidateEvidences) {
        if (!representedDeliverables.has(cEv.deliverableName) && plausiblePairs.length < 16) {
          plausiblePairs.push({
            candidateEv: cEv,
            companyEv: evaluationCompanyEvidences[0],
            recallScore: 5,
          });
          representedDeliverables.add(cEv.deliverableName);
        }
      }
    }

    if (plausiblePairs.length === 0) {
      return {
        match: null,
        candidateEvidence: null,
        companyEvidence: null,
        refusalReason: NoOutreachAngleReason.NO_DOMAIN_ALIGNMENT,
        compositeScore: 0,
      };
    }

    // Sort by high-recall score and select top 6 pairs for semantic evaluation
    plausiblePairs.sort((a, b) => b.recallScore - a.recallScore);
    const topPairs = plausiblePairs.slice(0, 6);

    // 4. Step 2: Semantic LLM Relationship Evaluation
    try {
      const pairSummaries = topPairs.map((p, idx) => ({
        pairIndex: idx,
        candidateDeliverable: p.candidateEv.deliverableName,
        candidateClaim: p.candidateEv.atomicClaim,
        candidateRole: p.candidateEv.experience?.roleTitle || 'Engineer',
        candidateEmployer: p.candidateEv.experience?.employer || 'Previous Employer',
        candidateTechnologies: p.candidateEv.technologies,
        companyQuote: p.companyEv.verbatimQuote,
        companyClaim: p.companyEv.atomicClaim,
      }));

      const systemPrompt = `You are a Principal Technical Matchmaker evaluating the genuine technical and architectural relationship between a software engineer's first-hand verified accomplishments and a company's technical initiatives.

Evaluate each candidate ↔ company pair across explicit qualitative criteria:
1. directness: "DIRECT" | "INDIRECT" | "ANALOGOUS"
2. evidenceSpecificity: "HIGH" | "MEDIUM" | "LOW"
3. candidateOwnership: "PRIMARY" | "CONTRIBUTOR" | "SUPPORTING"
4. companyEvidenceStrength: "CLEAR_ACUTE_NEED" | "GENERAL_TECH" | "SPECULATIVE"
   - CLEAR_ACUTE_NEED: Company is building or solving a specific, acute engineering challenge (e.g. multi-tenant authorization scale, high-throughput queue idempotency, vendor order routing).
   - GENERAL_TECH: Company merely uses standard baseline tools (Node.js, PostgreSQL, AWS, Docker, HTML5, WordPress, basic web portals) without an acute architectural problem.
   - SPECULATIVE: Unverified or vague technical requirement.
5. architecturalCorrespondence: "EXACT_PARALLEL" | "SIMILAR_CLASS" | "DIVERGENT"
   - EXACT_PARALLEL: Solves the exact same engineering challenge or system class.
   - SIMILAR_CLASS: Related backend architecture or infrastructure pattern.
   - DIVERGENT: Fundamentally different technical domain or problem space.
6. genericOverlapOnly: boolean
   - If companyEvidenceStrength is GENERAL_TECH or SPECULATIVE, AND candidate evidence is merely common tooling (e.g. Node.js, PostgreSQL, Docker) without domain/architectural overlap, flag genericOverlapOnly = true.
   - MUST be true for digital marketing agencies, generic web design shops, or small business brochure/portal builders.
   - If candidate and company share genuine architectural patterns (such as microservices, event-driven platforms, audit logging, authorization systems, or compliance workflows), genericOverlapOnly is FALSE.
   - If genericOverlapOnly is true, set relationshipQuality to "DISQUALIFIED_GENERIC_OVERLAP" and rankingScore <= 35.
7. relationshipQuality: "HIGH" | "MODERATE" | "WEAK" | "DISQUALIFIED_GENERIC_OVERLAP"
   - HIGH: Direct architectural match with CLEAR_ACUTE_NEED and high specificity.
   - MODERATE: Plausible architectural correspondence with genuine technical substance (e.g. similar class infrastructure, indirect/analogous problem-space alignment like microservices, event-driven pipelines, audit logging, or compliance systems).
   - WEAK: Tenuous or indirect connection with minimal technical substance.
   - DISQUALIFIED_GENERIC_OVERLAP: Company is standard agency/general tech or match is based only on basic programming languages/databases.
8. analyticalRationale: Concise 1-2 sentence explanation. Do NOT hallucinate company needs not present in the company quote!
9. rankingScore: Integer 0-100 used ONLY as an internal ranking signal:
   - 80-100: HIGH quality match on acute architectural parallel
   - 65-79: MODERATE quality match with genuine architectural substance
   - 40-64: WEAK connection
   - 0-39: Generic tech overlap or disqualified

Output pure JSON conforming to:
{
  "evaluations": [
    {
      "pairIndex": 0,
      "directness": "DIRECT",
      "evidenceSpecificity": "HIGH",
      "candidateOwnership": "PRIMARY",
      "companyEvidenceStrength": "CLEAR_ACUTE_NEED",
      "architecturalCorrespondence": "EXACT_PARALLEL",
      "genericOverlapOnly": false,
      "relationshipQuality": "HIGH",
      "analyticalRationale": "Direct match on tenant isolation and authorization policies.",
      "rankingScore": 88
    },
    {
      "pairIndex": 1,
      "directness": "INDIRECT",
      "evidenceSpecificity": "HIGH",
      "candidateOwnership": "PRIMARY",
      "companyEvidenceStrength": "CLEAR_ACUTE_NEED",
      "architecturalCorrespondence": "SIMILAR_CLASS",
      "genericOverlapOnly": false,
      "relationshipQuality": "MODERATE",
      "analyticalRationale": "Architectural alignment between event-driven audit logging and enterprise compliance microservices.",
      "rankingScore": 75
    }
  ]
}`;

      const aiResponse = await this.aiProviderService.structuredComplete<{
        evaluations: Array<{
          pairIndex: number;
          directness: 'DIRECT' | 'INDIRECT' | 'ANALOGOUS';
          evidenceSpecificity: 'HIGH' | 'MEDIUM' | 'LOW';
          candidateOwnership: 'PRIMARY' | 'CONTRIBUTOR' | 'SUPPORTING';
          companyEvidenceStrength: 'CLEAR_ACUTE_NEED' | 'GENERAL_TECH' | 'SPECULATIVE';
          architecturalCorrespondence: 'EXACT_PARALLEL' | 'SIMILAR_CLASS' | 'DIVERGENT';
          genericOverlapOnly: boolean;
          relationshipQuality: RelationshipQuality;
          analyticalRationale: string;
          rankingScore: number;
        }>;
      }>({
        systemPrompt,
        userPrompt: `COMPANY: ${company.companyName} (${company.industry}, ${company.businessModel})\nPAIRS TO EVALUATE:\n${JSON.stringify(pairSummaries, null, 2)}`,
        feature: 'OUTREACH_GENERATION',
        model: this.matchingModel,
        maxTokens: 1500,
        temperature: 0.1,
      });

      const evaluations = aiResponse.data.evaluations || [];

      // Rank by quality first (HIGH > MODERATE > WEAK > DISQUALIFIED_GENERIC_OVERLAP), then rankingScore
      const qualityRank: Record<string, number> = {
        HIGH: 4,
        MODERATE: 3,
        WEAK: 2,
        DISQUALIFIED_GENERIC_OVERLAP: 1,
      };

      evaluations.sort((a, b) => {
        const qA = qualityRank[a.relationshipQuality] || 0;
        const qB = qualityRank[b.relationshipQuality] || 0;
        if (qB !== qA) return qB - qA;
        return (b.rankingScore || 0) - (a.rankingScore || 0);
      });

      const bestEvaluation = evaluations[0];
      if (!bestEvaluation) {
        return {
          match: null,
          candidateEvidence: null,
          companyEvidence: null,
          refusalReason: NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH,
          compositeScore: 0,
        };
      }

      // 1. Check fundamentally divergent domain
      if (bestEvaluation.architecturalCorrespondence === 'DIVERGENT') {
        this.logger.warn(
          `Outreach refused for ${company.companyName}: NO_DOMAIN_ALIGNMENT (${bestEvaluation.analyticalRationale})`,
        );
        return {
          match: null,
          candidateEvidence: null,
          companyEvidence: null,
          refusalReason: NoOutreachAngleReason.NO_DOMAIN_ALIGNMENT,
          compositeScore: bestEvaluation.rankingScore || 20,
        };
      }

      // 2. Explicit generic overlap or disqualified generic overlap
      if (bestEvaluation.genericOverlapOnly || bestEvaluation.relationshipQuality === 'DISQUALIFIED_GENERIC_OVERLAP') {
        this.logger.warn(`Outreach refused for ${company.companyName}: GENERIC_TECH_OVERLAP_ONLY (${bestEvaluation.analyticalRationale})`);
        return {
          match: null,
          candidateEvidence: null,
          companyEvidence: null,
          refusalReason: NoOutreachAngleReason.GENERIC_TECH_OVERLAP_ONLY,
          compositeScore: bestEvaluation.rankingScore || 25,
        };
      }

      // 3. Check weak relationship
      if (bestEvaluation.relationshipQuality === 'WEAK') {
        const refusalReason =
          bestEvaluation.companyEvidenceStrength === 'GENERAL_TECH' || bestEvaluation.companyEvidenceStrength === 'SPECULATIVE'
            ? NoOutreachAngleReason.GENERIC_TECH_OVERLAP_ONLY
            : bestEvaluation.companyEvidenceStrength === 'CLEAR_ACUTE_NEED' && bestEvaluation.candidateOwnership !== 'PRIMARY'
            ? NoOutreachAngleReason.INSUFFICIENT_CANDIDATE_EVIDENCE
            : NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH;

        this.logger.warn(`Outreach refused for ${company.companyName}: ${refusalReason} (${bestEvaluation.analyticalRationale})`);
        return {
          match: null,
          candidateEvidence: null,
          companyEvidence: null,
          refusalReason,
          compositeScore: bestEvaluation.rankingScore || 35,
        };
      }

      // 3. Digital agency / marketing web portals with no specialized architectural problem
      const isGenericWebAgency = /agency|marketing|web design|landing pages|small business clients/i.test(
        `${company.industry || ''} ${company.businessModel || ''} ${company.summary || ''}`,
      );
      if (isGenericWebAgency && bestEvaluation.architecturalCorrespondence !== 'EXACT_PARALLEL') {
        this.logger.warn(
          `Outreach refused for ${company.companyName}: GENERIC_TECH_OVERLAP_ONLY (Generic web/marketing agency overlap)`,
        );
        return {
          match: null,
          candidateEvidence: null,
          companyEvidence: null,
          refusalReason: NoOutreachAngleReason.GENERIC_TECH_OVERLAP_ONLY,
          compositeScore: bestEvaluation.rankingScore || 30,
        };
      }

      // 4. Low ranking score gate (< 60)
      if ((bestEvaluation.rankingScore || 0) < 60) {
        this.logger.warn(
          `Outreach refused for ${company.companyName}: LOW_RELATIONSHIP_STRENGTH (Score ${bestEvaluation.rankingScore} < 60)`,
        );
        return {
          match: null,
          candidateEvidence: null,
          companyEvidence: null,
          refusalReason: NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH,
          compositeScore: bestEvaluation.rankingScore || 50,
        };
      }

      // Valid relationship match (HIGH or MODERATE)
      const bestPair = topPairs[bestEvaluation.pairIndex] || topPairs[0];

      const matchEntity = this.matchRepo.create({
        companyEvidenceId: bestPair.companyEv.id,
        candidateEvidenceId: bestPair.candidateEv.id,
        relationshipType:
          bestEvaluation.architecturalCorrespondence === 'EXACT_PARALLEL' ? 'DIRECT_TECHNICAL' : 'PROBLEM_SPACE',
        isInferredRelationship: true,
        analyticalRationale: bestEvaluation.analyticalRationale,
        relationshipQuality: bestEvaluation.relationshipQuality,
        rankingScore: bestEvaluation.rankingScore || 80,
        directness: bestEvaluation.directness || 'DIRECT',
        evidenceSpecificity: bestEvaluation.evidenceSpecificity || 'HIGH',
        candidateOwnership: bestEvaluation.candidateOwnership || 'PRIMARY',
        genericOverlapDetected: false,
      });

      const savedMatch = await this.matchRepo.save(matchEntity);
      this.logger.log(`Created RelationshipMatchEntity ${savedMatch.id} | Quality: ${bestEvaluation.relationshipQuality} | Deliverable: ${bestPair.candidateEv.deliverableName}`);

      return {
        match: savedMatch,
        candidateEvidence: bestPair.candidateEv,
        companyEvidence: bestPair.companyEv,
        compositeScore: bestEvaluation.rankingScore || 85,
      };
    } catch (err: any) {
      this.logger.error(`Error in semantic relationship matching: ${err.message}`, err.stack);
      // Fallback only if candidate deliverable has strong direct overlap
      const fallbackPair = topPairs[0];
      if (fallbackPair && fallbackPair.recallScore >= 30) {
        const matchEntity = this.matchRepo.create({
          companyEvidenceId: fallbackPair.companyEv.id,
          candidateEvidenceId: fallbackPair.candidateEv.id,
          relationshipType: 'DIRECT_TECHNICAL',
          isInferredRelationship: true,
          analyticalRationale: `Direct engineering alignment on ${fallbackPair.candidateEv.deliverableName}`,
          relationshipQuality: 'MODERATE',
          rankingScore: 70,
          directness: 'DIRECT',
          evidenceSpecificity: 'HIGH',
          candidateOwnership: 'PRIMARY',
          genericOverlapDetected: false,
        });
        const savedMatch = await this.matchRepo.save(matchEntity);
        return {
          match: savedMatch,
          candidateEvidence: fallbackPair.candidateEv,
          companyEvidence: fallbackPair.companyEv,
          compositeScore: 70,
        };
      }
      return {
        match: null,
        candidateEvidence: null,
        companyEvidence: null,
        refusalReason: NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH,
        compositeScore: 0,
      };
    }
  }
}
