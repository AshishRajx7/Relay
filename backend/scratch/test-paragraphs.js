const { Client } = require('pg');
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });

function formatParagraphs(body, companyName) {
  let text = body.trim();

  // 1. Greeting
  const greetingMatch = text.match(/^(Hi\s+[^,]+,\s*|Hi,\s*)/i);
  let greeting = '';
  if (greetingMatch) {
    greeting = greetingMatch[1].trim();
    text = text.slice(greetingMatch[0].length).trim();
  }

  // Remove trailing signoff if model generated one
  text = text.replace(/(\s*(?:Best|Best regards|Thanks|Regards),?\s*\n?Ashish Raj\s*)$/i, '').trim();

  // 4. P4: Starts with "I've attached my resume"
  let p4 = '';
  const p4Index = text.indexOf("I've attached my resume");
  if (p4Index !== -1) {
    p4 = text.slice(p4Index).trim();
    text = text.slice(0, p4Index).trim();
  }

  // 3. P3: Starts with engineering achievements: "I've built", "In my current", "Before joining", "Additionally, I co-founded", "I designed", "As the co-founder"
  let p3 = '';
  let p3Index = text.search(/(?:I've built|In my current|I built|Before joining The Ninja Studio|Additionally, I co-founded|I designed|As the co-founder)/i);
  if (p3Index !== -1) {
    p3 = text.slice(p3Index).trim();
    text = text.slice(0, p3Index).trim();
  }

  // What remains in `text` is P1 and P2!
  // P1 ends at "opportunities at <Company>."
  let p1 = '';
  let p2 = '';
  const oppIndex = text.indexOf('opportunities at ');
  if (oppIndex !== -1) {
    const afterOpp = text.slice(oppIndex);
    // Find the period ending this sentence
    const periodIndex = afterOpp.search(/\.\s+[A-Z]/);
    if (periodIndex !== -1) {
      const splitAt = oppIndex + periodIndex + 1;
      p1 = text.slice(0, splitAt).trim();
      p2 = text.slice(splitAt).trim();
    } else {
      // If dot followed by end of line or space
      const dotIndex = afterOpp.indexOf('.');
      if (dotIndex !== -1) {
        const splitAt = oppIndex + dotIndex + 1;
        p1 = text.slice(0, splitAt).trim();
        p2 = text.slice(splitAt).trim();
      }
    }
  }

  if (!p1) {
    p1 = text.trim();
  }

  const parts = [];
  if (greeting) parts.push(greeting);
  if (p1) parts.push(p1);
  if (p2) parts.push(p2);
  if (p3) parts.push(p3);
  if (p4) parts.push(p4);

  return parts.join('\n\n');
}

async function run() {
  await client.connect();

  const drafts = await client.query(`
    SELECT d.id, d.subject, d.body, d.gmail_draft_id, p.email, p.company_name, p.id as prospect_id
    FROM email_drafts d
    JOIN prospects p ON p.id = d.prospect_id
    WHERE d.status = 'GMAIL_DRAFT_CREATED'
    ORDER BY d.updated_at DESC
    LIMIT 9
  `);

  console.log(`Auditing ${drafts.rows.length} drafts with perfect paragraph splitting:`);

  for (const row of drafts.rows) {
    const formatted = formatParagraphs(row.body, row.company_name);
    console.log(`\n================================================================`);
    console.log(`PROSPECT: ${row.email} (${row.company_name})`);
    console.log(`SUBJECT: ${row.subject}`);
    console.log(`BODY:\n${formatted}`);
  }

  await client.end();
}

run().catch(console.error);
