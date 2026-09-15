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
  "saw what you're building",
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
  'job openings',
  'opportunity to discuss',
  'conversation',
  'call',
  'meeting',
  'chat',
  'connect',
  'follow up',
  'circle back',
  'touch base',
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

const VALID_ENDINGS = [
  'Resume attached.',
  "I've attached my resume.",
  'Attached my resume.'
];

const SIGNATURE_PATTERNS = [
  /\bthank\s+you\b/i,
  /\bthanks\b/i,
  /\bbest\s+regards\b/i,
  /\bbest\b/i,
  /\bregards\b/i,
  /\bcheers\b/i,
  /\bsincerely\b/i,
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
      q.requires_manual_review,
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
  console.log(`AUDITING ${uniqueDrafts.length} PROSPECTS AGAINST RELAY OUTREACH V6.1 RULES`);
  console.log(`================================================================\n`);

  let allPassed = true;
  const openings = new Set();
  const companySentences = new Set();
  const achievements = new Set();
  const endings = new Set();

  for (let i = 0; i < uniqueDrafts.length; i++) {
    const row = uniqueDrafts[i];
    const words = row.body.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const paragraphs = row.body.split(/\n\s*\n/).filter(Boolean);

    console.log(`----------------------------------------------------------------`);
    console.log(`[Target ${i + 1}/${uniqueDrafts.length}] ${row.email} (${row.domain})`);
    console.log(`Subject:        ${row.subject}`);
    console.log(`Word Count:     ${wordCount} words (Target: 55-85, Hard: 45-95)`);
    console.log(`Paragraphs:     ${paragraphs.length} (Strictly 4 required)`);
    console.log(`Gmail Draft ID: ${row.gmail_draft_id}`);
    console.log(`Manual Review:  ${row.requires_manual_review ? '⚠️ YES' : '✅ NO'}`);
    console.log(`Flags:          ${(row.flags || []).length > 0 ? row.flags.join(', ') : 'NONE'}`);
    console.log(`Body:\n${row.body}\n`);

    const failures = [];

    // 1. Word count check (Hard min 45, Hard max 95)
    if (wordCount < 45 || wordCount > 95) {
      failures.push(`Word count ${wordCount} is outside allowed range (45-95 words)`);
    }

    // 2. Exactly 4 paragraphs check
    if (paragraphs.length !== 4) {
      failures.push(`Paragraph count is ${paragraphs.length}, strictly 4 required`);
    }

    // 3. Ending check (Strictly one of 3 choices)
    const lastP = paragraphs.length === 4 ? paragraphs[3].trim() : '';
    if (!VALID_ENDINGS.includes(lastP)) {
      failures.push(`Invalid paragraph 4 ending: "${lastP}". Must be one of: ${VALID_ENDINGS.join(', ')}`);
    } else {
      endings.add(lastP);
    }

    // 4. No signature or thank you check
    for (const pattern of SIGNATURE_PATTERNS) {
      if (pattern.test(row.body)) {
        failures.push(`Contains forbidden signature or thank you: ${pattern.toString()}`);
      }
    }

    // 5. Forbidden phrases check
    const lowerBody = row.body.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      if (lowerBody.includes(phrase)) {
        failures.push(`Contains forbidden phrase: "${phrase}"`);
      }
    }

    // 6. Candidate source of truth
    if (!row.body.includes('The Ninja Studio')) {
      failures.push(`Missing current company "The Ninja Studio"`);
    }
    if (!row.body.includes('Ashish')) {
      failures.push(`Missing candidate name "Ashish"`);
    }

    // 7. Track rotation
    if (paragraphs.length >= 1) openings.add(paragraphs[0].trim());
    if (paragraphs.length >= 2) companySentences.add(paragraphs[1].trim());
    if (paragraphs.length >= 3) achievements.add(paragraphs[2].trim());

    if (failures.length > 0) {
      console.log(`❌ FAILURES:\n  - ` + failures.join('\n  - '));
      allPassed = false;
    } else {
      console.log(`✅ Passed all V6.1 rules!`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`ROTATION & COMPLIANCE SUMMARY:`);
  console.log(`Distinct Opening Styles:         ${openings.size}`);
  console.log(`Distinct Company Sentences:      ${companySentences.size}`);
  console.log(`Distinct Achievements:           ${achievements.size}`);
  console.log(`Distinct Endings Used:           ${endings.size}`);
  console.log(`Overall RELAY OUTREACH V6.1:     ${allPassed ? '🎉 100% PASS' : '❌ FAILURES DETECTED'}`);
  console.log(`================================================================\n`);

  await client.end();
}

runAudit().catch(console.error);
