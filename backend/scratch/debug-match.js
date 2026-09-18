const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { CandidateMatchingService } = require('../dist/modules/outreach/services/candidate-matching.service');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { CompanyProfile } = require('../dist/modules/company-research/entities/company-profile.entity');
const { CandidateProfile } = require('../dist/modules/resume/entities/candidate-profile.entity');

async function debugMatch() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const matchingService = app.get(CandidateMatchingService);
  const companyRepo = app.get(getRepositoryToken(CompanyProfile));
  const candidateRepo = app.get(getRepositoryToken(CandidateProfile));

  const sf = await companyRepo.findOne({ where: { domain: 'sourcefuse.com' } });
  const ps = await companyRepo.findOne({ where: { domain: 'perennialsys.com' } });
  const ib = await companyRepo.findOne({ where: { domain: 'ibhubs.co' } });
  const cand = await candidateRepo.findOne({ where: { id: '7c8bc6f4-c8a0-4889-87ee-9628c8ef6772' } });

  console.log('Testing SourceFuse...');
  const resSf = await matchingService.matchCandidateToCompany(sf, cand.id);
  console.log('SourceFuse Result:', JSON.stringify(resSf, null, 2));

  console.log('\nTesting Perennial Systems...');
  const resPs = await matchingService.matchCandidateToCompany(ps, cand.id);
  console.log('Perennial Result:', JSON.stringify(resPs, null, 2));

  console.log('\nTesting iB Hubs...');
  const resIb = await matchingService.matchCandidateToCompany(ib, cand.id);
  console.log('iB Hubs Result:', JSON.stringify(resIb, null, 2));

  await app.close();
}

debugMatch().catch(console.error);
