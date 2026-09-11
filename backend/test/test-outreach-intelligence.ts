import { OutreachIntelligenceService } from '../src/modules/outreach/services/outreach-intelligence.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runOutreachIntelligenceTests() {
  console.log('Running Outreach Intelligence Automated Test Suite...\n');

  const service = new OutreachIntelligenceService({} as any);

  // Test 1: Contact Role Classification
  {
    assert(service.classifyContact('hr@stripe.com') === 'HR', 'hr@stripe.com classified as HR');
    assert(service.classifyContact('careers@linear.app') === 'HR', 'careers@linear.app classified as HR');
    assert(service.classifyContact('recruitment@brex.com') === 'HR', 'recruitment@brex.com classified as HR');
    assert(service.classifyContact('recruiter@google.com') === 'RECRUITER', 'recruiter@google.com classified as RECRUITER');
    assert(service.classifyContact('talent@vercel.com') === 'RECRUITER', 'talent@vercel.com classified as RECRUITER');
    assert(service.classifyContact('founder@startup.io') === 'FOUNDER', 'founder@startup.io classified as FOUNDER');
    assert(service.classifyContact('ceo@acme.com') === 'FOUNDER', 'ceo@acme.com classified as FOUNDER');
    assert(service.classifyContact('engineering@scale.com') === 'ENGINEERING', 'engineering@scale.com classified as ENGINEERING');
    assert(service.classifyContact('cto@postman.com') === 'ENGINEERING', 'cto@postman.com classified as ENGINEERING');
    assert(service.classifyContact('dev@infra.tech') === 'ENGINEERING', 'dev@infra.tech classified as ENGINEERING');
    assert(service.classifyContact('hello@company.com') === 'GENERAL', 'hello@company.com classified as GENERAL');
    assert(service.classifyContact('info@domain.org') === 'GENERAL', 'info@domain.org classified as GENERAL');
  }

  // Test 2: Research Quality Scoring Breakdown (0-100)
  {
    // Minimal discovery
    const minScore = service.calculateResearchScore({ domain: 'unknown.com', companyName: 'unknown.com' }, {}, 1);
    assert(minScore === 10, `Minimal domain score is 10 (got ${minScore})`);

    // High confidence profile
    const richScore = service.calculateResearchScore(
      {
        domain: 'stripe.com',
        companyName: 'Stripe',
        industry: 'Fintech',
      },
      {
        summary: 'Global payments infrastructure platform enabling internet commerce and financial workflows.',
        businessModel: 'B2B FinTech Platform',
        products: ['Stripe Payments', 'Stripe Connect', 'Stripe Billing'],
        techSignals: ['Ruby', 'Go', 'Java', 'Distributed Systems', 'Kafka'],
        hiringSignals: ['Staff Backend Engineer', 'Infrastructure Engineer'],
        recentInitiatives: ['Global payout expansion', 'Agentic AI payment protocols'],
      },
      3,
    );
    assert(richScore === 100, `Rich research score is 100 (got ${richScore})`);
  }

  console.log('\n🎉 ALL OUTREACH INTELLIGENCE UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runOutreachIntelligenceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
