const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function testTaskGroup5Integration() {
  console.log('===========================================================');
  console.log('🚀 RELAY TASK GROUP 5: END-TO-END RESEARCH PIPELINE VERIFY');
  console.log('===========================================================\n');

  const BASE_URL = 'http://127.0.0.1:3000/api/v1';

  // 1. Reset DB test tables
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  await pgClient.query('DELETE FROM company_research');
  await pgClient.query('DELETE FROM contact');
  await pgClient.query('DELETE FROM company');

  console.log('1️⃣  Database tables cleaned and ready\n');

  // 2. Upload sample CSV with new companies
  console.log('2️⃣  Uploading Contacts CSV (Triggers background BullMQ research)...');
  const csvContent = `name,email,company,website
Marc Andreessen,marc@a16z.com,Andreessen Horowitz,https://a16z.com
Patrick Collison,patrick@stripe.com,Stripe,https://stripe.com
Alex Karp,alex@palantir.com,Palantir Technologies,https://palantir.com
`;

  const blob = new Blob([new Uint8Array(Buffer.from(csvContent, 'utf-8'))], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', blob, 'leaders.csv');

  const uploadRes = await fetch(`${BASE_URL}/contacts/upload`, {
    method: 'POST',
    body: formData,
  });

  const uploadResult = await uploadRes.json();
  console.log('   Upload result:', JSON.stringify(uploadResult, null, 2));

  if (uploadRes.status !== 201 || uploadResult.imported !== 3) {
    throw new Error(`CSV upload failed: ${JSON.stringify(uploadResult)}`);
  }
  console.log('   ✔ 3 contacts imported and background research jobs dispatched to BullMQ\n');

  // 3. Poll BullMQ Worker completion
  console.log('3️⃣  Waiting for BullMQ worker to process and complete company research...');

  let completedResearches = [];
  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await pgClient.query('SELECT * FROM company_research ORDER BY created_at ASC');
    const completed = res.rows.filter((r) => r.status === 'COMPLETED');
    console.log(`   Poll attempt ${attempt}: Total=${res.rows.length}, COMPLETED=${completed.length}, PENDING/PROCESSING=${res.rows.length - completed.length}`);

    if (completed.length === 3) {
      completedResearches = res.rows;
      break;
    }
  }

  if (completedResearches.length < 3) {
    throw new Error(`BullMQ research worker did not complete all 3 jobs in time. Current records: ${JSON.stringify(completedResearches)}`);
  }

  console.log('\n   ✅ All 3 background research jobs COMPLETED successfully!');
  completedResearches.forEach((r, idx) => {
    console.log(`\n   [Company Research ${idx + 1}] ID: ${r.id}`);
    console.log(`   - Persona: ${r.persona} | Industry: ${r.industry} | Size: ${r.company_size}`);
    console.log(`   - Quality Score: ${r.research_quality_score}/100 (${r.quality_reason})`);
    console.log(`   - ATS Provider: ${r.ats_provider || 'Direct / Custom'}`);
    console.log(`   - Careers Page: ${r.careers_page_url}`);
    console.log(`   - isHiring: ${r.is_hiring} | Signals: ${JSON.stringify(r.hiring_signals)}`);
    console.log(`   - Generic Emails: ${JSON.stringify(r.generic_contact_emails)}`);
    console.log(`   - Target Departments: ${JSON.stringify(r.target_departments)}`);
    console.log(`   - Outreach Hooks: ${JSON.stringify(r.outreach_hooks, null, 2)}`);
  });

  // 4. Test Cache Hit (Importing another contact for Stripe should NOT trigger re-research)
  console.log('\n4️⃣  Testing Cache Hit Enforcement (Duplicate domain upload)...');
  const initialResearchCount = completedResearches.length;

  const cachedCsv = `name,email,company,website
John Collison,john@stripe.com,Stripe,https://stripe.com
`;
  const cachedBlob = new Blob([new Uint8Array(Buffer.from(cachedCsv, 'utf-8'))], { type: 'text/csv' });
  const cachedFormData = new FormData();
  cachedFormData.append('file', cachedBlob, 'stripe-founder.csv');

  const cacheUploadRes = await fetch(`${BASE_URL}/contacts/upload`, {
    method: 'POST',
    body: cachedFormData,
  });

  const cacheResult = await cacheUploadRes.json();
  console.log('   Second upload result:', JSON.stringify(cacheResult));

  // Wait a short moment to ensure no spurious background job was added
  await new Promise((r) => setTimeout(r, 1000));
  const postCacheCheck = await pgClient.query('SELECT COUNT(*) FROM company_research');
  const countAfter = parseInt(postCacheCheck.rows[0].count, 10);
  console.log(`   Total research rows before: ${initialResearchCount}, after: ${countAfter}`);

  if (countAfter !== initialResearchCount) {
    throw new Error(`Cache enforcement failed: new research record was created instead of reusing cache`);
  }
  console.log('   ✔ Cache enforcement PASSED (reused existing valid 30-day cache)\n');

  // 5. Test Manual Refresh via POST /api/v1/research/:id/refresh
  console.log('5️⃣  Testing Manual Refresh Endpoint (POST /api/v1/research/:id/refresh)...');
  const firstResearchId = completedResearches[0].id;
  const refreshRes = await fetch(`${BASE_URL}/research/${firstResearchId}/refresh`, {
    method: 'POST',
  });

  const refreshData = await refreshRes.json();
  console.log('   Refresh trigger status:', refreshRes.status);
  console.log('   Refresh response payload:', JSON.stringify(refreshData, null, 2));

  if (refreshRes.status !== 202 || refreshData.status !== 'PENDING') {
    throw new Error(`Manual refresh trigger failed: ${JSON.stringify(refreshData)}`);
  }

  // Wait for worker to complete the refreshed research
  console.log('   Waiting for worker to process refreshed research job...');
  let refreshedRecord = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await pgClient.query('SELECT * FROM company_research WHERE id = $1', [refreshData.id]);
    if (check.rows[0]?.status === 'COMPLETED') {
      refreshedRecord = check.rows[0];
      break;
    }
  }

  if (!refreshedRecord) {
    throw new Error('Refreshed research job did not reach COMPLETED status in time');
  }
  console.log(`   ✔ Manual refresh completed! New research ID: ${refreshedRecord.id}, Status: ${refreshedRecord.status}, Score: ${refreshedRecord.research_quality_score}`);
  console.log('   ✅ Manual Refresh PASSED\n');

  // 6. Test GET /api/v1/companies/:id/research HTTP API
  console.log('6️⃣  Testing GET /api/v1/companies/:id/research with full outreach payload...');
  const stripeCompanyId = completedResearches.find((r) => r.outreach_hooks?.whyThisCompany || r.persona)?.company_id;
  const getResearchRes = await fetch(`${BASE_URL}/companies/${stripeCompanyId}/research`);
  const getResearchData = await getResearchRes.json();
  console.log('   GET API response payload preview:');
  console.log(JSON.stringify({
    id: getResearchData.id,
    companyId: getResearchData.companyId,
    status: getResearchData.status,
    persona: getResearchData.persona,
    industry: getResearchData.industry,
    atsProvider: getResearchData.atsProvider,
    isHiring: getResearchData.isHiring,
    hiringSignals: getResearchData.hiringSignals,
    outreachHooks: getResearchData.outreachHooks,
    researchQualityScore: getResearchData.researchQualityScore,
  }, null, 2));

  if (getResearchRes.status !== 200 || !getResearchData.outreachHooks) {
    throw new Error(`GET company research failed: ${JSON.stringify(getResearchData)}`);
  }
  console.log('   ✅ GET /companies/:id/research PASSED\n');

  await pgClient.end();

  console.log('===========================================================');
  console.log('🎉 ALL TASK GROUP 5 INTEGRATION TESTS COMPLETED (100% PASS)');
  console.log('===========================================================');
}

testTaskGroup5Integration().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
