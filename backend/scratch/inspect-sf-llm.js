const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { CandidateMatchingService } = require('../dist/modules/outreach/services/candidate-matching.service');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { CompanyProfile } = require('../dist/modules/company-research/entities/company-profile.entity');
const { CompanyEvidenceEntity } = require('../dist/modules/company-research/entities/company-evidence.entity');
const { CandidateEvidenceEntity } = require('../dist/modules/resume/entities/candidate-evidence.entity');

async function inspectSfEvaluations() {
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
        plausiblePairs.push({ candidateEv: cEv, companyEv: coEv, recallScore });
      }
    }
  }

  plausiblePairs.sort((a, b) => b.recallScore - a.recallScore);
  const topPairs = plausiblePairs.slice(0, 6);

  const pairSummaries = topPairs.map((p, idx) => ({
    pairIndex: idx,
    candidateDeliverable: p.candidateEv.deliverableName,
    candidateClaim: p.candidateEv.atomicClaim,
    candidateRole: p.candidateEv.experience?.roleTitle || 'Engineer',
    candidateEmployer: p.candidateEv.experience?.employer || 'Previous Employer',
    candidateTechnologies: p.candidateEv.technologies,
    companyQuote: p.companyEv.verbatimQuote,
    companyClaim: p.companyEv.atomicClaim,
  }));

  console.log('Pair Summaries sent to LLM:');
  pairSummaries.forEach(p => console.log(`[#${p.pairIndex}] Cand: "${p.candidateDeliverable}" | Comp: "${p.companyClaim.slice(0, 50)}"`));

  await app.close();
}

inspectSfEvaluations().catch(console.error);
