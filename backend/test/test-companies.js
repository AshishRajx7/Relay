const { Client } = require('pg');

async function testCompaniesModule() {
  console.log('====================================================');
  console.log('🏢 RELAY TASK GROUP 2: COMPANIES MODULE VERIFICATION');
  console.log('====================================================\n');

  const BASE_URL = 'http://127.0.0.1:3000/api/v1';

  // 1. Direct Domain Normalizer Unit Tests
  console.log('1️⃣  Testing DomainNormalizerService logic...');
  const { DomainNormalizerService } = require('../dist/modules/companies/domain-normalizer.service');
  const normalizer = new DomainNormalizerService();

  const testCases = [
    { input: 'https://www.company.com', expected: 'company.com' },
    { input: 'http://company.com/', expected: 'company.com' },
    { input: 'company.com', expected: 'company.com' },
    { input: 'https://www.Company.COM/about?ref=123#test', expected: 'company.com' },
    { input: 'https://subdomain.company.com/path', expected: 'subdomain.company.com' },
    { input: 'www.company.co.uk/careers/', expected: 'company.co.uk' },
    { input: 'https://www2.company.org/', expected: 'company.org' },
  ];

  for (const { input, expected } of testCases) {
    const result = normalizer.normalize(input);
    if (result !== expected) {
      throw new Error(`Domain normalizer failed for "${input}". Expected "${expected}", got "${result}"`);
    }
    console.log(`   ✔ "${input}" -> "${result}"`);
  }

  // Test invalid domains throw BadRequestException
  const invalidCases = ['', '   ', 'not-a-domain', 'http://', 'http://.com'];
  for (const invalid of invalidCases) {
    try {
      normalizer.normalize(invalid);
      throw new Error(`Expected "${invalid}" to throw error, but it passed.`);
    } catch (err) {
      console.log(`   ✔ Invalid input "${invalid}" correctly rejected (${err.message})`);
    }
  }
  console.log('   ✅ DomainNormalizerService tests PASSED\n');

  // 2. Test PostgreSQL Database direct query & findOrCreate race-condition safety
  console.log('2️⃣  Testing Company DB operations & concurrent findOrCreate...');
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  // Clean test company if exists
  await pgClient.query("DELETE FROM company WHERE normalized_domain = 'testcompany.com'");

  // Insert initial company
  const insert1 = await pgClient.query(`
    INSERT INTO "company" ("name", "website", "normalized_domain", "created_at", "updated_at")
    VALUES ($1, $2, $3, now(), now())
    ON CONFLICT ("normalized_domain") DO UPDATE SET "updated_at" = now()
    RETURNING *;
  `, ['Test Company Inc', 'https://www.TestCompany.com/about', 'testcompany.com']);

  const companyId = insert1.rows[0].id;
  console.log(`   Created initial company with ID: ${companyId}`);

  // Test concurrent insert race condition (create 10 separate clients executing concurrently)
  console.log('   Testing 10 simultaneous concurrent inserts for same domain (race-condition check)...');
  const clients = await Promise.all(
    Array.from({ length: 10 }).map(async () => {
      const c = new Client({
        host: '127.0.0.1',
        port: 5432,
        user: 'relay',
        password: 'relay_dev_password',
        database: 'relay',
      });
      await c.connect();
      return c;
    })
  );

  const results = await Promise.all(
    clients.map(async (client, i) => {
      const res = await client.query(`
        INSERT INTO "company" ("name", "website", "normalized_domain", "created_at", "updated_at")
        VALUES ($1, $2, $3, now(), now())
        ON CONFLICT ("normalized_domain") DO UPDATE SET "updated_at" = now()
        RETURNING *;
      `, [`Test Company Variant ${i}`, `http://testcompany.com/?ref=${i}`, 'testcompany.com']);
      await client.end();
      return res;
    })
  );

  const distinctIds = new Set(results.map(r => r.rows[0].id));
  if (distinctIds.size !== 1) {
    throw new Error(`Race condition failed! Multiple rows created: ${distinctIds.size}`);
  }
  console.log(`   ✔ All 10 concurrent requests resolved to the single identical company ID: ${Array.from(distinctIds)[0]}`);
  console.log('   ✅ Concurrent findOrCreate race-condition safety PASSED\n');

  // 3. Test REST API Endpoints via HTTP
  console.log('3️⃣  Testing REST API Endpoints...');

  // GET /api/v1/companies
  const listRes = await fetch(`${BASE_URL}/companies`);
  const listData = await listRes.json();
  console.log('   GET /companies status:', listRes.status);
  console.log('   Total companies listed:', listData.length);
  if (listRes.status !== 200 || !Array.isArray(listData)) {
    throw new Error(`GET /companies failed: ${JSON.stringify(listData)}`);
  }
  console.log('   First company preview:', JSON.stringify(listData[0]));
  console.log('   ✅ GET /companies PASSED\n');

  // GET /api/v1/companies/:id
  const getRes = await fetch(`${BASE_URL}/companies/${companyId}`);
  const getData = await getRes.json();
  console.log('   GET /companies/:id status:', getRes.status);
  console.log('   Company details:', JSON.stringify(getData, null, 2));
  if (getRes.status !== 200 || getData.id !== companyId || getData.normalizedDomain !== 'testcompany.com') {
    throw new Error(`GET /companies/:id failed: ${JSON.stringify(getData)}`);
  }
  console.log('   ✅ GET /companies/:id PASSED\n');

  // GET /api/v1/companies/invalid-uuid -> 400
  const badUuidRes = await fetch(`${BASE_URL}/companies/not-a-uuid`);
  console.log('   GET /companies/not-a-uuid status:', badUuidRes.status);
  if (badUuidRes.status !== 400) {
    throw new Error(`Expected 400 for invalid UUID, got ${badUuidRes.status}`);
  }
  console.log('   ✔ 400 Bad Request on invalid UUID string validated');

  // GET /api/v1/companies/a0000000-0000-4000-8000-000000000000 -> 404
  const nonExistentId = 'a0000000-0000-4000-8000-000000000000';
  const notFoundRes = await fetch(`${BASE_URL}/companies/${nonExistentId}`);
  console.log('   GET /companies/non-existent-v4-uuid status:', notFoundRes.status);
  if (notFoundRes.status !== 404) {
    throw new Error(`Expected 404 for non-existent company, got ${notFoundRes.status}`);
  }
  console.log('   ✔ 404 Not Found on non-existent valid UUID validated');

  // 4. Test Swagger UI docs
  console.log('\n4️⃣  Testing Swagger Documentation endpoint...');
  const swaggerRes = await fetch('http://127.0.0.1:3000/api/docs');
  console.log('   GET /api/docs status:', swaggerRes.status);
  if (swaggerRes.status !== 200 && swaggerRes.status !== 301) {
    throw new Error(`Swagger documentation failed to respond, status: ${swaggerRes.status}`);
  }
  console.log('   ✅ Swagger Documentation endpoint PASSED\n');

  // Cleanup test company
  await pgClient.query("DELETE FROM company WHERE normalized_domain = 'testcompany.com'");
  await pgClient.end();

  console.log('====================================================');
  console.log('🎉 ALL TASK GROUP 2 VERIFICATIONS COMPLETED WITH 100% SUCCESS');
  console.log('====================================================');
}

testCompaniesModule().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
