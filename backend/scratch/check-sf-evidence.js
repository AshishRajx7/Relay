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

  console.log('SourceFuse Profile:');
  console.log('  companyName:', sf.companyName);
  console.log('  products:', sf.products);
  console.log('  techSignals:', sf.techSignals);
  console.log('  summary:', sf.summary);
  console.log('\nSourceFuse Evidence Count:', compEvs.length);
  for (const e of compEvs) {
    console.log(`  [${e.category}] ${e.atomicClaim}`);
  }

  console.log('\nCandidate Deliverables Sample:');
  for (const c of candEvs.filter(e => e.sourceType === 'RESUME_BULLET').slice(0, 10)) {
    console.log(`  - ${c.deliverableName}: ${c.atomicClaim}`);
  }

  await app.close();
}

checkSfPairs().catch(console.error);
