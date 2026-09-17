const fs = require('fs');
const { Queue } = require('bullmq');
const { Client } = require('pg');

const BASE_URL = 'http://localhost:3000/api/v1';

async function main() {
  console.log('=====================================================');
  console.log('🔬 RUNNING CLEAN-ROOM SYSTEM VALIDATION & FRESH FLOW');
  console.log('=====================================================\n');

  // Connect to DB and Redis for direct assertions
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  const researchQueue = new Queue('company-research', {
    connection: { host: '127.0.0.1', port: 6380 },
  });

  try {
    // ----------------------------------------------------
    // PART 1: EMPTY STATE VALIDATION
    // ----------------------------------------------------
    console.log('--- PART 1: VALIDATING EMPTY STATE ACROSS ALL APIS ---');

    // 1. Resumes
    const resumesRes = await fetch(`${BASE_URL}/resumes`);
    const resumes = await resumesRes.json();
    console.log(`GET /resumes: ${resumes.length} items`);
    if (resumes.length !== 0) throw new Error(`Expected 0 resumes, got ${resumes.length}`);

    // 2. Campaigns
    const campaignsRes = await fetch(`${BASE_URL}/campaigns`);
    const campaigns = await campaignsRes.json();
    console.log(`GET /campaigns: ${campaigns.length} items`);
    if (campaigns.length !== 0) throw new Error(`Expected 0 campaigns, got ${campaigns.length}`);

    // 3. Companies
    const companiesRes = await fetch(`${BASE_URL}/companies`);
    const companies = await companiesRes.json();
    console.log(`GET /companies: ${companies.length} items`);
    if (companies.length !== 0) throw new Error(`Expected 0 companies, got ${companies.length}`);

    // 4. Drafts
    const draftsRes = await fetch(`${BASE_URL}/drafts`);
    const drafts = await draftsRes.json();
    console.log(`GET /drafts: ${drafts.length} items`);
    if (drafts.length !== 0) throw new Error(`Expected 0 drafts, got ${drafts.length}`);

    // 5. Database direct checks
    const prospectsCount = await pgClient.query('SELECT count(*) FROM prospects');
    console.log(`DB prospects count: ${prospectsCount.rows[0].count}`);
    if (parseInt(prospectsCount.rows[0].count, 10) !== 0) {
      throw new Error(`Expected 0 prospects in DB, got ${prospectsCount.rows[0].count}`);
    }

    // 6. Queue checks
    const waitingJobs = await researchQueue.getWaitingCount();
    const activeJobs = await researchQueue.getActiveCount();
    console.log(`Queue waiting: ${waitingJobs}, active: ${activeJobs}`);
    if (waitingJobs !== 0 || activeJobs !== 0) {
      throw new Error('Expected 0 jobs in company-research queue');
    }

    console.log('✅ PART 1 PASSED: Application is 100% clean and empty!\n');

    // ----------------------------------------------------
    // PART 2: FRESH UPLOAD FLOW FROM CLEAN STATE
    // ----------------------------------------------------
    console.log('--- PART 2: TESTING FRESH UPLOAD FLOW ---');

    // 1. Upload a new resume
    console.log('Step 1: Uploading new resume PDF...');
    const resumePath = 'C:/Users/ashis/.gemini/antigravity-ide/brain/44d2b673-30f2-4ed5-a5a8-0d25bd2a9d6d/.user_uploaded/media_1789384215603.pdf';
    const resumeBuffer = fs.readFileSync(resumePath);

    const formData = new FormData();
    formData.append('file', new Blob([resumeBuffer], { type: 'application/pdf' }), 'Staff_Backend_Engineer.pdf');
    formData.append('category', 'BACKEND');
    formData.append('label', 'Primary Production Resume');

    const uploadRes = await fetch(`${BASE_URL}/resumes/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!uploadRes.ok) {
      throw new Error(`Resume upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }
    const uploadedResume = await uploadRes.json();
    console.log('Uploaded Resume:', {
      id: uploadedResume.id,
      originalFileName: uploadedResume.originalFileName,
      status: uploadedResume.status,
      category: uploadedResume.category,
    });

    // 2. Poll until candidate profile is generated
    console.log('Step 2: Waiting for resume parsing and candidate profile generation...');
    let candidateProfile = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const rListRes = await fetch(`${BASE_URL}/resumes`);
      const rList = await rListRes.json();
      const current = rList.find((r) => r.id === uploadedResume.id);
      if (current && current.profile && current.processingStatus === 'READY') {
        candidateProfile = current.profile;
        console.log('Candidate Profile successfully generated:', {
          id: candidateProfile.id,
          name: candidateProfile.name,
          title: candidateProfile.title,
          email: candidateProfile.email,
        });
        break;
      }
      process.stdout.write('.');
    }
    if (!candidateProfile) {
      throw new Error('Timed out waiting for candidate profile generation');
    }

    // 3. Create a new campaign with the candidate profile
    console.log('\nStep 3: Creating campaign with candidate profile...');
    const createCampRes = await fetch(`${BASE_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Clean Room Outreach Q3',
        candidateProfileId: candidateProfile.id,
      }),
    });
    if (!createCampRes.ok) {
      throw new Error(`Campaign creation failed: ${createCampRes.status} ${await createCampRes.text()}`);
    }
    const campaign = await createCampRes.json();
    console.log('Campaign created:', {
      id: campaign.id,
      name: campaign.name,
      candidateProfileId: campaign.candidateProfileId,
      status: campaign.status,
    });

    // 4. Upload prospect contacts with duplicates
    console.log('\nStep 4: Ingesting prospects into campaign with batch deduplication...');
    const csvContent = `email,company
alex.chen@stripe.com,Stripe
alex.chen@stripe.com,Stripe
sarah.dev@github.com,GitHub`;

    const prospectFormData = new FormData();
    prospectFormData.append(
      'file',
      new Blob([Buffer.from(csvContent)], { type: 'text/csv' }),
      'prospects_clean.csv',
    );

    const prospectUploadRes = await fetch(`${BASE_URL}/campaigns/${campaign.id}/upload`, {
      method: 'POST',
      body: prospectFormData,
    });
    if (!prospectUploadRes.ok) {
      throw new Error(`Prospects upload failed: ${prospectUploadRes.status} ${await prospectUploadRes.text()}`);
    }
    const ingestionStats = await prospectUploadRes.json();
    console.log('Ingestion Statistics:', ingestionStats);

    if (ingestionStats.total !== 3) throw new Error(`Expected total 3, got ${ingestionStats.total}`);
    if (ingestionStats.queued !== 2) throw new Error(`Expected queued 2, got ${ingestionStats.queued}`);
    if (ingestionStats.duplicateInFile !== 1) throw new Error(`Expected duplicateInFile 1, got ${ingestionStats.duplicateInFile}`);
    if (ingestionStats.duplicateInQueue !== 0) throw new Error(`Expected duplicateInQueue 0, got ${ingestionStats.duplicateInQueue}`);
    if (ingestionStats.duplicateInDatabase !== 0) throw new Error(`Expected duplicateInDatabase 0, got ${ingestionStats.duplicateInDatabase}`);

    console.log('✅ PART 2 PASSED: Fresh flow completed cleanly from scratch!');
    console.log('=====================================================');
    console.log('🎉 ALL CLEAN-ROOM VALIDATION TESTS PASSED! 🎉');
    console.log('=====================================================');
  } finally {
    await researchQueue.close();
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('❌ Validation failed:', err);
  process.exit(1);
});
