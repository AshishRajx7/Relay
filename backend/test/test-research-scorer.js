const { ResearchQualityScorerService } = require('../dist/modules/company-research/services/research-quality-scorer.service');

function runScorerTests() {
  console.log('===========================================================');
  console.log('📊 TASK GROUP 5: RESEARCH QUALITY SCORER UNIT TESTS');
  console.log('===========================================================\n');

  const scorer = new ResearchQualityScorerService();

  // Test 1: Full-quality crawl (Score ~100)
  const fullCrawl = {
    url: 'https://stripe.com',
    success: true,
    markdown: 'word '.repeat(1600),
    htmlLinks: ['https://stripe.com/about', 'https://stripe.com/careers', 'https://stripe.com/products'],
    subpagesCrawled: ['https://stripe.com/about', 'https://stripe.com/careers', 'https://stripe.com/products'],
    pageCount: 4,
    wordCount: 1600,
    metadata: {},
  };

  const fullProfile = {
    persona: 'FINTECH',
    industry: 'Financial Services',
    companySize: '1000+',
    summary: 'Stripe builds financial infrastructure for internet commerce globally.',
    keywords: ['Payments', 'Billing', 'Banking', 'Fintech', 'Checkout'],
    techStack: ['Ruby', 'Go', 'Java', 'Kubernetes', 'PostgreSQL'],
    products: ['Stripe Payments', 'Stripe Connect'],
    outreachHooks: {
      whyThisCompany: 'Market leader in developer-first financial APIs.',
      whyNow: 'Global expansion and AI billing platform acceleration.',
    },
  };

  const fullResult = scorer.score(fullCrawl, fullProfile);
  console.log('1️⃣  Full Quality Profile Score:', fullResult.score);
  console.log('   Reason:', fullResult.reason);
  console.log('   Breakdown:', JSON.stringify(fullResult.breakdown));
  if (fullResult.score !== 100 || !fullResult.isSufficient) {
    throw new Error(`Expected score 100 and isSufficient=true, got ${fullResult.score}`);
  }
  console.log('   ✔ Full profile scored 100/100 and marked SUFFICIENT\n');

  // Test 2: Low-content / thin crawl (Score < 40 -> INSUFFICIENT)
  const thinCrawl = {
    url: 'https://thin-site.com',
    success: true,
    markdown: 'Coming soon. Welcome to our website.',
    htmlLinks: [],
    subpagesCrawled: [],
    pageCount: 1,
    wordCount: 6,
    metadata: {},
  };

  const thinProfile = {
    persona: null,
    industry: null,
    companySize: null,
    summary: null,
    keywords: [],
    techStack: [],
    products: [],
    outreachHooks: {},
  };

  const thinResult = scorer.score(thinCrawl, thinProfile);
  console.log('2️⃣  Thin Site Crawl Score:', thinResult.score);
  console.log('   Reason:', thinResult.reason);
  console.log('   Breakdown:', JSON.stringify(thinResult.breakdown));
  if (thinResult.score >= 40 || thinResult.isSufficient) {
    throw new Error(`Expected score < 40 and isSufficient=false, got score=${thinResult.score}`);
  }
  console.log('   ✔ Thin site scored <40 and marked INSUFFICIENT\n');

  // Test 3: Moderate single-page crawl (Score in 40-70 range -> SUFFICIENT)
  const moderateCrawl = {
    url: 'https://mod-site.com',
    success: true,
    markdown: 'word '.repeat(900),
    htmlLinks: ['https://mod-site.com/about'],
    subpagesCrawled: ['https://mod-site.com/about'],
    pageCount: 2,
    wordCount: 900,
    metadata: {},
  };

  const moderateProfile = {
    persona: 'SAAS',
    industry: 'Productivity',
    companySize: '11-50',
    summary: 'ModSite provides modern task automation for distributed design agencies.',
    keywords: ['Workflow', 'Automation'],
    techStack: ['TypeScript', 'React'],
    products: ['ModFlow'],
    outreachHooks: {},
  };

  const moderateResult = scorer.score(moderateCrawl, moderateProfile);
  console.log('3️⃣  Moderate Profile Score:', moderateResult.score);
  console.log('   Reason:', moderateResult.reason);
  if (moderateResult.score < 40 || !moderateResult.isSufficient) {
    throw new Error(`Expected score >= 40 and isSufficient=true, got score=${moderateResult.score}`);
  }
  console.log('   ✔ Moderate profile passed minimum quality threshold (>=40)\n');

  console.log('===========================================================');
  console.log('🎉 ALL SCORER UNIT TESTS COMPLETED SUCCESSFULLY');
  console.log('===========================================================');
}

runScorerTests();
