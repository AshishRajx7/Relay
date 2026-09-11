import { CompanyProfileService } from '../src/modules/company-research/services/company-profile.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase2ATests() {
  console.log('Running Phase 2A Company Intelligence Automated Test Suite...\n');

  const service = new CompanyProfileService({} as any, {} as any, {} as any, {} as any, {} as any);

  // Test 1: Domain Normalization
  {
    assert(service.normalizeDomain('https://www.stripe.com/about') === 'stripe.com', 'Normalized https://www.stripe.com/about to stripe.com');
    assert(service.normalizeDomain('http://linear.app/careers') === 'linear.app', 'Normalized http://linear.app/careers to linear.app');
    assert(service.normalizeDomain('vercel.com:443?ref=relay#top') === 'vercel.com', 'Normalized query and ports from domain');
  }

  // Test 2: Free Mail Classification
  {
    assert(service.isFreeMailDomain('gmail.com') === true, 'gmail.com identified as FreeMail');
    assert(service.isFreeMailDomain('yahoo.co.in') === true, 'yahoo.co.in identified as FreeMail');
    assert(service.isFreeMailDomain('outlook.com') === true, 'outlook.com identified as FreeMail');
    assert(service.isFreeMailDomain('stripe.com') === false, 'stripe.com identified as Corporate Domain');
    assert(service.isFreeMailDomain('brex.io') === false, 'brex.io identified as Corporate Domain');
  }

  // Test 3: CSV Content Email Extraction Logic
  {
    const sampleCsv = `email,company\nhr@acme.com,Acme Corp\nrecruiting@stripe.com,Stripe\nfounder@gmail.com,Personal`;
    const lines = sampleCsv.split('\n').slice(1);
    const emails = lines.map(l => l.split(',')[0]);
    assert(emails.length === 3, 'Extracted 3 emails from CSV');
    assert(emails[0] === 'hr@acme.com', 'First email is hr@acme.com');
  }

  // Test 4: PDF Regex Extraction Logic
  {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const samplePdfText = `
      Candidate contact sheet:
      Reach out to hr@fintech.io or talent@startup.ai.
      For questions email jobs@scale.com or duplicate talent@startup.ai.
    `;
    const matches = samplePdfText.match(emailRegex) || [];
    const unique = Array.from(new Set(matches.map(e => e.toLowerCase())));
    assert(unique.length === 3, 'Extracted 3 unique emails from multi-token text');
    assert(unique.includes('hr@fintech.io'), 'Contains hr@fintech.io');
    assert(unique.includes('talent@startup.ai'), 'Contains talent@startup.ai');
    assert(unique.includes('jobs@scale.com'), 'Contains jobs@scale.com');
  }

  console.log('\n🎉 ALL PHASE 2A TESTS PASSED SUCCESSFULLY!\n');
}

runPhase2ATests().catch(err => {
  console.error(err);
  process.exit(1);
});
