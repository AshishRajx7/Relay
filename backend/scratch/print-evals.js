const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });
  await client.connect();

  const candEvs = (await client.query('SELECT deliverable_name, atomic_claim, technologies FROM candidate_evidence WHERE candidate_profile_id = $1', ['7c8bc6f4-c8a0-4889-87ee-9628c8ef6772'])).rows;
  console.log(`Candidate Evidence count: ${candEvs.length}`);
  candEvs.forEach((c, idx) => {
    console.log(`[${idx}] "${c.deliverable_name}" | Claim: "${c.atomic_claim.slice(0, 60)}" | Techs: "${c.technologies}"`);
  });

  const sf = (await client.query("SELECT * FROM company_profiles WHERE domain = 'sourcefuse.com'")).rows[0];
  const sfEvs = (await client.query("SELECT * FROM company_evidence WHERE company_profile_id = $1", [sf.id])).rows;
  console.log(`\nSourceFuse Evidence count: ${sfEvs.length}`);
  sfEvs.forEach((e, idx) => {
    console.log(`[${idx}] "${e.atomic_claim}"`);
  });

  const ps = (await client.query("SELECT * FROM company_profiles WHERE domain = 'perennialsys.com'")).rows[0];
  const psEvs = (await client.query("SELECT * FROM company_evidence WHERE company_profile_id = $1", [ps.id])).rows;
  console.log(`\nPerennial Systems Evidence count: ${psEvs.length}`);
  psEvs.forEach((e, idx) => {
    console.log(`[${idx}] "${e.atomic_claim}"`);
  });

  await client.end();
}

test().catch(console.error);

test().catch(console.error);
