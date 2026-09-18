const https = require('https');

async function getAvailableModels() {
  return new Promise((resolve) => {
    const req = https.request('https://integrate.api.nvidia.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer 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'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data.map(d => d.id));
        } catch {
          resolve([]);
        }
      });
    });
    req.end();
  });
}

function testModel(model) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    });

    const req = https.request('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ model, status: res.statusCode });
      });
    });

    req.on('error', () => resolve({ model, status: 'error' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ model, status: 'timeout' });
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const models = await getAvailableModels();
  console.log(`Checking ${models.length} models for active status on this API key...`);
  const active = [];

  for (let i = 0; i < models.length; i += 8) {
    const batch = models.slice(i, i + 8);
    const results = await Promise.all(batch.map(testModel));
    for (const r of results) {
      if (r.status === 200) {
        console.log(`ACTIVE [200]: ${r.model}`);
        active.push(r.model);
      }
    }
  }

  console.log('\n--- ALL ACTIVE MODELS FOR THIS KEY ---');
  console.log(active);
}

main();
