const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'relay',
  password: 'relay_dev_password',
  database: 'relay'
});

async function check() {
  await client.connect();

  const res = await client.query(`
    SELECT d.id, p.company_name, p.email, d.subject, d.status, d.gmail_draft_id, d.created_at, d.updated_at
    FROM email_drafts d
    JOIN prospects p ON p.id = d.prospect_id
    ORDER BY d.created_at DESC
  `);

  console.log('ALL DRAFTS IN DB (ORDERED BY CREATED_AT DESC):');
  res.rows.forEach((r, i) => {
    console.log(`${i+1}. [${r.company_name}] ${r.email} | Created: ${r.created_at.toISOString()} | Subject: ${r.subject} | Gmail: ${r.gmail_draft_id}`);
  });

  await client.end();
}

check().catch(console.error);
