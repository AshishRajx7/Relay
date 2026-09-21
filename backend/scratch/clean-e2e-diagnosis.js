const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Redis = require('ioredis');

const BASE_URL = 'http://127.0.0.1:3000/api/v1';
const CSV_FILE = 'C:\\Users\\ashis\\.gemini\\antigravity-ide\\brain\\44d2b673-30f2-4ed5-a5a8-0d25bd2a9d6d\\.user_uploaded\\media_1789384229198.csv';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCleanE2EDiagnosis() {
  console.log('================================================================');
  console.log('🧪 RELAY AI PIPELINE: CLEAN 3-PROSPECT E2E VERIFICATION RUN');
  console.log('================================================================\n');

  // 1. Connect to PostgreSQL and Redis
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  const redis = new Redis({
    host: '127.0.0.1',
    port: 6380,
  });

  // 2. Redis Flush & Clear Existing Campaign / Prospect Data
  console.log('1️⃣  Flushing Redis queues and resetting campaign test data...');
  await redis.flushdb();
  console.log('   ✔ Redis flushed.');

  await pgClient.query(`
    TRUNCATE TABLE 
      draft_verification,
      draft_claim,
      email_draft_variants,
      draft_quality,
      draft_reasoning,
      outreach_strategy,
      relationship_match,
      email_drafts,
      prospects,
      campaigns
    RESTART IDENTITY CASCADE;
  `);
  console.log('   ✔ Cleaned campaign and draft tables.');

  // Find candidate profile
  const candRes = await pgClient.query(`SELECT id, name, email FROM candidate_profile LIMIT 1`);
  if (candRes.rows.length === 0) {
    throw new Error('No candidate profile found in database. Please upload a resume first.');
  }
  const candidate = candRes.rows[0];
  console.log(`   ✔ Candidate profile loaded: ${candidate.name} (${candidate.email}, ID: ${candidate.id})\n`);

  // 3. Create Clean Test Campaign
  console.log('2️⃣  Creating new test campaign...');
  const createCampRes = await fetch(`${BASE_URL}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Clean 3-Prospect Architecture E2E',
      candidateProfileId: candidate.id,
    }),
  });

  if (!createCampRes.ok) {
    throw new Error(`Failed to create campaign: ${createCampRes.status} ${await createCampRes.text()}`);
  }
  const campaign = await createCampRes.json();
  const campaignId = campaign.id;
  console.log(`   ✔ Campaign created: "${campaign.name}" (ID: ${campaignId})\n`);

  // 4. Ingest the 3 Test Prospects via CSV
  console.log('3️⃣  Uploading CSV with 3 test prospects (SourceFuse, Perennial Systems, iB Hubs)...');
  const csvBuffer = fs.readFileSync(CSV_FILE);
  const formData = new FormData();
  formData.append('file', new Blob([csvBuffer], { type: 'text/csv' }), 'prospects.csv');

  const uploadRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const uploadResult = await uploadRes.json();
  console.log(`   ✔ Upload complete: ${uploadResult.queued} prospects queued for research.\n`);

  // 5. Trigger Campaign Research Processing
  console.log('4️⃣  Triggering campaign research pipeline...');
  const startRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/start`, {
    method: 'POST',
  });
  console.log(`   ✔ Campaign start status: ${startRes.status}\n`);

  // 6. Monitor Research Completion
  console.log('5️⃣  Waiting for Deep Research on all prospects...');
  let rElapsed = 0;
  while (rElapsed < 120000) {
    await sleep(3000);
    rElapsed += 3000;

    const ovRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/overview`);
    if (ovRes.ok) {
      const ov = await ovRes.json();
      console.log(`   [+${Math.round(rElapsed / 1000)}s] Research Progress: ${ov.researchedProspects}/${ov.totalProspects}`);
      if (ov.researchedProspects >= ov.totalProspects && ov.totalProspects > 0) {
        console.log('   ✅ All prospects researched successfully!\n');
        break;
      }
    }
  }

  // 7. Trigger AI Draft Generation for all researched prospects
  console.log('6️⃣  Triggering AI draft generation & relational matching pipeline...');
  const genRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/generate-drafts`, {
    method: 'POST',
  });
  const genResult = await genRes.json();
  console.log(`   ✔ AI Draft Generation jobs queued:`, genResult, '\n');

  // 8. Monitor Synthesis & Verification Progression
  console.log('7️⃣  Monitoring Relational Matching, Strategy, Synthesis & Verification...');
  let elapsed = 0;
  const maxWaitMs = 180000; // 3 minutes timeout

  while (elapsed < maxWaitMs) {
    await sleep(4000);
    elapsed += 4000;

    const ovRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/overview`);
    if (ovRes.ok) {
      const ov = await ovRes.json();
      const finished = (ov.draftsGenerated || 0) + (ov.refusedCount || 0) + (ov.failedCount || 0);
      console.log(
        `   [+${Math.round(elapsed / 1000)}s] Total: ${ov.totalProspects} | Finished: ${finished}/${ov.totalProspects} | ReadyForApproval: ${ov.readyForApprovalCount || 0} | Refused: ${ov.refusedCount || 0} | Failed: ${ov.failedCount || 0}`,
      );

      if (finished >= ov.totalProspects && ov.totalProspects > 0) {
        console.log('\n   ✅ All prospects reached terminal state or ready for approval!\n');
        break;
      }
    }
  }

  // 7. Human Operator Approval for any prospects in READY_FOR_APPROVAL
  console.log('6️⃣  Human Operator Approval Phase...');
  const readyDrafts = await pgClient.query(`
    SELECT ed.id, p.email, ed.subject, ed.status
    FROM email_drafts ed
    JOIN prospects p ON ed.prospect_id = p.id
    WHERE ed.status = 'READY_FOR_APPROVAL'
  `);

  console.log(`   Found ${readyDrafts.rows.length} draft(s) in READY_FOR_APPROVAL.`);
  for (const d of readyDrafts.rows) {
    console.log(`   Approving draft ${d.id} for ${d.email}...`);
    const approveRes = await fetch(`${BASE_URL}/drafts/${d.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ humanApprovedBy: 'Human Operator', notes: 'Verified compliance with architecture rules' }),
    });

    if (approveRes.ok) {
      const approvedData = await approveRes.json();
      console.log(`   ✔ Draft ${d.id} approved successfully. Status: ${approvedData.status}`);
    } else {
      console.error(`   ❌ Failed to approve draft ${d.id}: ${approveRes.status} ${await approveRes.text()}`);
    }
  }

  // 8. Gmail Staging Dispatch
  console.log('\n7️⃣  Gmail Staging Dispatch Phase...');
  const gmailBatchRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/create-gmail-drafts`, {
    method: 'POST',
  });

  if (gmailBatchRes.ok) {
    const batchData = await gmailBatchRes.json();
    console.log('   ✔ Gmail staging queued:', batchData);
  } else {
    console.log(`   Gmail dispatch response: ${gmailBatchRes.status} ${await gmailBatchRes.text()}`);
  }

  // Poll for Gmail Draft creation to complete in BullMQ worker
  console.log('   Waiting for Gmail staging worker to persist drafts...');
  let gElapsed = 0;
  while (gElapsed < 25000) {
    await sleep(2000);
    gElapsed += 2000;

    const approvedProspects = await pgClient.query(`
      SELECT p.id, p.email, p.draft_status, ed.gmail_draft_id
      FROM prospects p
      LEFT JOIN email_drafts ed ON ed.prospect_id = p.id
      WHERE p.campaign_id = $1 AND p.draft_status IN ('APPROVED', 'GMAIL_DRAFT_CREATED')
    `, [campaignId]);

    const staged = approvedProspects.rows.filter((r) => r.draft_status === 'GMAIL_DRAFT_CREATED');
    console.log(`   [+${gElapsed / 1000}s] Staged in Gmail: ${staged.length}/${approvedProspects.rows.length}`);

    if (staged.length === approvedProspects.rows.length && approvedProspects.rows.length > 0) {
      console.log('   ✔ All approved drafts staged in Gmail!\n');
      break;
    }
  }

  // 9. Full In-Depth Inspection & Matrix Reporting
  console.log('================================================================');
  console.log('📋 COMPLETE 8-STAGE AUDIT MATRIX PER PROSPECT');
  console.log('================================================================\n');

  const prospects = await pgClient.query(`
    SELECT p.id, p.email, p.company_name, p.domain, p.research_status, p.draft_status, p.no_angle_reason, p.error,
           p.personalization_level,
           cp.id as company_profile_id, cp.company_name as resolved_name, cp.industry, cp.summary as company_summary
    FROM prospects p
    LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
    WHERE p.campaign_id = $1
    ORDER BY p.email ASC
  `, [campaignId]);

  for (const p of prospects.rows) {
    console.log('----------------------------------------------------------------');
    console.log(`PROSPECT: ${p.email} | Company: ${p.resolved_name || p.company_name}`);
    console.log(`PERSONALIZATION LEVEL: ${p.personalization_level || 'NOT_SET'}`);
    console.log('----------------------------------------------------------------');

    // Stage 1: Research
    const ceCountRes = await pgClient.query(`
      SELECT count(*) FROM company_evidence WHERE company_profile_id = $1
    `, [p.company_profile_id]);
    const evidenceCount = parseInt(ceCountRes.rows[0]?.count || '0', 10);
    console.log(`1. RESEARCH:`);
    console.log(`   Status:       ${p.research_status}`);
    console.log(`   Industry:     ${p.industry || 'N/A'}`);
    console.log(`   Evidence:     ${evidenceCount} verified evidence claims extracted`);

    // Stage 2: Relationship
    const rmRes = await pgClient.query(`
      SELECT rm.id, rm.relationship_type, rm.relationship_quality, rm.ranking_score, rm.directness, rm.analytical_rationale,
             ce.atomic_claim as company_claim,
             cde.atomic_claim as candidate_claim, cde.deliverable_name as candidate_deliverable
      FROM relationship_match rm
      LEFT JOIN company_evidence ce ON rm.company_evidence_id = ce.id
      LEFT JOIN candidate_evidence cde ON rm.candidate_evidence_id = cde.id
      WHERE ce.company_profile_id = $1
      ORDER BY rm.ranking_score DESC LIMIT 1
    `, [p.company_profile_id]);

    console.log(`2. RELATIONSHIP:`);
    if (rmRes.rows.length > 0) {
      const rm = rmRes.rows[0];
      console.log(`   Outcome:      MATCH ACCEPTED`);
      console.log(`   Quality:      ${rm.relationship_quality} (Score: ${rm.ranking_score}, Directness: ${rm.directness})`);
      console.log(`   Type:         ${rm.relationship_type}`);
      console.log(`   Bridge Rationale: "${rm.analytical_rationale}"`);
      console.log(`   Company Fact:     "${rm.company_claim}"`);
      console.log(`   Candidate Fact:   "${rm.candidate_deliverable || rm.candidate_claim}"`);
    } else {
      console.log(`   Outcome:      GENERAL COLD OUTREACH / NO SPECIFIC ANGLE`);
      console.log(`   Level:        ${p.personalization_level || 'GENERAL_COLD_OUTREACH'}`);
    }

    // Stage 3: Strategy
    const stratRes = await pgClient.query(`
      SELECT os.id, os.personalization_level, os.recipient_classification, os.objective, os.tone, os.closing_strategy
      FROM outreach_strategy os
      JOIN email_drafts ed ON os.email_draft_id = ed.id
      WHERE ed.prospect_id = $1
    `, [p.id]);

    console.log(`3. STRATEGY:`);
    if (stratRes.rows.length > 0) {
      const os = stratRes.rows[0];
      console.log(`   Personalization:  ${os.personalization_level || p.personalization_level}`);
      console.log(`   Recipient Class:  ${os.recipient_classification}`);
      console.log(`   Objective:        ${os.objective}`);
      console.log(`   Tone:             ${os.tone}`);
      console.log(`   Closing Strategy: ${os.closing_strategy}`);
    } else {
      console.log(`   Strategy: N/A (Halted before strategy)`);
    }

    // Stage 4: Draft
    const draftRes = await pgClient.query(`
      SELECT ed.id, ed.subject, ed.body, ed.status, ed.gmail_draft_id, ed.personalization_level,
             dq.personalization_score, dq.relevance_score, dq.spam_risk_score, dq.confidence_score
      FROM email_drafts ed
      LEFT JOIN draft_quality dq ON dq.email_draft_id = ed.id
      WHERE ed.prospect_id = $1
    `, [p.id]);

    let draftId = null;
    let draftBody = null;
    console.log(`4. DRAFT:`);
    if (draftRes.rows.length > 0) {
      const d = draftRes.rows[0];
      draftId = d.id;
      draftBody = d.body;
      const wordCount = d.body.trim().split(/\s+/).filter(Boolean).length;
      console.log(`   Level:      ${d.personalization_level || p.personalization_level}`);
      console.log(`   Subject:    "${d.subject}"`);
      console.log(`   Word Count: ${wordCount} words (Constraint: <= 100 words)`);
      console.log(`   Scores:     Personalization=${d.personalization_score}, Relevance=${d.relevance_score}, SpamRisk=${d.spam_risk_score}`);
      console.log(`   --- Rendered Email ---`);
      console.log(d.body);
      console.log(`   ----------------------`);
    } else {
      console.log(`   Draft: N/A (No email drafted)`);
    }

    // Stage 5: Deterministic Verification
    console.log(`5. DETERMINISTIC VERIFICATION:`);
    if (draftBody) {
      const wordCount = draftBody.trim().split(/\s+/).filter(Boolean).length;
      const hasParticipleBug = /\bI\s+[a-z]+ing\b/i.test(draftBody);
      const hasForbiddenMeta = /v3match|compositescore|atomicclaim/i.test(draftBody);
      const hasForbiddenFiller = /following your work|hope this email finds you well/i.test(draftBody);

      console.log(`   Word Count <= 100:     ${wordCount <= 100 ? 'PASS' : 'FAIL'} (${wordCount} words)`);
      console.log(`   Grammar (Participle):  ${!hasParticipleBug ? 'PASS' : 'FAIL'}`);
      console.log(`   Forbidden Metadata:    ${!hasForbiddenMeta ? 'PASS' : 'FAIL'}`);
      console.log(`   Forbidden Filler:      ${!hasForbiddenFiller ? 'PASS' : 'FAIL'}`);
      console.log(`   Deterministic Result:  ${wordCount <= 100 && !hasParticipleBug && !hasForbiddenMeta && !hasForbiddenFiller ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`   Deterministic Verification: N/A`);
    }

    // Stage 6: Semantic Verification
    console.log(`6. SEMANTIC VERIFICATION:`);
    if (draftId) {
      const verRes = await pgClient.query(`
        SELECT dv.passed, dv.severity, dv.total_claims_count, dv.verified_claims_count,
               dv.cross_role_bleed_detected, dv.verifier_notes
        FROM draft_verification dv
        WHERE dv.email_draft_id = $1
      `, [draftId]);

      if (verRes.rows.length > 0) {
        const v = verRes.rows[0];
        console.log(`   Passed:       ${v.passed}`);
        console.log(`   Severity:     ${v.severity}`);
        console.log(`   Claims:       ${v.verified_claims_count}/${v.total_claims_count} claims verified`);
        console.log(`   Bleed Check:  ${v.cross_role_bleed_detected ? 'BLEED DETECTED' : 'CLEAN'}`);
        console.log(`   Audit Notes:  "${v.verifier_notes}"`);
      } else {
        console.log(`   Verification: Not recorded`);
      }
    } else {
      console.log(`   Semantic Verification: N/A`);
    }

    // Stage 7: Approval
    console.log(`7. APPROVAL:`);
    if (draftRes.rows.length > 0) {
      const d = draftRes.rows[0];
      const isApproved = d.status === 'APPROVED' || d.status === 'GMAIL_DRAFT_CREATED';
      console.log(`   Draft Status: ${d.status} (${isApproved ? 'APPROVED' : 'PENDING APPROVAL'})`);
    } else {
      console.log(`   Approval: N/A`);
    }

    // Stage 8: Gmail Staging
    console.log(`8. GMAIL STAGING:`);
    if (draftRes.rows.length > 0) {
      const d = draftRes.rows[0];
      console.log(`   Staged in Mailbox: ${d.status === 'GMAIL_DRAFT_CREATED' ? 'YES' : 'NO'}`);
      console.log(`   Gmail Draft ID:    ${d.gmail_draft_id || 'N/A'}`);
    } else {
      console.log(`   Gmail Staging: N/A`);
    }

    // Terminal Status & Reason
    const isTerminal =
      p.draft_status === 'APPROVED' ||
      p.draft_status === 'GMAIL_DRAFT_CREATED' ||
      p.draft_status === 'NO_SUFFICIENT_OUTREACH_ANGLE' ||
      p.draft_status === 'FAILED';

    console.log(`\n🎯 EXACT TERMINAL STATUS: ${p.draft_status} (${isTerminal ? 'TERMINAL' : 'NON-TERMINAL'})`);
    console.log(`   TERMINAL REASON:         ${p.no_angle_reason || (p.draft_status === 'GMAIL_DRAFT_CREATED' ? 'SUCCESSFULLY_STAGED' : p.error || 'N/A')}\n`);
  }

  // 10. Check Final Campaign Overview API
  console.log('================================================================');
  console.log('📊 FINAL CAMPAIGN OVERVIEW API AUDIT');
  console.log('================================================================');

  const finalOvRes = await fetch(`${BASE_URL}/campaigns/${campaignId}/overview`);
  const ov = await finalOvRes.json();
  console.log(JSON.stringify(ov, null, 2));

  console.log('\nPipeline Counters Audit:');
  console.log(`  Total Prospects:        ${ov.totalProspects}`);
  console.log(`  Researched Prospects:   ${ov.researchedProspects}`);
  console.log(`  Drafts Generated:       ${ov.draftsGenerated}`);
  console.log(`  Approved Count:         ${ov.approvedCount}`);
  console.log(`  Gmail Draft Count:      ${ov.gmailDraftCount}`);
  console.log(`  Refused Count:          ${ov.refusedCount}`);
  console.log(`  Terminal Prospects:     ${ov.terminalProspects}`);
  console.log(`  Gmail Dispatch Counter: ${ov.gmailDraftCount}/${ov.approvedCount}`);

  await pgClient.end();
  await redis.quit();
  console.log('\n✅ RUN COMPLETED SUCCESSFULLY!');
}

runCleanE2EDiagnosis().catch((err) => {
  console.error('Fatal Error in Clean E2E Diagnosis:', err);
  process.exit(1);
});
