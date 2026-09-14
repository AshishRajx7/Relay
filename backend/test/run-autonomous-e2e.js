const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const BASE_URL = 'http://localhost:3000/api/v1';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================================');
  console.log('🚀 RELAY AUTONOMOUS OUTREACH PIPELINE: TRUE END-TO-END RUN');
  console.log('================================================================================\n');

  // Connect to DB for deep verification
  const db = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await db.connect();

  // 1. Get Candidate Profile
  const candRes = await db.query('SELECT id, name, title FROM candidate_profile LIMIT 1');
  if (candRes.rows.length === 0) {
    throw new Error('No candidate profile found in database!');
  }
  const candidate = candRes.rows[0];
  console.log(`[Step 1] Selected Candidate Profile: ${candidate.name} (${candidate.title}) [ID: ${candidate.id}]`);

  // 2. Create Campaign
  console.log('\n[Step 2] Creating new Outreach Campaign via POST /api/v1/campaigns...');
  const createRes = await fetch(`${BASE_URL}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Autonomous Pipeline E2E - ${new Date().toISOString()}`,
      candidateProfileId: candidate.id,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create campaign: ${createRes.status} ${text}`);
  }

  const campaign = await createRes.json();
  console.log(`✅ Campaign created successfully!`);
  console.log(`   ID:     ${campaign.id}`);
  console.log(`   Name:   ${campaign.name}`);
  console.log(`   Status: ${campaign.status}`);

  // 3. Upload CSV (1 unresearched domain: clickhouse.com, 1 cached domain: supabase.com)
  console.log('\n[Step 3] Uploading CSV with prospects via POST /api/v1/campaigns/:id/upload...');
  const csvFilePath = path.join(__dirname, 'test-autonomous-e2e.csv');
  const csvBuffer = fs.readFileSync(csvFilePath);
  const blob = new Blob([csvBuffer], { type: 'text/csv' });

  const formData = new FormData();
  formData.append('file', blob, 'test-autonomous-e2e.csv');

  const uploadRes = await fetch(`${BASE_URL}/campaigns/${campaign.id}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Failed to upload CSV: ${uploadRes.status} ${text}`);
  }

  const uploadResult = await uploadRes.json();
  console.log(`✅ CSV uploaded and parsed successfully!`);
  console.log(`   Total parsed:      ${uploadResult.totalParsed}`);
  console.log(`   Valid prospects:   ${uploadResult.validProspects}`);
  console.log(`   Queued research:   ${uploadResult.queuedForResearch}`);
  console.log(`   Cached profiles:   ${uploadResult.cachedProfiles}`);

  // 4. Autonomous Monitoring: NO CALL TO create-gmail-drafts
  console.log('\n================================================================================');
  console.log('⚡ OBSERVING AUTONOMOUS PIPELINE TRANSITIONS');
  console.log('   (NO manual draft approval. NO manual queue triggering. NO create-gmail-drafts)');
  console.log('================================================================================\n');

  let maxWait = 90; // 90 seconds timeout
  let isCompleted = false;

  while (maxWait > 0) {
    const cRes = await db.query(
      'SELECT status, total_prospects, completed_prospects, gmail_draft_count, crawl_count, llm_calls FROM campaigns WHERE id = $1',
      [campaign.id]
    );
    const c = cRes.rows[0];

    const pRes = await db.query(
      'SELECT email, domain, research_status, draft_status FROM prospects WHERE campaign_id = $1 ORDER BY email',
      [campaign.id]
    );

    const draftsRes = await db.query(
      `SELECT d.id, d.status, d.subject, d.gmail_draft_id, p.email 
       FROM email_drafts d 
       JOIN prospects p ON d.prospect_id = p.id 
       WHERE p.campaign_id = $1`,
      [campaign.id]
    );

    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Campaign Status: ${c.status} | Completed Research: ${c.completed_prospects}/${c.total_prospects} | Gmail Drafts: ${c.gmail_draft_count}/${c.total_prospects}`);
    for (const p of pRes.rows) {
      console.log(`       Prospect: ${p.email.padEnd(25)} | Research: ${p.research_status.padEnd(12)} | Draft: ${p.draft_status}`);
    }

    if (draftsRes.rows.length > 0) {
      for (const d of draftsRes.rows) {
        console.log(`       Draft for ${d.email}: Status=${d.status} | GmailDraftId=${d.gmail_draft_id || 'PENDING'}`);
      }
    }

    if (c.status === 'COMPLETED' || (c.gmail_draft_count >= c.total_prospects && c.total_prospects > 0)) {
      isCompleted = true;
      console.log('\n🎉 CAMPAIGN FULLY COMPLETED AUTONOMOUSLY!');
      break;
    }

    await sleep(3000);
    maxWait -= 3;
  }

  if (!isCompleted) {
    console.error('❌ Campaign did not complete within the timeout period.');
  }

  // Final Summary Report
  console.log('\n================================================================================');
  console.log('📊 FINAL EXECUTION AUDIT & DATABASE VERIFICATION');
  console.log('================================================================================\n');

  const finalCampaign = (await db.query('SELECT * FROM campaigns WHERE id = $1', [campaign.id])).rows[0];
  console.log('Campaign Final State:');
  console.log({
    id: finalCampaign.id,
    name: finalCampaign.name,
    status: finalCampaign.status,
    totalProspects: finalCampaign.total_prospects,
    completedProspects: finalCampaign.completed_prospects,
    gmailDraftCount: finalCampaign.gmail_draft_count,
    crawlCount: finalCampaign.crawl_count,
    llmCalls: finalCampaign.llm_calls,
    estimatedCostUsd: finalCampaign.estimated_cost_usd,
  });

  const finalDrafts = await db.query(
    `SELECT d.id, d.status, d.subject, d.gmail_draft_id, p.email, p.company_name, r.chosen_project, r.match_score
     FROM email_drafts d
     JOIN prospects p ON d.prospect_id = p.id
     LEFT JOIN draft_reasoning r ON r.email_draft_id = d.id
     WHERE p.campaign_id = $1`,
    [campaign.id]
  );

  console.log('\nGenerated & Synced Gmail Drafts:');
  console.table(finalDrafts.rows);

  await db.end();
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
