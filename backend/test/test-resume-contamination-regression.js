const { Client } = require('pg');
require('dotenv').config();

async function runRegressionTest() {
  console.log('===============================================================');
  console.log('RUNNING AUTOMATED RESUME CONTAMINATION REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();

  const res = await client.query(`
    SELECT cp.*, rf.status as resume_status, rf.original_file_name 
    FROM candidate_profile cp
    JOIN resume_file rf ON rf.id = cp.resume_file_id
    WHERE rf.id = 'bb6abcf6-920b-41e8-9f04-7e0232e5356c'
  `);

  if (res.rows.length === 0) {
    throw new Error('Target resume/candidate profile bb6abcf6-920b-41e8-9f04-7e0232e5356c not found in DB');
  }

  const profile = res.rows[0];
  const experience = profile.experience || [];

  console.log(`Candidate Name: ${profile.name}`);
  console.log(`Total Experiences Extracted: ${experience.length}`);

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedAssertions++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedAssertions++;
    }
  }

  // --- 1. Distinct Experience Separation ---
  console.log('\n--- 1. Boundary & Experience Separation Tests ---');
  assert(experience.length === 3, `Expected exactly 3 experience entries, found ${experience.length}`);

  const seRole = experience.find(
    (e) => /ninja/i.test(e.company) && /software engineer/i.test(e.title) && !/intern/i.test(e.title)
  );
  const internRole = experience.find(
    (e) => /ninja/i.test(e.company) && /intern/i.test(e.title)
  );
  const dronsRole = experience.find(
    (e) => /d'rons|drons/i.test(e.company)
  );

  assert(!!seRole, 'Software Engineer role at The Ninja Studio exists');
  assert(!!internRole, 'Backend Engineering Intern role at The Ninja Studio exists');
  assert(!!dronsRole, 'D\'Rons Founder and Full Stack Lead role exists');

  assert(seRole !== internRole, 'The Ninja Studio Full-Time !== The Ninja Studio Intern role');
  assert(dronsRole !== seRole, 'D\'Rons !== The Ninja Studio Software Engineer role');
  assert(dronsRole !== internRole, 'D\'Rons !== The Ninja Studio Intern role');

  assert(seRole?.experienceType === 'FULL_TIME', `SE experienceType is FULL_TIME (actual: ${seRole?.experienceType})`);
  assert(internRole?.experienceType === 'INTERNSHIP', `Intern experienceType is INTERNSHIP (actual: ${internRole?.experienceType})`);
  assert(dronsRole?.experienceType === 'FOUNDER', `D'Rons experienceType is FOUNDER (actual: ${dronsRole?.experienceType})`);
  assert(dronsRole?.isFounder === true, `D'Rons isFounder flag is true (actual: ${dronsRole?.isFounder})`);

  assert(seRole?.startDate === '2026-08', `SE startDate is 2026-08 (actual: ${seRole?.startDate})`);
  assert(internRole?.startDate === '2026-02', `Intern startDate is 2026-02 (actual: ${internRole?.startDate})`);
  assert(internRole?.endDate === '2026-08', `Intern endDate is 2026-08 (actual: ${internRole?.endDate})`);
  assert(seRole?.startDate !== internRole?.startDate, 'Promotion roles do NOT share the same start date');

  // --- 2. D'Rons Contamination Check ---
  console.log('\n--- 2. D\'Rons Zero-Contamination Verification ---');
  const dronsAllText = [
    dronsRole?.company || '',
    dronsRole?.title || '',
    ...(dronsRole?.sourceBullets || []),
    ...(dronsRole?.highlights || []),
    ...(dronsRole?.whatWasBuilt || []),
    ...(dronsRole?.scaleAndOwnership || []),
    ...(dronsRole?.measurableImpact || []),
    ...(dronsRole?.technologies || []),
  ].join(' ').toLowerCase();

  const forbiddenDronsTerms = [
    'redis',
    'branchguard',
    'branch guard',
    'audit log',
    'leave management',
    'super admin',
    'superadmin',
    'asynclocalstorage',
    'eventemitter2',
    'bullmq',
    'typeorm',
    'postgresql',
    'nestjs',
    'sentry',
    'dependabot',
    'survey platform',
    'survey builder',
  ];

  for (const term of forbiddenDronsTerms) {
    assert(!dronsAllText.includes(term), `D'Rons does NOT contain forbidden term '${term}'`);
  }

  assert(
    Array.isArray(dronsRole?.measurableImpact) && dronsRole.measurableImpact.length === 0,
    `D'Rons measurableImpact is empty array [] (actual: ${JSON.stringify(dronsRole?.measurableImpact)})`
  );

  // Ground truth check for D'Rons
  assert(
    dronsAllText.includes('quick commerce') || dronsAllText.includes('commerce platform'),
    'D\'Rons contains quick commerce platform from ground truth'
  );
  assert(
    dronsAllText.includes('wordpress'),
    'D\'Rons contains WordPress storefront from ground truth'
  );
  assert(
    dronsAllText.includes('payments') && dronsAllText.includes('order workflows'),
    'D\'Rons contains payments and order workflows from ground truth'
  );
  assert(
    dronsAllText.includes('2 vendors'),
    'D\'Rons contains 2 vendors onboarding from ground truth'
  );
  assert(
    dronsAllText.includes('apis') || (dronsRole?.technologies || []).some(t => /api/i.test(t)),
    'D\'Rons contains custom backend APIs from ground truth'
  );

  // --- 3. The Ninja Studio Software Engineer Scoping ---
  console.log('\n--- 3. The Ninja Studio Software Engineer Role Scoping ---');
  const seAllText = [
    seRole?.company || '',
    seRole?.title || '',
    ...(seRole?.sourceBullets || []),
    ...(seRole?.highlights || []),
    ...(seRole?.whatWasBuilt || []),
    ...(seRole?.scaleAndOwnership || []),
    ...(seRole?.measurableImpact || []),
    ...(seRole?.technologies || []),
  ].join(' ').toLowerCase();

  // Must contain SE deliverables
  assert(seAllText.includes('activitylog') || seAllText.includes('activity log'), 'SE contains Activity Log frontend');
  assert(seAllText.includes('bullmq'), 'SE contains BullMQ notification system');
  assert(seAllText.includes('redis'), 'SE contains Redis caching for BranchGuard');
  assert(seAllText.includes('n8n') || seAllText.includes('sentry'), 'SE contains n8n / Sentry alerting');

  // Must NOT leak intern-only backend systems
  assert(!seAllText.includes('super admin') && !seAllText.includes('superadmin'), 'SE does NOT inherit Super Admin impersonation');
  assert(!seAllText.includes('leave management'), 'SE does NOT inherit Leave Management optimization');
  assert(!seAllText.includes('15+ hr modules'), 'SE does NOT inherit 15+ HR modules Activity Log platform');
  assert(!seAllText.includes('anonymity-leak') && !seAllText.includes('anonymity leak'), 'SE does NOT inherit anonymity vulnerabilities');

  // --- 4. The Ninja Studio Intern Role Scoping ---
  console.log('\n--- 4. The Ninja Studio Intern Role Scoping ---');
  const internAllText = [
    internRole?.company || '',
    internRole?.title || '',
    ...(internRole?.sourceBullets || []),
    ...(internRole?.highlights || []),
    ...(internRole?.whatWasBuilt || []),
    ...(internRole?.scaleAndOwnership || []),
    ...(internRole?.measurableImpact || []),
    ...(internRole?.technologies || []),
  ].join(' ').toLowerCase();

  // Must contain Intern deliverables
  assert(internAllText.includes('super admin') || internAllText.includes('superadmin'), 'Intern contains Super Admin impersonation');
  assert(internAllText.includes('asynclocalstorage') || internAllText.includes('async local storage'), 'Intern contains AsyncLocalStorage audit trail');
  assert(internAllText.includes('eventemitter2'), 'Intern contains EventEmitter2 Activity Log platform');
  assert(internAllText.includes('branchguard') || internAllText.includes('branch guard'), 'Intern contains BranchGuard access control');
  assert(internAllText.includes('leave management'), 'Intern contains Leave Management optimization');
  assert(internAllText.includes('survey platform') || internAllText.includes('survey'), 'Intern contains Survey platform backend');

  // Must NOT leak SE-only frontend & tooling projects
  assert(!internAllText.includes('react 19'), 'Intern does NOT inherit React 19');
  assert(!internAllText.includes('tanstack'), 'Intern does NOT inherit TanStack Query');
  assert(!internAllText.includes('bullmq'), 'Intern does NOT inherit BullMQ notification system');
  assert(!internAllText.includes('n8n'), 'Intern does NOT inherit n8n alerting');

  // --- 5. Source Bullets Preservation ---
  console.log('\n--- 5. Source Bullets Preservation ---');
  assert(Array.isArray(seRole?.sourceBullets) && seRole.sourceBullets.length >= 4, 'SE has full source bullets preserved');
  assert(Array.isArray(internRole?.sourceBullets) && internRole.sourceBullets.length >= 5, 'Intern has full source bullets preserved');
  assert(Array.isArray(dronsRole?.sourceBullets) && dronsRole.sourceBullets.length >= 2, 'D\'Rons has full source bullets preserved');

  console.log('\n===============================================================');
  console.log(`REGRESSION TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('===============================================================');

  await client.end();

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runRegressionTest().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
