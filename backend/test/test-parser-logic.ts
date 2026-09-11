import { ResumeParserService } from '../src/modules/resume/resume-parser.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('Running Resume Parser Intelligence Automated Test Suite...\n');
  const service = new ResumeParserService({} as any, {} as any, {} as any, {} as any);

  // Test 1: Promotions & Consecutive Roles Timeline Separation
  {
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
          startDate: '2026-02', // Erroneously copied by LLM from overall tenure
          endDate: 'Present',
          experienceType: 'FULL_TIME',
        },
      ],
    };

    const result = service.postProcessAndValidate(rawAiData);
    assert(result.experience[0].startDate === '2026-02', 'Internship start date preserved as 2026-02');
    assert(result.experience[0].endDate === '2026-08', 'Internship end date preserved as 2026-08');
    assert(result.experience[1].startDate === '2026-08', 'Promoted role start date adjusted to 2026-08 (no overlap)');
    assert(result.experience[1].endDate === 'Present', 'Promoted role end date is Present');
  }

  // Test 2: Founder Experience & Total Years Experience Calculation
  {
    const rawAiData = {
      name: 'Ashish Raj',
      experience: [
        {
          company: "D'Rons",
          title: 'Founder and Full Stack Lead',
          startDate: '2024-01',
          endDate: '2025-12',
          isFounder: true,
        },
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
          startDate: '2026-08',
          endDate: 'Present',
          experienceType: 'FULL_TIME',
        },
      ],
    };

    const result = service.postProcessAndValidate(rawAiData);
    assert(result.experience[0].experienceType === 'FOUNDER', 'D\'Rons classified as FOUNDER');
    assert(result.experience[0].isFounder === true, 'D\'Rons isFounder is true');
    assert(result.experience[0].founderType === 'FOUNDER', 'D\'Rons founderType is FOUNDER');
    assert(result.totalYearsExperience === 2.6, `Total years experience calculated as 2.6 yrs (got ${result.totalYearsExperience})`);
  }

  // Test 3: Degree & Field of Study Separation
  {
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
    assert(result.education[0].degree === 'Bachelor of Technology', 'Degree parsed as "Bachelor of Technology"');
    assert(result.education[0].field === 'Electronics and Computer Engineering', 'Field parsed as "Electronics and Computer Engineering"');
    assert(result.education[0].startYear === 2022, 'Start year is 2022');
    assert(result.education[0].endYear === 2026, 'End year is 2026');
  }

  // Test 4: Deterministic Skill Taxonomy & ORM Relocation
  {
    const rawAiData = {
      name: 'Ashish Raj',
      skills: {
        languages: ['Python', 'TypeScript', 'SQL'],
        frameworks: ['NestJS', 'Express', 'FastAPI'],
        databases: ['PostgreSQL', 'MySQL', 'TypeORM', 'Prisma'], // ORMs in databases
        tools: ['Docker', 'Git'],
        other: ['OpenTelemetry', 'Grafana'],
      },
    };

    const rawResumeText = 'React 19, TanStack Query, EventEmitter2, BullMQ, TailwindCSS, AsyncLocalStorage, RBAC';
    const result = service.postProcessAndValidate(rawAiData, rawResumeText);

    assert(!result.skills.databases.includes('TypeORM'), 'TypeORM removed from databases');
    assert(!result.skills.databases.includes('Prisma'), 'Prisma removed from databases');
    assert(result.skills.frameworks.includes('TypeORM'), 'TypeORM moved to frameworks');
    assert(result.skills.frameworks.includes('React 19'), 'React 19 preserved in frameworks');
    assert(result.skills.frameworks.includes('TanStack Query'), 'TanStack Query preserved in frameworks');
    assert(result.skills.frameworks.includes('EventEmitter2'), 'EventEmitter2 preserved in frameworks');
    assert(result.skills.patterns?.includes('AsyncLocalStorage') ?? false, 'AsyncLocalStorage captured in patterns');
    assert(result.skills.patterns?.includes('RBAC') ?? false, 'RBAC captured in patterns');
  }

  // Test 5: Achievements vs Certifications Classification
  {
    const rawAiData = {
      name: 'Ashish Raj',
      certifications: [
        'Codeforces Specialist (max rating 1448); 500+ DSA problems solved',
        'Amazon ML Challenge: Ranked 62nd of 2,500+ teams',
      ],
      achievements: [],
    };

    const result = service.postProcessAndValidate(rawAiData);
    assert(result.certifications.length === 0, 'Certifications array is empty (no formal certs)');
    assert(result.achievements.some((a) => a.includes('Codeforces Specialist')), 'Codeforces in achievements');
    assert(result.achievements.some((a) => a.includes('Amazon ML Challenge')), 'Amazon ML Challenge in achievements');
  }

  // Test 6: Zero-Hallucination Project URLs
  {
    const rawAiData = {
      name: 'Ashish Raj',
      projects: [
        {
          name: 'Sentinel Gateway',
          description: 'Distributed API Gateway',
          techStack: ['Node.js', 'Redis', 'Docker'],
          url: 'https://github.com/fake/repo-not-in-source',
        },
      ],
    };

    const rawResumeText = 'Sentinel Gateway — Distributed API Gateway | GitHub Node.js, Redis, Docker';
    const result = service.postProcessAndValidate(rawAiData, rawResumeText);
    assert(result.projects[0].url === null, 'Fabricated repository URL successfully set to null');
  }

  console.log('\n🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
