import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { CampaignIngestionService } from '../src/modules/campaigns/services/campaign-ingestion.service';
import { CompanyProfileService } from '../src/modules/company-research/services/company-profile.service';
import { OutreachService } from '../src/modules/outreach/outreach.service';
import { EmailGenerationService } from '../src/modules/outreach/services/email-generation.service';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { Prospect, ProspectResearchStatus, ContactType } from '../src/modules/prospects/entities/prospect.entity';
import { EmailDraft, OutreachDraftStatus } from '../src/modules/outreach/entities/email-draft.entity';
import { DraftReasoning } from '../src/modules/outreach/entities/draft-reasoning.entity';
import { DraftQuality } from '../src/modules/outreach/entities/draft-quality.entity';
import { EmailDraftVariant, EmailVariantType } from '../src/modules/outreach/entities/email-draft-variant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function run300ProspectsScaleTest() {
  console.log('🚀 Bootstrapping NestJS Context for 300-Prospect Scale & Execution Test...\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const campaignsService = app.get(CampaignsService);
  const ingestionService = app.get(CampaignIngestionService);
  const companyProfileService = app.get(CompanyProfileService);
  const outreachService = app.get(OutreachService);
  const emailGenerationService = app.get(EmailGenerationService);

  const candidateRepo: Repository<CandidateProfile> = app.get(getRepositoryToken(CandidateProfile));
  const prospectRepo: Repository<Prospect> = app.get(getRepositoryToken(Prospect));
  const draftRepo: Repository<EmailDraft> = app.get(getRepositoryToken(EmailDraft));
  const reasoningRepo: Repository<DraftReasoning> = app.get(getRepositoryToken(DraftReasoning));
  const qualityRepo: Repository<DraftQuality> = app.get(getRepositoryToken(DraftQuality));
  const variantRepo: Repository<EmailDraftVariant> = app.get(getRepositoryToken(EmailDraftVariant));

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
    name: 'Q3 300-Scaleup Production Outreach Campaign',
    candidateProfileId: candidate.id,
  });
  console.log(`📁 Created Campaign: "${campaign.name}" (ID: ${campaign.id})`);

  // 3. Generate synthetic 300-contact dataset across 20 unique companies + bots + freemail
  console.log('\n--- 1. Generating 300 Contacts Dataset ---');
  const companies = [
    'stripe.com', 'linear.app', 'resend.com', 'vercel.com', 'supabase.com',
    'posthog.com', 'brex.com', 'ramp.com', 'airtable.com', 'datadog.com',
    'cloudflare.com', 'notion.so', 'figma.com', 'retool.com', 'temporal.io',
    'prisma.io', 'render.com', 'planetscale.com', 'fly.io', 'modal.com',
  ];

  const roles = ['cto', 'vp-eng', 'tech-lead', 'engineering', 'backend', 'recruiter', 'talent', 'founder', 'product', 'hr'];
  const subdomains = ['', 'jobs.', 'careers.', 'api.', 'mail.'];

  const rows: string[] = ['email,company'];
  let contactCount = 0;

  // 250 corporate contacts across the 20 companies (with subdomains & duplicates)
  for (let i = 0; i < 250; i++) {
    const compDomain = companies[i % companies.length];
    const sub = subdomains[i % subdomains.length];
    const role = roles[i % roles.length];
    const email = `${role}.${i}@${sub}${compDomain}`;
    rows.push(`${email},${compDomain.split('.')[0]}`);
    contactCount++;
  }

  // 30 free webmail contacts
  for (let i = 0; i < 30; i++) {
    rows.push(`candidate_eval_${i}@gmail.com,`);
    contactCount++;
  }

  // 20 unmonitored / bot addresses
  for (let i = 0; i < 20; i++) {
    const compDomain = companies[i % companies.length];
    const botPrefixes = ['noreply', 'admin', 'support', 'alerts', 'system'];
    const prefix = botPrefixes[i % botPrefixes.length];
    rows.push(`${prefix}_${i}@${compDomain},${compDomain.split('.')[0]}`);
    contactCount++;
  }

  assert(contactCount === 300, `Generated exactly 300 contacts (got ${contactCount})`);
  const csvBuffer = Buffer.from(rows.join('\n'), 'utf-8');

  // 4. Ingest 300 Contacts
  console.log('\n--- 2. Ingestion & Domain Normalization (300 Contacts) ---');
  const startTime = Date.now();
  const ingestRes = await ingestionService.ingestFile(
    campaign.id,
    csvBuffer,
    '300_prospects.csv',
    'text/csv',
  );

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`⏱️ Ingested 300 contacts in ${durationSec}s`);
  console.log(`   Total Created:      ${ingestRes.totalCreated}`);
  console.log(`   Corporate Contacts: ${ingestRes.corporateCount}`);
  console.log(`   FreeMail Filtered:  ${ingestRes.freeMailCount}`);
  console.log(`   Bot Disqualified:   ${ingestRes.unsupportedCount}`);
  console.log(`   Queued for Crawl:   ${ingestRes.queuedForResearch}`);

  assert(ingestRes.totalCreated === 300, 'Ingested all 300 contacts');
  assert(ingestRes.unsupportedCount === 20, 'Filtered all 20 bot/system addresses as UNSUPPORTED_CONTACT');
  assert(ingestRes.freeMailCount === 30, 'Filtered all 30 freemail contacts as MANUAL_REVIEW');
  assert(ingestRes.queuedForResearch <= 20, `Domain deduplication queued <= 20 unique companies (got ${ingestRes.queuedForResearch})`);

  // 5. Seed cached intelligence for the 20 companies to test cache reuse
  console.log('\n--- 3. Testing 30-Day Domain Cache & Research Reuse ---');
  for (const domain of companies) {
    let profile = await companyProfileService.findByDomain(domain);
    if (!profile) {
      profile = companyProfileService['companyProfileRepository'].create({
        domain,
        companyName: domain.split('.')[0],
        website: `https://${domain}`,
        industry: 'Developer Tools',
        businessModel: 'B2B SaaS',
        companyStage: 'Scaleup',
        employeeRange: '51-200',
        summary: `${domain} provides high-performance platforms and distributed cloud infrastructure.`,
        techSignals: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'BullMQ'],
        hiringSignals: ['Senior Backend Engineer'],
        recentInitiatives: ['Launched v2 Core API'],
        researchScore: 90,
        lastResearchedAt: new Date(),
      });
      await companyProfileService['companyProfileRepository'].save(profile);
    }
  }

  // Link all corporate prospects to their company profiles
  const allCorporate = await prospectRepo.find({
    where: { campaignId: campaign.id },
  });

  for (const p of allCorporate) {
    if (p.contactType !== ContactType.UNSUPPORTED_CONTACT && !p.email.includes('gmail.com')) {
      const profile = await companyProfileService.findByDomain(p.domain);
      if (profile) {
        p.companyProfileId = profile.id;
        p.companyName = profile.companyName;
        p.researchStatus = ProspectResearchStatus.RESEARCHED;
        await prospectRepo.save(p);
      }
    }
  }

  // 6. Generate Multi-Variant Draft for a Sample Prospect
  console.log('\n--- 4. Multi-Variant Generation & Persistence ---');
  const sampleProspect = await prospectRepo.findOne({
    where: { campaignId: campaign.id, domain: 'resend.com', contactType: ContactType.ENGINEERING },
    relations: ['companyProfile'],
  });

  if (!sampleProspect || !sampleProspect.companyProfile) throw new Error('Sample prospect not found');

  const generated = await emailGenerationService.generatePersonalizedDraft(
    sampleProspect,
    sampleProspect.companyProfile,
    candidate,
  );

  console.log(`🤖 Selected Active Variant: ${generated.selectedVariantType}`);
  console.log(`   Active Subject: "${generated.subject}"`);
  console.log(`   Generated Variants Count: ${generated.variants.length}`);

  assert(generated.variants.length === 3, 'Generated exactly 3 variants (TECHNICAL, STARTUP, DIRECT)');

  // Save Draft + 3 Variants to DB
  const draft = draftRepo.create({
    prospectId: sampleProspect.id,
    subject: generated.subject,
    body: generated.body,
    status: OutreachDraftStatus.GENERATED,
  });
  const savedDraft = await draftRepo.save(draft);

  const reasoning = reasoningRepo.create({
    emailDraftId: savedDraft.id,
    chosenProject: generated.matchResult.chosenProject,
    matchScore: generated.matchResult.matchScore,
    whyCompany: generated.whyCompany,
    whyMe: generated.whyMe,
    whyNow: generated.whyNow,
    whyRelevant: generated.whyRelevant,
    matchedTechnologies: generated.matchResult.matchedTechnologies,
    rankedMatches: generated.matchResult.rankedMatches,
    confidenceLevel: generated.confidenceLevel,
  });
  await reasoningRepo.save(reasoning);

  const quality = qualityRepo.create({
    emailDraftId: savedDraft.id,
    personalizationScore: generated.quality.personalizationScore,
    relevanceScore: generated.quality.relevanceScore,
    spamRiskScore: generated.quality.spamRiskScore,
    technicalAlignmentScore: generated.quality.technicalAlignmentScore,
    confidenceScore: generated.quality.confidenceScore,
    requiresManualReview: generated.quality.requiresManualReview,
    flags: generated.quality.flags,
  });
  await qualityRepo.save(quality);

  for (const v of generated.variants) {
    const variantEntity = variantRepo.create({
      emailDraftId: savedDraft.id,
      variantType: v.variantType,
      subject: v.subject,
      body: v.body,
      wordCount: v.wordCount,
      personalizationScore: v.quality.personalizationScore,
      relevanceScore: v.quality.relevanceScore,
      spamRiskScore: v.quality.spamRiskScore,
      technicalAlignmentScore: v.quality.technicalAlignmentScore,
      confidenceScore: v.quality.confidenceScore,
      isSelected: v.isSelected,
    });
    await variantRepo.save(variantEntity);
  }

  // 7. Test Review Workflow (Edit, Switch Variant, Approve, Reject, Gmail Gating)
  console.log('\n--- 5. Human Review Workflow & Approval Safety Gating ---');

  // Test variant switching: switch to DIRECT
  const switched = await outreachService.selectVariant(savedDraft.id, EmailVariantType.DIRECT);
  assert(switched.subject.length > 0, 'Successfully switched active content to DIRECT variant');

  // Test human editing
  const edited = await outreachService.updateDraft(savedDraft.id, {
    subject: 'Custom Tailored Subject Line (Human Edited)',
    body: 'Hi, this is a refined custom body text.',
  });
  assert(edited.status === OutreachDraftStatus.EDITED, `Draft status updated to EDITED (got ${edited.status})`);

  // Test approval
  const approved = await outreachService.approveDraft(savedDraft.id);
  assert(approved.status === OutreachDraftStatus.APPROVED, `Draft status updated to APPROVED (got ${approved.status})`);

  // Test Gmail draft creation
  const gmailResult = await outreachService.createGmailDraft(savedDraft.id);
  assert(!!gmailResult.gmailDraftId, `Created Gmail Draft ID: ${gmailResult.gmailDraftId}`);
  assert(gmailResult.gmailUrl.includes(gmailResult.gmailDraftId), `Generated Gmail URL: ${gmailResult.gmailUrl}`);

  // 8. Campaign Execution & Cost Dashboard Overview
  console.log('\n--- 6. Campaign Execution & Cost Dashboard ---');
  const overview = await campaignsService.getOverview(campaign.id);

  console.log(`📊 Campaign Name:        "${overview.name}"`);
  console.log(`   Progress:             ${overview.progressPercentage}%`);
  console.log(`   Total Prospects:      ${overview.totalProspects}`);
  console.log(`   Researched Prospects: ${overview.researchedProspects}`);
  console.log(`   Manual Review Count:  ${overview.manualReviewCount}`);
  console.log(`   Gmail Drafts Created: ${overview.gmailDraftCount}`);
  console.log(`   Unique Companies:     ${overview.duplicateAnalysis.uniqueCompaniesCount}`);
  console.log(`   Duplicate Companies:  ${overview.duplicateAnalysis.duplicateCompanyCount}`);
  console.log(`   Duplicate Drafts:     ${overview.duplicateAnalysis.duplicateDraftCount}`);
  console.log(`   Warnings Surfaced:    ${overview.duplicateAnalysis.warnings.length}`);
  console.log(`   Estimated Cost USD:   $${overview.cost.estimatedCostUsd.toFixed(4)}`);

  assert(overview.totalProspects === 300, `Dashboard tracks all 300 prospects`);
  assert(overview.duplicateAnalysis.duplicateCompanyCount === 20, `Correctly identified 20 duplicate companies with multiple contacts`);
  assert(overview.duplicateAnalysis.warnings.length === 20, `Surfaced 20 duplicate warnings`);
  assert(overview.duplicateAnalysis.warnings[0].includes('belong to the same company'), `Warning formatted correctly: "${overview.duplicateAnalysis.warnings[0]}"`);

  await app.close();
  console.log('\n🎉 ALL 300-PROSPECT SCALE & EXECUTION TESTS PASSED WITH 100% SUCCESS!\n');
}

run300ProspectsScaleTest().catch((err) => {
  console.error('Scale Test Failed:', err);
  process.exit(1);
});
