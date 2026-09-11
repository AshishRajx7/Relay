import { Injectable, Logger } from '@nestjs/common';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { RankedMatch } from '../entities/draft-reasoning.entity';

export interface CandidateMatchResult {
  chosenProject: string;
  matchScore: number;
  matchedTechnologies: string[];
  matchedSkills: string[];
  whyRelevant: string;
  rankedMatches: RankedMatch[];
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

  // Candidate experience catalog
  private readonly experienceCatalog: ExperienceCatalogItem[] = [
    {
      name: 'BullMQ Notification System',
      keywords: ['notification', 'queue', 'bullmq', 'async', 'event-driven', 'idempotent', 'job', 'worker', 'message', 'background', 'pubsub', 'kafka', 'streaming'],
      technologies: ['BullMQ', 'Redis', 'NestJS', 'TypeScript', 'PostgreSQL'],
      description: 'Engineered an idempotent, replay-safe BullMQ notification system with batched processing, retry backoff, and paginated in-app feeds.',
      relevantDomains: ['b2b saas', 'developer tools', 'fintech', 'productivity', 'messaging'],
    },
    {
      name: 'Activity Log Platform',
      keywords: ['activity log', 'audit', 'compliance', 'eventemitter2', 'events', 'hr', 'governance', 'tracing', 'actor', 'interceptor'],
      technologies: ['NestJS', 'EventEmitter2', 'AsyncLocalStorage', 'TypeORM', 'PostgreSQL'],
      description: 'Architected a company-wide event-driven activity logging and audit trail platform across 15+ HR modules with actor attribution.',
      relevantDomains: ['hr tech', 'compliance', 'b2b saas', 'enterprise', 'security'],
    },
    {
      name: 'BranchGuard Authorization',
      keywords: ['authorization', 'rbac', 'security', 'branchguard', 'multi-tenant', 'permissions', 'access control', 'tenant', 'isolation'],
      technologies: ['NestJS', 'Redis', 'PostgreSQL', 'TypeORM'],
      description: 'Designed branch-based tenant access control, closed security bypasses, and added Redis caching for authorization lookups.',
      relevantDomains: ['security', 'fintech', 'multi-tenant saas', 'enterprise software'],
    },
    {
      name: 'Sentinel Gateway',
      keywords: ['gateway', 'api gateway', 'rate limiting', 'distributed', 'opentelemetry', 'jaeger', 'prometheus', 'grafana', 'metrics', 'proxy', 'latency'],
      technologies: ['Node.js', 'Redis', 'Docker', 'OpenTelemetry', 'Jaeger', 'Prometheus', 'Grafana'],
      description: 'Built a high-throughput distributed API gateway with Redis rate limiting, distributed tracing with OpenTelemetry, and Prometheus metrics.',
      relevantDomains: ['infrastructure', 'developer tools', 'cloud', 'apis', 'microservices'],
    },
    {
      name: 'Minimal Workflow Engine',
      keywords: ['workflow', 'dag', 'graph', 'orchestration', 'fastapi', 'asyncio', 'websockets', 'pipeline', 'execution engine'],
      technologies: ['FastAPI', 'Python', 'AsyncIO', 'WebSockets'],
      description: 'Created a graph-based DAG workflow orchestration engine executing asynchronous tasks with real-time WebSocket telemetry.',
      relevantDomains: ['developer tooling', 'automation', 'data pipelines', 'ai workflows'],
    },
    {
      name: 'Redis Optimization',
      keywords: ['redis', 'caching', 'optimization', 'performance', 'latency', 'high throughput', 'indexing', 'database bottleneck'],
      technologies: ['Redis', 'PostgreSQL', 'TypeORM', 'Node.js'],
      description: 'Eliminated database query bottlenecks, introduced Redis caching for hot paths, and optimized relational indexes.',
      relevantDomains: ['high traffic platforms', 'e-commerce', 'fintech', 'developer tools'],
    },
    {
      name: 'Survey Platform',
      keywords: ['survey', 'anonymity', 'analytics', 'builder', 'data collection', 'leak prevention', 'frontend', 'react'],
      technologies: ['NestJS', 'React', 'PostgreSQL', 'TypeScript'],
      description: 'Owned the full backend for a survey builder with custom targeting, response aggregation, and zero-leak anonymity architecture.',
      relevantDomains: ['hr tech', 'analytics', 'feedback platforms', 'product discovery'],
    },
    {
      name: 'Founder Experience',
      keywords: ['founder', 'co-founder', 'startup', 'e-commerce', 'quick commerce', 'payments', 'vendor', '0 to 1', 'ownership'],
      technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Payment Gateways'],
      description: 'Co-founded quick commerce startup D\'Rons end to end, building backend APIs, payment integrations, and vendor management workflows.',
      relevantDomains: ['startups', 'early stage', 'e-commerce', 'marketplaces'],
    },
  ];

  /**
   * Matches company profile intelligence against candidate portfolio and ranks top 3 experiences.
   */
  public matchExperience(
    company: CompanyProfile,
    candidate: CandidateProfile,
  ): CandidateMatchResult {
    const companyTechSignals = (company.techSignals || []).map((t) => t.toLowerCase());
    const companyIndustry = (company.industry || '').toLowerCase();
    const companyBusinessModel = (company.businessModel || '').toLowerCase();
    const hiringSignals = (company.hiringSignals || []).map((h) => h.toLowerCase());
    const companySummary = (company.summary || '').toLowerCase();

    const companyContextString = [
      ...companyTechSignals,
      companyIndustry,
      companyBusinessModel,
      ...hiringSignals,
      companySummary,
    ].join(' ');

    const scoredProjects: Array<{
      item: ExperienceCatalogItem;
      score: number;
      matchedTechs: string[];
      matchedKeywords: string[];
    }> = [];

    for (const exp of this.experienceCatalog) {
      let score = 50; // Base score
      const matchedTechs: string[] = [];
      const matchedKeywords: string[] = [];

      // Check tech overlap
      for (const tech of exp.technologies) {
        if (companyTechSignals.some((ct) => ct.includes(tech.toLowerCase()) || tech.toLowerCase().includes(ct))) {
          score += 15;
          matchedTechs.push(tech);
        } else if (companyContextString.includes(tech.toLowerCase())) {
          score += 10;
          matchedTechs.push(tech);
        }
      }

      // Check keyword/domain overlap
      for (const kw of exp.keywords) {
        if (companyContextString.includes(kw.toLowerCase())) {
          score += 8;
          matchedKeywords.push(kw);
        }
      }

      // Check industry/domain alignment
      for (const domain of exp.relevantDomains) {
        if (companyIndustry.includes(domain) || companyBusinessModel.includes(domain)) {
          score += 10;
        }
      }

      // Cap max score at 98
      const finalScore = Math.min(98, score);
      scoredProjects.push({
        item: exp,
        score: finalScore,
        matchedTechs: Array.from(new Set(matchedTechs)),
        matchedKeywords: Array.from(new Set(matchedKeywords)),
      });
    }

    // Sort descending by score
    scoredProjects.sort((a, b) => b.score - a.score);

    const topMatch = scoredProjects[0];
    const rankedMatches: RankedMatch[] = scoredProjects.slice(0, 3).map((p, idx) => ({
      rank: idx + 1,
      project: p.item.name,
      score: p.score,
    }));

    const matchedTechnologies = topMatch.matchedTechs.length > 0 ? topMatch.matchedTechs : ['NestJS', 'PostgreSQL', 'Redis'];
    const whyRelevant = `${company.companyName} operates ${company.businessModel || 'systems'} with focus on ${matchedTechnologies.join(', ')}. Candidate's work on ${topMatch.item.name} (${topMatch.item.description}) directly mirrors this technical challenge.`;

    return {
      chosenProject: topMatch.item.name,
      matchScore: topMatch.score,
      matchedTechnologies,
      matchedSkills: topMatch.matchedKeywords.slice(0, 5),
      whyRelevant,
      rankedMatches,
    };
  }
}
