const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { CompanyProfile } = require('../dist/modules/company-research/entities/company-profile.entity');
const { CompanyEvidenceEntity } = require('../dist/modules/company-research/entities/company-evidence.entity');
const { CandidateEvidenceEntity } = require('../dist/modules/resume/entities/candidate-evidence.entity');

async function checkSfPairs() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const companyRepo = app.get(getRepositoryToken(CompanyProfile));
  const compEvRepo = app.get(getRepositoryToken(CompanyEvidenceEntity));
  const candEvRepo = app.get(getRepositoryToken(CandidateEvidenceEntity));

  const sf = await companyRepo.findOne({ where: { domain: 'sourcefuse.com' } });
  const compEvs = await compEvRepo.find({ where: { companyProfileId: sf.id } });
  const candEvs = await candEvRepo.find({ where: { candidateProfileId: '7c8bc6f4-c8a0-4889-87ee-9628c8ef6772' } });

  const bulletEvidences = candEvs.filter((e) => e.sourceType === 'RESUME_BULLET');
  const extractTokens = (text) => (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);

  const companyContextText = `${sf.companyName} ${sf.industry || ''} ${sf.summary || ''} ${(sf.products || []).join(' ')} ${(sf.techSignals || []).join(' ')}`.toLowerCase();
  const companyContextTokens = extractTokens(companyContextText);

  const plausiblePairs = [];
  for (const cEv of bulletEvidences) {
    const cTokens = extractTokens(`${cEv.deliverableName} ${cEv.atomicClaim} ${cEv.technologies || ''}`);
    for (const coEv of compEvs) {
      const coTokens = extractTokens(`${coEv.atomicClaim} ${coEv.verbatimQuote}`);
      let recallScore = 0;
      for (const ct of cTokens) {
        if (coTokens.includes(ct)) recallScore += 15;
        else if (companyContextTokens.includes(ct)) recallScore += 5;
      }
      for (const ct of cTokens) {
        if (ct.length >= 4) {
          const prefix = ct.slice(0, 4);
          if (coTokens.some(t => t.length >= 4 && t.startsWith(prefix) && t !== ct)) recallScore += 10;
        }
      }
      const directTechs = (cEv.technologies || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      for (const tech of directTechs) {
        if (coTokens.includes(tech) || companyContextText.includes(tech)) recallScore += 12;
      }
      if (recallScore > 0 || plausiblePairs.length < 12) {
        plausiblePairs.push({ candidate: cEv.deliverableName, company: coEv.atomicClaim.slice(0, 60), score: recallScore, cEv, coEv });
      }
    }
  }

  plausiblePairs.sort((a, b) => b.score - a.score);
  console.log('Top Pairs for SourceFuse (count:', plausiblePairs.length, '):');
  for (let i = 0; i < Math.min(8, plausiblePairs.length); i++) {
    const p = plausiblePairs[i];
    console.log(`[#${i}] Recall: ${p.score} | Cand: "${p.candidate}" | Comp: "${p.company}"`);
  }

  await app.close();
}

checkSfPairs().catch(console.error);
