const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();
  const res = await client.query('SELECT * FROM resume_file');
  console.log('Total resumes:', res.rows.length);
  for (const row of res.rows) {
    console.log('ID:', row.id, '| File:', row.original_file_name, '| Status:', row.status);
    console.log('Raw text length:', row.raw_text?.length);
    console.log('Raw text preview:\n', row.raw_text?.slice(0, 1000));
  }

  const profiles = await client.query('SELECT * FROM candidate_profile');
  console.log('\n--- CANDIDATE PROFILES ---');
  for (const p of profiles.rows) {
    console.log('Profile ID:', p.id, '| Name:', p.name);
    console.log('Experience:', JSON.stringify(p.experience, null, 2));
  }
  await client.end();
}

check().catch(console.error);
