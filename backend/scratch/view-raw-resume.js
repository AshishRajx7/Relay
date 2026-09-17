const { Client } = require('pg');

async function viewResume() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await client.connect();

  const rf = await client.query('SELECT id, original_file_name, raw_text FROM resume_file LIMIT 1');
  if (rf.rows.length) {
    console.log('Resume ID:', rf.rows[0].id);
    console.log('Original File:', rf.rows[0].original_file_name);
    console.log('=== RAW TEXT ===\n' + rf.rows[0].raw_text);
  } else {
    console.log('No resume found');
  }

  await client.end();
}

viewResume().catch(console.error);
