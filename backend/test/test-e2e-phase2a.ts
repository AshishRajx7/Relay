import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { CampaignIngestionService } from '../src/modules/campaigns/services/campaign-ingestion.service';
import { ProspectsService } from '../src/modules/prospects/prospects.service';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function main() {
  console.log('Testing Phase 2A Campaign & Prospect Ingestion Pipeline End-to-End...\n');
  const app = await NestFactory.createApplicationContext(AppModule);

  const campaignsService = app.get(CampaignsService);
  const ingestionService = app.get(CampaignIngestionService);
  const prospectsService = app.get(ProspectsService);
  const candidateProfileRepo: Repository<CandidateProfile> = app.get(getRepositoryToken(CandidateProfile));

  // Find candidate profile
  const profile = await candidateProfileRepo.findOne({ where: { name: 'Ashish Raj' } });
  if (!profile) {
    throw new Error('Ashish Raj candidate profile not found. Please ensure Phase 1 candidate profile exists.');
  }

  console.log(`Using Candidate Profile: "${profile.name}" (ID: ${profile.id})`);

  // 1. Create a Campaign
  const campaign = await campaignsService.createCampaign({
    name: 'Q3 High-Growth Tech Outreach',
    candidateProfileId: profile.id,
  });
  console.log(`Created Campaign: "${campaign.name}" (ID: ${campaign.id})`);

  // 2. Prepare sample CSV with corporate + free webmail
  const sampleCsv = `email,company
recruiting@stripe.com,Stripe
careers@linear.app,Linear
talent@vercel.com,Vercel
founder.contact@gmail.com,Personal Referral
recruiting@stripe.com,Duplicate Stripe`;

  const csvBuffer = Buffer.from(sampleCsv, 'utf-8');

  // 3. Ingest CSV file
  const ingestionResult = await ingestionService.ingestFile(
    campaign.id,
    csvBuffer,
    'prospects_list.csv',
    'text/csv',
  );

  console.log('\nIngestion Result Summary:');
  console.log(JSON.stringify(ingestionResult, null, 2));

  // 4. Query prospects
  const prospects = await prospectsService.findByCampaign(campaign.id);
  console.log(`\nPersisted Prospects in Campaign (${prospects.length} total):`);
  for (const p of prospects) {
    console.log(`  - [${p.sourceType}] ${p.email} | Domain: ${p.domain} | ResearchStatus: ${p.researchStatus}`);
  }

  await app.close();
  console.log('\n✅ Phase 2A E2E Campaign Ingestion Test Succeeded!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
