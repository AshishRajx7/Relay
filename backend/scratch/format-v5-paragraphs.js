const { Client } = require('pg');
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });

function formatParagraphs(body, companyName) {
  let text = body.trim();

  // Extract greeting
  const greetingMatch = text.match(/^(Hi\s+[^,]+,\s*|Hi,\s*)/i);
  let greeting = '';
  if (greetingMatch) {
    greeting = greetingMatch[1].trim();
    text = text.slice(greetingMatch[0].length).trim();
  }

  // Remove any trailing sign-off like "Best, Ashish Raj" because paragraph 4 is the direct ask
  text = text.replace(/(\s*(?:Best|Best regards|Thanks|Regards),?\s*\n?Ashish Raj\s*)$/i, '').trim();

  // P4: Starts with "I've attached my resume"
  let p4 = '';
  const p4Index = text.indexOf("I've attached my resume");
  if (p4Index !== -1) {
    p4 = text.slice(p4Index).trim();
    text = text.slice(0, p4Index).trim();
  }

  // P1: Starts with "I graduated from VIT Chennai" up to "opportunities at <Company>."
  let p1 = '';
  const p1Match = text.match(/^(I graduated from VIT Chennai.*?(?:opportunities at [^.]+\.))/i);
  if (p1Match) {
    p1 = p1Match[1].trim();
    text = text.slice(p1Match[0].length).trim();
  } else {
    // Fallback: take first 1-2 sentences
    const firstPeriod = text.indexOf('.');
    const secondPeriod = text.indexOf('.', firstPeriod + 1);
    if (secondPeriod !== -1) {
      p1 = text.slice(0, secondPeriod + 1).trim();
      text = text.slice(secondPeriod + 1).trim();
    }
  }

  // P2 & P3: P3 begins with concrete engineering verbs / experience
  // e.g. "I've built", "In my current", "Before joining", "Additionally, I co-founded", "I designed"
  let p2 = '';
  let p3 = '';
  const p3Index = text.search(/(?:I've built|In my current|I built|Before joining The Ninja Studio|I designed|As the co-founder)/i);
  if (p3Index !== -1 && p3Index > 0) {
    p2 = text.slice(0, p3Index).trim();
    p3 = text.slice(p3Index).trim();
  } else {
    p3 = text.trim();
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

  console.log(`Found ${drafts.rows.length} drafts to inspect/format.`);

  for (const row of drafts.rows) {
    const formatted = formatParagraphs(row.body, row.company_name);
    console.log(`\n================================================================`);
    console.log(`PROSPECT: ${row.email} (${row.company_name})`);
    console.log(`SUBJECT: ${row.subject}`);
    console.log(`--- FORMATTED 4 PARAGRAPHS ---\n${formatted}`);
    console.log(`================================================================`);
  }

  await client.end();
}

run().catch(console.error);
