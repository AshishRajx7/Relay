const { Client } = require('pg');
const { Queue } = require('bullmq');

async function diagnose() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await client.connect();

  console.log('========================================================================');
  console.log('=== RELAY BACKEND PIPELINE COMPREHENSIVE DIAGNOSIS ===');
  console.log('========================================================================\n');

  // 1. Inspect Campaign
  const campaign = (await client.query("SELECT * FROM campaigns WHERE id = 'ac4cd304-43d4-4fa0-9e90-c6345185148d'")).rows[0];
  console.log('CAMPAIGN STATE:');
  console.log({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    total_prospects: campaign.total_prospects,
    completed_prospects: campaign.completed_prospects,
    manual_review_count: campaign.manual_review_count,
    gmail_draft_count: campaign.gmail_draft_count,
    crawl_count: campaign.crawl_count,
    llm_calls: campaign.llm_calls,
    estimated_cost_usd: campaign.estimated_cost_usd,
  });

  // 2. Inspect Prospects
  const prospects = (await client.query(`
    SELECT p.id, p.email, p.domain, p.company_name, p.research_status, p.draft_status, p.no_angle_reason, p.error,
           cp.id as company_profile_id, cp.company_name as resolved_company_name, cp.industry, cp.products
    FROM prospects p
    LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
    WHERE p.campaign_id = 'ac4cd304-43d4-4fa0-9e90-c6345185148d'
    ORDER BY p.email
  `)).rows;

  console.log(`\nPROSPECTS COUNT: ${prospects.length}`);
  const reportRows = [];

  for (const p of prospects) {
    // Relationship Match
    const rm = (await client.query(`
      SELECT rm.id, rm.relationship_type, rm.relationship_quality, rm.ranking_score, rm.analytical_rationale,
             ce.atomic_claim as company_claim, cde.deliverable_name as candidate_deliverable
      FROM relationship_match rm
      LEFT JOIN company_evidence ce ON rm.company_evidence_id = ce.id
      LEFT JOIN candidate_evidence cde ON rm.candidate_evidence_id = cde.id
      WHERE ce.company_profile_id = $1
      ORDER BY rm.ranking_score DESC LIMIT 1
    `, [p.company_profile_id])).rows[0];

    // Email Draft
    const draft = (await client.query(`
      SELECT ed.id, ed.subject, ed.body, ed.status, ed.gmail_draft_id,
             os.id as strategy_id, os.objective as strategy_obj,
             dv.passed as verif_passed, dv.severity as verif_severity,
             dq.personalization_score, dq.relevance_score, dq.flags
      FROM email_drafts ed
      LEFT JOIN outreach_strategy os ON os.email_draft_id = ed.id
      LEFT JOIN draft_verification dv ON dv.email_draft_id = ed.id
      LEFT JOIN draft_quality dq ON dq.email_draft_id = ed.id
      WHERE ed.prospect_id = $1
    `, [p.id])).rows[0];

    reportRows.push({
      email: p.email,
      company: p.resolved_company_name || p.company_name,
      research: p.research_status,
      match: rm ? `${rm.relationship_quality} (${rm.ranking_score})` : 'NONE',
      matchType: rm ? rm.relationship_type : 'N/A',
      strategy: draft?.strategy_id ? 'CREATED' : 'NONE',
      draft: draft ? draft.status : (p.draft_status === 'NO_SUFFICIENT_OUTREACH_ANGLE' ? `REFUSED: ${p.no_angle_reason}` : p.draft_status),
      verification: draft?.verif_severity || 'N/A',
      humanApproval: draft?.status === 'APPROVED' || draft?.status === 'GMAIL_DRAFT_CREATED' ? 'YES' : (draft?.status === 'READY_FOR_APPROVAL' ? 'PENDING' : 'N/A'),
      gmailStaging: draft?.gmail_draft_id ? `STAGED (${draft.gmail_draft_id.slice(0, 10)})` : (draft?.status === 'GMAIL_DRAFT_CREATED' ? 'STAGED' : 'NOT_STAGED'),
      finalStatus: p.draft_status,
      rationale: rm?.analytical_rationale || p.no_angle_reason || 'N/A',
    });
  }

  console.log('\n--- PROSPECT PIPELINE MATRIX ---');
  console.table(reportRows);

  // 3. Inspect BullMQ Queue states
  console.log('\n--- BULLMQ QUEUES ---');
  const redisConfig = { host: 'localhost', port: 6380 };
  const queueNames = ['company-research', 'draft-generation', 'gmail-draft'];
  for (const qName of queueNames) {
    try {
      const q = new Queue(qName, { connection: redisConfig });
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      console.log(`Queue [${qName}]:`, counts);
      await q.close();
    } catch (e) {
      console.log(`Queue [${qName}]: Error connecting -`, e.message);
    }
  }

  await client.end();
}

diagnose().catch(console.error);
