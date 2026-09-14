const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();
  const res = await client.query("SELECT email, domain, research_status, draft_status, error FROM prospects WHERE campaign_id = 'f94dbf46-68c4-4246-a5d4-a3799d199483'");
  console.log('Prospects:', res.rows);
  const comp = await client.query("SELECT * FROM company_profiles WHERE domain = 'neon.tech'");
  console.log('Neon profile in DB:', comp.rows.length > 0 ? comp.rows[0].company_name : 'NONE');
  await client.end();
}

main().catch(console.error);
