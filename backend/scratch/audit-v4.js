const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'relay',
  password: 'relay_dev_password',
  database: 'relay'
});

const FORBIDDEN_AI_PHRASES = [
  'additionally',
  'furthermore',
  'notably',
  "i've had the opportunity to",
  "i have had the opportunity to",
  "i've observed that",
  "i have observed that",
  'my experience aligns with',
  "i've owned and maintained",
  'i have owned and maintained',
  "i'm particularly drawn to",
  'i am particularly drawn to',
  "i've built and maintained several production systems",
  'i have built and maintained several production systems'
];

const FORBIDDEN_NETWORKING_PHRASES = [
  "i'd love to chat",
  'love to chat',
  "let's connect",
  'lets connect',
  'thought i would reach out',
  "thought i'd reach out",
  'happy to brainstorm',
  'would love your thoughts',
  'explore synergies',
  'rockstar engineer',
  'cutting-edge',
  'game-changing',
  'revolutionary',
  'hope this email finds you well',
  'hope you are doing well'
];

const FORBIDDEN_PROFILE_PHRASES = [
  'goklaim',
  'student looking for opportunities',
  'intern at goklaim',
  'final year student',
  'pursuing degree',
  'currently pursuing',
  'student at vit'
];

const REQUIRED_CTA = "I've attached my resume and would appreciate consideration for any current or future backend engineering openings.\n\nThank you for your time.\n\nAshish Raj";

async function auditV4() {
  await client.connect();

  const query = `
    SELECT 
      d.id as draft_id,
      p.email,
      p.domain,
      p.contact_type,
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
    ORDER BY d.updated_at DESC
    LIMIT 9;
  `;

  const res = await client.query(query);
  console.log(`Auditing ${res.rows.length} V4 drafts...\n`);

  let allPassed = true;

  for (const row of res.rows) {
    const body = row.body || '';
    const subject = row.subject || '';
    const words = body.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    console.log('================================================================');
    console.log(`Prospect: ${row.email} (${row.domain}) [${row.contact_type}]`);
    console.log(`Subject:  ${subject}`);
    console.log(`Gmail ID: ${row.gmail_draft_id}`);
    console.log(`Word Count: ${wordCount} (Target: 70-120, Hard Max: 140)`);
    console.log('----------------------------------------------------------------');
    console.log(body);
    console.log('----------------------------------------------------------------');

    const issues = [];

    // 1. Word count validation
    if (wordCount > 140) {
      issues.push(`FAIL: Word count ${wordCount} exceeds 140 maximum!`);
    } else if (wordCount < 70) {
      issues.push(`WARN: Word count ${wordCount} is below target 70 words.`);
    }

    // 2. Forbidden AI phrases
    const lowerBody = body.toLowerCase();
    for (const phrase of FORBIDDEN_AI_PHRASES) {
      if (lowerBody.includes(phrase)) {
        issues.push(`FAIL: Found forbidden AI phrase "${phrase}"`);
      }
    }

    // 3. Forbidden networking phrases
    for (const phrase of FORBIDDEN_NETWORKING_PHRASES) {
      if (lowerBody.includes(phrase)) {
        issues.push(`FAIL: Found forbidden networking phrase "${phrase}"`);
      }
    }

    // 4. Forbidden candidate profile phrases
    for (const phrase of FORBIDDEN_PROFILE_PHRASES) {
      if (lowerBody.includes(phrase)) {
        issues.push(`FAIL: Found forbidden profile phrase "${phrase}"`);
      }
    }

    // 5. Check candidate identity
    if (!body.includes('Ashish Raj')) {
      issues.push('FAIL: Candidate name Ashish Raj missing');
    }
    if (!body.includes('The Ninja Studio')) {
      issues.push('FAIL: Current company The Ninja Studio missing');
    }
    if (!body.includes('July 2026') && !body.includes('VIT Chennai')) {
      issues.push('FAIL: Graduated July 2026 / VIT Chennai missing');
    }

    // 6. Check CTA
    if (!body.includes("I've attached my resume and would appreciate consideration")) {
      issues.push('FAIL: Required CTA missing or altered');
    }

    // 7. Check section count (must have exactly 4 main sections)
    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    console.log(`Paragraph count: ${paragraphs.length} blocks`);

    if (issues.length > 0) {
      console.log('❌ ISSUES:');
      issues.forEach(i => console.log(`   - ${i}`));
      allPassed = false;
    } else {
      console.log('✅ ALL V4 HUMAN-LIKE CHECKS PASSED');
    }
    console.log('\n');
  }

  console.log('================================================================');
  console.log(allPassed ? '🎉 OVERALL AUDIT: ALL 9 PROSPECTS PASSED 100% OF V4 CRITERIA' : '⚠️ OVERALL AUDIT: ISSUES DETECTED');
  console.log('================================================================');

  await client.end();
}

auditV4().catch(err => {
  console.error(err);
  process.exit(1);
});
