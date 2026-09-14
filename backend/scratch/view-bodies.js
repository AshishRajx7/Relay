const { Client } = require('pg');
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT p.company_name, p.email, p.contact_type, d.subject, d.body
    FROM email_drafts d
    JOIN prospects p ON p.id = d.prospect_id
    ORDER BY d.updated_at DESC
  `);
  for (const r of res.rows) {
    console.log('================================================================');
    console.log(`COMPANY: ${r.company_name} | EMAIL: ${r.email} | TYPE: ${r.contact_type}`);
    console.log(`SUBJECT: ${r.subject}`);
    console.log('BODY:\n' + r.body);
    console.log('================================================================\n');
  }
  await client.end();
}
check().catch(console.error);
