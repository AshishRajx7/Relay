const Redis = require('ioredis');

async function auditRedis() {
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6380,
  });

  const keys = await redis.keys('*');
  console.log(`=== REDIS KEYS AUDIT (${keys.length} keys) ===`);
  const categorized = {};
  for (const k of keys) {
    const prefix = k.split(':')[0] || 'other';
    categorized[prefix] = (categorized[prefix] || 0) + 1;
  }
  console.log('Categories:', categorized);
  console.log('Keys Sample:', keys.slice(0, 30));

  await redis.quit();
}

auditRedis().catch(console.error);
