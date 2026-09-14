const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'relay',
  password: 'relay_dev_password',
  database: 'relay'
});

async function updateCandidate() {
  await client.connect();

  const candidateId = 'be4f2886-1411-4752-ad6b-c5dbd275dd68';

  const education = [
    {
      degree: 'Bachelor of Technology',
      field: 'Electronics & Computer Engineering',
      institution: 'Vellore Institute of Technology, Chennai',
      startYear: 2022,
      endYear: 2026,
      graduationDate: 'July 2026',
      status: 'Graduated'
    }
  ];

  const experience = [
    {
      title: 'Software Engineer',
      company: 'The Ninja Studio',
      startDate: '2026-08',
      endDate: 'Present',
      experienceType: 'FULL_TIME',
      highlights: [
        'Converted to full-time after six months as a backend engineering intern. Built the Activity Log frontend end to end using React 19, TypeScript, and TanStack Query, including timeline views, dynamic activity rendering, actor resolution, and URL-synced advanced filtering, and contributed to the Survey builder UI.',
        'Engineered a BullMQ-based notification system with idempotent, replay-safe delivery, batched processing, retry backoff, and a paginated in-app feed.',
        'Implemented Redis caching for BranchGuard\'s branch-access lookups, cutting repeated database validation checks on authenticated requests.',
        'Automated Sentry-to-Slack incident alerting through n8n to speed up production issue triage, and resolved multiple Dependabot-flagged dependency vulnerabilities across the backend.'
      ]
    },
    {
      title: 'Backend Engineering Intern',
      company: 'The Ninja Studio',
      startDate: '2026-02',
      endDate: '2026-08',
      experienceType: 'INTERNSHIP',
      highlights: [
        'Built a Super Admin impersonation system end to end, including the entity, migration, controller, service, and configurable-expiry tokens, with an audit trail powered by AsyncLocalStorage request context, a global NestJS interceptor, and a TypeORM EventSubscriber, plus a @SkipAuditLog() decorator for opt-outs.',
        'Designed and rolled out a company-wide, event-driven Activity Log platform on NestJS EventEmitter2, standardizing audit trails and actor attribution across 15+ HR modules including Leave, Tasks, Surveys, Payroll, and Company Admins.',
        'Designed and implemented branch-based access control (BranchGuard), enforcing tenant-scoped authorization across leave policies, requests, wallets, and dashboards, and identified and closed a bypass that let branch-restricted admins operate outside their assigned scope.',
        'Optimized Leave Management performance by removing an inefficient join pattern and adding targeted PostgreSQL indexes.',
        'Owned the Survey platform backend end to end, including the builder, audience assignment, publishing, response collection, and analytics, and discovered and remediated two anonymity-leak vulnerabilities that could expose respondent identities.'
      ]
    },
    {
      title: 'Founder & Full Stack Lead',
      company: "D'Rons",
      startDate: '2024',
      endDate: '2025',
      experienceType: 'FOUNDER',
      highlights: [
        'Co-founded and built a quick commerce platform end to end, integrating payments, order workflows, and delivery tracking while running it alongside coursework.',
        'Onboarded 2 vendors onto the platform, built custom backend APIs and order-management workflows integrated with a WordPress-based storefront, and owned live production debugging and order processing.'
      ]
    }
  ];

  const projects = [
    {
      name: 'Activity Log Platform',
      techStack: ['NestJS', 'EventEmitter2', 'TypeORM', 'AsyncLocalStorage', 'PostgreSQL'],
      description: 'Architected a company-wide event-driven activity logging and audit trail platform across 15+ HR modules with actor attribution.'
    },
    {
      name: 'Survey Platform',
      techStack: ['NestJS', 'React', 'PostgreSQL', 'TypeScript'],
      description: 'Owned the full backend for a survey builder with custom targeting, response aggregation, and zero-leak anonymity architecture.'
    },
    {
      name: 'BranchGuard Authorization',
      techStack: ['NestJS', 'Redis', 'PostgreSQL', 'TypeORM'],
      description: 'Designed tenant-scoped authorization system, closed security bypasses, and implemented Redis caching for authorization checks.'
    },
    {
      name: 'BullMQ Notification System',
      techStack: ['BullMQ', 'Redis', 'NestJS', 'TypeScript', 'PostgreSQL'],
      description: 'Engineered an idempotent, replay-safe BullMQ notification system with batched processing, retry backoff, and paginated in-app feeds.'
    },
    {
      name: 'Super Admin Impersonation',
      techStack: ['NestJS', 'TypeORM', 'PostgreSQL', 'AsyncLocalStorage'],
      description: 'Built end-to-end impersonation system with configurable-expiry tokens and audit trail powered by AsyncLocalStorage request context.'
    },
    {
      name: 'Leave Management Optimization',
      techStack: ['PostgreSQL', 'TypeORM', 'NestJS'],
      description: 'Optimized Leave Management performance by removing inefficient join patterns and adding targeted PostgreSQL indexes.'
    },
    {
      name: 'Founder Experience (D\'Rons)',
      techStack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Payment Gateways'],
      description: 'Co-founded quick commerce platform Dronsnow.com end to end, building backend APIs, payment integrations, and vendor management workflows.'
    },
    {
      name: 'Sentinel Gateway',
      techStack: ['Node.js', 'Redis', 'Docker', 'OpenTelemetry', 'Jaeger', 'Prometheus', 'Grafana'],
      description: 'Distributed API gateway with Redis rate limiting, retry handling, and OpenTelemetry observability.'
    },
    {
      name: 'Minimal Workflow Engine',
      techStack: ['FastAPI', 'Python', 'AsyncIO', 'WebSockets'],
      description: 'Graph-based DAG workflow orchestration engine executing async tasks with WebSocket telemetry.'
    }
  ];

  const skills = {
    languages: ['TypeScript', 'JavaScript', 'Python', 'SQL', 'C++'],
    frameworks: ['NestJS', 'Node.js', 'Express', 'FastAPI', 'React', 'TypeORM', 'BullMQ', 'EventEmitter2', 'TanStack Query'],
    databases: ['PostgreSQL', 'Redis', 'MySQL', 'MongoDB'],
    infrastructure: ['Docker', 'Redis', 'OpenTelemetry', 'Grafana', 'Prometheus', 'Jaeger'],
    tools: ['Git', 'Linux', 'Postman', 'Sentry', 'n8n', 'CI/CD'],
    cloud: ['AWS', 'GCP', 'Firebase'],
    other: ['Microservices', 'Distributed Systems', 'REST APIs', 'WebSockets']
  };

  await client.query(
    `UPDATE candidate_profile
     SET name = $1,
         title = $2,
         education = $3,
         experience = $4,
         projects = $5,
         skills = $6,
         updated_at = NOW()
     WHERE id = $7`,
    [
      'Ashish Raj',
      'Software Engineer',
      JSON.stringify(education),
      JSON.stringify(experience),
      JSON.stringify(projects),
      JSON.stringify(skills),
      candidateId
    ]
  );

  console.log('✅ Successfully updated CandidateProfile in database for Ashish Raj:');
  console.log('   - Current Title: Software Engineer');
  console.log('   - Current Company: The Ninja Studio (Aug 2026 – Present)');
  console.log('   - Education: Graduated July 2026, B.Tech ECE, VIT Chennai');
  console.log('   - Strongest Experience: Activity Log Platform, Survey Platform, BranchGuard, Redis Caching, BullMQ, Super Admin Impersonation, Leave Management Optimization, D\'Rons');

  await client.end();
}

updateCandidate().catch(console.error);
