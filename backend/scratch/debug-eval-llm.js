const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { CandidateMatchingService } = require('../dist/modules/outreach/services/candidate-matching.service');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { CompanyProfile } = require('../dist/modules/company-research/entities/company-profile.entity');
const { CandidateProfile } = require('../dist/modules/resume/entities/candidate-profile.entity');

async function debug() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const matchingService = app.get(CandidateMatchingService);
  const companyRepo = app.get(getRepositoryToken(CompanyProfile));
  const candidateRepo = app.get(getRepositoryToken(CandidateProfile));

  const ps = await companyRepo.findOne({ where: { domain: 'perennialsys.com' } });
  const cand = await candidateRepo.findOne({ where: { id: '7c8bc6f4-c8a0-4889-87ee-9628c8ef6772' } });

  console.log('Testing Perennial Systems in matchingService...');
  const res = await matchingService.matchCandidateToCompany(ps, cand.id);
  console.log('Final Result:', JSON.stringify(res, null, 2));

  await app.close();
}

debug().catch(console.error);
