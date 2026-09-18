const { Client } = require('pg');
const client = new Client({ host: 'localhost', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });

async function run() {
  await client.connect();
  const strategies = await client.query('SELECT * FROM outreach_strategy');
  console.log('Outreach strategies:', strategies.rows);

  const matches = await client.query('SELECT rm.*, ce.deliverable_name, ce.atomic_claim as cand_claim, co.atomic_claim as comp_claim, co.verbatim_quote FROM relationship_match rm JOIN candidate_evidence ce ON rm.candidate_evidence_id = ce.id JOIN company_evidence co ON rm.company_evidence_id = co.id');
  console.log('Relationship matches:');
  for (const m of matches.rows) {
    console.log({
      id: m.id,
      quality: m.relationship_quality,
      score: m.ranking_score,
      rationale: m.analytical_rationale,
      candidateDeliverable: m.deliverable_name,
      candidateClaim: m.cand_claim,
      companyClaim: m.comp_claim,
      companyQuote: m.verbatim_quote,
    });
  }

  await client.end();
}

run().catch(console.error);
