const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AIProviderService } = require('../dist/modules/ai-provider/ai-provider.service');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { CompanyProfile } = require('../dist/modules/company-research/entities/company-profile.entity');
const { CompanyEvidenceEntity } = require('../dist/modules/company-research/entities/company-evidence.entity');
const { CandidateEvidenceEntity } = require('../dist/modules/resume/entities/candidate-evidence.entity');

async function testLlmEvaluations() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const companyRepo = app.get(getRepositoryToken(CompanyProfile));
  const compEvRepo = app.get(getRepositoryToken(CompanyEvidenceEntity));
  const candEvRepo = app.get(getRepositoryToken(CandidateEvidenceEntity));
  const aiProviderService = app.get(AIProviderService);

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

  const systemPrompt = `You are a Principal Technical Matchmaker evaluating the genuine technical and architectural relationship between a software engineer's first-hand verified accomplishments and a company's technical initiatives.

Evaluate each candidate ↔ company pair across explicit qualitative criteria:
1. directness: "DIRECT" | "INDIRECT" | "ANALOGOUS"
2. evidenceSpecificity: "HIGH" | "MEDIUM" | "LOW"
3. candidateOwnership: "PRIMARY" | "CONTRIBUTOR" | "SUPPORTING"
4. companyEvidenceStrength: "CLEAR_ACUTE_NEED" | "GENERAL_TECH" | "SPECULATIVE"
   - CLEAR_ACUTE_NEED: Company is building or solving a specific product or engineering initiative (e.g. building a compliance/regtech platform, SaaS accelerators, multi-tenant authorization, queue infrastructure, order workflows, AI platform).
   - GENERAL_TECH: Company merely lists standard baseline tools (Node.js, PostgreSQL, AWS, Docker, HTML5) without an initiative or product challenge.
   - SPECULATIVE: Unverified or vague technical claim.
5. architecturalCorrespondence: "EXACT_PARALLEL" | "SIMILAR_CLASS" | "DIVERGENT"
   - EXACT_PARALLEL: Solves the exact same engineering challenge or system class.
   - SIMILAR_CLASS: Related backend architecture or infrastructure pattern (e.g. compliance platforms ↔ audit trails/activity logging; enterprise platforms ↔ platform services).
   - DIVERGENT: Fundamentally different technical domain or problem space (e.g. GPU kernels vs web storefront).
6. genericOverlapOnly: boolean
   - TRUE ONLY IF the overlap is solely generic buzzwords or baseline tooling (e.g. both simply mention AWS, React, Python, or SQL) with NO architectural pattern or product challenge in common.
   - FALSE whenever there is a genuine architectural or domain connection (e.g. regtech/compliance platforms, audit logging, authorization systems, event-driven services, queue infrastructure, API integration, or data workflows).
   - If genericOverlapOnly is true, set relationshipQuality to "DISQUALIFIED_GENERIC_OVERLAP" and rankingScore <= 35.
7. relationshipQuality: "HIGH" | "MODERATE" | "WEAK" | "DISQUALIFIED_GENERIC_OVERLAP"
   - HIGH: Direct architectural match with CLEAR_ACUTE_NEED and high specificity.
   - MODERATE: Plausible architectural correspondence with genuine technical substance (e.g. similar class infrastructure, indirect/analogous problem-space alignment like microservices, event-driven pipelines, audit logging, or compliance systems).
   - WEAK: Tenuous or indirect connection with minimal technical substance.
   - DISQUALIFIED_GENERIC_OVERLAP: Company is standard agency/general tech or match is based only on basic programming languages/databases.
8. analyticalRationale: Concise 1-2 sentence explanation evaluating the EXACT candidate claim and company claim in this pair.
9. rankingScore: Integer 0-100:
   - 80-100: HIGH quality match on acute architectural parallel
   - 65-79: MODERATE quality match with genuine architectural substance
   - 40-64: WEAK connection
   - 0-39: Generic tech overlap or disqualified

Output pure JSON conforming to:
{
  "evaluations": [
    {
      "pairIndex": 0,
      "directness": "DIRECT",
      "evidenceSpecificity": "HIGH",
      "candidateOwnership": "PRIMARY",
      "companyEvidenceStrength": "CLEAR_ACUTE_NEED",
      "architecturalCorrespondence": "SIMILAR_CLASS",
      "genericOverlapOnly": false,
      "relationshipQuality": "MODERATE",
      "analyticalRationale": "Event-driven audit logging and Activity Log platform corresponds directly to compliance platform requirements.",
      "rankingScore": 85
    }
  ]
}`;

  const res = await aiProviderService.structuredComplete({
    systemPrompt,
    userPrompt: `COMPANY: ${sf.companyName} (${sf.industry}, ${sf.businessModel})\nPAIRS TO EVALUATE:\n${JSON.stringify(pairSummaries, null, 2)}`,
    feature: 'OUTREACH_GENERATION',
    maxTokens: 1500,
    temperature: 0.1,
  });

  console.log('Evaluations from LLM:');
  console.log(JSON.stringify(res.data.evaluations, null, 2));

  await app.close();
}

testLlmEvaluations().catch(console.error);
