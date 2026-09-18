import { createConnection, Connection } from 'typeorm';
import * as assert from 'assert';
import * as dotenv from 'dotenv';
import { CompanyProfile } from '../src/modules/company-research/entities/company-profile.entity';
import { CompanySource } from '../src/modules/company-research/entities/company-source.entity';
import { CompanyEvidenceEntity } from '../src/modules/company-research/entities/company-evidence.entity';
import { CompanyProfileService } from '../src/modules/company-research/services/company-profile.service';
import { CompanyDomainService } from '../src/modules/company-research/services/company-domain.service';
import { Prospect } from '../src/modules/prospects/entities/prospect.entity';
import { Campaign } from '../src/modules/campaigns/entities/campaign.entity';

dotenv.config();

async function runPersistenceRegressionTest() {
  console.log('=== RUNNING REGRESSION TEST: CompanyProfile company_name NOT NULL Persistence ===\n');

  const conn: Connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'relay',
    password: process.env.DB_PASSWORD || 'relay_dev_password',
    database: process.env.DB_DATABASE || 'relay',
    entities: [__dirname + '/../src/**/*.entity.{ts,js}'],
    synchronize: false,
  });

  const profileRepo = conn.getRepository(CompanyProfile);
  const sourceRepo = conn.getRepository(CompanySource);
  const evidenceRepo = conn.getRepository(CompanyEvidenceEntity);
  const prospectRepo = conn.getRepository(Prospect);
  const campaignRepo = conn.getRepository(Campaign);

  // Mock crawl provider and AI provider
  const mockCrawlProvider = {
    crawl: async (url: string) => ({
      success: true,
      url,
      markdown: '# Test Enterprise Platform\n\nWe provide scalable enterprise infrastructure with AWS and TypeScript.',
      wordCount: 150,
      subpagesCrawled: ['https://example-test.com/about'],
    }),
  };

  const mockAiProvider = {
    structuredComplete: async () => ({
      data: {
        companyName: 'Test Enterprise Corp',
        website: 'https://example-test.com',
        industry: 'Enterprise Software',
        businessModel: 'B2B SaaS',
        companyStage: 'Series B',
        employeeRange: '100-250',
        summary: 'Scalable cloud infrastructure provider.',
        products: ['CloudScale'],
        techSignals: ['AWS', 'TypeScript', 'PostgreSQL'],
        hiringSignals: ['Senior Backend Engineer'],
        recentInitiatives: ['Launched cloud compliance tools'],
        evidence: [
          {
            source: 'homepage',
            url: 'https://example-test.com',
            type: 'HOMEPAGE',
            quote: 'We provide scalable enterprise infrastructure with AWS and TypeScript.',
          },
        ],
      },
    }),
  };

  const domainService = new CompanyDomainService();

  const service = new CompanyProfileService(
    profileRepo,
    sourceRepo,
    evidenceRepo,
    prospectRepo,
    campaignRepo,
    mockAiProvider as any,
    domainService as any,
    mockCrawlProvider as any,
  );

  const testDomainWithPreferredName = 'test-company-persist-a.com';
  const testDomainWithoutPreferredName = 'test-company-persist-b.com';

  try {
    // Clean up any stale records
    await profileRepo.delete({ domain: testDomainWithPreferredName });
    await profileRepo.delete({ domain: testDomainWithoutPreferredName });

    // -----------------------------------------------------------------
    // TEST 1: Preferred company name provided (as in CSV / BullMQ job)
    // -----------------------------------------------------------------
    console.log('[TEST 1] Testing persistence with preferred company name...');
    const profileA = await service.researchAndSaveCompany(testDomainWithPreferredName, 'Preferred Brand Name');
    
    assert.ok(profileA, 'CompanyProfile should be created and returned');
    assert.ok(profileA.id, 'CompanyProfile must have a valid UUID ID');
    assert.strictEqual(profileA.domain, testDomainWithPreferredName);
    assert.ok(profileA.companyName, 'companyName must not be null or undefined');
    assert.ok(profileA.companyName.length > 0, 'companyName must not be empty');

    // Query directly from PostgreSQL to verify row exists in database with non-null company_name
    const rawRowA = await conn.query('SELECT id, domain, company_name FROM company_profiles WHERE domain = $1', [
      testDomainWithPreferredName,
    ]);
    assert.strictEqual(rawRowA.length, 1, 'Row must exist in PostgreSQL company_profiles table');
    assert.ok(rawRowA[0].company_name !== null, 'company_name column in PostgreSQL must NOT be null');
    console.log(`  ✓ Passed: Persisted "${rawRowA[0].company_name}" for domain "${rawRowA[0].domain}"`);

    // -----------------------------------------------------------------
    // TEST 2: No preferred company name provided (fallback capitalization)
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Testing persistence without preferred company name (fallback to domain)...');
    const profileB = await service.researchAndSaveCompany(testDomainWithoutPreferredName, null);

    assert.ok(profileB, 'CompanyProfile should be created and returned');
    assert.ok(profileB.id, 'CompanyProfile must have a valid UUID ID');
    assert.strictEqual(profileB.domain, testDomainWithoutPreferredName);
    assert.ok(profileB.companyName, 'companyName must not be null or undefined');

    const rawRowB = await conn.query('SELECT id, domain, company_name FROM company_profiles WHERE domain = $1', [
      testDomainWithoutPreferredName,
    ]);
    assert.strictEqual(rawRowB.length, 1, 'Row must exist in PostgreSQL company_profiles table');
    assert.ok(rawRowB[0].company_name !== null, 'company_name column in PostgreSQL must NOT be null');
    console.log(`  ✓ Passed: Persisted "${rawRowB[0].company_name}" for domain "${rawRowB[0].domain}"`);

    console.log('\n=============================================================');
    console.log(' ALL REGRESSION TESTS PASSED: company_name NOT NULL satisfied ');
    console.log('=============================================================\n');
  } finally {
    // Cleanup test records
    await profileRepo.delete({ domain: testDomainWithPreferredName });
    await profileRepo.delete({ domain: testDomainWithoutPreferredName });
    await conn.close();
  }
}

runPersistenceRegressionTest().catch((err) => {
  console.error('❌ Regression test failed:', err);
  process.exit(1);
});
