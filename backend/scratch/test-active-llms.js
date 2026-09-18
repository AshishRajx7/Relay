const https = require('https');

async function testPrompt(model, name) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an AI assistant. Return strictly JSON: {"summary": "string", "score": number}' },
        { role: 'user', content: 'Evaluate relationship between candidate building an audit log system and company building a compliance platform.' }
      ],
      max_tokens: 300,
      temperature: 0.1
    });

    const t0 = Date.now();
    const req = https.request('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const ms = Date.now() - t0;
        console.log(`[${name} / ${model}] Status: ${res.statusCode} in ${ms}ms`);
        console.log(`Response: ${data.slice(0, 500)}`);
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`[${name}] Error:`, e.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function main() {
  await testPrompt('nvidia/nemotron-3-super-120b-a12b', 'Nemotron 120B');
  await testPrompt('openai/gpt-oss-20b', 'GPT-OSS 20B');
}

main();
