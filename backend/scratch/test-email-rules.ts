import 'reflect-metadata';
import * as assert from 'assert';
import { EmailGenerationService } from '../src/modules/outreach/services/email-generation.service';
import { DraftQualityService } from '../src/modules/outreach/services/draft-quality.service';
import { ContactType } from '../src/modules/prospects/entities/prospect.entity';

async function runTest() {
  console.log('--- Testing Relay Email Rules & Recipient Classification ---');

  const qualityService = new DraftQualityService();
  const emailGenService = new EmailGenerationService({} as any, {} as any, qualityService);

  // 1. Recipient Classification Tests
  const peerRoles = [
    'Software Engineer',
    'Senior Software Engineer',
    'Staff Engineer',
    'Principal Engineer',
    'Engineering Lead',
    'Engineering Manager',
    'VP Engineering',
    'CTO',
  ];

  for (const role of peerRoles) {
    const res = emailGenService.classifyRecipient(ContactType.ENGINEERING, 'eng@company.com', role);
    assert.strictEqual(
      res.recipientClass,
      'ENGINEERING_PEER',
      `Role "${role}" must classify as ENGINEERING_PEER, got: ${res.recipientClass}`,
    );
    console.log(`✓ [ENGINEERING_PEER]: "${role}" correctly classified`);
  }

  const recruitingRoles = [
    'Recruiter',
    'Talent Partner',
    'Talent Acquisition',
    'Hiring Manager',
    'Recruiting Coordinator',
    'People Operations',
  ];

  for (const role of recruitingRoles) {
    const res = emailGenService.classifyRecipient(ContactType.GENERAL, 'contact@company.com', role);
    assert.strictEqual(
      res.recipientClass,
      'RECRUITING_CONTACT',
      `Role "${role}" must classify as RECRUITING_CONTACT, got: ${res.recipientClass}`,
    );
    console.log(`✓ [RECRUITING_CONTACT]: "${role}" correctly classified`);
  }

  // 2. Forbidden Phrases Checks
  const forbiddenPhrases = [
    'I am excited to apply',
    'I believe I would be a great fit',
    'I am passionate about',
    'I would appreciate your consideration',
    'Please review my resume',
    'Looking forward to hearing from you',
    'Please find my resume attached',
    'Kindly review the attached resume',
    'I request you to review my resume',
    'Thank you for your time and consideration',
  ];

  for (const phrase of forbiddenPhrases) {
    const flagged = qualityService.hasForbiddenPhrase(phrase);
    assert(flagged, `Phrase "${phrase}" must be flagged as forbidden`);
    console.log(`✓ Forbidden phrase detected: "${phrase}"`);
  }

  // 3. Approved Endings Checks (Must NOT be flagged as forbidden)
  const approvedPeerEndings = [
    "Would love to learn more about the team and the problems you're solving if there are relevant opportunities. I've attached my resume for context.",
    "Happy to share more details about my work if it's relevant to what the team is building. I've attached my resume for context.",
    "Would be interested in learning more about the platform team and any challenges you're currently tackling. I've attached my resume.",
    "If my background seems relevant, I'd be glad to continue the conversation. I've attached my resume.",
  ];

  for (const ending of approvedPeerEndings) {
    const flagged = qualityService.hasForbiddenPhrase(ending);
    assert(!flagged, `Peer ending "${ending}" must NOT be flagged as forbidden! Flagged as: ${flagged}`);
    assert(qualityService.hasResumeMention(ending), `Peer ending "${ending}" must mention resume`);
    console.log(`✓ Approved peer ending valid: "${ending.slice(0, 50)}..."`);
  }

  const approvedRecruiterEndings = [
    "If there are any software engineering opportunities that align with my background, I'd be grateful for the opportunity to be considered. I've attached my resume.",
    "If my experience aligns with any current or upcoming engineering roles, I'd be happy to share additional information. I've attached my resume.",
    "Should there be relevant backend or platform engineering opportunities, I'd welcome the opportunity to be considered. I've attached my resume.",
    "If my background appears relevant to any engineering openings, I'd be glad to discuss further. I've attached my resume.",
  ];

  for (const ending of approvedRecruiterEndings) {
    const flagged = qualityService.hasForbiddenPhrase(ending);
    assert(!flagged, `Recruiter ending "${ending}" must NOT be flagged as forbidden! Flagged as: ${flagged}`);
    assert(qualityService.hasResumeMention(ending), `Recruiter ending "${ending}" must mention resume`);
    console.log(`✓ Approved recruiter ending valid: "${ending.slice(0, 50)}..."`);
  }

  // 4. Clean Signature Check
  const signature = `Best,\nAshish Raj\nGitHub: https://github.com/AshishRajx7\nLinkedIn: https://linkedin.com/in/ashishrajx7`;
  assert(!DraftQualityService.hasSignatureOrClosingSentence(signature), 'Clean signature must not be flagged');
  console.log('✓ Clean signature format verified');

  console.log('\n--- ALL EMAIL RULES & CLASSIFICATION TESTS PASSED ---');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
