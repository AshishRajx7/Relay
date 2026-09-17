const OpenAI = require('openai');

async function test() {
  const client = new OpenAI({
    apiKey: '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',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  console.log('Sending request to Nvidia NIM...');
  const start = Date.now();
  const res = await client.chat.completions.create({
    model: 'meta/llama-3.2-11b-vision-instruct',
    messages: [
      { role: 'user', content: 'Output JSON: {"status": "ok"}' },
    ],
    response_format: { type: 'json_object' },
  });
  console.log(`Success in ${Date.now() - start}ms:`, res.choices[0]?.message?.content);
}

test().catch(console.error);
