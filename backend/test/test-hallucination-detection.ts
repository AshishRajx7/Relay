import { DraftQualityService } from '../src/modules/outreach/services/draft-quality.service';
import { OutreachStrategy } from '../src/modules/outreach/services/candidate-matching.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runHallucinationDetectionTests() {
  console.log('Running PR 2: Hallucination Detection Unit Test Suite...\n');
  const qualityService = new DraftQualityService();

  const mockCompany: any = {
    companyName: 'SourceFuse',
    domain: 'sourcefuse.com',
    industry: 'Cloud',
    businessModel: 'Enterprise',
    summary: 'Cloud migration and modern enterprise architecture',
    techSignals: [],
    products: ['CloudTransform'],
  };

  // =========================================================================
  // 1. BUSINESS_ONLY Strategy Tests
  // =========================================================================
  console.log('--- 1. BUSINESS_ONLY Strategy Hallucination Tests ---');

  const businessOnlyMatch: any = {
    chosenProject: 'Sentinel Gateway',
    matchScore: 85,
    matchedTechnologies: [],
    matchedSkills: ['distributed systems', 'queues'],
    whyRelevant: 'SourceFuse builds cloud services. Candidate has background in distributed systems.',
    strategy: OutreachStrategy.BUSINESS_ONLY,
  };

  // Test 1A: "your NestJS stack"
  {
    const body = `Hi Akanksha,\n\nI noticed your NestJS stack is scaling rapidly across enterprise workloads. In my past work, I built resilient distributed gateways.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, mockCompany, businessOnlyMatch);
    assert(result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'Flags "your NestJS stack" as HALLUCINATED_COMPANY_TECH_ATTRIBUTION');
    assert(result.requiresManualReview === true, 'Sets requiresManualReview = true for hallucinated tech');
  }

  // Test 1B: "you use Redis"
  {
    const body = `Hi Akanksha,\n\nI understand you use Redis for low-latency in-memory data caching. I recently optimized database bottlenecks with Redis caching.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, mockCompany, businessOnlyMatch);
    assert(result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'Flags "you use Redis" as HALLUCINATED_COMPANY_TECH_ATTRIBUTION');
    assert(result.requiresManualReview === true, 'Sets requiresManualReview = true for "you use Redis"');
  }

  // Test 1C: "your PostgreSQL infrastructure"
  {
    const body = `Hi Akanksha,\n\nGiven your PostgreSQL infrastructure, I thought my experience with relational schema indexing and high-throughput query tuning might be relevant.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, mockCompany, businessOnlyMatch);
    assert(result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'Flags "your PostgreSQL infrastructure" as HALLUCINATED_COMPANY_TECH_ATTRIBUTION');
    assert(result.requiresManualReview === true, 'Sets requiresManualReview = true for "your PostgreSQL infrastructure"');
  }

  // Test 1D: "your Kafka architecture"
  {
    const body = `Hi Akanksha,\n\nI was reading about your Kafka architecture and streaming pipelines. I engineered idempotent event streaming systems.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, mockCompany, businessOnlyMatch);
    assert(result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'Flags "your Kafka architecture" as HALLUCINATED_COMPANY_TECH_ATTRIBUTION');
    assert(result.requiresManualReview === true, 'Sets requiresManualReview = true for "your Kafka architecture"');
  }

  // Test 1E: "your backend runs on FastAPI"
  {
    const body = `Hi Akanksha,\n\nI saw that your backend runs on FastAPI for async microservices. I built DAG execution workflows with FastAPI and WebSockets.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, mockCompany, businessOnlyMatch);
    assert(result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'Flags "your backend runs on FastAPI" as HALLUCINATED_COMPANY_TECH_ATTRIBUTION');
    assert(result.requiresManualReview === true, 'Sets requiresManualReview = true for "your backend runs on FastAPI"');
  }

  // Test 1F: Clean BUSINESS_ONLY Draft (Candidate Tools ONLY - No Company Tech Attribution)
  {
    const body = `Hi Akanksha,\n\nI noticed SourceFuse is focused on cloud migration and modern enterprise architecture. In my recent engineering work building high-throughput distributed systems with NestJS and Redis, I designed idempotent background worker pipelines that eliminated query bottlenecks.\n\nWould it make sense to connect?\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, mockCompany, businessOnlyMatch);
    assert(!result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'Does NOT flag candidate experience with NestJS/Redis as company hallucination');
    assert(!result.flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION'), 'No unverified tech flags on clean draft');
  }

  // =========================================================================
  // 2. TECH_STACK_MATCH Strategy Tests
  // =========================================================================
  console.log('\n--- 2. TECH_STACK_MATCH Strategy Tests ---');

  const techStackCompany: any = {
    companyName: 'TechCorp',
    domain: 'techcorp.io',
    industry: 'FinTech',
    businessModel: 'B2B SaaS',
    summary: 'High performance payment pipelines',
    techSignals: ['Redis', 'PostgreSQL'],
    products: ['PaymentCore'],
  };

  const techMatchResult: any = {
    chosenProject: 'Redis Optimization',
    matchScore: 90,
    matchedTechnologies: ['Redis', 'PostgreSQL'],
    matchedSkills: ['caching', 'indexing'],
    whyRelevant: 'TechCorp utilizes Redis, PostgreSQL.',
    strategy: OutreachStrategy.TECH_STACK_MATCH,
  };

  // Test 2A: Legitimate verified tech attribution
  {
    const body = `Hi Team,\n\nI noticed you use Redis and your PostgreSQL infrastructure handles heavy transaction volumes. In my previous work, I optimized hot paths with Redis caching.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, techStackCompany, techMatchResult);
    assert(!result.flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION'), 'Verified tech (Redis, PostgreSQL) passes without UNVERIFIED flag');
    assert(!result.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION'), 'No hallucinated tech flag for verified tech stack');
  }

  // Test 2B: Unverified tech attribution in TECH_STACK_MATCH
  {
    const body = `Hi Team,\n\nI noticed you use Redis, and your Kafka architecture handles distributed streaming events. I engineered async queue pipelines.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Engineering inquiry', body, techStackCompany, techMatchResult);
    assert(result.flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION'), 'Flags Kafka as UNVERIFIED_COMPANY_TECH_ATTRIBUTION (only Redis/PostgreSQL verified)');
    assert(result.requiresManualReview === true, 'Sets requiresManualReview = true for unverified tech in TECH_STACK_MATCH');
  }

  // =========================================================================
  // 3. Non-Blocking Generation Verification
  // =========================================================================
  console.log('\n--- 3. Non-blocking Generation Verification ---');
  {
    const bodyWithHallucination = `Hi,\n\nYour NestJS stack is great. In my work...\n\nBest,\nAshish`;
    let threw = false;
    let evalResult: any;
    try {
      evalResult = qualityService.evaluateDraft('Subject', bodyWithHallucination, mockCompany, businessOnlyMatch);
    } catch (e) {
      threw = true;
    }
    assert(!threw, 'Evaluation completes without throwing errors (non-blocking)');
    assert(evalResult !== undefined, 'Returns valid score result object');
    assert(evalResult.requiresManualReview === true, 'Routes flagged draft to review without crashing');
  }

  console.log('\n🎉 ALL PR 2 HALLUCINATION DETECTION UNIT TESTS PASSED!');
}

runHallucinationDetectionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
