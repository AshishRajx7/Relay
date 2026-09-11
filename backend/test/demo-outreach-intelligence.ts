import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OutreachIntelligenceService } from '../src/modules/outreach/services/outreach-intelligence.service';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { CompanyProfile } from '../src/modules/company-research/entities/company-profile.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function main() {
  console.log('Running Deep AI Outreach Intelligence & Personalization Live Demonstration...\n');
  const app = await NestFactory.createApplicationContext(AppModule);

  const intelligenceService = app.get(OutreachIntelligenceService);
  const candidateProfileRepo: Repository<CandidateProfile> = app.get(getRepositoryToken(CandidateProfile));
  const companyProfileRepo: Repository<CompanyProfile> = app.get(getRepositoryToken(CompanyProfile));

  // 1. Fetch Candidate Profile (Ashish Raj)
  const candidate = await candidateProfileRepo.findOne({ where: { name: 'Ashish Raj' } });
  if (!candidate) throw new Error('Ashish Raj profile not found');

  // 2. Fetch Researched Company (Linear)
  const company = await companyProfileRepo.findOne({ where: { domain: 'linear.app' } });
  if (!company) throw new Error('Linear company profile not found');

  const prospectEmail = 'cto@linear.app';

  console.log(`Prospect: ${prospectEmail}`);
  console.log(`Target Company: ${company.companyName} (${company.domain})`);
  console.log(`Candidate: ${candidate.name} (${candidate.title})\n`);

  // 3. Generate Deep Outreach Intelligence
  const result = await intelligenceService.generateOutreachIntelligence(
    prospectEmail,
    company,
    candidate,
  );

  console.log('================================================================');
  console.log('🏆 COMPLETE OUTREACH INTELLIGENCE OUTPUT:');
  console.log('================================================================');
  console.log(JSON.stringify(result, null, 2));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
