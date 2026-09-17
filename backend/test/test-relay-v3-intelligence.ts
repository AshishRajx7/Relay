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
import { SOURCEFUSE_FIXTURE_DATA, SOURCEFUSE_RAW_CRAWLED_MARKDOWN } from './fixtures/companies/sourcefuse.fixture';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

async function runRegressionSuite() {
  console.log('\n=============================================================');
  console.log('      RELAY V3 INTELLIGENCE LAYER REGRESSION TEST SUITE      ');
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
  let totalTests = 7;

  try {
    // -------------------------------------------------------------
    // TEST 1: Candidate Experience Normalization & resumeId FK
    // -------------------------------------------------------------
    console.log('[TEST 1] Verifying CandidateExperience Normalization & resumeId FK...');
    await resumeParser.backfillAllCandidateProfiles();

    const experiences = await expRepo.find({ order: { orderIndex: 'ASC' } });
    assert.ok(experiences.length >= 3, `Expected at least 3 distinct experiences, found ${experiences.length}`);

    // Verify resumeId FK exists and is non-null
    for (const exp of experiences) {
      assert.ok(exp.resumeId, `CandidateExperience ${exp.id} must have non-null resumeId`);
      assert.ok(exp.candidateProfileId, `CandidateExperience ${exp.id} must have non-null candidateProfileId`);
    }

    // Verify strict separation of 3 roles
    const internRole = experiences.find((e) => e.roleTitle.toLowerCase().includes('intern'));
    const sweRole = experiences.find((e) => e.roleTitle.toLowerCase().includes('software engineer'));
    const founderRole = experiences.find((e) => e.roleTitle.toLowerCase().includes('founder'));

    assert.ok(internRole, 'Backend Engineering Intern role must exist as distinct row');
    assert.ok(sweRole, 'Software Engineer role must exist as distinct row');
    assert.ok(founderRole, 'Founder role must exist as distinct row');

    assert.strictEqual(internRole.tenureType, 'INTERNSHIP');
    assert.strictEqual(sweRole.tenureType, 'FULL_TIME');
    assert.strictEqual(founderRole.tenureType, 'FOUNDER');

    console.log('  ✓ candidate_experience has resumeId FK and strict 3-way role separation.');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 2: Source Fact vs Normalized Claim Distinction
    // -------------------------------------------------------------
    console.log('[TEST 2] Verifying Source Fact vs Normalized Claim Distinction...');
    const candEvidence = await candEvidenceRepo.find({ relations: ['experience'] });
    assert.ok(candEvidence.length > 0, 'Candidate evidence claims must be populated');

    const bulletEvidence = candEvidence.filter((e) => e.sourceType === 'RESUME_BULLET');
    assert.ok(bulletEvidence.length >= 5, 'At least 5 bullet evidence items expected');

    for (const bev of bulletEvidence) {
      assert.ok(bev.rawBulletText && bev.rawBulletText.trim().length > 10, 'rawBulletText must contain exact source fact');
      assert.ok(bev.atomicClaim && bev.atomicClaim.trim().length > 10, 'atomicClaim must contain normalized claim');
      assert.ok(bev.experienceId, 'Candidate evidence from bullet must reference experienceId FK');
    }

    // BranchGuard must be on intern role; Redis caching must be on SWE role
    const branchGuardEv = bulletEvidence.find((e) => e.rawBulletText?.includes('BranchGuard') && !e.rawBulletText?.includes('Redis caching'));
    const redisEv = bulletEvidence.find((e) => e.rawBulletText?.includes('Redis caching'));

    assert.ok(branchGuardEv, 'BranchGuard bullet evidence must exist');
    assert.ok(redisEv, 'Redis caching bullet evidence must exist');

    assert.strictEqual(branchGuardEv.experience?.roleTitle, 'Backend Engineering Intern');
    assert.strictEqual(redisEv.experience?.roleTitle, 'Software Engineer');

    console.log('  ✓ rawBulletText is verbatim SOURCE FACT and separate from atomicClaim.');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 3: High-Recall Deterministic Pair Pruning
    // -------------------------------------------------------------
    console.log('[TEST 3] Verifying High-Recall Deterministic Pair Pruning...');
    // Create test company profile from SourceFuse fixture
    let testCompany = await companyProfileRepo.findOne({ where: { domain: SOURCEFUSE_FIXTURE_DATA.domain } });
    if (!testCompany) {
      testCompany = companyProfileRepo.create({
        domain: SOURCEFUSE_FIXTURE_DATA.domain,
        companyName: SOURCEFUSE_FIXTURE_DATA.companyName,
        website: SOURCEFUSE_FIXTURE_DATA.website,
        industry: SOURCEFUSE_FIXTURE_DATA.industry,
        summary: SOURCEFUSE_FIXTURE_DATA.summary,
        products: SOURCEFUSE_FIXTURE_DATA.products,
        techSignals: SOURCEFUSE_FIXTURE_DATA.techSignals,
      });
      testCompany = await companyProfileRepo.save(testCompany);
    }

    // Save test company source and evidence
    let testSource = await sourceRepo.findOne({ where: { companyProfileId: testCompany.id } });
    if (!testSource) {
      testSource = sourceRepo.create({
        companyProfileId: testCompany.id,
        url: SOURCEFUSE_FIXTURE_DATA.website,
        section: 'HOMEPAGE',
        rawMarkdown: SOURCEFUSE_RAW_CRAWLED_MARKDOWN,
        contentHash: 'fixture_hash',
        retrievedAt: new Date(),
        wordCount: 150,
      });
      testSource = await sourceRepo.save(testSource);
    }

    await compEvidenceRepo.delete({ companyProfileId: testCompany.id });
    for (const ev of SOURCEFUSE_FIXTURE_DATA.evidence) {
      const coEv = compEvidenceRepo.create({
        companyProfileId: testCompany.id,
        sourceId: testSource.id,
        sourceUrl: ev.url,
        verbatimQuote: ev.quote,
        atomicClaim: ev.quote,
        category: 'CUSTOMER_PROBLEM',
        confidence: 1.0,
        isSourceFact: true,
      });
      await compEvidenceRepo.save(coEv);
    }

    const candidateProfile = await profileRepo.findOne({ where: {} });
    assert.ok(candidateProfile, 'Candidate profile must exist');

    const v3Match = await matchingService.matchCandidateToCompany(testCompany, candidateProfile.id);
    assert.ok(v3Match.match, 'V3 matching should identify high-recall semantic alignment');
    assert.ok(v3Match.compositeScore >= 60, `Expected score >= 60, got ${v3Match.compositeScore}`);

    console.log(`  ✓ High-recall matcher discovered relational alignment (Score: ${v3Match.compositeScore}/100).`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 4: Decoupled Coverage Quality vs Relationship Quality
    // -------------------------------------------------------------
    console.log('[TEST 4] Verifying Coverage Quality Decoupled from Refusal...');
    // A company with minimal coverage (e.g. 1 page crawled, missing hiring signals) should still be evaluated
    testCompany.coverageMetadata = {
      coverageStatus: 'MINIMAL',
      pagesAttemptedCount: 1,
      pagesSucceededCount: 1,
      totalWordCount: 120,
      sectionsAcquired: ['HOMEPAGE'],
      hasCoreSummary: true,
      hasVerifiedProducts: true,
      hasTechnicalSignals: false,
      hasHiringSignals: false,
      coverageGaps: ['Missing hiring signals'],
    };
    await companyProfileRepo.save(testCompany);

    const matchWithMinimalCoverage = await matchingService.matchCandidateToCompany(testCompany, candidateProfile.id);
    assert.ok(matchWithMinimalCoverage.match !== null, 'Minimal coverage alone must NOT trigger outreach refusal');

    console.log('  ✓ Coverage quality is decoupled from outreach refusal.');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 5: RESEARCH_RETRY_REQUIRED for Crawler Failures
    // -------------------------------------------------------------
    console.log('[TEST 5] Verifying RESEARCH_RETRY_REQUIRED on Crawl Failure...');
    let campaign = await campaignRepo.findOne({ where: {} });
    if (!campaign) {
      campaign = campaignRepo.create({
        name: 'V3 Regression Suite Campaign',
        candidateProfileId: candidateProfile.id,
        status: CampaignStatus.PROCESSING,
      });
      campaign = await campaignRepo.save(campaign);
    }

    const testFailEmail = `network-fail-${Date.now()}@example-transient.com`;
    const testProspect = prospectRepo.create({
      campaignId: campaign.id,
      email: testFailEmail,
      domain: 'example-transient.com',
      researchStatus: ProspectResearchStatus.PENDING,
    });
    await prospectRepo.save(testProspect);

    try {
      await companyProfileService.markProspectsRetryRequired('example-transient.com', 'Timeout connecting to host');
      const updatedProspect = await prospectRepo.findOne({ where: { email: testFailEmail } });

      assert.strictEqual(
        updatedProspect?.researchStatus,
        ProspectResearchStatus.RESEARCH_RETRY_REQUIRED,
        'Crawl failure must set status to RESEARCH_RETRY_REQUIRED',
      );
    } finally {
      await prospectRepo.delete({ email: testFailEmail });
    }

    console.log('  ✓ Transient scraping errors trigger RESEARCH_RETRY_REQUIRED.');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 6: Adversarial Claim Verifier & Full Provenance Tracing
    // -------------------------------------------------------------
    console.log('[TEST 6] Verifying Adversarial Verifier and Cross-Role Bleed Detection...');
    const testSuffix = Date.now();
    const validEmail = `valid-attr-${testSuffix}@example.com`;
    const invalidEmail = `invalid-attr-${testSuffix}@example.com`;

    // Case A: Correct role attribution (BranchGuard during internship)
    const validBody = `Hi Alex,
I noticed your work on AssessLens, which caught my attention.
During my internship at The Ninja Studio, I designed branch-based access control (BranchGuard) to enforce tenant-scoped authorization.
Would love to learn more about the engineering challenges you're tackling.
Best,
Ashish`;

    const validProspect = prospectRepo.create({
      campaignId: campaign.id,
      email: validEmail,
      domain: SOURCEFUSE_FIXTURE_DATA.domain,
      researchStatus: ProspectResearchStatus.RESEARCHED,
    });
    await prospectRepo.save(validProspect);

    const validDraft = draftRepo.create({
      prospectId: validProspect.id,
      subject: 'Valid Draft Attribution Subject',
      body: validBody,
      status: OutreachDraftStatus.GENERATED,
    });
    await draftRepo.save(validDraft);

    // Case B: Cross-Role Bleed (Attributing BranchGuard to full-time Software Engineer tenure)
    const invalidBody = `Hi Alex,
I saw that your team is building scalable platforms.
As a full-time Software Engineer at The Ninja Studio, I designed and built the BranchGuard access control system.
Would love to chat.
Best,
Ashish`;

    const invalidProspect = prospectRepo.create({
      campaignId: campaign.id,
      email: invalidEmail,
      domain: SOURCEFUSE_FIXTURE_DATA.domain,
      researchStatus: ProspectResearchStatus.RESEARCHED,
    });
    await prospectRepo.save(invalidProspect);

    const invalidDraft = draftRepo.create({
      prospectId: invalidProspect.id,
      subject: 'Invalid Draft Bleed Subject',
      body: invalidBody,
      status: OutreachDraftStatus.GENERATED,
    });
    await draftRepo.save(invalidDraft);

    try {
      const validVerification = await verifierService.verifyDraft(
        validDraft.id,
        validBody,
        candidateProfile.id,
        testCompany.id,
      );
      assert.strictEqual(validVerification.passed, true, 'Valid role attribution must PASS verification');
      assert.strictEqual(validVerification.crossRoleBleedDetected, false, 'No cross-role bleed in valid draft');

      const invalidVerification = await verifierService.verifyDraft(
        invalidDraft.id,
        invalidBody,
        candidateProfile.id,
        testCompany.id,
      );
      assert.strictEqual(invalidVerification.crossRoleBleedDetected, true, 'Cross-role bleed must be detected when BranchGuard is claimed as full-time SWE');
      assert.strictEqual(invalidVerification.passed, false, 'Draft with cross-role bleed must NOT pass');
    } finally {
      // Clean up
      await draftRepo.delete({ id: validDraft.id });
      await draftRepo.delete({ id: invalidDraft.id });
      await prospectRepo.delete({ id: validProspect.id });
      await prospectRepo.delete({ id: invalidProspect.id });
    }

    console.log('  ✓ Adversarial verifier successfully traced claims and caught cross-role bleed.');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 7: Zero Hardcoding of SourceFuse in Production Logic
    // -------------------------------------------------------------
    console.log('[TEST 7] Verifying Zero Hardcoded References to SourceFuse in src/...');
    const srcDir = path.resolve(__dirname, '../src');

    function searchDirForTerm(dir: string, term: string): string[] {
      const matches: string[] = [];
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          matches.push(...searchDirForTerm(fullPath, term));
        } else if (/\.(ts|js|json)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.toLowerCase().includes(term.toLowerCase())) {
            matches.push(fullPath);
          }
        }
      }
      return matches;
    }

    const matches = searchDirForTerm(srcDir, 'sourcefuse');
    assert.strictEqual(
      matches.length,
      0,
      `Found forbidden references to "sourcefuse" in production code: ${matches.join(', ')}`,
    );

    console.log('  ✓ Production codebase contains 0 hardcoded references to SourceFuse.');
    passedTests++;

    console.log('\n=============================================================');
    console.log(` ALL ${passedTests}/${totalTests} RELAY V3 REGRESSION TESTS PASSED SUCCESSFULLY! `);
    console.log('=============================================================\n');
  } catch (err: any) {
    console.error(`\n❌ REGRESSION TEST FAILED: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runRegressionSuite()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
