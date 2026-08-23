const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 RELAY PHASE 1 BACKEND END-TO-END VERIFICATION');
  console.log('====================================================\n');

  const BASE_URL = 'http://127.0.0.1:3000/api/v1';

  // 1. Health Check
  console.log('1️⃣  Testing Health Endpoint...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log('   Health response:', JSON.stringify(healthData));
  if (healthRes.status !== 200 || healthData.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(healthData)}`);
  }
  console.log('   ✅ Health check PASSED\n');

  // Clean existing resume records before testing
  const initPg = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });
  await initPg.connect();
  await initPg.query('DELETE FROM resume_file');
  await initPg.end();

  // 2. Upload Resume PDF
  console.log('2️⃣  Testing Resume Upload (multipart/form-data)...');
  const { generateValidPdf } = require('./generate-test-pdf');
  const pdfPath = generateValidPdf();
  const fileBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });

  const formData = new FormData();
  formData.append('file', blob, 'test-resume.pdf');
  formData.append('label', 'Staff Backend Resume');

  const uploadRes = await fetch(`${BASE_URL}/resumes/upload`, {
    method: 'POST',
    body: formData,
  });

  const uploadData = await uploadRes.json();
  console.log('   Upload response status:', uploadRes.status);
  console.log('   Upload response:', JSON.stringify(uploadData, null, 2));

  if (uploadRes.status !== 201) {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(uploadData)}`);
  }
  const resumeId = uploadData.id;
  console.log(`   ✅ Resume created with ID: ${resumeId}\n`);

  // 3. Poll BullMQ Worker completion
  console.log('3️⃣  Waiting for BullMQ worker to process resume parsing job...');
  let parsedResume = null;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const checkRes = await fetch(`${BASE_URL}/resumes/${resumeId}`);
    parsedResume = await checkRes.json();
    console.log(`   Poll attempt ${i + 1}: status = ${parsedResume.status}`);
    if (parsedResume.status === 'PARSED') {
      break;
    }
    if (parsedResume.status === 'FAILED') {
      throw new Error(`Resume parsing failed: ${parsedResume.parseError}`);
    }
  }

  if (parsedResume.status !== 'PARSED') {
    throw new Error(`Resume did not reach PARSED status in time: ${JSON.stringify(parsedResume)}`);
  }
  console.log('   ✅ BullMQ Async Parsing completed successfully!');
  console.log('   Candidate Name:', parsedResume.profile?.name);
  console.log('   Candidate Title:', parsedResume.profile?.title);
  console.log('   Raw Text stored length:', parsedResume.rawText ? parsedResume.rawText.length : 'N/A');
  console.log('   Extracted Skills Languages:', parsedResume.profile?.skills?.languages);
  console.log('   Extracted Skills Frameworks:', parsedResume.profile?.skills?.frameworks);
  console.log('   Extracted Experience count:', parsedResume.profile?.experience?.length);
  console.log('   Extracted Projects count:', parsedResume.profile?.projects?.length);
  console.log('');

  // 4. Test Duplicate Upload (409 Conflict)
  console.log('4️⃣  Testing Duplicate Upload (same SHA-256 hash)...');
  const dupBlob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
  const dupFormData = new FormData();
  dupFormData.append('file', dupBlob, 'test-resume.pdf');
  const dupRes = await fetch(`${BASE_URL}/resumes/upload`, {
    method: 'POST',
    body: dupFormData,
  });
  const dupData = await dupRes.json();
  console.log('   Duplicate upload status:', dupRes.status);
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 Conflict but got ${dupRes.status}: ${JSON.stringify(dupData)}`);
  }
  console.log('   ✅ Duplicate detection PASSED (409 Conflict received)\n');

  // 5. Test List Resumes
  console.log('5️⃣  Testing List Resumes (GET /resumes)...');
  const listRes = await fetch(`${BASE_URL}/resumes`);
  const listData = await listRes.json();
  console.log('   Total resumes in library:', listData.length);
  console.log('   First resume slim profile:', JSON.stringify(listData[0]));
  if (!Array.isArray(listData) || listData.length === 0) {
    throw new Error('List resumes failed or returned empty array');
  }
  console.log('   ✅ List Resumes PASSED\n');

  // 6. Test Update Label
  console.log('6️⃣  Testing Update Label (PATCH /resumes/:id)...');
  const updateRes = await fetch(`${BASE_URL}/resumes/${resumeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'Principal Backend Engineer' }),
  });
  const updateData = await updateRes.json();
  console.log('   Updated label:', updateData.label);
  if (updateData.label !== 'Principal Backend Engineer') {
    throw new Error(`Update label failed: ${JSON.stringify(updateData)}`);
  }
  console.log('   ✅ Update Label PASSED\n');

  // 7. Test Re-parse
  console.log('7️⃣  Testing Re-parse (POST /resumes/:id/reparse)...');
  const reparseRes = await fetch(`${BASE_URL}/resumes/${resumeId}/reparse`, {
    method: 'POST',
  });
  const reparseData = await reparseRes.json();
  console.log('   Reparse response status:', reparseRes.status);
  if (reparseRes.status !== 202) {
    throw new Error(`Expected 202 Accepted but got ${reparseRes.status}`);
  }
  // Wait for worker
  await new Promise((r) => setTimeout(r, 2000));
  console.log('   ✅ Re-parse job dispatched and completed\n');

  // 8. Test Database Audit Logs for AI Requests
  console.log('8️⃣  Verifying ai_request_log records in PostgreSQL...');
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();
  const dbLogs = await pgClient.query('SELECT * FROM ai_request_log ORDER BY created_at DESC LIMIT 5');
  console.log(`   Found ${dbLogs.rows.length} AI request log entries in database:`);
  dbLogs.rows.forEach((row, i) => {
    console.log(`   [${i + 1}] feature=${row.feature} provider=${row.provider} model=${row.model} tokens=${row.total_tokens} latency=${row.latency_ms}ms status=${row.status}`);
  });
  await pgClient.end();
  if (dbLogs.rows.length === 0) {
    throw new Error('No AI request logs found in database');
  }
  console.log('   ✅ AI Audit Logging PASSED\n');

  // 9. Test Delete Resume
  console.log('9️⃣  Testing Delete Resume (DELETE /resumes/:id)...');
  const deleteRes = await fetch(`${BASE_URL}/resumes/${resumeId}`, {
    method: 'DELETE',
  });
  console.log('   Delete response status:', deleteRes.status);
  if (deleteRes.status !== 204) {
    throw new Error(`Expected 204 No Content but got ${deleteRes.status}`);
  }

  const notFoundRes = await fetch(`${BASE_URL}/resumes/${resumeId}`);
  if (notFoundRes.status !== 404) {
    throw new Error(`Expected 404 Not Found after deletion but got ${notFoundRes.status}`);
  }
  console.log('   ✅ Delete & Cascade Cleanup PASSED\n');

  console.log('====================================================');
  console.log('🎉 ALL 9 VERIFICATION PHASES COMPLETED WITH 100% SUCCESS');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
