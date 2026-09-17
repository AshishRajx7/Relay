const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();
  const res = await client.query('SELECT raw_text FROM resume_file LIMIT 1');
  console.log(res.rows[0].raw_text);
  await client.end();
}

check().catch(console.error);
