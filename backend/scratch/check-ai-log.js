const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();
  const res = await client.query('SELECT * FROM ai_request_log ORDER BY created_at DESC LIMIT 5');
  console.log('AI Request Logs:', res.rows);

  const resume = await client.query('SELECT id, status, parse_error FROM resume_file WHERE id = \'bb6abcf6-920b-41e8-9f04-7e0232e5356c\'');
  console.log('Resume status:', resume.rows[0]);

  await client.end();
}

check().catch(console.error);
