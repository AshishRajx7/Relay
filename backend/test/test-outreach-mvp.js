const { Client } = require('pg');
const { generateValidPdf } = require('./generate-test-pdf');

const BASE_URL = 'http://127.0.0.1:3000/api/v1';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOutreachMvpTest() {
  console.log('===========================================================');
  console.log('🚀 RELAY PHASE 3A: COLD EMAIL GENERATION MVP TEST SUITE');
  console.log('===========================================================\n');

  // 1. Clean DB
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  console.log('1️⃣  Cleaning database tables...');
  await pgClient.query(`TRUNCATE TABLE "email_draft", "company_research", "contact", "company", "candidate_profile", "resume_file" CASCADE;`);
  console.log('   ✔ DB tables ready\n');

  // 2. Upload and Parse Resume
  console.log('2️⃣  Uploading Candidate Resume...');
  const pdfPath = generateValidPdf();
  const fs = require('fs');
  const pdfBuffer = fs.readFileSync(pdfPath);

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
  formData.append('file', blob, 'staff-backend-resume.pdf');
  formData.append('label', 'Ashish Staff Backend Resume');

  const uploadRes = await fetch(`${BASE_URL}/resumes/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload resume: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const resumeData = await uploadRes.json();
  console.log(`   ✔ Resume uploaded with ID: ${resumeData.id}`);

  // Wait for resume parsing
  console.log('   Waiting for resume parser worker...');
  let parsedResume = null;
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const rRes = await fetch(`${BASE_URL}/resumes/${resumeData.id}`);
    const rJson = await rRes.json();
    if (rJson.status === 'PARSED') {
      parsedResume = rJson;
      break;
    }
  }

  if (!parsedResume) {
    throw new Error('Resume did not parse in time');
  }
  console.log(`   ✔ Resume parsed! Candidate: ${parsedResume.profile.name} (${parsedResume.profile.title})\n`);

  // 3. Upload Contacts CSV (Triggers background research for 3 companies)
  console.log('3️⃣  Uploading Contacts CSV (3 contacts across Stripe, TechFlow, Palantir)...');
  const csvContent = `name,email,company,website
Patrick Collison,patrick@stripe.com,Stripe,https://stripe.com
Sarah Connor,sarah@techflow.io,TechFlow,https://techflow.io
Alex Karp,akarp@palantir.com,Palantir,https://palantir.com`;

  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  const csvFormData = new FormData();
  csvFormData.append('file', csvBlob, 'outreach-targets.csv');

  const contactUploadRes = await fetch(`${BASE_URL}/contacts/upload`, {
    method: 'POST',
    body: csvFormData,
  });

  const contactUploadJson = await contactUploadRes.json();
  console.log('   Upload result:', contactUploadJson);

  // Wait for company research worker to complete
  console.log('   Waiting for BullMQ worker to complete company research...');
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const countRes = await pgClient.query(`SELECT count(*) FROM "company_research" WHERE status = 'COMPLETED'`);
    if (parseInt(countRes.rows[0].count, 10) === 3) {
      console.log('   ✔ All 3 companies researched and cached with outreach hooks!\n');
      break;
    }
  }

  // 4. Trigger Batch Cold Email Draft Generation
  console.log('4️⃣  Triggering Batch Cold Email Draft Generation (POST /api/v1/outreach/generate)...');
  const generateRes = await fetch(`${BASE_URL}/outreach/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resumeId: parsedResume.id,
      forceRegenerate: true,
    }),
  });

  if (generateRes.status !== 202) {
    throw new Error(`Failed to trigger draft generation: ${generateRes.status} ${await generateRes.text()}`);
  }

  const generateJson = await generateRes.json();
  console.log('   Trigger response:', generateJson);
  console.log(`   ✔ Queued ${generateJson.queuedCount} cold-email generation jobs to BullMQ\n`);

  // 5. Poll for BullMQ worker to generate all 3 drafts
  console.log('5️⃣  Waiting for EmailDraftProcessor to synthesize personalized drafts...');
  let generatedDrafts = [];
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const draftsRes = await fetch(`${BASE_URL}/outreach/drafts?status=GENERATED`);
    const drafts = await draftsRes.json();
    if (drafts.length === 3) {
      generatedDrafts = drafts;
      break;
    }
  }

  if (generatedDrafts.length !== 3) {
    throw new Error(`Expected 3 generated drafts, but got ${generatedDrafts.length}`);
  }

  console.log('   ✅ All 3 cold-email drafts generated successfully!\n');

  for (let idx = 0; idx < generatedDrafts.length; idx++) {
    const d = generatedDrafts[idx];
    console.log(`   [Draft ${idx + 1}] Recipient: ${d.contact.name} <${d.contact.email}> (${d.company.name})`);
    console.log(`   - Status: ${d.status}`);
    console.log(`   - Subject: "${d.subject}"`);
    console.log(`   - Subject Variations: ${JSON.stringify(d.subjectVariations)}`);
    console.log(`   - Word Count: ${d.wordCount} words (Target: 75-125)`);
    console.log(`   - Personalization Score: ${d.personalizationScore}/100`);
    console.log(`   - Why Company: "${d.reasoning?.whyCompany}"`);
    console.log(`   - Why Me: "${d.reasoning?.whyMe}"`);
    console.log(`   - Email Body:\n${d.bodyText}\n`);

    if (d.wordCount < 40 || d.wordCount > 160) {
      throw new Error(`Draft ${d.id} word count out of bounds: ${d.wordCount}`);
    }
    if (!d.subject || !d.bodyText) {
      throw new Error(`Draft ${d.id} missing subject or bodyText`);
    }
    if (!d.reasoning?.whyCompany || !d.reasoning?.whyMe) {
      throw new Error(`Draft ${d.id} missing structured reasoning metadata`);
    }
  }

  // 6. Test Filtering & Search API
  console.log('6️⃣  Testing Drafts Search & Filter API...');
  const searchRes = await fetch(`${BASE_URL}/outreach/drafts?search=Patrick`);
  const searchJson = await searchRes.json();
  if (searchJson.length !== 1 || searchJson[0].contact.name !== 'Patrick Collison') {
    throw new Error('Search filtering failed for Patrick');
  }
  console.log('   ✔ Search filtering by contact name PASSED');

  // 7. Test Manual Review, Edit & Approval
  console.log('7️⃣  Testing Manual Edit & Approval (PATCH /api/v1/outreach/drafts/:id)...');
  const targetDraft = generatedDrafts[0];
  const updateRes = await fetch(`${BASE_URL}/outreach/drafts/${targetDraft.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Scaling Stripe core payments backend architecture',
      status: 'APPROVED',
    }),
  });

  const updatedDraft = await updateRes.json();
  if (updatedDraft.status !== 'APPROVED' || !updatedDraft.approvedAt) {
    throw new Error('Approval transition failed');
  }
  if (updatedDraft.subject !== 'Scaling Stripe core payments backend architecture') {
    throw new Error('Subject update failed');
  }
  console.log(`   ✔ Draft ${targetDraft.id} updated and APPROVED at: ${updatedDraft.approvedAt}`);

  // Test Rejection
  const secondDraft = generatedDrafts[1];
  const rejectRes = await fetch(`${BASE_URL}/outreach/drafts/${secondDraft.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'REJECTED',
    }),
  });
  const rejectedDraft = await rejectRes.json();
  if (rejectedDraft.status !== 'REJECTED') {
    throw new Error('Rejection transition failed');
  }
  console.log(`   ✔ Draft ${secondDraft.id} successfully marked REJECTED\n`);

  // 8. Test Delete Draft
  console.log('8️⃣  Testing Delete Draft (DELETE /api/v1/outreach/drafts/:id)...');
  const thirdDraft = generatedDrafts[2];
  const deleteRes = await fetch(`${BASE_URL}/outreach/drafts/${thirdDraft.id}`, {
    method: 'DELETE',
  });
  if (deleteRes.status !== 204) {
    throw new Error(`Delete failed: ${deleteRes.status}`);
  }

  const verifyDeleteRes = await fetch(`${BASE_URL}/outreach/drafts/${thirdDraft.id}`);
  if (verifyDeleteRes.status !== 404) {
    throw new Error('Draft was not deleted properly');
  }
  console.log(`   ✔ Draft ${thirdDraft.id} successfully deleted (404 on subsequent lookup)\n`);

  console.log('===========================================================');
  console.log('🎉 ALL PHASE 3A VERIFICATIONS COMPLETED WITH 100% SUCCESS');
  console.log('===========================================================');

  await pgClient.end();
}

runOutreachMvpTest().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
