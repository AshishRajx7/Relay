const { Client } = require('pg');
const Redis = require('ioredis');
const fs = require('fs/promises');
const path = require('path');

const APPLICATION_TABLES = [
  'ai_request_log',
  'campaigns',
  'candidate_profile',
  'company',
  'company_profiles',
  'company_research',
  'contact',
  'draft_quality',
  'draft_reasoning',
  'email_draft',
  'email_draft_variants',
  'email_drafts',
  'gmail_accounts',
  'prospects',
  'resume_file',
];

async function runCleanReset() {
  console.log('=====================================================');
  console.log('🧹 INITIATING CLEAN LOCAL DEVELOPMENT ENVIRONMENT RESET');
  console.log('=====================================================\n');

  // 1. Reset PostgreSQL
  console.log('--- 1. DATABASE RESET ---');
  const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await pgClient.connect();

  const truncateQuery = `TRUNCATE TABLE ${APPLICATION_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
  console.log('Executing TRUNCATE on application tables...');
  await pgClient.query(truncateQuery);
  console.log('✅ All application tables truncated with RESTART IDENTITY CASCADE.');

  // Verify PostgreSQL counts
  console.log('\nVerifying table counts:');
  for (const table of APPLICATION_TABLES) {
    const res = await pgClient.query(`SELECT count(*) FROM "${table}"`);
    const count = parseInt(res.rows[0].count, 10);
    if (count !== 0) {
      throw new Error(`Expected table ${table} to have 0 rows, got ${count}`);
    }
    console.log(`  - ${table}: ${count} rows`);
  }

  // Verify migrations preserved
  const migRes = await pgClient.query('SELECT count(*) FROM "migrations"');
  console.log(`  - migrations (preserved): ${migRes.rows[0].count} rows`);
  await pgClient.end();

  // 2. Reset Redis
  console.log('\n--- 2. REDIS RESET ---');
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6380,
  });

  const keysBefore = await redis.keys('*');
  console.log(`Keys before flush: ${keysBefore.length}`);
  await redis.flushdb();
  const keysAfter = await redis.keys('*');
  console.log(`Keys after flush: ${keysAfter.length}`);
  if (keysAfter.length !== 0) {
    throw new Error('Redis not empty after FLUSHDB');
  }
  console.log('✅ Redis database completely emptied (0 keys, 0 jobs, 0 caches).');
  await redis.quit();

  // 3. Reset Local Storage
  console.log('\n--- 3. LOCAL FILE STORAGE RESET ---');
  const uploadsDir = path.resolve(__dirname, '..', 'uploads');
  const resumesDir = path.join(uploadsDir, 'resumes');

  try {
    const entries = await fs.readdir(resumesDir);
    console.log(`Found ${entries.length} items in ${resumesDir}`);
    for (const entry of entries) {
      const fullPath = path.join(resumesDir, entry);
      await fs.rm(fullPath, { recursive: true, force: true });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Ensure resumes directory exists and is empty
  await fs.mkdir(resumesDir, { recursive: true });
  const remainingFiles = await fs.readdir(resumesDir);
  console.log(`Remaining items in ${resumesDir}: ${remainingFiles.length}`);
  if (remainingFiles.length !== 0) {
    throw new Error('Local resume storage directory not empty');
  }
  console.log('✅ Local storage cleaned. Storage directory structure preserved.\n');

  console.log('=====================================================');
  console.log('✨ CLEAN-ROOM RESET COMPLETED SUCCESSFULLY! ✨');
  console.log('=====================================================');
}

runCleanReset().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
