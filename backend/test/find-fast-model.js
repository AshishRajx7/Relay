const { OpenAI } = require('openai');
const o = new OpenAI({
  apiKey: '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',
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function main() {
  const list = await o.models.list();
  const allIds = list.data.map(m => m.id);

  console.log(`Testing all ${allIds.length} models for active completions...`);
  const active = [];

  for (const m of allIds) {
    if (m.includes('guard') || m.includes('embed') || m.includes('retriever') || m.includes('reward')) continue;
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2500);
    try {
      const start = Date.now();
      const res = await o.chat.completions.create({
        model: m,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }, { signal: c.signal });
      clearTimeout(t);
      console.log(`✅ ACTIVE: ${m} (${Date.now() - start}ms)`);
      active.push(m);
    } catch (e) {
      clearTimeout(t);
    }
  }

  console.log('\nAll Active Models:', active);
}

main().catch(console.error);
