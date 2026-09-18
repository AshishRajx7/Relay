const { Client } = require('pg');

async function testLLM() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await client.connect();

  // Find the recent AI request logs for OUTREACH_GENERATION
  const aiLogs = (await client.query("SELECT prompt_tokens, completion_tokens, latency_ms, created_at FROM ai_request_log ORDER BY created_at DESC LIMIT 5")).rows;
  console.log('Recent AI Logs:', aiLogs);

  await client.end();
}

testLLM().catch(console.error);
