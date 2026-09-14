const https = require('https');

const systemPrompt = `# SYSTEM PROMPT: JOB OUTREACH EMAIL GENERATOR

You are writing a direct, high-converting job application email FROM the candidate (Ashish Raj) TO the recipient (engineering@linear.app) at Linear.
The email MUST be written in the first person ("I", "my", "me") by Ashish Raj. Ashish Raj IS the sender and applicant. You are NOT writing to Ashish Raj.

Your sole objective is to maximize the probability that the recipient responds positively to Ashish Raj (INTERVIEW CONVERSION RATE).

You are NOT a sales copywriter.
You are NOT a consultant.
You are NOT an external recruiter.
You are NOT writing networking emails.
You are writing a direct, professional job application email.

Every email must make it immediately obvious:
1. Who the candidate is
2. What role they are seeking
3. Why they chose this company
4. Why their background is relevant
5. What action they are requesting

CRITICAL RULE:
The candidate's job-seeking intent MUST be obvious within the first two sentences.

RECIPIENT CONTEXT:
- Recipient Email: engineering@linear.app
- Recipient Role: TYPE_B_ENGINEERING_MANAGER (Engineering Lead)

CANDIDATE FACTS:
- Candidate Name: Ashish Raj
- Target Role: Backend Engineer
- Current Role: Backend Developer Intern at Goklaim
- Educational Status: B.Tech in Electronics and Computer Engineering at VIT Chennai
- Primary Project: Goklaim HRMS platform (Activity Logs, Survey Module, BranchGuard Redis Caching, Leave Management Optimization)
- Production Tools: NestJS, PostgreSQL, Redis, TypeORM, Docker, React

TARGET COMPANY:
- Company Name: Linear
- Domain: linear.app
- Products: Issue tracking, project management, developer workflows
- Verified Tech Signals: TypeScript, GraphQL, React

EXACT 4-PARAGRAPH EMAIL STRUCTURE:
PARAGRAPH 1: Candidate introduction and role intent within first 2 sentences.
PARAGRAPH 2: Company-specific personalization (Max 2 sentences).
PARAGRAPH 3: Relevant candidate experience (80% volume, production metrics, NestJS/PostgreSQL/Redis).
PARAGRAPH 4: Clear application CTA with attached resume.

FORBIDDEN PHRASES:
"I'd love to chat", "Let's connect", "I'd love to discuss your roadmap", "Happy to brainstorm", "Thought I'd reach out", "Explore synergies", "I can help you".

SUBJECT RULES:
Tier 1: Backend Engineer Application — Ashish Raj
Every subject MUST contain at least one of: Application, Opportunity, Engineer, Engineering, Developer, Software, Backend, Role, Position.

Output pure JSON conforming to this schema:
{
  "technicalVariant": { "subject": "string", "body": "string" },
  "startupVariant": { "subject": "string", "body": "string" },
  "directVariant": { "subject": "string", "body": "string" },
  "whyCompany": "string",
  "whyMe": "string",
  "whyNow": "string",
  "confidenceLevel": "HIGH"
}`;

const userPrompt = `Write a job application email authored by candidate Ashish Raj applying for Backend Engineer opportunities at Linear (linear.app), sent to Engineering Lead (engineering@linear.app). Write from Ashish Raj's first-person perspective ("I", "my") seeking an engineering role.`;

const payload = JSON.stringify({
  model: 'meta/llama-3.2-11b-vision-instruct',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  response_format: { type: 'json_object' },
  max_tokens: 1500,
  temperature: 0.2
});

const t0 = Date.now();
const req = https.request('https://integrate.api.nvidia.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json'
  },
  timeout: 30000
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Finished in ${Date.now() - t0}ms with status ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      const content = parsed.choices[0].message.content;
      console.log('CONTENT:', content);
    } catch(e) {
      console.error('PARSE ERROR:', e.message, data.slice(0, 300));
    }
  });
});

req.on('error', (e) => console.error('REQ ERROR:', e.message));
req.write(payload);
req.end();
