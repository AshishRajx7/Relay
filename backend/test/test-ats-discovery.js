const { AtsDiscoveryService } = require('../dist/modules/company-research/services/ats-discovery.service');

function runAtsTests() {
  console.log('===========================================================');
  console.log('🔍 TASK GROUP 5: ATS & CAREERS DISCOVERY UNIT TESTS');
  console.log('===========================================================\n');

  const atsService = new AtsDiscoveryService();

  const testCases = [
    {
      name: 'Ashby Detection',
      baseUrl: 'https://linear.app',
      links: ['https://jobs.ashbyhq.com/linear', 'https://linear.app/about'],
      markdown: 'We are hiring for distributed engineering roles.',
      expectedAts: 'ASHBY',
      expectedHiring: true,
    },
    {
      name: 'Greenhouse Detection',
      baseUrl: 'https://stripe.com',
      links: ['https://boards.greenhouse.io/stripe', 'https://stripe.com/team'],
      markdown: 'Join our team. Contact careers@stripe.com.',
      expectedAts: 'GREENHOUSE',
      expectedHiring: true,
      expectedEmail: 'careers@stripe.com',
    },
    {
      name: 'Lever Detection',
      baseUrl: 'https://figma.com',
      links: ['https://jobs.lever.co/figma'],
      markdown: 'Open positions available now.',
      expectedAts: 'LEVER',
      expectedHiring: true,
    },
    {
      name: 'Workable Detection',
      baseUrl: 'https://startup.io',
      links: ['https://apply.workable.com/startup-io'],
      markdown: 'Explore careers with us.',
      expectedAts: 'WORKABLE',
      expectedHiring: true,
    },
    {
      name: 'SmartRecruiters Detection',
      baseUrl: 'https://enterprise.com',
      links: ['https://careers.smartrecruiters.com/enterprise'],
      markdown: 'View job openings.',
      expectedAts: 'SMARTRECRUITERS',
      expectedHiring: true,
    },
    {
      name: 'Rippling Detection',
      baseUrl: 'https://ripplingclient.com',
      links: ['https://jobs.rippling.com/ripplingclient'],
      markdown: 'See all jobs.',
      expectedAts: 'RIPPLING',
      expectedHiring: true,
    },
    {
      name: 'BambooHR Detection',
      baseUrl: 'https://bambooclient.com',
      links: ['https://bambooclient.bamboohr.com/jobs'],
      markdown: 'Grow with us.',
      expectedAts: 'BAMBOOHR',
      expectedHiring: true,
    },
    {
      name: 'Teamtailor Detection',
      baseUrl: 'https://nordicbrand.com',
      links: ['https://nordicbrand.teamtailor.com'],
      markdown: 'Check out our openings.',
      expectedAts: 'TEAMTAILOR',
      expectedHiring: true,
    },
    {
      name: 'Personio Detection',
      baseUrl: 'https://berlinstartup.de',
      links: ['https://berlinstartup.personio.de'],
      markdown: 'Open positions in Berlin and Munich.',
      expectedAts: 'PERSONIO',
      expectedHiring: true,
    },
    {
      name: 'Jobvite Detection',
      baseUrl: 'https://jobviteclient.com',
      links: ['https://jobs.jobvite.com/jobviteclient'],
      markdown: 'Careers at Jobvite Client.',
      expectedAts: 'JOBVITE',
      expectedHiring: true,
    },
  ];

  testCases.forEach((tc, idx) => {
    const result = atsService.discover(tc.baseUrl, tc.links, tc.markdown);
    console.log(`[${idx + 1}] Testing ${tc.name}...`);
    console.log(`   ATS Provider: ${result.atsProvider} (Expected: ${tc.expectedAts})`);
    console.log(`   isHiring: ${result.isHiring} | Signals: ${result.hiringSignals.join(', ')}`);
    if (tc.expectedEmail) {
      console.log(`   Discovered Emails: ${result.genericContactEmails.join(', ')}`);
      if (!result.genericContactEmails.includes(tc.expectedEmail)) {
        throw new Error(`Expected email ${tc.expectedEmail} not found in ${result.genericContactEmails}`);
      }
    }

    if (result.atsProvider !== tc.expectedAts) {
      throw new Error(`Test ${tc.name} failed: expected ATS ${tc.expectedAts}, got ${result.atsProvider}`);
    }
    if (result.isHiring !== tc.expectedHiring) {
      throw new Error(`Test ${tc.name} failed: expected isHiring=${tc.expectedHiring}, got ${result.isHiring}`);
    }
    console.log(`   ✔ ${tc.name} PASSED\n`);
  });

  console.log('===========================================================');
  console.log('🎉 ALL 10 ATS PROVIDER DISCOVERY TESTS PASSED (100% SUCCESS)');
  console.log('===========================================================');
}

runAtsTests();
