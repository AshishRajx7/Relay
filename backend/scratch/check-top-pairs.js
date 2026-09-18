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

  const STOP_WORDS = new Set([
    'and', 'the', 'with', 'for', 'from', 'into', 'using', 'that', 'this',
    'our', 'your', 'their', 'across', 'over', 'both', 'such', 'also', 'than',
    'then', 'each', 'more', 'most', 'some', 'well', 'been', 'were', 'have',
  ]);
  const extractTokens = (text) => {
    return (text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  };

  const candEvs = (await client.query("SELECT * FROM candidate_evidence WHERE candidate_profile_id = '7c8bc6f4-c8a0-4889-87ee-9628c8ef6772'")).rows;
  const bulletEvidences = candEvs.filter((e) => e.source_type === 'RESUME_BULLET');

  for (const domain of ['sourcefuse.com', 'perennialsys.com']) {
    console.log(`\n=================== ${domain} ===================`);
    const company = (await client.query("SELECT * FROM company_profiles WHERE domain = $1", [domain])).rows[0];
    const compEvs = (await client.query("SELECT * FROM company_evidence WHERE company_profile_id = $1", [company.id])).rows;

    const normalizedProducts = (company.products || []).map((p) => typeof p === 'string' ? p : (p?.name || p?.title || '')).join(' ');
    const normalizedTechs = (company.tech_signals || []).map((t) => typeof t === 'string' ? t : (t?.name || t?.tech || '')).join(' ');
    const companyContextText = `${company.company_name} ${company.industry || ''} ${company.summary || ''} ${normalizedProducts} ${normalizedTechs}`.toLowerCase();
    const companyContextTokens = extractTokens(companyContextText);

    const plausiblePairs = [];
    for (const cEv of bulletEvidences) {
      const cText = `${cEv.deliverable_name} ${cEv.atomic_claim} ${cEv.technologies || ''} ${cEv.raw_bullet_text || ''}`.toLowerCase();
      const cTokens = extractTokens(cText);

      for (const coEv of compEvs) {
        const coText = `${coEv.atomic_claim} ${coEv.verbatim_quote} ${coEv.category || ''}`.toLowerCase();
        const coTokens = extractTokens(coText);

        let recallScore = 0;
        for (const ct of cTokens) {
          if (coTokens.includes(ct)) {
            recallScore += 15;
          } else if (companyContextTokens.includes(ct)) {
            recallScore += 5;
          }
        }
        for (const ct of cTokens) {
          if (ct.length >= 4) {
            const prefix = ct.slice(0, 4);
            const matchesCo = coTokens.some((t) => t.length >= 4 && t.startsWith(prefix) && t !== ct);
            if (matchesCo) recallScore += 10;
          }
        }
        const directTechs = (cEv.technologies || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        for (const tech of directTechs) {
          if (coText.includes(tech) || companyContextText.includes(tech)) {
            recallScore += 12;
          }
        }
        plausiblePairs.push({
          candidateDeliverable: cEv.deliverable_name,
          candidateClaim: cEv.atomic_claim,
          companyClaim: coEv.atomic_claim,
          recallScore,
        });
      }
    }

    plausiblePairs.sort((a, b) => b.recallScore - a.recallScore);
    console.log(`Top 6 pairs for ${company.company_name}:`);
    plausiblePairs.slice(0, 6).forEach((p, idx) => {
      console.log(` #${idx} (Score ${p.recallScore}): Cand="${p.candidateDeliverable}" ↔ Comp="${p.companyClaim.slice(0, 50)}..."`);
    });
  }

  await client.end();
}

test().catch(console.error);
