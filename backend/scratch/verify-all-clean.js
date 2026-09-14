const { Client } = require('pg');
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });

const FORBIDDEN_PHRASES = [
  "i'd love to chat", "let's connect", "thought i'd reach out", "happy to brainstorm",
  "would love your thoughts", "i can help you", "i admire", "i'm inspired by",
  "i've been following", "i'm excited about", "i love what you're building",
  "i wanted to introduce myself", "hope you're doing well", "hope this email finds you well",
  "explore synergies", "passionate about", "rockstar engineer", "world-class team",
  "cutting-edge", "game-changing", "revolutionary", "goklaim"
];

const FORBIDDEN_PUNCT = ["—", "–", "•", "!!"];

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT d.subject, d.body, p.email, p.company_name 
    FROM email_drafts d 
    JOIN prospects p ON p.id = d.prospect_id 
    WHERE d.status = 'GMAIL_DRAFT_CREATED' 
    ORDER BY d.updated_at DESC 
    LIMIT 9
  `);
  
  let violations = 0;
  for (const r of res.rows) {
    const text = (r.subject + ' ' + r.body).toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      if (text.includes(phrase)) {
        console.error(`VIOLATION in ${r.email}: found forbidden phrase '${phrase}'`);
        violations++;
      }
    }
    for (const p of FORBIDDEN_PUNCT) {
      if (r.subject.includes(p) || r.body.includes(p)) {
        console.error(`VIOLATION in ${r.email}: found forbidden punctuation '${p}'`);
        violations++;
      }
    }
    if (/\b(student|recent graduate seeking first job|junior engineer|aspiring engineer|looking to gain experience|backend intern)\b/i.test(text)) {
      console.error(`VIOLATION in ${r.email}: found forbidden candidate positioning`);
      violations++;
    }
  }

  if (violations === 0) {
    console.log('✅ AUDIT COMPLETE: ZERO FORBIDDEN PHRASES, ZERO FORBIDDEN PUNCTUATION, ZERO POSITIONING VIOLATIONS ACROSS ALL 9 DRAFTS.');
  } else {
    console.log(`Found ${violations} violations.`);
  }

  await client.end();
}

check().catch(console.error);
