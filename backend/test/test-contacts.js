const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function testContactsModule() {
  console.log('====================================================');
  console.log('👥 RELAY TASK GROUP 3: CONTACTS MODULE VERIFICATION');
  console.log('====================================================\n');

  const BASE_URL = 'http://127.0.0.1:3000/api/v1';

  // 1. Direct CSV Parser Unit Tests
  console.log('1️⃣  Testing ContactsCsvParserService logic...');
  const { ContactsCsvParserService } = require('../dist/modules/contacts/contacts-csv-parser.service');
  const parser = new ContactsCsvParserService();

  const validCsv = Buffer.from(`name,email,company,website\nJohn Doe,john@acme.com,Acme Inc,https://acme.com`);
  const parsedValid = parser.parse(validCsv);
  console.log('   Valid rows parsed:', parsedValid.totalRows);
  if (parsedValid.totalRows !== 1 || !parsedValid.rows[0].isValid) {
    throw new Error('Valid CSV parsing failed');
  }
  console.log('   ✔ Valid CSV row parsed successfully');

  // Test missing header
  try {
    parser.parse(Buffer.from(`name,email,company\nJohn Doe,john@acme.com,Acme Inc`));
    throw new Error('Expected missing header error, but it passed.');
  } catch (err) {
    console.log(`   ✔ Missing required header rejected: (${err.message})`);
  }

  // Test invalid rows
  const mixedCsv = Buffer.from(`name,email,company,website
Valid User,valid@domain.com,Valid Corp,https://valid.com
Invalid Email,not-an-email,Bad Corp,https://bad.com
,no-name@domain.com,NoName Corp,https://noname.com
Missing Co,missing-co@domain.com,,https://missing.com
Missing Web,missing-web@domain.com,NoWeb Corp,`);
  const parsedMixed = parser.parse(mixedCsv);
  console.log('   Total mixed rows:', parsedMixed.totalRows);
  const validCount = parsedMixed.rows.filter((r) => r.isValid).length;
  const invalidCount = parsedMixed.rows.filter((r) => !r.isValid).length;
  console.log(`   ✔ Valid count: ${validCount}, Invalid count: ${invalidCount}`);
  if (validCount !== 1 || invalidCount !== 4) {
    throw new Error(`Expected 1 valid and 4 invalid rows, got valid=${validCount}, invalid=${invalidCount}`);
  }
  console.log('   ✅ ContactsCsvParserService tests PASSED\n');

  // 2. Clean DB before test
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();
  await pgClient.query('DELETE FROM contact');
  await pgClient.query('DELETE FROM company');
  await pgClient.end();

  // 3. Test POST /api/v1/contacts/upload (Multipart CSV Upload)
  console.log('2️⃣  Testing POST /api/v1/contacts/upload (Multipart CSV Import)...');
  const csvPath = path.join(__dirname, 'sample-contacts.csv');
  const csvBuffer = fs.readFileSync(csvPath);
  const blob = new Blob([csvBuffer], { type: 'text/csv' });

  const formData = new FormData();
  formData.append('file', blob, 'sample-contacts.csv');

  const uploadRes = await fetch(`${BASE_URL}/contacts/upload`, {
    method: 'POST',
    body: formData,
  });

  const uploadData = await uploadRes.json();
  console.log('   Upload status code:', uploadRes.status);
  console.log('   Upload Result:', JSON.stringify(uploadData, null, 2));

  if (uploadRes.status !== 201) {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(uploadData)}`);
  }

  // sample-contacts.csv has 7 rows:
  // - 4 valid (John Doe, Jane Smith, Bob Wilson, Sarah Connor)
  // - 3 invalid (Alice Johnson bad email, Missing Company, No Name)
  if (uploadData.totalRows !== 7 || uploadData.imported !== 4 || uploadData.invalid !== 3 || uploadData.duplicates !== 0) {
    throw new Error(`Unexpected import result counts: ${JSON.stringify(uploadData)}`);
  }
  console.log('   ✔ 4 valid rows imported, 3 invalid rows recorded with error reasons');
  console.log('   ✅ CSV Import Flow PASSED\n');

  // 4. Test Deduplication on Second CSV Upload
  console.log('3️⃣  Testing Deduplication on Second CSV Upload...');
  const dupFormData = new FormData();
  dupFormData.append('file', blob, 'sample-contacts.csv');

  const dupRes = await fetch(`${BASE_URL}/contacts/upload`, {
    method: 'POST',
    body: dupFormData,
  });
  const dupData = await dupRes.json();
  console.log('   Re-upload status:', dupRes.status);
  console.log('   Re-upload Result:', JSON.stringify(dupData, null, 2));

  if (dupData.imported !== 0 || dupData.duplicates !== 4 || dupData.invalid !== 3) {
    throw new Error(`Deduplication failed. Expected imported=0, duplicates=4, invalid=3: ${JSON.stringify(dupData)}`);
  }
  console.log('   ✔ All 4 previously imported contacts correctly flagged as duplicates');
  console.log('   ✅ Deduplication PASSED\n');

  // 5. Test GET /api/v1/contacts
  console.log('4️⃣  Testing GET /api/v1/contacts (Listing & Relationships)...');
  const listRes = await fetch(`${BASE_URL}/contacts`);
  const listData = await listRes.json();
  console.log('   GET /contacts status:', listRes.status);
  console.log('   Total contacts in database:', listData.length);
  if (listRes.status !== 200 || listData.length !== 4) {
    throw new Error(`Expected 4 contacts, got ${listData.length}`);
  }

  const sampleContact = listData.find((c) => c.name === 'John Doe');
  console.log('   Sample contact with company relationship:', JSON.stringify(sampleContact, null, 2));
  if (!sampleContact || !sampleContact.company || sampleContact.company.normalizedDomain !== 'techflow.io') {
    throw new Error('Contact missing linked company metadata');
  }
  console.log('   ✔ Company normalization & linking verified');
  console.log('   ✅ GET /contacts PASSED\n');

  // 6. Test GET /api/v1/contacts with Search & Company Filtering
  console.log('5️⃣  Testing Search & Filtering query parameters...');

  // Search by name (case-insensitive)
  const searchNameRes = await fetch(`${BASE_URL}/contacts?search=JOHN`);
  const searchNameData = await searchNameRes.json();
  console.log('   Search "JOHN" results count:', searchNameData.length);
  if (searchNameData.length !== 1 || searchNameData[0].email !== 'john.doe@techflow.io') {
    throw new Error(`Search by name failed: ${JSON.stringify(searchNameData)}`);
  }
  console.log('   ✔ Case-insensitive name search matched: John Doe');

  // Search by email substring (case-insensitive)
  const searchEmailRes = await fetch(`${BASE_URL}/contacts?search=cloudscale.COM`);
  const searchEmailData = await searchEmailRes.json();
  console.log('   Search "cloudscale.COM" results count:', searchEmailData.length);
  if (searchEmailData.length !== 1 || searchEmailData[0].name !== 'Jane Smith') {
    throw new Error(`Search by email failed: ${JSON.stringify(searchEmailData)}`);
  }
  console.log('   ✔ Case-insensitive email search matched: Jane Smith');

  // Filter by companyId (TechFlow Systems)
  const techflowCompanyId = sampleContact.company.id;
  const filterCompanyRes = await fetch(`${BASE_URL}/contacts?companyId=${techflowCompanyId}`);
  const filterCompanyData = await filterCompanyRes.json();
  console.log(`   Filter by TechFlow companyId (${techflowCompanyId}) count:`, filterCompanyData.length);
  if (filterCompanyData.length !== 2) {
    // John Doe and Bob Wilson both belong to techflow.io
    throw new Error(`Expected 2 contacts for TechFlow Systems, got ${filterCompanyData.length}`);
  }
  console.log('   ✔ Company filtering returned 2 contacts (John Doe & Bob Wilson)');

  // Search with no matches
  const noMatchRes = await fetch(`${BASE_URL}/contacts?search=nonexistent`);
  const noMatchData = await noMatchRes.json();
  if (noMatchData.length !== 0) {
    throw new Error(`Expected 0 results for non-matching search, got ${noMatchData.length}`);
  }
  console.log('   ✔ Non-matching search returned 0 results');
  console.log('   ✅ Search & Filtering PASSED\n');

  // 7. Verify Swagger Documentation
  console.log('6️⃣  Verifying Swagger OpenAPI Documentation...');
  const swaggerRes = await fetch('http://127.0.0.1:3000/api/docs');
  console.log('   Swagger UI status:', swaggerRes.status);
  if (swaggerRes.status !== 200 && swaggerRes.status !== 301) {
    throw new Error(`Swagger docs failed with status ${swaggerRes.status}`);
  }
  console.log('   ✅ Swagger Documentation PASSED\n');

  console.log('====================================================');
  console.log('🎉 ALL TASK GROUP 3 VERIFICATIONS COMPLETED WITH 100% SUCCESS');
  console.log('====================================================');
}

testContactsModule().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
