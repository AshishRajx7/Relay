import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResumeParserService } from './resume-parser.service';
import { ResumeFile } from './entities/resume-file.entity';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { StorageService } from '../storage/storage.service';
import { AIProviderService } from '../ai-provider/ai-provider.service';

describe('ResumeParserService - Quality & Deterministic Logic Tests', () => {
  let service: ResumeParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeParserService,
        {
          provide: getRepositoryToken(ResumeFile),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            readFile: jest.fn(),
          },
        },
        {
          provide: AIProviderService,
          useValue: {
            structuredComplete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ResumeParserService>(ResumeParserService);
  });

  describe('1. Promotions & Consecutive Roles in Same Company', () => {
    it('should separate timelines when a candidate was promoted after an internship', () => {
      const rawAiData = {
        name: 'Ashish Raj',
        experience: [
          {
            company: 'The Ninja Studio',
            title: 'Backend Engineering Intern',
            startDate: '2026-02',
            endDate: '2026-08',
            experienceType: 'INTERNSHIP',
          },
          {
            company: 'The Ninja Studio',
            title: 'Software Engineer',
            startDate: '2026-02', // Erroneously set to overall tenure start by LLM
            endDate: 'Present',
            experienceType: 'FULL_TIME',
          },
        ],
      };

      const result = service.postProcessAndValidate(rawAiData);

      expect(result.experience[0].startDate).toBe('2026-02');
      expect(result.experience[0].endDate).toBe('2026-08');
      expect(result.experience[0].experienceType).toBe('INTERNSHIP');

      // Promoted full-time role start date must be corrected to the end of internship
      expect(result.experience[1].startDate).toBe('2026-08');
      expect(result.experience[1].endDate).toBe('Present');
      expect(result.experience[1].experienceType).toBe('FULL_TIME');
    });
  });

  describe('2. Founder Experience & Total Years Experience Calculation', () => {
    it('should correctly count founder experience and calculate exact non-overlapping month union', () => {
      const rawAiData = {
        name: 'Ashish Raj',
        experience: [
          {
            company: "D'Rons",
            title: 'Founder and Full Stack Lead',
            startDate: '2024-01',
            endDate: '2025-12', // 24 months
            isFounder: true,
          },
          {
            company: 'The Ninja Studio',
            title: 'Backend Engineering Intern',
            startDate: '2026-02',
            endDate: '2026-08', // 7 months
            experienceType: 'INTERNSHIP',
          },
          {
            company: 'The Ninja Studio',
            title: 'Software Engineer',
            startDate: '2026-08',
            endDate: 'Present',
            experienceType: 'FULL_TIME',
          },
        ],
      };

      const result = service.postProcessAndValidate(rawAiData);

      expect(result.experience[0].experienceType).toBe('FOUNDER');
      expect(result.experience[0].isFounder).toBe(true);
      expect(result.experience[0].founderType).toBe('FOUNDER');

      // 24 months (D'Rons) + 7 months (Ninja Studio) = 31 unique months -> 2.6 years
      expect(result.totalYearsExperience).toBe(2.6);
    });
  });

  describe('3. Degree & Field of Study Separation', () => {
    it('should cleanly split "Degree in Field" into separate degree and field properties', () => {
      const rawAiData = {
        name: 'Ashish Raj',
        education: [
          {
            institution: 'Vellore Institute of Technology, Chennai',
            degree: 'Bachelor of Technology in Electronics and Computer Engineering',
            field: '',
            startYear: 2022,
            endYear: 2026,
          },
        ],
      };

      const result = service.postProcessAndValidate(rawAiData);

      expect(result.education[0].degree).toBe('Bachelor of Technology');
      expect(result.education[0].field).toBe('Electronics and Computer Engineering');
      expect(result.education[0].startYear).toBe(2022);
      expect(result.education[0].endYear).toBe(2026);
    });
  });

  describe('4. Deterministic Skill Taxonomy & ORM Relocation', () => {
    it('should move TypeORM, Prisma, etc. from databases to frameworks and preserve all stack items', () => {
      const rawAiData = {
        name: 'Ashish Raj',
        skills: {
          languages: ['Python', 'TypeScript', 'SQL'],
          frameworks: ['NestJS', 'Express', 'FastAPI'],
          databases: ['PostgreSQL', 'MySQL', 'TypeORM', 'Prisma'], // ORMs mistakenly in databases
          tools: ['Docker', 'Git'],
          other: ['OpenTelemetry', 'Grafana'],
        },
      };

      const rawResumeText = 'React 19, TanStack Query, EventEmitter2, BullMQ, TailwindCSS, AsyncLocalStorage';
      const result = service.postProcessAndValidate(rawAiData, rawResumeText);

      // Databases must not contain ORMs
      expect(result.skills.databases).toEqual(['PostgreSQL', 'MySQL']);

      // Frameworks must contain ORMs and raw text framework mentions
      expect(result.skills.frameworks).toContain('TypeORM');
      expect(result.skills.frameworks).toContain('Prisma');
      expect(result.skills.frameworks).toContain('React 19');
      expect(result.skills.frameworks).toContain('TanStack Query');
      expect(result.skills.frameworks).toContain('EventEmitter2');
      expect(result.skills.frameworks).toContain('BullMQ');

      // Patterns must contain AsyncLocalStorage
      expect(result.skills.patterns).toContain('AsyncLocalStorage');
    });
  });

  describe('5. Achievements vs Certifications Classification', () => {
    it('should categorize competitions, hackathons, and Codeforces ratings into achievements and keep certifications clean', () => {
      const rawAiData = {
        name: 'Ashish Raj',
        certifications: [
          'Codeforces Specialist (max rating 1448); 500+ DSA problems solved',
          'Amazon ML Challenge: Ranked 62nd of 2,500+ teams',
        ],
        achievements: [],
      };

      const result = service.postProcessAndValidate(rawAiData);

      expect(result.certifications).toEqual([]);
      expect(result.achievements).toContain('Codeforces Specialist (max rating 1448); 500+ DSA problems solved');
      expect(result.achievements).toContain('Amazon ML Challenge: Ranked 62nd of 2,500+ teams');
    });
  });

  describe('6. Zero-Hallucination Project URLs', () => {
    it('should nullify fabricated placeholder URLs if no full URL is in source text', () => {
      const rawAiData = {
        name: 'Ashish Raj',
        projects: [
          {
            name: 'Sentinel Gateway',
            description: 'Distributed API Gateway',
            techStack: ['Node.js', 'Redis', 'Docker'],
            url: 'https://github.com/fake-user/fabricated-repo',
          },
        ],
      };

      const rawResumeText = 'Sentinel Gateway — Distributed API Gateway | GitHub Node.js, Redis, Docker';
      const result = service.postProcessAndValidate(rawAiData, rawResumeText);

      expect(result.projects[0].url).toBeNull();
    });
  });
});
