const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay'
  });
  await client.connect();

  const camps = await client.query('SELECT id, name, created_at, status, gmail_draft_count FROM campaigns ORDER BY created_at DESC');
  console.log('Campaigns:', camps.rows);

  const prospects = await client.query(`
    SELECT p.id, p.campaign_id, p.email, p.company_name, p.research_status, p.draft_status, p.no_angle_reason, p.error,
           ed.id as draft_id, ed.status as draft_entity_status, ed.subject, ed.body, ed.gmail_draft_id
    FROM prospects p
    LEFT JOIN email_drafts ed ON ed.prospect_id = p.id
    ORDER BY p.email
  `);
  console.log('Prospects & Drafts:');
  for (const p of prospects.rows) {
    console.log(`\nEmail: ${p.email} (${p.company_name})`);
    console.log(`  Campaign: ${p.campaign_id}`);
    console.log(`  Research: ${p.research_status} | Draft: ${p.draft_status} | Reason: ${p.no_angle_reason} | Error: ${p.error}`);
    console.log(`  DraftEntity: ${p.draft_id} | Status: ${p.draft_entity_status} | Gmail: ${p.gmail_draft_id}`);
    if (p.body) {
      console.log(`  Draft Body: ${p.body.slice(0, 100)}...`);
    }
  }

  const verifications = await client.query('SELECT * FROM draft_verification');
  console.log('\nDraft Verifications:', verifications.rows);

  const matches = await client.query('SELECT * FROM relationship_match');
  const coEv = await client.query(`
    SELECT cp.domain, ce.id, ce.category, ce.atomic_claim, ce.verbatim_quote
    FROM company_profiles cp
    LEFT JOIN company_evidence ce ON ce.company_profile_id = cp.id
    ORDER BY cp.domain, ce.category
  `);
  console.log('\nCompany Evidence by Domain:');
  for (const row of coEv.rows) {
    console.log(`[${row.domain}] (${row.category}) Claim: ${row.atomic_claim?.slice(0, 70)}... Quote: ${row.verbatim_quote?.slice(0, 70)}...`);
  }

  const logs = await client.query('SELECT id, feature, model, latency_ms, status, error_message, created_at FROM ai_request_log ORDER BY created_at DESC LIMIT 6');
  console.log('\nRecent AI Requests:', logs.rows);

  await client.end();
}

main().catch(console.error);

