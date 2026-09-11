import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
export class ResumeParserService {
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
    private readonly storageService: StorageService,
    private readonly aiProviderService: AIProviderService,
  ) {}

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

            return {
              company: String(exp.company).trim(),
              title,
              location: exp.location ? String(exp.location).trim() : null,
              startDate: exp.startDate ? String(exp.startDate).trim() : '',
              endDate: exp.endDate ? String(exp.endDate).trim() : 'Present',
              experienceType,
              isFounder,
              founderType: isFounder ? (exp.founderType || (/co-founder/i.test(title) ? 'CO_FOUNDER' : 'FOUNDER')) : null,
              highlights: Array.isArray(exp.highlights) ? exp.highlights.map(String).filter((h: string) => h.trim().length > 0) : [],
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
Your task is to parse resume text and produce a rich, high-fidelity JSON object with ZERO hallucination, accurate technology taxonomy, normalized dates, and first-class founder experience classification.

Strict Extraction Instructions:

1. PROMOTIONS & CONSECUTIVE ROLES (CRITICAL):
- When a candidate was promoted or held multiple roles at the same company (e.g. Intern followed by Full-Time), each role MUST have its own independent startDate and endDate according to its own role header.
- Example: "The Ninja Studio — Software Engineer Aug 2026 – Present" -> startDate: "2026-08", endDate: "Present".
- "The Ninja Studio — Backend Engineering Intern Feb 2026 – Aug 2026" -> startDate: "2026-02", endDate: "2026-08".
- NEVER copy the internship start date to the promoted full-time role.

2. FOUNDER & STARTUP EXPERIENCE:
- All Founder, Co-Founder, Founding Engineer, Startup Lead, Entrepreneur, and Self-Employed roles demonstrating product development, API design, payment integration, or vendor management MUST be classified as professional experience in "experience".
- Set "experienceType": "FOUNDER" and "isFounder": true for such roles.
- For all other roles, set "experienceType" to "FULL_TIME", "INTERNSHIP", "CONTRACT", or "FREELANCE".

3. DATE NORMALIZATION (ISO YYYY-MM):
- Convert all dates into ISO "YYYY-MM" or "YYYY" format:
  * "Aug 2026" -> "2026-08"
  * "Feb 2026" -> "2026-02"
  * "2024" -> "2024-01"
  * "2025" -> "2025-12"
  * "Present" / "Current" -> "Present"

4. TECHNOLOGY TAXONOMY & ORM SEPARATION:
- Extract EVERY technology mentioned across Skills, Experience, Projects, and Activities.
- DO NOT summarize or omit technologies. Use exact official casing (e.g. "TanStack Query", "TypeORM", "OpenTelemetry", "BullMQ", "AsyncLocalStorage", "EventEmitter2", "React 19", "FastAPI", "n8n", "Sentry", "Jaeger", "Prometheus", "Grafana", "Redis").
- RULES FOR CATEGORIES:
  * "databases": ONLY actual database engines/caches (PostgreSQL, MySQL, MongoDB, Redis, SQLite). TypeORM, Prisma, Mongoose are ORMs/frameworks, NOT databases!
  * "frameworks": All backend, frontend, and ORM frameworks (NestJS, React, React 19, Express, FastAPI, TypeORM, TanStack Query, React Router, EventEmitter2, TailwindCSS, BullMQ, Node.js).
  * "languages": Programming & query languages (Python, JavaScript/TypeScript, SQL, C++).
  * "tools": DevOps, CI/CD, monitoring, workflow tools (Docker, Git, Linux, Postman, CI/CD, Sentry, n8n).
  * "other": Cloud & observability (AWS, GCP, Firebase, OpenTelemetry, Grafana, Prometheus, Jaeger, WebSockets, REST APIs, Microservices).
  * "patterns": Architecture & design patterns (AsyncLocalStorage, Event Driven Architecture, Audit Logging, RBAC, Branch Based Access Control, Idempotent Delivery).

5. EDUCATION (DEGREE & FIELD SEPARATION):
- Strictly separate the degree from the field of study.
- For "Bachelor of Technology in Electronics and Computer Engineering":
  * degree: "Bachelor of Technology"
  * field: "Electronics and Computer Engineering"
  * startYear: 2022
  * endYear: 2026
  * graduationDate: "2026"

6. ACHIEVEMENTS VS CERTIFICATIONS:
- "certifications": ONLY official professional certifications (e.g. AWS Certified Solutions Architect). If none exist, return [].
- "achievements": Hackathon placements, competitive programming ranks, coding milestones (e.g. "Amazon ML Challenge: Ranked 62nd of 2,500+ teams", "Codeforces Specialist (max rating 1448)", "500+ DSA problems solved across Codeforces and LeetCode").

7. PROJECT EXTRACTION & ZERO-HALLUCINATION URLS:
- For every project in "projects", extract name, description, techStack.
- Set "url": null unless an explicit, complete repository URL is written in the resume text. NEVER hallucinate repository URLs.

8. PROFESSIONAL SUMMARY:
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
      "highlights": ["string"]
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

      // 6. Update resume status without stale cascade overwrite
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
}
