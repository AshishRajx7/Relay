const https = require('https');

const models = [
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'meta/llama-3.2-11b-vision-instruct',
  'mistralai/mistral-large-2-instruct',
  'z-ai/glm-5.3-flash',
  'ibm/granite-3.0-8b-instruct',
  'google/gemma-3-12b-it',
  'moonshotai/kimi-k2.6',
  'deepseek-ai/deepseek-v4-flash-0731'
];

async function checkModel(model) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    });

    const req = https.request('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ model, status: res.statusCode, data: data.slice(0, 100) });
      });
    });

    req.on('error', (e) => resolve({ model, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ model, error: 'TIMEOUT (8s)' });
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  for (const m of models) {
    const t0 = Date.now();
    const res = await checkModel(m);
    console.log(`${m}: [${Date.now() - t0}ms]`, res.status || res.error, res.data || '');
  }
}
main();
