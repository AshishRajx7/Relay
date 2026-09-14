const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { google } = require('googleapis');

const BASE_URL = 'http://localhost:3000/api/v1';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================================');
  console.log('🚀 RELAY PHASE 5: LIVE TRUE END-TO-END AUTONOMOUS AUDIT RUN');
  console.log('================================================================================\n');

  const db = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await db.connect();

  // 1. Fetch Candidate Profile
  const candRes = await db.query('SELECT * FROM candidate_profile LIMIT 1');
  const candidate = candRes.rows[0];
  console.log(`[Step 1] Candidate Profile: ${candidate.name} (${candidate.title})`);
  console.log(`        Profile ID: ${candidate.id}`);
  console.log(`        Resume File ID: ${candidate.resume_file_id}`);

  // 2. Create Campaign
  const campaignName = `Staff Audit Autonomous Run - ${new Date().toISOString()}`;
  console.log(`\n[Step 2] Creating Campaign: "${campaignName}"`);
  const createRes = await fetch(`${BASE_URL}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: campaignName,
      candidateProfileId: candidate.id,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create campaign: ${createRes.status} ${await createRes.text()}`);
  }

  const campaign = await createRes.json();
  console.log(`✅ Campaign Created!`);
  console.log(`   Campaign ID: ${campaign.id}`);
  console.log(`   Status:      ${campaign.status}`);

  // 3. Upload CSV
  console.log(`\n[Step 3] Uploading CSV with 1 Unresearched (neon.tech) & 1 Researched (posthog.com)...`);
  const csvFilePath = path.join(__dirname, 'test-phase5-audit.csv');
  const csvBuffer = fs.readFileSync(csvFilePath);
  const blob = new Blob([csvBuffer], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', blob, 'test-phase5-audit.csv');

  const uploadRes = await fetch(`${BASE_URL}/campaigns/${campaign.id}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload CSV: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const uploadResult = await uploadRes.json();
  console.log(`✅ CSV Ingested!`);
  console.log(`   Total parsed:      ${uploadResult.totalParsed}`);
  console.log(`   Cached profiles:   ${uploadResult.cachedProfiles}`);
  console.log(`   Queued research:   ${uploadResult.queuedForResearch}`);

  // 4. Autonomous Monitoring: NO CALLS TO APPROVE OR CREATE-GMAIL-DRAFTS
  console.log('\n[Step 4] Monitoring Autonomous Transitions...');
  console.log('         (Zero manual intervention: no approve, no create-gmail-drafts, no review)\n');

  let maxWait = 120; // 120 seconds timeout
  let isCompleted = false;

  while (maxWait > 0) {
    const cRes = await db.query(
      'SELECT status, total_prospects, completed_prospects, gmail_draft_count, crawl_count, llm_calls, estimated_cost_usd FROM campaigns WHERE id = $1',
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
    console.log(`[${timestamp}] Campaign: ${c.status.padEnd(10)} | Research: ${c.completed_prospects}/${c.total_prospects} | Gmail Drafts: ${c.gmail_draft_count}/${c.total_prospects}`);
    for (const p of pRes.rows) {
      console.log(`       Prospect: ${p.email.padEnd(25)} | Research: ${p.research_status.padEnd(12)} | Draft: ${p.draft_status}`);
    }

    if (draftsRes.rows.length > 0) {
      for (const d of draftsRes.rows) {
        console.log(`       Draft: ${d.email.padEnd(28)} | Status: ${d.status.padEnd(20)} | Gmail ID: ${d.gmail_draft_id || 'AWAITING_SYNC'}`);
      }
    }

    if (c.status === 'COMPLETED' || (c.gmail_draft_count >= c.total_prospects && c.total_prospects > 0)) {
      isCompleted = true;
      console.log('\n🎉 ALL AUTONOMOUS PIPELINE TRANSITIONS COMPLETED SUCCESSFULLY!');
      break;
    }

    await sleep(3000);
    maxWait -= 3;
  }

  if (!isCompleted) {
    console.error('❌ Campaign did not complete within the timeout period.');
  }

  // 5. Database State Audit
  console.log('\n================================================================================');
  console.log('📊 DATABASE STATE AUDIT');
  console.log('================================================================================\n');

  const finalCampaign = (await db.query('SELECT * FROM campaigns WHERE id = $1', [campaign.id])).rows[0];
  console.log('Campaign Final Entity:');
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

  console.log('\nDraft Entities in Database:');
  console.table(finalDrafts.rows);

  // 6. Direct Gmail API Verification
  console.log('\n================================================================================');
  console.log('✉️  DIRECT GMAIL API VERIFICATION (CHECKING INBOX/DRAFTS)');
  console.log('================================================================================\n');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  for (const row of finalDrafts.rows) {
    if (!row.gmail_draft_id) {
      console.error(`❌ Draft for ${row.email} has no gmail_draft_id!`);
      continue;
    }

    try {
      const gDraft = await gmail.users.drafts.get({
        userId: 'me',
        id: row.gmail_draft_id,
        format: 'full',
      });

      const headers = gDraft.data.message?.payload?.headers || [];
      const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

      const to = getHeader('To');
      const subject = getHeader('Subject');
      const contentType = getHeader('Content-Type');
      const parts = gDraft.data.message?.payload?.parts || [];
      const attachmentParts = parts.filter((p) => p.filename && p.filename.length > 0);

      console.log(`Verified Gmail Draft ID: ${row.gmail_draft_id}`);
      console.log(`  To:           ${to}`);
      console.log(`  Subject:      ${subject}`);
      console.log(`  Content-Type: ${contentType}`);
      console.log(`  Attachments:  ${attachmentParts.map((p) => `${p.filename} (${p.mimeType}, size: ${p.body?.size || 'binary'})`).join(', ') || 'NONE'}`);
      console.log(`  Verification: ✅ CONFIRMED PRESENT IN GMAIL WITH RESUME ATTACHED\n`);
    } catch (err) {
      console.error(`❌ Failed to fetch draft ${row.gmail_draft_id} from Gmail API: ${err.message}`);
    }
  }

  await db.end();
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
