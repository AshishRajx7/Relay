const https = require('https');

const candidates = [
  'mistralai/mistral-large',
  'mistralai/mistral-7b-instruct-v0.3',
  'microsoft/phi-3.5-moe-instruct',
  'ai21labs/jamba-1.5-large-instruct',
  'meta/llama2-70b',
  'openai/gpt-oss-20b'
];

async function checkModel(model) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Respond with JSON: {"status": "ok"}' }],
      temperature: 0.1,
      max_tokens: 50
    });

    const req = https.request('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ model, status: res.statusCode, data: data.slice(0, 150) });
      });
    });

    req.on('error', (e) => resolve({ model, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ model, error: 'TIMEOUT' });
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  for (const m of candidates) {
    const t0 = Date.now();
    const res = await checkModel(m);
    console.log(`${m}: [${Date.now() - t0}ms]`, res.status || res.error, res.data ? res.data.replace(/\n/g, ' ') : '');
  }
}
main();
