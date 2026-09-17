const { Client } = require('pg');

async function audit() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });

  await client.connect();

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('=== DATABASE TABLES AUDIT ===');
  for (const r of res.rows) {
    const tableName = r.table_name;
    const countRes = await client.query(`SELECT count(*) FROM "${tableName}"`);
    console.log(`${tableName}: ${countRes.rows[0].count} rows`);
  }

  await client.end();
}

audit().catch(console.error);
