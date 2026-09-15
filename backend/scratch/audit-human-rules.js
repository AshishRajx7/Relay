const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'relay',
  password: 'relay_dev_password',
  database: 'relay'
});

const FORBIDDEN_PHRASES = [
  'caught my attention',
  'aligns with my experience',
  'aligns with my background',
  'aligns with',
  'relevant to my experience',
  'relevant to my background',
  'very relevant',
  'directly relevant',
  'particularly drawn to',
  'resonates with me',
  'resonates with',
  'excited about',
  'reaching out regarding',
  'reaching out about',
  'would appreciate consideration',
  'current or future opportunities',
  'current or future openings',
  'current or future',
  'current and future',
  'backend openings',
  'engineering openings',
  'opportunity to discuss',
  'would love to chat',
  "let's connect",
  'happy to connect',
  'happy to chat',
  'introductory conversation',
  'brief call',
  'quick call',
  'coffee chat',
  'explore synergies',
  'looking forward to hearing from you',
  'additionally',
  'furthermore',
  'moreover',
  'notably',
  'importantly',
  'in my current role',
  'i have had the opportunity to',
  'i have owned and maintained',
  'i have successfully',
  'i am particularly interested in',
  'i am excited to apply',
  'i am writing to express interest',
  'goklaim',
  'final year student',
  'pursuing degree',
  'vit chennai',
  'july 2026',
  'graduated',
  'cgpa',
];

const FORBIDDEN_CTA_PATTERNS = [
  /\bcall\b/i,
  /\bmeeting\b/i,
  /\bchat\b/i,
  /\bconversation\b/i,
  /\breply\b/i,
  /\bcoffee\b/i,
  /\bhop on\b/i,
  /\btouch base\b/i,
  /\btime for a\b/i,
  /\bhear from you\b/i,
];

async function runAudit() {
  await client.connect();

  const query = `
    SELECT 
      d.id as draft_id,
      p.email,
      p.domain,
      d.subject,
      d.body,
      d.gmail_draft_id,
      d.status,
      q.personalization_score,
      q.relevance_score,
      q.spam_risk_score,
      q.technical_alignment_score,
      q.confidence_score,
      q.flags
    FROM email_drafts d
    JOIN prospects p ON d.prospect_id = p.id
    LEFT JOIN draft_quality q ON q.email_draft_id = d.id
    WHERE d.status = 'GMAIL_DRAFT_CREATED'
    ORDER BY d.updated_at DESC;
  `;

  const res = await client.query(query);
  
  // Deduplicate by email
  const seen = new Set();
  const uniqueDrafts = [];
  for (const row of res.rows) {
    if (!seen.has(row.email)) {
      seen.add(row.email);
      uniqueDrafts.push(row);
    }
  }

  console.log(`================================================================`);
  console.log(`AUDITING ${uniqueDrafts.length} PROSPECTS AGAINST RELAY OUTREACH V5 RULES`);
  console.log(`================================================================\n`);

  let allPassed = true;
  const openings = new Set();
  const closings = new Set();

  for (let i = 0; i < uniqueDrafts.length; i++) {
    const row = uniqueDrafts[i];
    const words = row.body.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    console.log(`----------------------------------------------------------------`);
    console.log(`[${i + 1}/${uniqueDrafts.length}] ${row.email} (${row.domain})`);
    console.log(`Subject:    ${row.subject}`);
    console.log(`Word Count: ${wordCount} words (Target: 55-90, Hard Max: 100)`);
    console.log(`Gmail ID:   ${row.gmail_draft_id}`);
    console.log(`Body:\n${row.body}\n`);

    const failures = [];

    // 1. Word count check (Target: 55-90, Hard max: 100)
    if (wordCount < 50 || wordCount > 100) {
      failures.push(`Word count ${wordCount} is outside allowed range (55-90 words, hard max 100)`);
    }

    // 2. Forbidden phrases check
    const lowerBody = row.body.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      if (lowerBody.includes(phrase)) {
        failures.push(`Contains forbidden phrase: "${phrase}"`);
      }
    }

    // 3. CTA check (Must not ask for call/chat/meeting/reply/time)
    for (const pattern of FORBIDDEN_CTA_PATTERNS) {
      if (pattern.test(lowerBody)) {
        failures.push(`Violates CTA rule (contains forbidden ask: ${pattern.toString()})`);
      }
    }

    // 4. Graduation check
    if (lowerBody.includes('graduated') || lowerBody.includes('july 2026') || lowerBody.includes('vit')) {
      failures.push(`Mentions graduation or college unprompted`);
    }

    // 5. Candidate source of truth
    if (!row.body.includes('The Ninja Studio')) {
      failures.push(`Missing current company "The Ninja Studio"`);
    }
    if (!row.body.includes('Ashish')) {
      failures.push(`Missing candidate name "Ashish"`);
    }

    // 6. Resume mention check
    if (!lowerBody.includes('resume')) {
      failures.push(`Missing attached resume mention`);
    }

    // Extract first paragraph for opening style tracking
    const paragraphs = row.body.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length >= 1) {
      openings.add(paragraphs[0].trim());
    }
    if (paragraphs.length >= 4) {
      closings.add(paragraphs[3].trim());
    }

    if (failures.length > 0) {
      console.log(`❌ FAILURES:\n  - ` + failures.join('\n  - '));
      allPassed = false;
    } else {
      console.log(`✅ Passed all V5 rules!`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`ROTATION AUDIT:`);
  console.log(`Distinct Opening Styles Found: ${openings.size}`);
  console.log(`Distinct Closing Styles Found: ${closings.size}`);
  console.log(`Overall V5 Pass: ${allPassed ? '✅ YES - 100% COMPLIANT' : '❌ NO'}`);
  console.log(`================================================================\n`);

  await client.end();
}

runAudit().catch(console.error);
