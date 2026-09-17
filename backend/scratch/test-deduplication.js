const { Queue } = require('bullmq');
const { Client } = require('pg');

const BASE_URL = 'http://localhost:3000/api/v1';

async function main() {
  console.log('--- STARTING DEDUPLICATION VERIFICATION SUITE ---\n');

  // 1. Connect to BullMQ company-research queue
  const researchQueue = new Queue('company-research', {
    connection: {
      host: '127.0.0.1',
      port: 6380,
    },
  });

  // 2. Connect to PostgreSQL
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  async function createTestCampaign(name) {
    const res = await fetch(`${BASE_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create campaign: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async function uploadFile(campaignId, filename, buffer, mimeType) {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);

    const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  try {
    // ==========================================
    // TEST 1: CSV contains duplicate emails
    // ==========================================
    console.log('=== TEST 1: CSV contains duplicate emails ===');
    const campaign1 = await createTestCampaign('Dedup Test 1 CSV');
    console.log(`Created campaign ${campaign1.id}`);

    const csvContent = `email,company
john@company.com,CompanyA
john@company.com,CompanyA
JOHN@company.com,CompanyA
mary@company.com,CompanyB`;

    const result1 = await uploadFile(campaign1.id, 'test.csv', Buffer.from(csvContent), 'text/csv');
    console.log('Upload result 1:', result1);

    if (result1.total !== 4) throw new Error(`Expected total 4, got ${result1.total}`);
    if (result1.queued !== 2) throw new Error(`Expected queued 2, got ${result1.queued}`);
    if (result1.duplicateInFile !== 2) throw new Error(`Expected duplicateInFile 2, got ${result1.duplicateInFile}`);
    if (result1.duplicateInQueue !== 0) throw new Error(`Expected duplicateInQueue 0, got ${result1.duplicateInQueue}`);
    if (result1.duplicateInDatabase !== 0) throw new Error(`Expected duplicateInDatabase 0, got ${result1.duplicateInDatabase}`);

    // Inspect BullMQ jobs
    const jobJohn1 = await researchQueue.getJob(`${campaign1.id}__john@company.com`);
    const jobMary1 = await researchQueue.getJob(`${campaign1.id}__mary@company.com`);
    if (!jobJohn1) throw new Error(`Job for ${campaign1.id}__john@company.com not found in BullMQ`);
    if (!jobMary1) throw new Error(`Job for ${campaign1.id}__mary@company.com not found in BullMQ`);

    // Check DB count
    const dbRes1 = await pgClient.query('SELECT count(*) FROM prospects WHERE campaign_id = $1', [campaign1.id]);
    if (parseInt(dbRes1.rows[0].count, 10) !== 2) {
      throw new Error(`Expected 2 prospects in DB, got ${dbRes1.rows[0].count}`);
    }
    console.log('✅ TEST 1 PASSED: Only one job per unique email queued from CSV (queued: 2, dupesInFile: 2)\n');

    // ==========================================
    // TEST 2: PDF extraction contains duplicate emails
    // ==========================================
    console.log('=== TEST 2: PDF extraction contains duplicate emails ===');
    const campaign2 = await createTestCampaign('Dedup Test 2 PDF');
    console.log(`Created campaign ${campaign2.id}`);

    // Create a minimal PDF containing duplicate emails
    const pdfText = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 150 >> stream
BT
/F1 12 Tf
100 700 Td
(Contact us at testpdf@alpha.com or TESTPDF@alpha.com or dev@alpha.com) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000227 00000 n 
0000000427 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
497
%%EOF`;

    const result2 = await uploadFile(campaign2.id, 'contacts.pdf', Buffer.from(pdfText), 'application/pdf');
    console.log('Upload result 2:', result2);

    if (result2.total !== 3) throw new Error(`Expected total 3, got ${result2.total}`);
    if (result2.queued !== 2) throw new Error(`Expected queued 2, got ${result2.queued}`);
    if (result2.duplicateInFile !== 1) throw new Error(`Expected duplicateInFile 1, got ${result2.duplicateInFile}`);
    if (result2.duplicateInQueue !== 0) throw new Error(`Expected duplicateInQueue 0, got ${result2.duplicateInQueue}`);
    if (result2.duplicateInDatabase !== 0) throw new Error(`Expected duplicateInDatabase 0, got ${result2.duplicateInDatabase}`);

    const jobPdf1 = await researchQueue.getJob(`${campaign2.id}__testpdf@alpha.com`);
    const jobDev1 = await researchQueue.getJob(`${campaign2.id}__dev@alpha.com`);
    if (!jobPdf1) throw new Error(`Job for ${campaign2.id}__testpdf@alpha.com not found in BullMQ`);
    if (!jobDev1) throw new Error(`Job for ${campaign2.id}__dev@alpha.com not found in BullMQ`);

    console.log('✅ TEST 2 PASSED: PDF duplicates accurately deduplicated and queued only once\n');

    // ==========================================
    // TEST 3: Email already exists in queue
    // ==========================================
    console.log('=== TEST 3: Email already exists in queue ===');
    const campaign3 = await createTestCampaign('Dedup Test 3 Queue');
    console.log(`Created campaign ${campaign3.id}`);

    // Pre-seed a job in BullMQ with deterministic jobId WITHOUT inserting into DB
    const existingQueueEmail = 'queue_existing@acme.com';
    const existingJobId = `${campaign3.id}__${existingQueueEmail}`;
    await researchQueue.add(
      'research_company',
      {
        domain: 'acme.com',
        campaignId: campaign3.id,
        email: existingQueueEmail,
      },
      {
        jobId: existingJobId,
        removeOnComplete: false,
      },
    );
    console.log(`Pre-seeded BullMQ job with ID: ${existingJobId}`);

    // Verify it exists in queue
    const checkJob = await researchQueue.getJob(existingJobId);
    if (!checkJob) throw new Error('Failed to pre-seed job in BullMQ');

    // Now upload CSV containing this email + a fresh email
    const csvContent3 = `email,company
${existingQueueEmail},Acme
fresh@acme.com,Acme`;

    const result3 = await uploadFile(campaign3.id, 'test3.csv', Buffer.from(csvContent3), 'text/csv');
    console.log('Upload result 3:', result3);

    if (result3.total !== 2) throw new Error(`Expected total 2, got ${result3.total}`);
    if (result3.queued !== 1) throw new Error(`Expected queued 1, got ${result3.queued}`);
    if (result3.duplicateInQueue !== 1) throw new Error(`Expected duplicateInQueue 1, got ${result3.duplicateInQueue}`);
    if (result3.duplicateInFile !== 0) throw new Error(`Expected duplicateInFile 0, got ${result3.duplicateInFile}`);
    if (result3.duplicateInDatabase !== 0) throw new Error(`Expected duplicateInDatabase 0, got ${result3.duplicateInDatabase}`);

    console.log('✅ TEST 3 PASSED: Pre-existing queue job detected, duplicateInQueue incremented, no duplicate job created\n');

    // ==========================================
    // TEST 4: Email already exists in database
    // ==========================================
    console.log('=== TEST 4: Email already exists in database ===');
    // fresh@acme.com was already saved to DB in Test 3 for campaign3!
    const csvContent4 = `email,company
fresh@acme.com,Acme
brandnew@acme.com,Acme`;

    const result4 = await uploadFile(campaign3.id, 'test4.csv', Buffer.from(csvContent4), 'text/csv');
    console.log('Upload result 4:', result4);

    if (result4.total !== 2) throw new Error(`Expected total 2, got ${result4.total}`);
    if (result4.queued !== 1) throw new Error(`Expected queued 1 (brandnew@acme.com), got ${result4.queued}`);
    if (result4.duplicateInDatabase !== 1) throw new Error(`Expected duplicateInDatabase 1, got ${result4.duplicateInDatabase}`);

    console.log('✅ TEST 4 PASSED: Pre-existing database record detected, skipped before queueing\n');

    // ==========================================
    // TEST 5: BullMQ inspection: exactly one job for campaignId + email
    // ==========================================
    console.log('=== TEST 5: BullMQ inspection for deterministic job ID ===');
    const jobs = await researchQueue.getJobs(['waiting', 'active', 'delayed', 'completed']);
    const targetPrefix = `${campaign1.id}__`;
    const campaign1Jobs = jobs.filter((j) => j.id && j.id.startsWith(targetPrefix));
    console.log(`Jobs for campaign 1 in BullMQ (${campaign1Jobs.length}):`, campaign1Jobs.map((j) => j.id));

    const jobIds = campaign1Jobs.map((j) => j.id);
    const uniqueJobIds = new Set(jobIds);
    if (jobIds.length !== uniqueJobIds.size) {
      throw new Error('Duplicate job IDs found in BullMQ for campaign 1!');
    }
    if (!uniqueJobIds.has(`${campaign1.id}__john@company.com`)) {
      throw new Error(`Expected job ID \`${campaign1.id}__john@company.com\` not found`);
    }
    if (!uniqueJobIds.has(`${campaign1.id}__mary@company.com`)) {
      throw new Error(`Expected job ID \`${campaign1.id}__mary@company.com\` not found`);
    }
    console.log('✅ TEST 5 PASSED: Deterministic job IDs verified, exactly one job per campaignId + email\n');

    console.log('=====================================================');
    console.log('🎉 ALL 5 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=====================================================');
  } finally {
    await researchQueue.close();
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
