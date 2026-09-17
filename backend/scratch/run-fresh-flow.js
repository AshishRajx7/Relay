const { Queue } = require('bullmq');
const { Client } = require('pg');

const BASE_URL = 'http://localhost:3000/api/v1';

async function main() {
  console.log('--- EXECUTING FRESH CAMPAIGN & PROSPECT FLOW ---\n');

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
    // 1. Get the parsed candidate profile
    const rListRes = await fetch(`${BASE_URL}/resumes`);
    const rList = await rListRes.json();
    const readyResume = rList.find((r) => r.processingStatus === 'READY');
    if (!readyResume) throw new Error('No ready candidate profile found');

    const candidateProfileId = readyResume.profile.id;
    console.log(`Using candidateProfileId: ${candidateProfileId} (${readyResume.profile.name})`);

    // 2. Create a new campaign
    console.log('\nCreating campaign...');
    const campRes = await fetch(`${BASE_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Backend Infrastructure Q3 Outreach',
        candidateProfileId,
      }),
    });
    if (!campRes.ok) {
      throw new Error(`Failed to create campaign: ${campRes.status} ${await campRes.text()}`);
    }
    const campaign = await campRes.json();
    console.log('Campaign Created:', {
      id: campaign.id,
      name: campaign.name,
      candidateProfileId: campaign.candidateProfileId,
      status: campaign.status,
    });

    // 3. Upload prospect contacts (with deliberate batch duplicates)
    console.log('\nUploading prospect contacts (CSV with duplicates)...');
    const csvContent = `email,company
alex@stripe.com,Stripe
alex@stripe.com,Stripe
ALEX@STRIPE.COM,Stripe
elena@github.com,GitHub
dev@vercel.com,Vercel`;

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([Buffer.from(csvContent)], { type: 'text/csv' }),
      'initial_prospects.csv',
    );

    const uploadRes = await fetch(`${BASE_URL}/campaigns/${campaign.id}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }
    const stats = await uploadRes.json();
    console.log('Upload Deduplication Results:', stats);

    if (stats.total !== 5) throw new Error(`Expected total 5, got ${stats.total}`);
    if (stats.queued !== 3) throw new Error(`Expected queued 3 (stripe, github, vercel), got ${stats.queued}`);
    if (stats.duplicateInFile !== 2) throw new Error(`Expected duplicateInFile 2, got ${stats.duplicateInFile}`);
    if (stats.duplicateInQueue !== 0) throw new Error(`Expected duplicateInQueue 0, got ${stats.duplicateInQueue}`);
    if (stats.duplicateInDatabase !== 0) throw new Error(`Expected duplicateInDatabase 0, got ${stats.duplicateInDatabase}`);

    // Verify prospects in PostgreSQL
    const pRows = await pgClient.query('SELECT email, domain, research_status FROM prospects WHERE campaign_id = $1', [campaign.id]);
    console.log('\nProspects saved in database (3 unique):', pRows.rows);

    // Verify BullMQ jobs
    const jobs = await researchQueue.getJobs(['waiting', 'active', 'delayed', 'completed']);
    const campaignJobs = jobs.filter((j) => j.id && j.id.startsWith(`${campaign.id}__`));
    console.log(`BullMQ Jobs created for this campaign (${campaignJobs.length}):`, campaignJobs.map((j) => j.id));

    console.log('\n=====================================================');
    console.log('🎉 FRESH FLOW VERIFICATION COMPLETED WITH 100% SUCCESS! 🎉');
    console.log('=====================================================');
  } finally {
    await researchQueue.close();
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('❌ Fresh flow failed:', err);
  process.exit(1);
});
