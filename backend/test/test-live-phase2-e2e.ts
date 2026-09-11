import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { CampaignIngestionService } from '../src/modules/campaigns/services/campaign-ingestion.service';
import { CompanyProfileService } from '../src/modules/company-research/services/company-profile.service';
import { EmailGenerationService } from '../src/modules/outreach/services/email-generation.service';
import { GmailDraftService } from '../src/modules/outreach/services/gmail-draft.service';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { Prospect } from '../src/modules/prospects/entities/prospect.entity';
import { EmailDraft } from '../src/modules/outreach/entities/email-draft.entity';
import { DraftReasoning } from '../src/modules/outreach/entities/draft-reasoning.entity';
import { DraftQuality } from '../src/modules/outreach/entities/draft-quality.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function runLiveE2E() {
  console.log('🚀 Bootstrapping NestJS Live Context for Phase 2 AI Outreach Draft Engine...\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });

  const campaignsService = app.get(CampaignsService);
  const ingestionService = app.get(CampaignIngestionService);
  const companyProfileService = app.get(CompanyProfileService);
  const emailGenerationService = app.get(EmailGenerationService);
  const gmailDraftService = app.get(GmailDraftService);

  const candidateRepo: Repository<CandidateProfile> = app.get(getRepositoryToken(CandidateProfile));
  const prospectRepo: Repository<Prospect> = app.get(getRepositoryToken(Prospect));
  const draftRepo: Repository<EmailDraft> = app.get(getRepositoryToken(EmailDraft));
  const reasoningRepo: Repository<DraftReasoning> = app.get(getRepositoryToken(DraftReasoning));
  const qualityRepo: Repository<DraftQuality> = app.get(getRepositoryToken(DraftQuality));

  // 1. Get or create candidate profile
  let candidate = await candidateRepo.findOne({ where: {} });
  if (!candidate) {
    candidate = candidateRepo.create({
      name: 'Ashish Raj',
      email: 'ashishrajcr7@gmail.com',
      title: 'Software Engineer',
      totalYearsExperience: 2.6,
      skills: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'BullMQ', 'Docker', 'OpenTelemetry'],
    });
    candidate = await candidateRepo.save(candidate);
  }
  console.log(`👤 Candidate Profile: ${candidate.name} (${candidate.title}, ${candidate.totalYearsExperience} yrs exp)`);

  // 2. Create Campaign
  const campaign = await campaignsService.createCampaign({
    name: 'Q3 Fast-Growing Scaleups Engineering Outreach',
    candidateProfileId: candidate.id,
  });
  console.log(`📁 Created Campaign: "${campaign.name}" (ID: ${campaign.id})`);

  // 3. Ingest CSV with engineering contact
  const csvData = `email,company\ncto@resend.com,Resend\nengineering@linear.app,Linear\n`;
  const csvBuffer = Buffer.from(csvData, 'utf-8');

  const ingestRes = await ingestionService.ingestFile(
    campaign.id,
    csvBuffer,
    'scaleups.csv',
    'text/csv',
  );
  console.log(`📥 Ingestion Result: Parsed ${ingestRes.totalParsed} | Created ${ingestRes.totalCreated} prospects`);

  // 4. Research Linear
  console.log('\n🔍 Running Company Intelligence for linear.app...');
  const companyProfile = await companyProfileService.researchAndSaveCompany('linear.app', 'Linear');
  console.log(`🏢 Researched Company: "${companyProfile.companyName}" | Score: ${companyProfile.researchScore}/100`);
  console.log(`   Summary: ${companyProfile.summary?.slice(0, 100)}...`);
  console.log(`   Tech Signals: ${companyProfile.techSignals?.join(', ')}`);

  // 5. Generate AI Personalized Draft
  const prospect = await prospectRepo.findOne({ where: { campaignId: campaign.id, domain: 'linear.app' } });
  if (!prospect) throw new Error('Prospect linear.app not found');

  console.log(`\n🤖 Generating AI Multi-Variant Outreach for ${prospect.email} (${prospect.contactType})...`);
  const generatedResult = await emailGenerationService.generatePersonalizedDraft(
    prospect,
    companyProfile,
    candidate,
  );

  console.log(`\n================ GENERATED DRAFT ================`);
  console.log(`Selected Variant: ${generatedResult.selectedVariantType}`);
  console.log(`Subject: ${generatedResult.subject}`);
  console.log(`Body:\n${generatedResult.body}`);
  console.log(`Word Count: ${generatedResult.body.split(/\s+/).filter(Boolean).length} words`);
  console.log(`---------------- QUALITY SCORECARD ----------------`);
  console.log(`Personalization: ${generatedResult.quality.personalizationScore}/100`);
  console.log(`Relevance:       ${generatedResult.quality.relevanceScore}/100`);
  console.log(`Spam Risk:       ${generatedResult.quality.spamRiskScore}/100`);
  console.log(`Tech Alignment:  ${generatedResult.quality.technicalAlignmentScore}/100`);
  console.log(`Confidence:      ${generatedResult.quality.confidenceScore}/100`);
  console.log(`Requires Review: ${generatedResult.quality.requiresManualReview}`);
  console.log(`---------------- EXPLAINABILITY -------------------`);
  console.log(`Chosen Project:  ${generatedResult.matchResult.chosenProject}`);
  console.log(`Why Company:     ${generatedResult.whyCompany}`);
  console.log(`Why Me:          ${generatedResult.whyMe}`);
  console.log(`Why Relevant:    ${generatedResult.whyRelevant}`);
  console.log(`Top 3 Matches:   ${JSON.stringify(generatedResult.matchResult.rankedMatches)}`);
  console.log(`===================================================\n`);

  // 6. Save Draft & Entities to PostgreSQL
  const draft = draftRepo.create({
    prospectId: prospect.id,
    subject: generatedResult.subject,
    body: generatedResult.body,
  });
  const savedDraft = await draftRepo.save(draft);

  const reasoning = reasoningRepo.create({
    emailDraftId: savedDraft.id,
    chosenProject: generatedResult.matchResult.chosenProject,
    matchScore: generatedResult.matchResult.matchScore,
    whyCompany: generatedResult.whyCompany,
    whyMe: generatedResult.whyMe,
    whyNow: generatedResult.whyNow,
    whyRelevant: generatedResult.whyRelevant,
    matchedTechnologies: generatedResult.matchResult.matchedTechnologies,
    rankedMatches: generatedResult.matchResult.rankedMatches,
    confidenceLevel: generatedResult.confidenceLevel,
  });
  await reasoningRepo.save(reasoning);

  const quality = qualityRepo.create({
    emailDraftId: savedDraft.id,
    personalizationScore: generatedResult.quality.personalizationScore,
    relevanceScore: generatedResult.quality.relevanceScore,
    spamRiskScore: generatedResult.quality.spamRiskScore,
    technicalAlignmentScore: generatedResult.quality.technicalAlignmentScore,
    confidenceScore: generatedResult.quality.confidenceScore,
    requiresManualReview: generatedResult.quality.requiresManualReview,
    flags: generatedResult.quality.flags,
  });
  await qualityRepo.save(quality);

  // 7. Create Gmail Draft
  console.log('✉️ Creating Gmail Draft...');
  const gmailResult = await gmailDraftService.createDraft(
    prospect.email,
    savedDraft.subject,
    savedDraft.body,
  );
  console.log(`✅ Gmail Draft Created! Draft ID: ${gmailResult.gmailDraftId}`);

  await app.close();
  console.log('\n🎉 E2E LIVE PIPELINE COMPLETED SUCCESSFULLY!\n');
}

runLiveE2E().catch((err) => {
  console.error('E2E Run Failed:', err);
  process.exit(1);
});
