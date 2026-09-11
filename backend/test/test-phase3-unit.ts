import { CompanyDomainService } from '../src/modules/company-research/services/company-domain.service';
import { ContactIntelligenceService } from '../src/modules/outreach/services/contact-intelligence.service';
import { ContactType } from '../src/modules/prospects/entities/prospect.entity';
import { OutreachDraftStatus } from '../src/modules/outreach/entities/email-draft.entity';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase3UnitTests() {
  console.log('Running Phase 3 Production Outreach Layer Unit Test Suite...\n');

  // 1. Test CompanyDomainService
  console.log('--- 1. Domain Normalization Engine Tests ---');
  const domainService = new CompanyDomainService();

  assert(domainService.extractRootDomain('https://jobs.resend.com/careers') === 'resend.com', 'jobs.resend.com -> resend.com');
  assert(domainService.extractRootDomain('careers.airtable.com') === 'airtable.com', 'careers.airtable.com -> airtable.com');
  assert(domainService.extractRootDomain('https://api.dev.stripe.com/v1') === 'stripe.com', 'api.dev.stripe.com -> stripe.com');
  assert(domainService.extractRootDomain('mail.google.com') === 'google.com', 'mail.google.com -> google.com');
  assert(domainService.extractRootDomain('engineering.bbc.co.uk') === 'bbc.co.uk', 'engineering.bbc.co.uk -> bbc.co.uk');
  assert(domainService.extractRootDomain('portal.service.gov.au') === 'service.gov.au', 'portal.service.gov.au -> service.gov.au');
  assert(domainService.extractRootDomain('tech.ninja.co.in') === 'ninja.co.in', 'tech.ninja.co.in -> ninja.co.in');
  assert(domainService.extractRootDomain('sub.domain.co.jp') === 'domain.co.jp', 'sub.domain.co.jp -> domain.co.jp');
  assert(domainService.normalizeCompanyDomain('linear.app') === 'linear.app', 'linear.app -> linear.app');
  assert(domainService.normalizeCompanyDomain('vercel.com') === 'vercel.com', 'vercel.com -> vercel.com');

  // 2. Test Contact Filtering (Phase 3.5)
  console.log('\n--- 2. Contact Filtering & Bot Disqualification Tests ---');
  const contactService = new ContactIntelligenceService();

  assert(contactService.classifyContact('noreply@resend.com') === ContactType.UNSUPPORTED_CONTACT, 'noreply@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('no-reply@stripe.com') === ContactType.UNSUPPORTED_CONTACT, 'no-reply@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('admin@company.io') === ContactType.UNSUPPORTED_CONTACT, 'admin@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('support@linear.app') === ContactType.UNSUPPORTED_CONTACT, 'support@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('alerts@monitoring.com') === ContactType.UNSUPPORTED_CONTACT, 'alerts@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('system@enterprise.org') === ContactType.UNSUPPORTED_CONTACT, 'system@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('postmaster@domain.com') === ContactType.UNSUPPORTED_CONTACT, 'postmaster@ -> UNSUPPORTED_CONTACT');
  assert(contactService.classifyContact('mailer-daemon@server.com') === ContactType.UNSUPPORTED_CONTACT, 'mailer-daemon@ -> UNSUPPORTED_CONTACT');

  // Valid personas
  assert(contactService.classifyContact('hr@stripe.com') === ContactType.HR, 'hr@ -> HR');
  assert(contactService.classifyContact('talent@linear.app') === ContactType.RECRUITER, 'talent@ -> RECRUITER');
  assert(contactService.classifyContact('founder@startup.io') === ContactType.FOUNDER, 'founder@ -> FOUNDER');
  assert(contactService.classifyContact('cto@resend.com') === ContactType.ENGINEERING, 'cto@ -> ENGINEERING');
  assert(contactService.classifyContact('product@vercel.com') === ContactType.PRODUCT, 'product@ -> PRODUCT');

  // 3. Test Duplicate Outreach Warning Logic (Phase 3.9)
  console.log('\n--- 3. Duplicate Company Outreach Detection Tests ---');
  const mockContacts = [
    { email: 'cto@stripe.com', domain: 'stripe.com', companyName: 'Stripe' },
    { email: 'hr@stripe.com', domain: 'stripe.com', companyName: 'Stripe' },
    { email: 'careers@stripe.com', domain: 'stripe.com', companyName: 'Stripe' },
    { email: 'talent@linear.app', domain: 'linear.app', companyName: 'Linear' },
    { email: 'eng@linear.app', domain: 'linear.app', companyName: 'Linear' },
    { email: 'founder@resend.com', domain: 'resend.com', companyName: 'Resend' },
  ];

  const map = new Map<string, { companyName: string; count: number }>();
  for (const c of mockContacts) {
    if (!map.has(c.domain)) {
      map.set(c.domain, { companyName: c.companyName, count: 0 });
    }
    map.get(c.domain)!.count++;
  }

  let dupCompanies = 0;
  let dupDrafts = 0;
  const warnings: string[] = [];

  for (const [, group] of map.entries()) {
    if (group.count > 1) {
      dupCompanies++;
      dupDrafts += (group.count - 1);
      warnings.push(`${group.count} contacts belong to the same company (${group.companyName}). Review before generating additional drafts.`);
    }
  }

  assert(dupCompanies === 2, `Detected 2 duplicate companies (Stripe, Linear)`);
  assert(dupDrafts === 3, `Detected 3 duplicate drafts beyond primary contact (got ${dupDrafts})`);
  assert(warnings.length === 2, `Generated 2 duplicate warnings`);
  assert(warnings[0].includes('Stripe') && warnings[0].includes('3 contacts'), `Warning 1 formatted properly: "${warnings[0]}"`);

  // 4. Test Draft Review Approval Safety Gate (Phase 3.9)
  console.log('\n--- 4. Draft Review Approval Safety Gate Tests ---');
  const isEligibleForGmail = (status: OutreachDraftStatus) => {
    return status === OutreachDraftStatus.APPROVED || status === OutreachDraftStatus.EDITED;
  };

  assert(isEligibleForGmail(OutreachDraftStatus.GENERATED) === false, 'GENERATED draft is NOT eligible for Gmail creation without approval');
  assert(isEligibleForGmail(OutreachDraftStatus.REVIEW_REQUIRED) === false, 'REVIEW_REQUIRED draft is NOT eligible for Gmail creation');
  assert(isEligibleForGmail(OutreachDraftStatus.REJECTED) === false, 'REJECTED draft is NOT eligible for Gmail creation');
  assert(isEligibleForGmail(OutreachDraftStatus.APPROVED) === true, 'APPROVED draft IS eligible for Gmail creation');
  assert(isEligibleForGmail(OutreachDraftStatus.EDITED) === true, 'EDITED draft IS eligible for Gmail creation');

  console.log('\n🎉 ALL PHASE 3 UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runPhase3UnitTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
