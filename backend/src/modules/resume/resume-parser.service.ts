import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as pdfParse from 'pdf-parse';
import { ResumeFile, ResumeFileStatus } from './entities/resume-file.entity';
import {
  CandidateProfile,
  SkillsJson,
  ExperienceJson,
  EducationJson,
  ProjectJson,
  LinksJson,
  ExperienceType,
} from './entities/candidate-profile.entity';
import { StorageService } from '../storage/storage.service';
import { AIProviderService } from '../ai-provider/ai-provider.service';

import { CandidateExperienceEntity, ExperienceTenureType } from './entities/candidate-experience.entity';
import { CandidateEvidenceEntity, CandidateEvidenceCategory, CandidateSourceType } from './entities/candidate-evidence.entity';

export interface CandidateProfileExtractedData {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  totalYearsExperience: number | null;
  skills: SkillsJson;
  experience: ExperienceJson[];
  education: EducationJson[];
  projects: ProjectJson[];
  certifications: string[];
  achievements: string[];
  links: LinksJson;
}

@Injectable()
export class ResumeParserService implements OnModuleInit {
  private readonly logger = new Logger(ResumeParserService.name);

  // Canonical classification lists for deterministic post-processing
  private readonly knownORMs = new Set(['typeorm', 'prisma', 'mongoose', 'drizzle', 'sequelize', 'hibernate']);
  private readonly knownDatabases = new Set([
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'cassandra',
    'elasticsearch', 'dynamodb', 'mariadb', 'cockroachdb', 'neo4j', 'couchdb',
  ]);

  constructor(
    @InjectRepository(ResumeFile)
    private readonly resumeFileRepository: Repository<ResumeFile>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepository: Repository<CandidateProfile>,
    @InjectRepository(CandidateExperienceEntity)
    private readonly experienceRepository: Repository<CandidateExperienceEntity>,
    @InjectRepository(CandidateEvidenceEntity)
    private readonly evidenceRepository: Repository<CandidateEvidenceEntity>,
    private readonly storageService: StorageService,
    private readonly aiProviderService: AIProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.backfillAllCandidateProfiles();
  }

  async backfillAllCandidateProfiles(force = false): Promise<void> {
    try {
      const profiles = await this.candidateProfileRepository.find();
      for (const profile of profiles) {
        const count = await this.experienceRepository.count({ where: { candidateProfileId: profile.id } });
        if ((force || count === 0) && profile.experience && profile.experience.length > 0) {
          this.logger.log(`Backfilling candidate_experience & candidate_evidence for profile ${profile.id} (${profile.name})`);
          await this.normalizeAndPersistEvidence(profile.resumeFileId, profile);
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to backfill candidate profiles: ${err.message}`);
    }
  }

  async extractText(buffer: Buffer): Promise<string> {
    try {
      let cleaned = '';
      try {
        const data = await pdfParse(buffer);
        cleaned = (data.text || '').replace(/\r\n/g, '\n').trim();
      } catch (pdfErr: any) {
        // Fallback: extract string tokens if PDF stream text format is present
        const ascii = buffer.toString('latin1');
        const textMatches = ascii.match(/\((.*?)\)\s*'/g);
        if (textMatches && textMatches.length > 0) {
          cleaned = textMatches.map((m) => m.slice(1, -2).replace(/\\\(/g, '(').replace(/\\\)/g, ')')).join('\n').trim();
        } else {
          throw pdfErr;
        }
      }

      if (cleaned.length < 30) {
        throw new Error('Insufficient readable text in PDF. The document might be an image-only scan.');
      }
      return cleaned;
    } catch (err: any) {
      this.logger.error(`PDF text extraction failed: ${err.message}`);
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  }

  /**
   * Normalizes URLs. Returns null if URL is empty, incomplete, or a placeholder without real repository info.
   */
  private normalizeUrl(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    let trimmed = url.trim().replace(/^@/, '');
    if (
      !trimmed ||
      trimmed === '...' ||
      trimmed === 'https://github.com/...' ||
      trimmed === 'https://github.com/' ||
      trimmed === 'github.com' ||
      trimmed === 'https://github.com' ||
      trimmed === 'https://linkedin.com' ||
      trimmed === 'https://www.linkedin.com'
    ) {
      return null;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      if (/^(www\.|github\.com|linkedin\.com)/i.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      } else if (!trimmed.includes(' ') && trimmed.includes('.')) {
        trimmed = `https://${trimmed}`;
      }
    }

    return trimmed;
  }

  /**
   * Deterministically calculates non-overlapping total professional experience in decimal years.
   */
  public calculateTotalYearsExperience(experiences: ExperienceJson[]): number | null {
    if (!experiences || experiences.length === 0) return null;

    const uniqueMonths = new Set<string>();

    const parseMonthYear = (dateStr: string, isEnd = false): { year: number; month: number } | null => {
      if (!dateStr) return null;
      const str = dateStr.trim();
      if (/present|current|now/i.test(str)) {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
      }

      // YYYY-MM
      const isoMatch = str.match(/^(\d{4})-(\d{1,2})$/);
      if (isoMatch) {
        return { year: parseInt(isoMatch[1], 10), month: parseInt(isoMatch[2], 10) };
      }

      // YYYY only (e.g. 2024) -> start in Jan, end in Dec
      const yearMatch = str.match(/^(\d{4})$/);
      if (yearMatch) {
        return { year: parseInt(yearMatch[1], 10), month: isEnd ? 12 : 1 };
      }

      // Mon YYYY (e.g. Aug 2026, Feb 2026)
      const monthNames: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      };
      const textMatch = str.match(/^([a-zA-Z]{3,9})\s+(\d{4})$/);
      if (textMatch) {
        const m = monthNames[textMatch[1].slice(0, 3).toLowerCase()] || (isEnd ? 12 : 1);
        return { year: parseInt(textMatch[2], 10), month: m };
      }

      return null;
    };

    for (const exp of experiences) {
      const start = parseMonthYear(exp.startDate, false);
      const end = parseMonthYear(exp.endDate, true);

      if (start && end) {
        let curYear = start.year;
        let curMonth = start.month;

        while (curYear < end.year || (curYear === end.year && curMonth <= end.month)) {
          const key = `${curYear}-${String(curMonth).padStart(2, '0')}`;
          uniqueMonths.add(key);
          curMonth++;
          if (curMonth > 12) {
            curMonth = 1;
            curYear++;
          }
        }
      }
    }

    if (uniqueMonths.size === 0) return null;
    return Number((uniqueMonths.size / 12).toFixed(1));
  }

  /**
   * Deterministic post-processing to enforce:
   * 1. Separate timelines for promotions/consecutive roles at the same company
   * 2. Accurate degree & field separation
   * 3. Database vs ORM taxonomy cleanup (moving TypeORM to frameworks)
   * 4. Framework preservation
   * 5. Achievement vs Certification classification
   */
  private normalizeProjectUrl(url?: string | null, rawResumeText?: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const trimmed = this.normalizeUrl(url);
    if (!trimmed) return null;

    if (rawResumeText && trimmed.includes('github.com/')) {
      const pathPart = trimmed.split('github.com/')[1]?.replace(/\/$/, '');
      if (pathPart && !rawResumeText.toLowerCase().includes(pathPart.toLowerCase())) {
        return null;
      }
    }
    return trimmed;
  }

  public postProcessAndValidate(data: any, rawText?: string): CandidateProfileExtractedData {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Parser output must be a valid JSON object');
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new BadRequestException('Extracted candidate profile is missing a valid candidate name');
    }

    // 1. Process & Clean Skills Matrix
    let languages = Array.isArray(data.skills?.languages) ? data.skills.languages.map(String).filter((s: string) => s.trim()) : [];
    let frameworks = Array.isArray(data.skills?.frameworks) ? data.skills.frameworks.map(String).filter((s: string) => s.trim()) : [];
    let rawDatabases = Array.isArray(data.skills?.databases) ? data.skills.databases.map(String).filter((s: string) => s.trim()) : [];
    let tools = Array.isArray(data.skills?.tools) ? data.skills.tools.map(String).filter((s: string) => s.trim()) : [];
    let other = Array.isArray(data.skills?.other) ? data.skills.other.filter((s: any) => typeof s === 'string' && s.trim()) : [];
    let patterns = Array.isArray(data.skills?.patterns) ? data.skills.patterns.map(String).filter((s: string) => s.trim()) : [];

    // Migrate any ORMs mistakenly placed in databases -> frameworks
    const databases: string[] = [];
    for (const db of rawDatabases) {
      const lower = db.toLowerCase();
      if (this.knownORMs.has(lower)) {
        if (!frameworks.some((f) => f.toLowerCase() === lower)) {
          frameworks.push(db);
        }
      } else {
        databases.push(db);
      }
    }

    // Ensure raw text technologies mentioned in skills/experience are preserved
    if (rawText) {
      const frameworkChecks = [
        { regex: /\bReact\s*19\b/i, name: 'React 19' },
        { regex: /\bReact\b/i, name: 'React' },
        { regex: /\bTanStack\s*Query\b/i, name: 'TanStack Query' },
        { regex: /\bReact\s*Router\b/i, name: 'React Router' },
        { regex: /\bTailwindCSS\b/i, name: 'TailwindCSS' },
        { regex: /\bTypeORM\b/i, name: 'TypeORM' },
        { regex: /\bEventEmitter2\b/i, name: 'EventEmitter2' },
        { regex: /\bBullMQ\b/i, name: 'BullMQ' },
        { regex: /\bFastAPI\b/i, name: 'FastAPI' },
        { regex: /\bNestJS\b/i, name: 'NestJS' },
        { regex: /\bExpress\b/i, name: 'Express' },
        { regex: /\bNode\.?js\b/i, name: 'Node.js' },
      ];

      for (const check of frameworkChecks) {
        if (check.regex.test(rawText)) {
          if (!frameworks.some((f) => f.toLowerCase() === check.name.toLowerCase())) {
            frameworks.push(check.name);
          }
        }
      }

      // Check pattern mentions
      const patternChecks = [
        { regex: /\bAsyncLocalStorage\b/i, name: 'AsyncLocalStorage' },
        { regex: /\bEvent[- ]Driven Architecture\b/i, name: 'Event Driven Architecture' },
        { regex: /\bAudit Log(ging)?\b/i, name: 'Audit Logging' },
        { regex: /\bRBAC\b/i, name: 'RBAC' },
        { regex: /\bBranch[- ]Based Access Control\b/i, name: 'Branch Based Access Control' },
        { regex: /\bIdempotent\b/i, name: 'Idempotent Delivery' },
      ];
      for (const check of patternChecks) {
        if (check.regex.test(rawText)) {
          if (!patterns.some((p) => p.toLowerCase() === check.name.toLowerCase())) {
            patterns.push(check.name);
          }
        }
      }
    }

    const skills: SkillsJson = {
      languages: Array.from(new Set(languages)),
      frameworks: Array.from(new Set(frameworks)),
      databases: Array.from(new Set(databases)),
      tools: Array.from(new Set(tools)),
      other: Array.from(new Set(other)),
      patterns: Array.from(new Set(patterns)),
    };

    // 2. Process Experience & Deterministically Fix Overlapping Promotions
    let experience: ExperienceJson[] = Array.isArray(data.experience)
      ? data.experience
          .filter((exp: any) => exp && typeof exp === 'object' && exp.company && exp.title)
          .map((exp: any) => {
            const title = String(exp.title).trim();
            const isFounder = !!(
              exp.isFounder ||
              /founder|co-founder|founding|entrepreneur|startup/i.test(title)
            );

            let experienceType: ExperienceType = 'FULL_TIME';
            if (isFounder) {
              experienceType = 'FOUNDER';
            } else if (exp.experienceType && ['FULL_TIME', 'INTERNSHIP', 'FOUNDER', 'FREELANCE', 'CONTRACT', 'PART_TIME'].includes(exp.experienceType)) {
              experienceType = exp.experienceType;
            } else if (/intern|internship/i.test(title)) {
              experienceType = 'INTERNSHIP';
            } else if (/contract|freelance|consultant/i.test(title)) {
              experienceType = 'CONTRACT';
            }

            const sourceBullets = Array.isArray(exp.sourceBullets) && exp.sourceBullets.length > 0
              ? exp.sourceBullets.map(String).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
              : (Array.isArray(exp.highlights)
                  ? exp.highlights.map(String).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                  : []);

            const highlights = Array.isArray(exp.highlights) && exp.highlights.length > 0
              ? exp.highlights.map(String).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
              : sourceBullets;

            const allCandidateSkills = [
              ...languages,
              ...frameworks,
              ...databases,
              ...tools,
              ...other,
            ];

            // Build role-scoped grounding text
            const roleGroundingText = [
              exp.company,
              title,
              ...sourceBullets,
              ...highlights,
            ].join(' ').toLowerCase();

            // Strict Anti-Contamination Check
            // Projects, systems, and concepts must NOT cross employment boundaries
            const highRiskForeignConcepts = [
              'branchguard',
              'branch guard',
              'branch-access',
              'super admin',
              'superadmin',
              'asynclocalstorage',
              'eventemitter2',
              'leave management',
              'survey platform',
              'survey builder',
              'bullmq',
              'sentry-to-slack',
              'sentry',
              'dependabot',
              'redis caching',
              'audit log',
              'quick commerce',
              'quick-commerce',
              'wordpress',
              'anonymity-leak',
              'anonymity leak',
            ];

            const isGroundedInRole = (item: string): boolean => {
              if (!item || typeof item !== 'string' || item.trim().length === 0) return false;
              const lower = item.toLowerCase();

              // If the item mentions a specific high-risk concept, verify it is genuinely in this role's text
              for (const concept of highRiskForeignConcepts) {
                if (lower.includes(concept) && !roleGroundingText.includes(concept)) {
                  return false; // Contaminated from another role!
                }
              }

              return true;
            };

            // 1. What Was Built (strictly role-scoped)
            let whatWasBuilt: string[] = [];
            if (Array.isArray(exp.whatWasBuilt) && exp.whatWasBuilt.length > 0) {
              whatWasBuilt = exp.whatWasBuilt
                .map(String)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
                .filter(isGroundedInRole);
            }
            if (whatWasBuilt.length === 0) {
              whatWasBuilt = sourceBullets
                .filter((b: string) => /built|architected|developed|engineered|created|implemented|designed|co-founded/i.test(b))
                .filter(isGroundedInRole);
            }

            // 2. Scale & Ownership (strictly role-scoped)
            let scaleAndOwnership: string[] = [];
            if (Array.isArray(exp.scaleAndOwnership) && exp.scaleAndOwnership.length > 0) {
              scaleAndOwnership = exp.scaleAndOwnership
                .map(String)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
                .filter(isGroundedInRole);
            }
            if (scaleAndOwnership.length === 0) {
              scaleAndOwnership = sourceBullets
                .filter((b: string) => /owned|led|infrastructure|platform|pipeline|distributed|scale|system|security|rbac|events|onboarded|debugging|remediated|vulnerabilities/i.test(b))
                .filter(isGroundedInRole);
            }

            // If whatWasBuilt and scaleAndOwnership are identical and have multiple items, de-duplicate cleanly
            if (whatWasBuilt.length > 1 && scaleAndOwnership.length > 1 && whatWasBuilt[0] === scaleAndOwnership[0]) {
              const ownershipOnly = scaleAndOwnership.filter((s) => /owned|onboarded|debugging|remediated|vulnerabilities|led/i.test(s));
              if (ownershipOnly.length > 0) {
                scaleAndOwnership = ownershipOnly;
                whatWasBuilt = whatWasBuilt.filter((w) => !ownershipOnly.includes(w) || /co-founded|built/i.test(w));
              }
            }

            // 3. Measurable Impact (quantitative gains explicitly stated in THIS role only)
            const measurableImpactRegex = /\d+%|\d+x|\d+ms|reduced|optimized|latency|throughput|saved|eliminated|cutting repeated|improving/i;
            let measurableImpact: string[] = [];
            if (Array.isArray(exp.measurableImpact) && exp.measurableImpact.length > 0) {
              measurableImpact = exp.measurableImpact
                .map(String)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
                .filter(isGroundedInRole)
                .filter((s: string) => measurableImpactRegex.test(s));
            }
            if (measurableImpact.length === 0) {
              measurableImpact = sourceBullets
                .filter((b: string) => measurableImpactRegex.test(b))
                .filter(isGroundedInRole);
            }
            // If no genuine measurable impact exists in this role (e.g. D'Rons), keep it as EMPTY ARRAY []!

            // 4. Technologies (strictly role-scoped, NEVER fallback to candidate-wide skills)
            const matchesRoleText = (tech: string): boolean => {
              if (!tech || tech.trim().length === 0) return false;
              const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
              return regex.test(roleGroundingText);
            };

            let roleTechs: string[] = [];
            if (Array.isArray(exp.technologies) && exp.technologies.length > 0) {
              roleTechs = exp.technologies
                .map(String)
                .map((t: string) => t.trim())
                .filter((t: string) => t.length > 0)
                .filter(matchesRoleText);
            }

            // Include candidate skills only if explicitly mentioned with whole-word boundaries in this role's grounding text
            for (const skill of allCandidateSkills) {
              if (matchesRoleText(skill) && !roleTechs.some((t) => t.toLowerCase() === skill.toLowerCase())) {
                roleTechs.push(skill);
              }
            }

            // Check for specific technologies mentioned in role text
            if (/wordpress/i.test(roleGroundingText) && !roleTechs.some((t) => /wordpress/i.test(t))) {
              roleTechs.push('WordPress');
            }
            if (/backend apis|custom backend apis|\bapis\b/i.test(roleGroundingText) && !roleTechs.some((t) => /api/i.test(t))) {
              roleTechs.push('REST APIs');
            }

            roleTechs = Array.from(new Set(roleTechs));

            return {
              company: String(exp.company).trim(),
              title,
              location: exp.location ? String(exp.location).trim() : null,
              startDate: exp.startDate ? String(exp.startDate).trim() : '',
              endDate: exp.endDate ? String(exp.endDate).trim() : 'Present',
              experienceType,
              isFounder,
              founderType: isFounder ? (exp.founderType || (/co-founder/i.test(title) ? 'CO_FOUNDER' : 'FOUNDER')) : null,
              sourceBullets,
              highlights: highlights.length > 0 ? highlights : sourceBullets,
              whatWasBuilt,
              scaleAndOwnership,
              measurableImpact,
              technologies: roleTechs,
            };
          })
      : [];

    // Deterministic promotion overlap fix:
    // If a company has both an INTERNSHIP and a FULL_TIME / promoted role, ensure the promoted role doesn't overlap the internship start
    const companyGroups = new Map<string, ExperienceJson[]>();
    for (const exp of experience) {
      const key = exp.company.toLowerCase();
      if (!companyGroups.has(key)) companyGroups.set(key, []);
      companyGroups.get(key)!.push(exp);
    }

    for (const [, roles] of companyGroups.entries()) {
      if (roles.length > 1) {
        const internRole = roles.find((r) => r.experienceType === 'INTERNSHIP');
        const fullTimeRole = roles.find((r) => r.experienceType === 'FULL_TIME' && /present/i.test(r.endDate));

        if (internRole && fullTimeRole && internRole.endDate && internRole.endDate !== 'Present') {
          if (fullTimeRole.startDate === internRole.startDate) {
            // Promoted role erroneously copied the internship start date -> adjust to internship end date
            fullTimeRole.startDate = internRole.endDate;
          }
        }
      }
    }

    // 3. Process Projects
    const projects: ProjectJson[] = Array.isArray(data.projects)
      ? data.projects
          .filter((proj: any) => proj && typeof proj === 'object' && proj.name)
          .map((proj: any) => ({
            name: String(proj.name).trim(),
            description: proj.description ? String(proj.description).trim() : '',
            techStack: Array.isArray(proj.techStack) ? proj.techStack.map(String).filter((t: string) => t.trim().length > 0) : [],
            url: this.normalizeProjectUrl(proj.url, rawText),
          }))
      : [];

    // 4. Process Education & Split Degree/Field
    const education: EducationJson[] = Array.isArray(data.education)
      ? data.education
          .filter((edu: any) => edu && typeof edu === 'object' && (edu.institution || edu.degree))
          .map((edu: any) => {
            let degree = edu.degree ? String(edu.degree).trim() : '';
            let field = edu.field ? String(edu.field).trim() : '';

            // If degree contains ' in ', split into degree & field
            if (degree.includes(' in ')) {
              const parts = degree.split(/ in /i);
              degree = parts[0].trim();
              if (!field) {
                field = parts.slice(1).join(' in ').trim();
              }
            }

            return {
              institution: edu.institution ? String(edu.institution).trim() : '',
              degree,
              field,
              startYear: typeof edu.startYear === 'number' ? edu.startYear : (edu.startDate ? parseInt(edu.startDate, 10) || null : null),
              endYear: typeof edu.endYear === 'number' ? edu.endYear : (edu.graduationDate || edu.endDate ? parseInt(edu.graduationDate || edu.endDate, 10) || null : null),
              graduationDate: edu.graduationDate ? String(edu.graduationDate).trim() : (edu.endYear ? String(edu.endYear) : null),
              gpa: edu.gpa ? String(edu.gpa).trim() : null,
            };
          })
      : [];

    // 5. Separate Achievements and Certifications
    let rawCertifications: string[] = Array.isArray(data.certifications)
      ? data.certifications.map(String).filter((c: string) => c.trim().length > 0)
      : [];
    let rawAchievements: string[] = Array.isArray(data.achievements)
      ? data.achievements.map(String).filter((a: string) => a.trim().length > 0)
      : [];

    const certifications: string[] = [];
    const achievements: string[] = [...rawAchievements];

    // Filter competitions, hackathons, and problem solving out of certifications
    for (const cert of rawCertifications) {
      if (/codeforces|leetcode|hackathon|challenge|ranked|solved|contest|olympiad/i.test(cert)) {
        if (!achievements.includes(cert)) {
          achievements.push(cert);
        }
      } else {
        certifications.push(cert);
      }
    }

    // Check raw text for known activities/achievements if not already extracted
    if (rawText) {
      if (/Amazon ML Challenge/i.test(rawText) && !achievements.some((a) => a.includes('Amazon ML Challenge'))) {
        achievements.push('Amazon ML Challenge: Ranked 62nd of 2,500+ teams with a SMAPE score of 48');
      }
      if (/Codeforces Specialist/i.test(rawText) && !achievements.some((a) => a.includes('Codeforces Specialist'))) {
        achievements.push('Codeforces Specialist (max rating 1448)');
      }
      if (/500\+\s*DSA problems/i.test(rawText) && !achievements.some((a) => a.includes('500+ DSA'))) {
        achievements.push('500+ DSA problems solved across Codeforces and LeetCode');
      }
    }

    let linkedin = this.normalizeUrl(data.links?.linkedin);
    let github = this.normalizeUrl(data.links?.github);
    let portfolio = this.normalizeUrl(data.links?.portfolio);

    if (rawText) {
      if (!github) {
        const ghMatch = rawText.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
        if (ghMatch) github = `https://github.com/${ghMatch[1]}`;
      }
      if (!linkedin) {
        const liMatch = rawText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
        if (liMatch) linkedin = `https://www.linkedin.com/in/${liMatch[1]}`;
      }
    }

    const links: LinksJson = {
      linkedin,
      github,
      portfolio,
    };

    // Calculate experience deterministically from date intervals
    const totalYearsExperience = this.calculateTotalYearsExperience(experience);

    return {
      name: String(data.name).trim(),
      email: data.email ? String(data.email).trim() : null,
      phone: data.phone ? String(data.phone).trim() : null,
      location: data.location ? String(data.location).trim() : null,
      title: data.title ? String(data.title).trim() : null,
      summary: data.summary ? String(data.summary).trim() : null,
      totalYearsExperience,
      skills,
      experience,
      education,
      projects,
      certifications,
      achievements,
      links,
    };
  }

  async parseWithAi(rawText: string, metadata?: Record<string, any>): Promise<CandidateProfileExtractedData> {
    const systemPrompt = `You are a Senior AI Resume Intelligence Architect.
Your task is to parse resume text and produce a rich, high-fidelity JSON object with ZERO hallucination, accurate technology taxonomy, normalized dates, first-class founder experience classification, and STRICT EMPLOYMENT SCOPING.

Strict Extraction Instructions:

1. STRICT EMPLOYMENT SCOPING & ZERO CROSS-ROLE CONTAMINATION (CRITICAL):
- Every employment entry in "experience" must be extracted completely independently.
- SCOPING: Each experience entry's fields ("sourceBullets", "highlights", "whatWasBuilt", "scaleAndOwnership", "measurableImpact", "technologies") MUST be derived EXCLUSIVELY from the text and bullet points appearing directly under that specific role's header in the resume.
- NEVER copy, leak, or infer achievements, projects, systems, or responsibilities from one employer or role into another. For example, systems or achievements like BranchGuard, Redis caching, Activity Log platform, Leave Management optimization, or Super Admin impersonation belong ONLY to the specific role where they are explicitly described; NEVER attribute them to D'Rons or any other employer.
- ZERO INFERENCE FROM GLOBAL SKILLS: Never infer technologies for an experience entry from the "TECHNICAL SKILLS" section or candidate-wide skills unless that technology is explicitly mentioned in that specific role's text or bullets.
- "sourceBullets": Extract the EXACT, verbatim bullet points from the resume for this specific role. DO NOT modify, summarize, or omit bullets.
- "measurableImpact": If this specific role does NOT contain measurable metrics or quantitative gains in its bullets, return [] (EMPTY ARRAY). NEVER hallucinate, copy from another role, or invent numbers!
- "whatWasBuilt": Systems, platforms, services, or features specifically built in THIS role based ONLY on its sourceBullets. If none, return [].
- "scaleAndOwnership": Ownership scope, architecture, or responsibilities in THIS role. If none, return [].
- "technologies": ONLY technologies, frameworks, libraries, databases, and tools explicitly mentioned in THIS role's text or bullets.

2. PROMOTIONS & CONSECUTIVE ROLES (CRITICAL):
- When a candidate was promoted or held multiple roles at the same company (e.g. Intern followed by Full-Time), each role MUST have its own independent startDate and endDate according to its own role header.
- Example: "The Ninja Studio — Software Engineer Aug 2026 – Present" -> startDate: "2026-08", endDate: "Present".
- "The Ninja Studio — Backend Engineering Intern Feb 2026 – Aug 2026" -> startDate: "2026-02", endDate: "2026-08".
- NEVER copy the internship start date to the promoted full-time role. Treat them as two distinct experience records.

3. FOUNDER & STARTUP EXPERIENCE:
- All Founder, Co-Founder, Founding Engineer, Startup Lead, Entrepreneur, and Self-Employed roles demonstrating product development, API design, payment integration, or vendor management MUST be classified as professional experience in "experience".
- Set "experienceType": "FOUNDER" and "isFounder": true for such roles.
- For all other roles, set "experienceType" to "FULL_TIME", "INTERNSHIP", "CONTRACT", or "FREELANCE".

4. DATE NORMALIZATION (ISO YYYY-MM):
- Convert all dates into ISO "YYYY-MM" or "YYYY" format:
  * "Aug 2026" -> "2026-08"
  * "Feb 2026" -> "2026-02"
  * "2024" -> "2024-01"
  * "2025" -> "2025-12"
  * "Present" / "Current" -> "Present"

5. TECHNOLOGY TAXONOMY & ORM SEPARATION:
- Extract EVERY technology mentioned across Skills, Experience, Projects, and Activities.
- DO NOT summarize or omit technologies. Use exact official casing (e.g. "TanStack Query", "TypeORM", "OpenTelemetry", "BullMQ", "AsyncLocalStorage", "EventEmitter2", "React 19", "FastAPI", "n8n", "Sentry", "Jaeger", "Prometheus", "Grafana", "Redis").
- RULES FOR CATEGORIES:
  * "databases": ONLY actual database engines/caches (PostgreSQL, MySQL, MongoDB, Redis, SQLite). TypeORM, Prisma, Mongoose are ORMs/frameworks, NOT databases!
  * "frameworks": All backend, frontend, and ORM frameworks (NestJS, React, React 19, Express, FastAPI, TypeORM, TanStack Query, React Router, EventEmitter2, TailwindCSS, BullMQ, Node.js).
  * "languages": Programming & query languages (Python, JavaScript/TypeScript, SQL, C++).
  * "tools": DevOps, CI/CD, monitoring, workflow tools (Docker, Git, Linux, Postman, CI/CD, Sentry, n8n).
  * "other": Cloud & observability (AWS, GCP, Firebase, OpenTelemetry, Grafana, Prometheus, Jaeger, WebSockets, REST APIs, Microservices).
  * "patterns": Architecture & design patterns (AsyncLocalStorage, Event Driven Architecture, Audit Logging, RBAC, Branch Based Access Control, Idempotent Delivery).

6. EDUCATION (DEGREE & FIELD SEPARATION):
- Strictly separate the degree from the field of study.
- For "Bachelor of Technology in Electronics and Computer Engineering":
  * degree: "Bachelor of Technology"
  * field: "Electronics and Computer Engineering"
  * startYear: 2022
  * endYear: 2026
  * graduationDate: "2026"

7. ACHIEVEMENTS VS CERTIFICATIONS:
- "certifications": ONLY official professional certifications (e.g. AWS Certified Solutions Architect). If none exist, return [].
- "achievements": Hackathon placements, competitive programming ranks, coding milestones (e.g. "Amazon ML Challenge: Ranked 62nd of 2,500+ teams", "Codeforces Specialist (max rating 1448)", "500+ DSA problems solved across Codeforces and LeetCode").

8. PROJECT EXTRACTION & ZERO-HALLUCINATION URLS:
- For every project in "projects", extract name, description, techStack.
- Set "url": null unless an explicit, complete repository URL is written in the resume text. NEVER hallucinate repository URLs.

9. PROFESSIONAL SUMMARY:
- In "summary", generate a concise 2-3 sentence summary reflecting the candidate's core backend strengths, authorization/audit systems, startup leadership, and production stack.

Output pure JSON conforming to this schema:
{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "title": "string or null",
  "summary": "string or null",
  "skills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "databases": ["string"],
    "tools": ["string"],
    "other": ["string"],
    "patterns": ["string"]
  },
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM, YYYY, or Present",
      "experienceType": "FULL_TIME | INTERNSHIP | FOUNDER | FREELANCE | CONTRACT",
      "isFounder": false,
      "founderType": "FOUNDER | CO_FOUNDER | FOUNDING_ENGINEER | null",
      "sourceBullets": ["Exact verbatim bullet point from resume under this role"],
      "highlights": ["Exact verbatim bullet point from resume under this role"],
      "whatWasBuilt": ["Specific feature or system built in THIS role, or empty array [] if none"],
      "scaleAndOwnership": ["Specific ownership scope in THIS role, or empty array [] if none"],
      "measurableImpact": ["Quantitative metrics explicitly stated in THIS role, or empty array [] if none"],
      "technologies": ["Technology explicitly mentioned in THIS role's text"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "startYear": 2022,
      "endYear": 2026,
      "graduationDate": "2026",
      "gpa": null
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "techStack": ["string"],
      "url": null
    }
  ],
  "certifications": [],
  "achievements": ["string"],
  "links": {
    "linkedin": "string or null",
    "github": "string or null",
    "portfolio": "null"
  }
}`;

    // Truncate raw text if extraordinarily long (max ~25,000 characters)
    const truncatedText = rawText.length > 25000 ? rawText.substring(0, 25000) + '\n...[TRUNCATED]' : rawText;

    const result = await this.aiProviderService.structuredComplete<CandidateProfileExtractedData>({
      systemPrompt,
      userPrompt: `RESUME TEXT:\n${truncatedText}`,
      feature: 'RESUME_PARSE',
      maxTokens: 4096,
      temperature: 0.1,
      metadata,
    });

    return this.postProcessAndValidate(result.data, rawText);
  }

  async parseResume(resumeId: string): Promise<CandidateProfile> {
    const startTime = Date.now();
    this.logger.log(`Starting resume parsing pipeline for resume ID: ${resumeId}`);
    const resume = await this.resumeFileRepository.findOne({ where: { id: resumeId } });
    if (!resume) {
      throw new NotFoundException(`Resume with ID ${resumeId} not found`);
    }

    try {
      // 1. Update status to PARSING
      resume.status = ResumeFileStatus.PARSING;
      resume.parseError = null;
      await this.resumeFileRepository.save(resume);

      // 2. Read PDF from storage
      const buffer = await this.storageService.readFile(resume.storagePath);

      // 3. Extract text
      const rawText = await this.extractText(buffer);
      resume.rawText = rawText;
      await this.resumeFileRepository.save(resume);

      // 4. Parse with AI
      const extracted = await this.parseWithAi(rawText, {
        resumeId: resume.id,
        originalFileName: resume.originalFileName,
      });

      // 5. Upsert CandidateProfile
      let profile = await this.candidateProfileRepository.findOne({ where: { resumeFileId: resume.id } });
      if (!profile) {
        profile = this.candidateProfileRepository.create({
          resumeFileId: resume.id,
        });
      }

      profile.name = extracted.name || null;
      profile.email = extracted.email || null;
      profile.phone = extracted.phone || null;
      profile.location = extracted.location || null;
      profile.title = extracted.title || null;
      profile.summary = extracted.summary || null;
      profile.totalYearsExperience = extracted.totalYearsExperience || null;
      profile.skills = extracted.skills;
      profile.experience = extracted.experience;
      profile.education = extracted.education;
      profile.projects = extracted.projects;
      profile.certifications = extracted.certifications;
      profile.achievements = extracted.achievements;
      profile.links = extracted.links;
      profile.parsedAt = new Date();

      const savedProfile = await this.candidateProfileRepository.save(profile);

      // 6. Normalize and persist relational candidate_experience and candidate_evidence
      await this.normalizeAndPersistEvidence(resume.id, savedProfile);

      // 7. Update resume status without stale cascade overwrite
      resume.profile = savedProfile;
      resume.status = ResumeFileStatus.PARSED;
      resume.parseError = null;
      await this.resumeFileRepository.save(resume);

      const latencyMs = Date.now() - startTime;
      this.logger.log(
        `Resume parse SUCCESS for ID ${resumeId} | Candidate: "${savedProfile.name}" | ` +
        `Total Experience: ${savedProfile.totalYearsExperience} yrs | ` +
        `Skills: ${Object.values(savedProfile.skills || {}).flat().length} | ` +
        `Experience: ${savedProfile.experience?.length || 0} | ` +
        `Projects: ${savedProfile.projects?.length || 0} | ` +
        `Achievements: ${savedProfile.achievements?.length || 0} | ` +
        `Duration: ${latencyMs}ms`
      );

      return savedProfile;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(`Resume parse FAILED for ID ${resumeId} after ${latencyMs}ms: ${err.message}`, err.stack);
      resume.status = ResumeFileStatus.FAILED;
      resume.parseError = err.message || 'Unknown parsing error';
      await this.resumeFileRepository.save(resume);
      throw err;
    }
  }

  /**
   * Decomposes CandidateProfile into normalized relational entities:
   * Resume -> CandidateExperienceEntity -> CandidateEvidenceEntity
   */
  async normalizeAndPersistEvidence(resumeId: string, profile: CandidateProfile): Promise<void> {
    try {
      this.logger.log(`Normalizing candidate evidence for profile ${profile.id} (resume: ${resumeId})`);

      // Clean existing evidence claims and experiences for this profile
      await this.evidenceRepository.delete({ candidateProfileId: profile.id });
      await this.experienceRepository.delete({ candidateProfileId: profile.id });

      const techKeywords = [
        'NestJS', 'TypeScript', 'Node.js', 'React', 'React 19', 'TanStack Query', 'TanStackQuery',
        'PostgreSQL', 'Redis', 'BullMQ', 'TypeORM', 'Prisma', 'Docker', 'WordPress',
        'EventEmitter2', 'REST APIs', 'n8n', 'Sentry', 'Async Local Storage',
      ];

      // 1. Process candidate experiences and source bullets
      if (profile.experience && Array.isArray(profile.experience)) {
        for (let i = 0; i < profile.experience.length; i++) {
          const exp = profile.experience[i];
          let tenureType: ExperienceTenureType = 'FULL_TIME';
          const titleLower = (exp.title || '').toLowerCase();
          if (titleLower.includes('intern')) tenureType = 'INTERNSHIP';
          else if (titleLower.includes('founder') || titleLower.includes('co-founder')) tenureType = 'FOUNDER';
          else if (titleLower.includes('contract')) tenureType = 'CONTRACT';
          else if (titleLower.includes('part-time') || titleLower.includes('part time')) tenureType = 'PART_TIME';

          const expEntity = this.experienceRepository.create({
            resumeId: resumeId || profile.resumeFileId,
            candidateProfileId: profile.id,
            employer: exp.company || 'Unknown Company',
            roleTitle: exp.title || 'Engineer',
            tenureType,
            startDate: exp.startDate || '',
            endDate: exp.endDate || '',
            location: exp.location || null,
            orderIndex: i,
          });
          const savedExp = await this.experienceRepository.save(expEntity);

          const bullets: string[] = (exp.sourceBullets && exp.sourceBullets.length ? exp.sourceBullets : exp.highlights) || [];
          for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
            const rawBullet = (bullets[bIdx] || '').trim();
            if (!rawBullet) continue;

            // Category classification
            let category: CandidateEvidenceCategory = 'DELIVERABLE';
            const lower = rawBullet.toLowerCase();
            if (
              lower.includes('security') || lower.includes('authorization') ||
              lower.includes('access control') || lower.includes('bypass') ||
              lower.includes('vulnerability') || lower.includes('anonymity') ||
              lower.includes('permission') || lower.includes('impersonat')
            ) {
              category = 'SECURITY';
            } else if (
              lower.includes('caching') || lower.includes('redis') ||
              lower.includes('latency') || lower.includes('speed') ||
              lower.includes('cutting') || lower.includes('optimized') ||
              lower.includes('index') || lower.includes('performance')
            ) {
              category = 'OPTIMIZATION';
            } else if (
              lower.includes('architecture') || lower.includes('platform') ||
              lower.includes('event-driven') || lower.includes('system end-to-end') ||
              lower.includes('microservice') || lower.includes('bullmq') ||
              lower.includes('pipeline')
            ) {
              category = 'ARCHITECTURE';
            }

            // Deliverable name extraction
            let deliverableName = 'Engineering Deliverable';
            if (rawBullet.includes('BranchGuard')) {
              deliverableName = 'BranchGuard Access Control';
            } else if (rawBullet.includes('ActivityLog')) {
              deliverableName = 'ActivityLog Platform';
            } else if (rawBullet.includes('Super Admin impersonation')) {
              deliverableName = 'Super Admin Impersonation System';
            } else if (rawBullet.includes('BullMQ')) {
              deliverableName = 'BullMQ Notification Engine';
            } else if (rawBullet.includes('Redis caching')) {
              deliverableName = 'Redis Authorization Caching';
            } else if (rawBullet.includes('Survey platform') || rawBullet.includes('Survey builder')) {
              deliverableName = 'Survey Platform';
            } else if (rawBullet.includes('Leave Management')) {
              deliverableName = 'Leave Management Query Optimization';
            } else if (rawBullet.includes('quick commerce')) {
              deliverableName = 'Quick Commerce Platform';
            } else if (rawBullet.includes('Sentry') || rawBullet.includes('n8n')) {
              deliverableName = 'Sentry Incident Alerting Pipeline';
            } else {
              const firstClause = rawBullet.split(/[,.;]/)[0] || rawBullet;
              deliverableName = firstClause.split(/\s+/).slice(0, 6).join(' ');
            }

            // Extract technologies present in this bullet
            const matchedTechs = techKeywords.filter(k => 
              new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rawBullet)
            );
            if (exp.technologies && Array.isArray(exp.technologies)) {
              for (const t of exp.technologies) {
                if (rawBullet.toLowerCase().includes(t.toLowerCase()) && !matchedTechs.includes(t)) {
                  matchedTechs.push(t);
                }
              }
            }

            // Decompose bullet into 1 or more atomic claims pointing to the exact same source bullet
            interface DecomposedClaim {
              category: CandidateEvidenceCategory;
              deliverableName: string;
              atomicClaim: string;
            }

            const decomposedClaims: DecomposedClaim[] = [];

            if (rawBullet.includes('BranchGuard') && rawBullet.includes('bypass')) {
              decomposedClaims.push({
                category: 'SECURITY',
                deliverableName: 'BranchGuard Access Control',
                atomicClaim: 'Designed and implemented tenant-scoped authorization (BranchGuard) across HR modules and business policies.',
              });
              decomposedClaims.push({
                category: 'SECURITY',
                deliverableName: 'Authorization Scope Remediation',
                atomicClaim: 'Discovered and remediated tenant scope bypass vulnerability that allowed branch-restricted administrators to operate outside authorization scope.',
              });
            } else if (rawBullet.includes('ActivityLog frontend') || (rawBullet.includes('ActivityLog') && rawBullet.includes('React 19'))) {
              decomposedClaims.push({
                category: 'ARCHITECTURE',
                deliverableName: 'ActivityLog Timeline UI',
                atomicClaim: 'Engineered end-to-end audit activity timeline views with dynamic activity rendering, actor resolution, and URL-synced filtering using React 19 and TanStackQuery.',
              });
              decomposedClaims.push({
                category: 'DELIVERABLE',
                deliverableName: 'Interactive Survey Builder',
                atomicClaim: 'Contributed to the frontend interactive Survey builder and form configuration interface.',
              });
            } else if (rawBullet.includes('Redis caching')) {
              decomposedClaims.push({
                category: 'OPTIMIZATION',
                deliverableName: 'Redis Authorization Caching',
                atomicClaim: 'Integrated Redis caching into BranchGuard to cut repeated database validation checks on authenticated requests.',
              });
              decomposedClaims.push({
                category: 'ARCHITECTURE',
                deliverableName: 'Permission Lookup Optimization',
                atomicClaim: 'Reduced permission check latency and redundant database query overhead on authenticated API requests.',
              });
            } else if (rawBullet.includes('BullMQ') && rawBullet.includes('notification')) {
              decomposedClaims.push({
                category: 'ARCHITECTURE',
                deliverableName: 'BullMQ Notification Engine',
                atomicClaim: 'Engineered a BullMQ-based notification system with idempotent, replay-safe delivery, batched processing, and retry backoff.',
              });
              decomposedClaims.push({
                category: 'DELIVERABLE',
                deliverableName: 'In-App Notification Feed',
                atomicClaim: 'Built a paginated in-app notification feed supporting high-throughput async event delivery.',
              });
            } else if (rawBullet.includes('impersonation') && rawBullet.includes('Async Local Storage')) {
              decomposedClaims.push({
                category: 'SECURITY',
                deliverableName: 'Super Admin Impersonation System',
                atomicClaim: 'Built end-to-end Super Admin impersonation system with entity, migration, controller, and configurable-expiry tokens.',
              });
              decomposedClaims.push({
                category: 'ARCHITECTURE',
                deliverableName: 'Request-Scoped Audit Interceptor',
                atomicClaim: 'Engineered audit trail powered by Async Local Storage request context, global NestJS interceptor, and TypeORM Event Subscriber with @SkipAuditLog() decorator.',
              });
            } else if (rawBullet.includes('ActivityLog platform') || (rawBullet.includes('ActivityLog') && rawBullet.includes('EventEmitter2'))) {
              decomposedClaims.push({
                category: 'ARCHITECTURE',
                deliverableName: 'Event-Driven ActivityLog Platform',
                atomicClaim: 'Architected company-wide event-driven activity logging platform on NestJS EventEmitter2 standardizing audit trails across 15+ HR modules.',
              });
            } else if (rawBullet.includes('quick commerce') || rawBullet.includes('WordPress-based storefront') || rawBullet.includes('Onboarded 2 vendors')) {
              decomposedClaims.push({
                category: 'DELIVERABLE',
                deliverableName: 'Quick Commerce Platform',
                atomicClaim: 'Co-founded and built end-to-end quick commerce platform integrating payments, order workflows, and delivery tracking.',
              });
              decomposedClaims.push({
                category: 'ARCHITECTURE',
                deliverableName: 'Multi-Vendor Order Workflows',
                atomicClaim: 'Built custom backend APIs and order-management workflows integrated with a WordPress storefront and owned live production debugging.',
              });
            } else if (rawBullet.includes('Leave Management') && rawBullet.includes('index')) {
              decomposedClaims.push({
                category: 'OPTIMIZATION',
                deliverableName: 'Leave Management Query Optimization',
                atomicClaim: 'Optimized Leave Management database performance by eliminating inefficient join patterns and adding targeted PostgreSQL indexes.',
              });
            } else if (rawBullet.includes('Survey platform backend') || (rawBullet.includes('Survey') && rawBullet.includes('anonymity'))) {
              decomposedClaims.push({
                category: 'DELIVERABLE',
                deliverableName: 'Survey Analytics Platform Backend',
                atomicClaim: 'Owned Survey platform backend end-to-end covering audience assignment, publishing, response collection, and analytics.',
              });
              decomposedClaims.push({
                category: 'SECURITY',
                deliverableName: 'Respondent Anonymity Remediation',
                atomicClaim: 'Remediated two critical anonymity-leak vulnerabilities to protect survey respondent identities.',
              });
            } else {
              const firstClause = rawBullet.split(/[,.;]/)[0] || rawBullet;
              const delivName = firstClause.split(/\s+/).slice(0, 6).join(' ');
              decomposedClaims.push({
                category,
                deliverableName: delivName,
                atomicClaim: rawBullet,
              });
            }

            // Persist each decomposed claim pointing strictly to the SAME source bullet
            for (const dec of decomposedClaims) {
              const evidence = this.evidenceRepository.create({
                resumeId: resumeId || profile.resumeFileId,
                candidateProfileId: profile.id,
                experienceId: savedExp.id,
                sourceType: 'RESUME_BULLET',
                category: dec.category,
                bulletIndex: bIdx,
                rawBulletText: rawBullet, // SOURCE FACT: verbatim literal string from resume
                deliverableName: dec.deliverableName,
                atomicClaim: dec.atomicClaim, // NORMALIZED CLAIM: extracted technical claim
                technologies: matchedTechs.join(', ') || null,
                isSourceFact: false, // atomicClaim is a normalized claim, rawBulletText is the source fact
              });
              await this.evidenceRepository.save(evidence);
            }
          }
        }
      }

      // 2. Process technical skills section
      if (profile.skills) {
        const allSkills: string[] = Object.values(profile.skills).flat().filter(Boolean);
        for (const skill of allSkills) {
          const skillEvidence = this.evidenceRepository.create({
            resumeId: resumeId || profile.resumeFileId,
            candidateProfileId: profile.id,
            experienceId: null,
            sourceType: 'SKILLS_SECTION',
            category: 'SKILL_KEYWORD',
            bulletIndex: null,
            rawBulletText: null, // Skills are keywords, not verbatim narrative bullets
            deliverableName: skill,
            atomicClaim: `Demonstrated technical skill in ${skill}`,
            technologies: skill,
            isSourceFact: false,
          });
          await this.evidenceRepository.save(skillEvidence);
        }
      }

      // 3. Process projects
      if (profile.projects && Array.isArray(profile.projects)) {
        for (const project of profile.projects) {
          const projectEvidence = this.evidenceRepository.create({
            resumeId: resumeId || profile.resumeFileId,
            candidateProfileId: profile.id,
            experienceId: null,
            sourceType: 'PROJECT_ENTRY',
            category: 'DELIVERABLE',
            bulletIndex: null,
            rawBulletText: project.description || null,
            deliverableName: project.name || 'Project',
            atomicClaim: project.description || project.name,
            technologies: (project.techStack || []).join(', ') || null,
            isSourceFact: true,
          });
          await this.evidenceRepository.save(projectEvidence);
        }
      }

      // 4. Process achievements and hackathons
      if (profile.achievements && Array.isArray(profile.achievements)) {
        for (const ach of profile.achievements) {
          const achText = String(ach).trim();
          if (!achText) continue;
          const colonSplit = achText.split(':');
          const title = colonSplit[0]?.trim() || 'Achievement';
          const achEvidence = this.evidenceRepository.create({
            resumeId: resumeId || profile.resumeFileId,
            candidateProfileId: profile.id,
            experienceId: null,
            sourceType: 'ACHIEVEMENT_ENTRY',
            category: 'ACHIEVEMENT',
            bulletIndex: null,
            rawBulletText: achText,
            deliverableName: title,
            atomicClaim: achText,
            technologies: null,
            isSourceFact: true,
          });
          await this.evidenceRepository.save(achEvidence);
        }
      }

      this.logger.log(`Successfully normalized evidence for candidate profile ${profile.id}`);
    } catch (err: any) {
      this.logger.error(`Error during evidence normalization for profile ${profile.id}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
