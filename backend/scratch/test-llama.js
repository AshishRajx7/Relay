const https = require('https');
const payload = JSON.stringify({
  model: 'meta/llama-3.2-11b-vision-instruct',
  messages: [
    { role: 'system', content: 'Respond with pure JSON conforming to {"greeting": "hello world"}' },
    { role: 'user', content: 'Hi' }
  ],
  response_format: { type: 'json_object' },
  max_tokens: 50
});
const req = https.request('https://integrate.api.nvidia.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});
req.write(payload);
req.end();
