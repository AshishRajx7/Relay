import { ContactIntelligenceService } from '../src/modules/outreach/services/contact-intelligence.service';
import { CompanyProfileService } from '../src/modules/company-research/services/company-profile.service';
import { CandidateMatchingService } from '../src/modules/outreach/services/candidate-matching.service';
import { DraftQualityService } from '../src/modules/outreach/services/draft-quality.service';
import { GmailDraftService } from '../src/modules/outreach/services/gmail-draft.service';
import { ContactType } from '../src/modules/prospects/entities/prospect.entity';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase2TestSuite() {
  console.log('Running Complete Phase 2 Outreach Engine Automated Test Suite...\n');

  // 1. Test Contact Intelligence
  console.log('--- 1. Contact Intelligence Tests ---');
  const contactService = new ContactIntelligenceService();
  assert(contactService.classifyContact('hr@stripe.com') === ContactType.HR, 'hr@ classified as HR');
  assert(contactService.classifyContact('people@linear.app') === ContactType.HR, 'people@ classified as HR');
  assert(contactService.classifyContact('recruiter@acme.com') === ContactType.RECRUITER, 'recruiter@ classified as RECRUITER');
  assert(contactService.classifyContact('talent@brex.com') === ContactType.RECRUITER, 'talent@ classified as RECRUITER');
  assert(contactService.classifyContact('founder@startup.io') === ContactType.FOUNDER, 'founder@ classified as FOUNDER');
  assert(contactService.classifyContact('ceo@company.com') === ContactType.FOUNDER, 'ceo@ classified as FOUNDER');
  assert(contactService.classifyContact('cto@linear.app') === ContactType.ENGINEERING, 'cto@ classified as ENGINEERING');
  assert(contactService.classifyContact('backend@stripe.com') === ContactType.ENGINEERING, 'backend@ classified as ENGINEERING');
  assert(contactService.classifyContact('product@vercel.com') === ContactType.PRODUCT, 'product@ classified as PRODUCT');
  assert(contactService.classifyContact('hello@scale.com') === ContactType.GENERAL, 'hello@ classified as GENERAL');

  // 2. Test Company Research Scoring Formula (0-100)
  console.log('\n--- 2. Company Research Scoring Tests ---');
  const researchService = new CompanyProfileService({} as any, {} as any, {} as any, {} as any, {} as any);
  
  const score1 = researchService.calculateResearchScore({
    summary: 'Developer platform enabling high throughput workflow execution.',
    industry: 'Developer Tools',
    businessModel: 'B2B SaaS',
    techSignals: ['TypeScript', 'Redis', 'PostgreSQL'],
    hiringSignals: ['Senior Backend Engineer'],
    recentInitiatives: ['Launched v2 Core API'],
  }, true);
  assert(score1 === 100, `Full research scores 100/100 (got ${score1})`);

  const scoreLow = researchService.calculateResearchScore({
    summary: 'Minimal summary',
  }, true);
  assert(scoreLow === 20, `Minimal research scores 20/100 (got ${scoreLow})`);
  assert(scoreLow < 40, 'Score below 40 correctly identified as requiring manual review');

  // 3. Test Candidate Matching & Top 3 Ranking
  console.log('\n--- 3. Candidate Experience Match Tests ---');
  const matchingService = new CandidateMatchingService();
  const mockCompany: any = {
    companyName: 'Linear',
    domain: 'linear.app',
    industry: 'Developer Tools',
    businessModel: 'B2B SaaS',
    summary: 'High performance project management and event streaming infrastructure.',
    techSignals: ['Redis', 'BullMQ', 'PostgreSQL', 'NestJS'],
    hiringSignals: ['Backend Distributed Systems Specialist'],
  };

  const matchResult = matchingService.matchExperience(mockCompany, {} as any);
  assert(matchResult.chosenProject === 'BullMQ Notification System', `Chosen project is BullMQ Notification System (got "${matchResult.chosenProject}")`);
  assert(matchResult.matchScore >= 90, `Match score is high: ${matchResult.matchScore}`);
  assert(matchResult.rankedMatches.length === 3, 'Returns exactly top 3 ranked matches');
  assert(matchResult.rankedMatches[0].rank === 1, 'Top match has rank 1');

  // 4. Test Draft Quality Scorecard & Rejection Rules
  console.log('\n--- 4. Draft Quality Scoring Tests ---');
  const qualityService = new DraftQualityService();
  const highQualityBody = `Hi Patrick,\n\nI noticed Linear is scaling its event streaming infrastructure with Redis and distributed queues. Recently at The Ninja Studio, I built an idempotent BullMQ notification platform with retry backoff and low latency.\n\nOpen to a brief 10-minute chat this week?\n\nBest,\nAshish Raj`;
  
  const highQuality = qualityService.evaluateDraft('Linear backend engineering', highQualityBody, mockCompany, matchResult);
  assert(highQuality.personalizationScore >= 60, `Personalization score >= 60 (got ${highQuality.personalizationScore})`);
  assert(highQuality.spamRiskScore <= 30, `Spam risk score <= 30 (got ${highQuality.spamRiskScore})`);
  assert(highQuality.requiresManualReview === false, 'High quality draft passes safety gate');

  // Spammy/Generic rejection test
  const spammyBody = `BUY NOW! GUARANTEED 100% FREE REVOLUTIONARY SYNERGY FOR YOUR COMPANY! CLICK HERE IMMEDIATELY!!!`;
  const spamQuality = qualityService.evaluateDraft('EXCLUSIVE DEAL', spammyBody, mockCompany, matchResult);
  assert(spamQuality.spamRiskScore > 30, `Spam draft has high spam risk: ${spamQuality.spamRiskScore}`);
  assert(spamQuality.requiresManualReview === true, 'Spam draft correctly marked requiresManualReview = true');

  // 5. Test Gmail Draft Creation Service
  console.log('\n--- 5. Gmail Draft Service Tests ---');
  const gmailService = new GmailDraftService({ get: () => null } as any);
  const draftRes = await gmailService.createDraft('talent@linear.app', 'Exploring Backend Opportunities', highQualityBody);
  assert(!!draftRes.gmailDraftId, `Generated draft ID: ${draftRes.gmailDraftId}`);

  console.log('\n🎉 ALL PHASE 2 AUTOMATED UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runPhase2TestSuite().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
