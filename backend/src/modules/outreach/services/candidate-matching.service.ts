import { Injectable, Logger } from '@nestjs/common';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { RankedMatch } from '../entities/draft-reasoning.entity';

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

  // Default candidate experience catalog fallback (used only if CandidateProfile has no projects or experience)
  private readonly defaultFallbackCatalog: ExperienceCatalogItem[] = [
    {
      name: 'BullMQ Notification System',
      keywords: ['notification', 'queue', 'bullmq', 'async', 'event-driven', 'idempotent', 'job', 'worker', 'message', 'background', 'pubsub', 'kafka', 'streaming', 'distributed systems', 'reliability'],
      technologies: ['BullMQ', 'Redis', 'NestJS', 'TypeScript', 'PostgreSQL'],
      description: 'Engineered an idempotent, replay-safe BullMQ notification system with batched processing, retry backoff, and paginated in-app feeds.',
      relevantDomains: ['b2b saas', 'developer tools', 'fintech', 'productivity', 'messaging', 'platform engineering', 'cloud services', 'digital engineering', 'modernization'],
    },
    {
      name: 'Activity Log Platform',
      keywords: ['activity log', 'audit', 'compliance', 'eventemitter2', 'events', 'hr', 'governance', 'tracing', 'actor', 'interceptor', 'audit trail', 'enterprise workflows'],
      technologies: ['NestJS', 'EventEmitter2', 'AsyncLocalStorage', 'TypeORM', 'PostgreSQL'],
      description: 'Architected a company-wide event-driven activity logging and audit trail platform across 15+ HR modules with actor attribution.',
      relevantDomains: ['hr tech', 'compliance', 'b2b saas', 'enterprise', 'security', 'enterprise consulting', 'digital engineering', 'it services', 'enterprise software', 'enterprise engineering', 'platform modernization'],
    },
    {
      name: 'BranchGuard Authorization',
      keywords: ['authorization', 'rbac', 'security', 'branchguard', 'multi-tenant', 'permissions', 'access control', 'tenant', 'isolation', 'identity'],
      technologies: ['NestJS', 'Redis', 'PostgreSQL', 'TypeORM'],
      description: 'Designed branch-based tenant access control, closed security bypasses, and added Redis caching for authorization lookups.',
      relevantDomains: ['security', 'fintech', 'multi-tenant saas', 'enterprise software', 'cloud services', 'enterprise consulting', 'cybersecurity'],
    },
    {
      name: 'Sentinel Gateway',
      keywords: ['gateway', 'api gateway', 'rate limiting', 'distributed', 'opentelemetry', 'jaeger', 'prometheus', 'grafana', 'metrics', 'proxy', 'latency', 'high availability', 'resilience'],
      technologies: ['Node.js', 'Redis', 'Docker', 'OpenTelemetry', 'Jaeger', 'Prometheus', 'Grafana'],
      description: 'Built a high-throughput distributed API gateway with Redis rate limiting, distributed tracing with OpenTelemetry, and Prometheus metrics.',
      relevantDomains: ['infrastructure', 'developer tools', 'cloud', 'apis', 'microservices', 'cloud services', 'platform engineering', 'platform modernization', 'digital transformation', 'it services', 'developer productivity'],
    },
    {
      name: 'Minimal Workflow Engine',
      keywords: ['workflow', 'dag', 'graph', 'orchestration', 'fastapi', 'asyncio', 'websockets', 'pipeline', 'execution engine', 'automation', 'data engineering'],
      technologies: ['FastAPI', 'Python', 'AsyncIO', 'WebSockets'],
      description: 'Created a graph-based DAG workflow orchestration engine executing asynchronous tasks with real-time WebSocket telemetry.',
      relevantDomains: ['developer tooling', 'automation', 'data pipelines', 'ai workflows', 'platform engineering', 'digital transformation', 'developer productivity'],
    },
    {
      name: 'Redis Optimization',
      keywords: ['redis', 'caching', 'optimization', 'performance', 'latency', 'high throughput', 'indexing', 'database bottleneck', 'query optimization'],
      technologies: ['Redis', 'PostgreSQL', 'TypeORM', 'Node.js'],
      description: 'Eliminated database query bottlenecks, introduced Redis caching for hot paths, and optimized relational indexes.',
      relevantDomains: ['high traffic platforms', 'e-commerce', 'fintech', 'developer tools', 'modernization', 'cloud services', 'digital engineering', 'performance engineering'],
    },
    {
      name: 'Survey Platform',
      keywords: ['survey', 'anonymity', 'analytics', 'builder', 'data collection', 'leak prevention', 'frontend', 'react', 'feedback'],
      technologies: ['NestJS', 'React', 'PostgreSQL', 'TypeScript'],
      description: 'Owned the full backend for a survey builder with custom targeting, response aggregation, and zero-leak anonymity architecture.',
      relevantDomains: ['hr tech', 'analytics', 'feedback platforms', 'product discovery', 'b2b saas', 'enterprise software', 'developer productivity'],
    },
    {
      name: 'Founder Experience',
      keywords: ['founder', 'co-founder', 'startup', 'e-commerce', 'quick commerce', 'payments', 'vendor', '0 to 1', 'ownership', 'delivery', 'dispatch'],
      technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Payment Gateways'],
      description: 'Co-founded quick commerce startup D\'Rons end to end, building backend APIs, payment integrations, and vendor management workflows.',
      relevantDomains: ['startups', 'early stage', 'e-commerce', 'marketplaces', 'quick commerce', 'consumer services', 'logistics', 'digital transformation'],
    },
  ];

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

    // 3. Fallback logic: If no projects and no experience exist, return defaultFallbackCatalog
    if (catalog.length === 0) {
      return this.defaultFallbackCatalog;
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
}
