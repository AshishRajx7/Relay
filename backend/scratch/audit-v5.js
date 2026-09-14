const { Client } = require('pg');
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });

async function audit() {
  await client.connect();
  const res = await client.query(`
    SELECT 
      p.email,
      p.company_name,
      p.contact_type,
      d.id as draft_id,
      d.subject,
      d.body,
      d.status,
      d.gmail_draft_id,
      d.gmail_thread_id,
      q.personalization_score,
      q.relevance_score,
      q.spam_risk_score,
      q.technical_alignment_score,
      q.confidence_score,
      r.why_company,
      r.why_me
    FROM email_drafts d
    JOIN prospects p ON p.id = d.prospect_id
    LEFT JOIN draft_quality q ON q.email_draft_id = d.id
    LEFT JOIN draft_reasoning r ON r.email_draft_id = d.id
    ORDER BY d.updated_at DESC
    LIMIT 9
  `);

  console.log('--- DB AUDIT SUMMARY ---');
  console.log('Total drafts retrieved:', res.rows.length);
  for (const r of res.rows) {
    console.log(`\n[${r.company_name}] ${r.email} (${r.contact_type})`);
    console.log('  Subject:', r.subject);
    console.log('  Status:', r.status);
    console.log('  Gmail Draft ID:', r.gmail_draft_id);
    console.log(`  Quality Scores: P=${r.personalization_score} R=${r.relevance_score} Spam=${r.spam_risk_score} Tech=${r.technical_alignment_score} Conf=${r.confidence_score}`);
    const bodyLines = r.body.split('\n').filter(l => l.trim().length > 0);
    console.log('  Paragraph count:', bodyLines.length);
    console.log('  Word count:', r.body.trim().split(/\s+/).length);
  }

  // Also query variants count
  const vRes = await client.query('SELECT email_draft_id, variant_type, subject FROM email_draft_variants ORDER BY created_at DESC');
  console.log(`\nTotal Variants in DB: ${vRes.rows.length}`);

  await client.end();
}

audit().catch(console.error);
