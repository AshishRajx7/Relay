import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ResumeParserService } from '../src/modules/resume/resume-parser.service';
import { CandidateMatchingService } from '../src/modules/outreach/services/candidate-matching.service';
import { DraftVerificationService } from '../src/modules/outreach/services/draft-verification.service';
import { CompanyProfileService } from '../src/modules/company-research/services/company-profile.service';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { CandidateExperienceEntity } from '../src/modules/resume/entities/candidate-experience.entity';
import { CandidateEvidenceEntity } from '../src/modules/resume/entities/candidate-evidence.entity';
import { CompanyProfile } from '../src/modules/company-research/entities/company-profile.entity';
import { CompanySource } from '../src/modules/company-research/entities/company-source.entity';
import { CompanyEvidenceEntity } from '../src/modules/company-research/entities/company-evidence.entity';
import { Prospect, ProspectDraftStatus, ProspectResearchStatus, NoOutreachAngleReason } from '../src/modules/prospects/entities/prospect.entity';
import { Campaign, CampaignStatus } from '../src/modules/campaigns/entities/campaign.entity';
import { EmailDraft, OutreachDraftStatus } from '../src/modules/outreach/entities/email-draft.entity';
import {
  FIXTURE_A_AUTH_PLATFORM,
  FIXTURE_B_EVENT_QUEUE_PLATFORM,
  FIXTURE_C_COMMERCE_PRODUCT,
  FIXTURE_D_GENERIC_STACK,
  FIXTURE_E_AIML_INFRA,
  FIXTURE_F_UNRELATED_DOMAIN,
  FIXTURE_G_EMPTY_RESEARCH,
  FIXTURE_H_TRANSIENT_FAILURE,
  ScenarioFixtureData,
} from './fixtures/companies/generalized-scenarios.fixture';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as assert from 'assert';

async function runGeneralizationSuite() {
  console.log('\n=============================================================');
  console.log('    RELAY V3 GENERALIZATION & MULTI-COMPANY EVALUATION PASS  ');
  console.log('=============================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const resumeParser = app.get(ResumeParserService);
  const matchingService = app.get(CandidateMatchingService);
  const verifierService = app.get(DraftVerificationService);
  const companyProfileService = app.get(CompanyProfileService);

  const profileRepo: Repository<CandidateProfile> = app.get(getRepositoryToken(CandidateProfile));
  const expRepo: Repository<CandidateExperienceEntity> = app.get(getRepositoryToken(CandidateExperienceEntity));
  const candEvidenceRepo: Repository<CandidateEvidenceEntity> = app.get(getRepositoryToken(CandidateEvidenceEntity));
  const companyProfileRepo: Repository<CompanyProfile> = app.get(getRepositoryToken(CompanyProfile));
  const sourceRepo: Repository<CompanySource> = app.get(getRepositoryToken(CompanySource));
  const compEvidenceRepo: Repository<CompanyEvidenceEntity> = app.get(getRepositoryToken(CompanyEvidenceEntity));
  const prospectRepo: Repository<Prospect> = app.get(getRepositoryToken(Prospect));
  const campaignRepo: Repository<Campaign> = app.get(getRepositoryToken(Campaign));
  const draftRepo: Repository<EmailDraft> = app.get(getRepositoryToken(EmailDraft));

  let passedTests = 0;
  const totalTests = 8;

  // Helper to persist a test company fixture
  async function seedCompanyFixture(fixture: ScenarioFixtureData): Promise<CompanyProfile> {
    let company = await companyProfileRepo.findOne({ where: { domain: fixture.domain } });
    if (!company) {
      company = companyProfileRepo.create({
        domain: fixture.domain,
        companyName: fixture.companyName,
        website: fixture.website,
        industry: fixture.industry,
        businessModel: fixture.businessModel,
        companyStage: fixture.companyStage,
        employeeRange: fixture.employeeRange,
        summary: fixture.summary,
        products: fixture.products,
        techSignals: fixture.techSignals,
        hiringSignals: fixture.hiringSignals,
        recentInitiatives: fixture.recentInitiatives,
      });
      company = await companyProfileRepo.save(company);
    } else {
      company.summary = fixture.summary;
      company.products = fixture.products;
      company.techSignals = fixture.techSignals;
      company.hiringSignals = fixture.hiringSignals;
      company = await companyProfileRepo.save(company);
    }

    // Seed or update source
    let source = await sourceRepo.findOne({ where: { companyProfileId: company.id } });
    if (!source) {
      source = sourceRepo.create({
        companyProfileId: company.id,
        url: fixture.website,
        section: 'HOMEPAGE',
        rawMarkdown: `# ${fixture.companyName}\n${fixture.summary}\n${fixture.evidence.map((e) => e.quote).join('\n')}`,
        contentHash: `hash_${fixture.domain}`,
        retrievedAt: new Date(),
        wordCount: 150,
      });
      source = await sourceRepo.save(source);
    }

    // Seed evidence quotes
    await compEvidenceRepo.delete({ companyProfileId: company.id });
    for (const ev of fixture.evidence) {
      const coEv = compEvidenceRepo.create({
        companyProfileId: company.id,
        sourceId: source.id,
        sourceUrl: ev.url,
        verbatimQuote: ev.quote,
        atomicClaim: ev.quote,
        category: 'CUSTOMER_PROBLEM',
        confidence: 1.0,
        isSourceFact: true,
      });
      await compEvidenceRepo.save(coEv);
    }

    return company;
  }

  try {
    // -------------------------------------------------------------
    // PREPARATION: Load Candidate Profile & Verify Decomposed Evidence
    // -------------------------------------------------------------
    console.log('[TEST 1] Verifying Candidate Evidence Provenance & Atomic Claim Decomposition...');
    await resumeParser.backfillAllCandidateProfiles(true);

    const candidateProfile = await profileRepo.findOne({ where: {} });
    assert.ok(candidateProfile, 'A valid candidate profile must exist in the database');

    const experiences = await expRepo.find({ where: { candidateProfileId: candidateProfile.id } });
    assert.ok(experiences.length >= 3, `Expected at least 3 distinct roles, found ${experiences.length}`);

    const allCandidateEvidence = await candEvidenceRepo.find({
      where: { candidateProfileId: candidateProfile.id },
      relations: ['experience'],
    });

    const bulletEvidence = allCandidateEvidence.filter((e) => e.sourceType === 'RESUME_BULLET');
    assert.ok(bulletEvidence.length >= 5, `Expected >= 5 decomposed bullet claims, found ${bulletEvidence.length}`);

    // Verify rawBulletText vs atomicClaim separation
    for (const bev of bulletEvidence) {
      assert.ok(bev.rawBulletText && bev.rawBulletText.trim().length > 10, 'rawBulletText must contain source fact');
      assert.ok(bev.atomicClaim && bev.atomicClaim.trim().length > 10, 'atomicClaim must contain normalized claim');
      assert.ok(bev.experienceId, 'Experience-backed claim must reference valid experienceId');
      assert.strictEqual(bev.isSourceFact, false, 'atomicClaim is a normalized claim, not raw source fact');
    }

    // Verify D'Rons is isolated as Founder experience
    const dronsExp = experiences.find((e) => e.employer.toLowerCase().includes("d'rons"));
    assert.ok(dronsExp, "D'Rons must exist as a distinct candidate experience");
    assert.strictEqual(dronsExp.tenureType, 'FOUNDER');

    const dronsEvidence = bulletEvidence.filter((e) => e.experienceId === dronsExp.id);
    assert.ok(dronsEvidence.length >= 1, "D'Rons must have normalized evidence claims");

    // Verify Ninja Studio experiences are distinct
    const ninjaIntern = experiences.find((e) => e.employer.toLowerCase().includes('ninja') && e.tenureType === 'INTERNSHIP');
    const ninjaSwe = experiences.find((e) => e.employer.toLowerCase().includes('ninja') && e.tenureType === 'FULL_TIME');
    assert.ok(ninjaIntern, 'The Ninja Studio internship must exist');
    assert.ok(ninjaSwe, 'The Ninja Studio full-time SWE must exist');

    console.log(`  ✓ Provenance intact: ${bulletEvidence.length} atomic claims across 3 distinct roles.`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 2: Company A (Authorization / Security Platform) Evaluation
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Evaluating Company A (Identity / Auth Platform)...');
    const companyA = await seedCompanyFixture(FIXTURE_A_AUTH_PLATFORM);

    const matchA = await matchingService.matchCandidateToCompany(companyA, candidateProfile.id);
    assert.ok(matchA.match !== null, 'Company A must match successfully');
    assert.ok(
      matchA.match.relationshipQuality === 'HIGH' || matchA.match.relationshipQuality === 'MODERATE',
      `Expected HIGH or MODERATE quality, got ${matchA.match.relationshipQuality}`,
    );
    assert.strictEqual(matchA.match.genericOverlapDetected, false, 'Must not be flagged as generic overlap');

    // Deliverable must be authorization / BranchGuard from Intern role
    const candEvA = matchA.candidateEvidence;
    assert.ok(candEvA, 'Candidate evidence must be populated');
    const candDeliverableA = (candEvA.deliverableName || candEvA.atomicClaim).toLowerCase();
    assert.ok(
      candDeliverableA.includes('branchguard') || candDeliverableA.includes('authoriz') || candDeliverableA.includes('access control'),
      `Company A should select authorization evidence (BranchGuard), got: ${candDeliverableA}`,
    );
    assert.strictEqual(
      candEvA.experience?.roleTitle,
      'Backend Engineering Intern',
      'BranchGuard must be attributed to Backend Engineering Intern role',
    );

    console.log(`  ✓ Company A matched authorization deliverable: "${candEvA.deliverableName}" (${candEvA.experience?.roleTitle}).`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 3: Company B (Distributed Event / Queue Platform) Evaluation
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Evaluating Company B (Distributed Event / Queue Platform)...');
    const companyB = await seedCompanyFixture(FIXTURE_B_EVENT_QUEUE_PLATFORM);

    const matchB = await matchingService.matchCandidateToCompany(companyB, candidateProfile.id);
    assert.ok(matchB.match !== null, 'Company B must match successfully');
    assert.ok(
      matchB.match.relationshipQuality === 'HIGH' || matchB.match.relationshipQuality === 'MODERATE',
      `Expected HIGH or MODERATE quality, got ${matchB.match.relationshipQuality}`,
    );
    assert.strictEqual(matchB.match.genericOverlapDetected, false, 'Must not be flagged as generic overlap');

    // Deliverable must be event-driven / BullMQ / Redis from SWE role
    const candEvB = matchB.candidateEvidence;
    assert.ok(candEvB, 'Candidate evidence must be populated');
    const candDeliverableB = (candEvB.deliverableName || candEvB.atomicClaim).toLowerCase();
    assert.ok(
      candDeliverableB.includes('bullmq') ||
        candDeliverableB.includes('redis') ||
        candDeliverableB.includes('activitylog') ||
        candDeliverableB.includes('queue') ||
        candDeliverableB.includes('event'),
      `Company B should select event/queue backend evidence, got: ${candDeliverableB}`,
    );
    assert.strictEqual(
      candEvB.experience?.employer,
      'The Ninja Studio',
      'Event/queue deliverable must be attributed to The Ninja Studio',
    );
    assert.ok(
      candEvB.experience?.roleTitle === 'Software Engineer' ||
        candEvB.experience?.roleTitle === 'Backend Engineering Intern',
      `Deliverable must be attributed to The Ninja Studio engineering tenure, got ${candEvB.experience?.roleTitle}`,
    );

    console.log(`  ✓ Company B matched event/queue deliverable: "${candEvB.deliverableName}" (${candEvB.experience?.roleTitle}).`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 4: Company C (Commerce / Product Platform - D'Rons Match) Evaluation
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Evaluating Company C (Commerce Platform - D'Rons Match)...");
    const companyC = await seedCompanyFixture(FIXTURE_C_COMMERCE_PRODUCT);

    const matchC = await matchingService.matchCandidateToCompany(companyC, candidateProfile.id);
    assert.ok(matchC.match !== null, 'Company C must match successfully on commerce/product deliverable');

    const candEvC = matchC.candidateEvidence;
    assert.ok(candEvC, 'Candidate evidence must be populated');

    // Must be attributed to D'Rons
    assert.strictEqual(
      candEvC.experience?.employer,
      "D'Rons",
      `Company C evidence must be attributed strictly to D'Rons, got: ${candEvC.experience?.employer}`,
    );
    assert.strictEqual(
      candEvC.experience?.tenureType,
      'FOUNDER',
      `D'Rons role must be classified as FOUNDER tenure, got: ${candEvC.experience?.tenureType}`,
    );

    // CRITICAL: Ninja Studio deliverables must NOT bleed into D'Rons
    assert.notStrictEqual(
      candEvC.experience?.employer,
      'The Ninja Studio',
      "The Ninja Studio deliverables must NEVER be attributed to D'Rons",
    );
    const candDeliverableC = (candEvC.deliverableName || candEvC.atomicClaim).toLowerCase();
    assert.ok(
      !candDeliverableC.includes('branchguard') && !candDeliverableC.includes('leave management'),
      `Ninja Studio specific deliverables must not bleed into D'Rons match, got: ${candDeliverableC}`,
    );

    console.log(`  ✓ Company C matched D'Rons founder deliverable: "${candEvC.deliverableName}" (${candEvC.experience?.employer}) without cross-role bleed.`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 5: Company D (Generic Tech Stack) -> GENERIC_TECH_OVERLAP_ONLY
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Evaluating Company D (Generic Tech Stack Agency -> Refusal)...');
    const companyD = await seedCompanyFixture(FIXTURE_D_GENERIC_STACK);

    const matchD = await matchingService.matchCandidateToCompany(companyD, candidateProfile.id);
    assert.strictEqual(matchD.match, null, 'Generic web agency must NOT produce an outreach match');
    assert.ok(
      matchD.refusalReason === NoOutreachAngleReason.GENERIC_TECH_OVERLAP_ONLY ||
        matchD.refusalReason === NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH,
      `Expected GENERIC_TECH_OVERLAP_ONLY or LOW_RELATIONSHIP_STRENGTH, got ${matchD.refusalReason}`,
    );

    console.log(`  ✓ Company D correctly refused with: ${matchD.refusalReason} (Relay does not rubber-stamp generic stack).`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 6: Company E (AI/ML Infra - NEGATIVE TEST) -> NO_SUFFICIENT_OUTREACH_ANGLE
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Evaluating Company E (AI/ML Infra Negative Test -> Refusal)...');
    const companyE = await seedCompanyFixture(FIXTURE_E_AIML_INFRA);

    const matchE = await matchingService.matchCandidateToCompany(companyE, candidateProfile.id);

    // Candidate has Amazon ML Challenge under Activities, but NO production AI/ML infrastructure deliverables
    assert.strictEqual(
      matchE.match,
      null,
      'Deep AI/ML infra company must produce NO_SUFFICIENT_OUTREACH_ANGLE because candidate lacks AI/ML engineering deliverables',
    );
    assert.ok(
      matchE.refusalReason === NoOutreachAngleReason.INSUFFICIENT_CANDIDATE_EVIDENCE ||
        matchE.refusalReason === NoOutreachAngleReason.NO_DOMAIN_ALIGNMENT ||
        matchE.refusalReason === NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH,
      `Expected INSUFFICIENT_CANDIDATE_EVIDENCE or NO_DOMAIN_ALIGNMENT, got: ${matchE.refusalReason}`,
    );

    // Verify candidate projects in DB remain grounded (no AI/ML deliverables invented)
    const projects = candidateProfile.projects || [];
    for (const p of projects) {
      assert.ok(
        !p.name.toLowerCase().includes('gpu') && !p.name.toLowerCase().includes('pytorch kernel'),
        `Candidate projects must not contain fabricated AI/ML deliverables: ${p.name}`,
      );
    }

    console.log(`  ✓ Company E correctly produced NO_SUFFICIENT_OUTREACH_ANGLE (${matchE.refusalReason}) without inventing deliverables.`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 7: Company F (Unrelated Domain) & Company G (Deficient Research)
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Evaluating Company F (Unrelated Domain) & Company G (Empty Research)...');
    const companyF = await seedCompanyFixture(FIXTURE_F_UNRELATED_DOMAIN);

    const matchF = await matchingService.matchCandidateToCompany(companyF, candidateProfile.id);
    assert.strictEqual(matchF.match, null, 'Unrelated casual mobile game company must NOT produce a match');
    assert.ok(
      matchF.refusalReason === NoOutreachAngleReason.NO_DOMAIN_ALIGNMENT ||
        matchF.refusalReason === NoOutreachAngleReason.LOW_RELATIONSHIP_STRENGTH ||
        matchF.refusalReason === NoOutreachAngleReason.GENERIC_TECH_OVERLAP_ONLY,
      `Expected NO_DOMAIN_ALIGNMENT, LOW_RELATIONSHIP_STRENGTH, or GENERIC_TECH_OVERLAP_ONLY, got: ${matchF.refusalReason}`,
    );

    // Test Company G (Empty research)
    let companyG = await companyProfileRepo.findOne({ where: { domain: FIXTURE_G_EMPTY_RESEARCH.domain } });
    if (!companyG) {
      companyG = companyProfileRepo.create({
        domain: FIXTURE_G_EMPTY_RESEARCH.domain,
        companyName: FIXTURE_G_EMPTY_RESEARCH.companyName,
        website: FIXTURE_G_EMPTY_RESEARCH.website,
        summary: '',
        products: [],
        techSignals: [],
        evidence: [],
      });
      companyG = await companyProfileRepo.save(companyG);
    }
    await compEvidenceRepo.delete({ companyProfileId: companyG.id });

    const matchG = await matchingService.matchCandidateToCompany(companyG, candidateProfile.id);
    assert.strictEqual(matchG.match, null, 'Empty research must NOT produce a match');
    assert.strictEqual(
      matchG.refusalReason,
      NoOutreachAngleReason.INSUFFICIENT_COMPANY_RESEARCH,
      'Empty research must yield INSUFFICIENT_COMPANY_RESEARCH',
    );

    console.log(`  ✓ Negative cases validated: Company F (${matchF.refusalReason}), Company G (${matchG.refusalReason}).`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 8: Same-Resume Multi-Company Evaluation Synthesis
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Verifying Same-Resume Multi-Company Evaluation Matrix...');
    console.log('  Evaluating 5 companies against the SAME candidate profile:');
    console.log(`    Company A (Auth):        -> Deliverable: "${candEvA?.deliverableName}" (${candEvA?.experience?.roleTitle}) [MATCH: OK]`);
    console.log(`    Company B (Event/Queue): -> Deliverable: "${candEvB?.deliverableName}" (${candEvB?.experience?.roleTitle}) [MATCH: OK]`);
    console.log(`    Company C (Commerce):    -> Deliverable: "${candEvC?.deliverableName}" (${candEvC?.experience?.employer}) [MATCH: OK]`);
    console.log(`    Company D (Generic):     -> Refusal: ${matchD.refusalReason} [CORRECT REFUSAL: OK]`);
    console.log(`    Company E (AI/ML Infra): -> Refusal: ${matchE.refusalReason} [CORRECT REFUSAL: OK]`);

    // Verify that Relay does NOT produce "high match" for every company
    const matchesCount = [matchA.match, matchB.match, matchC.match, matchD.match, matchE.match].filter(Boolean).length;
    const refusalsCount = 5 - matchesCount;
    assert.strictEqual(matchesCount, 3, 'Exactly 3 companies must match based on genuine architectural alignment');
    assert.strictEqual(refusalsCount, 2, 'Exactly 2 companies must be refused (generic stack & insufficient candidate evidence)');

    // Verify distinct deliverables were selected across the 3 matching companies
    assert.notStrictEqual(candEvA?.id, candEvB?.id, 'Company A and Company B must select different candidate evidence');
    assert.notStrictEqual(candEvA?.id, candEvC?.id, 'Company A and Company C must select different candidate evidence');
    assert.notStrictEqual(candEvB?.id, candEvC?.id, 'Company B and Company C must select different candidate evidence');

    console.log('\n  ✓ Multi-company evaluation verified: Relay selectively personalizes based on genuine alignment and refuses when synergy is absent.');
    passedTests++;

    console.log('\n=============================================================');
    console.log(` ALL ${passedTests}/${totalTests} RELAY V3 GENERALIZATION TESTS PASSED SUCCESSFULLY! `);
    console.log('=============================================================\n');
  } catch (err: any) {
    console.error(`\n❌ GENERALIZATION TEST FAILED: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runGeneralizationSuite()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
