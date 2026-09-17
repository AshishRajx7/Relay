/**
 * SourceFuse Regression Fixture
 * 
 * IMPORTANT: This fixture exists strictly for regression testing and validation of:
 * 1. Strict separation of candidate roles:
 *    - Backend Engineering Intern (Feb 2026 - Aug 2026): BranchGuard tenant authorization & bypass fix
 *    - Software Engineer (Aug 2026 - Present): Redis caching for BranchGuard
 * 2. Zero synthesized company quotes: all quotes must be exact contiguous substrings of the crawled markdown.
 * 3. Adversarial claim verification: detecting and rejecting cross-role bleed.
 * 
 * Production code must NEVER reference SourceFuse or encode expected relationship rules for it.
 */

export const SOURCEFUSE_RAW_CRAWLED_MARKDOWN = `# SourceFuse | Cloud Transformation & Modernization

## Built for Scale and Compliance
We build cloud-native applications, modernization platforms, and enterprise data solutions.
AWS Premier Tier Services Partner specializing in cloud modernization, healthcare compliance, and microservices architecture.

### Featured Case Studies
From Spreadsheets to a Scalable Compliance Platform Designed and built AssessLens, a cloud-native regtech platform, taking a startup from idea to market-ready product without the hiring lag.

Our engineering teams deliver:
- Cloud-native microservices architecture on AWS
- Multi-tenant data governance and access control
- HIPAA and SOC2 compliance automation
- High-concurrency database performance tuning

Visit us at https://sourcefuse.com or contact our engineering leads.
`;

export const SOURCEFUSE_FIXTURE_DATA = {
  domain: 'sourcefuse.com',
  companyName: 'SourceFuse',
  website: 'https://sourcefuse.com',
  industry: 'Cloud Transformation & Enterprise Software',
  businessModel: 'B2B Services & Digital Engineering',
  companyStage: 'Scaleup',
  employeeRange: '501-1000',
  summary: 'Cloud transformation consultancy and AWS Premier Partner delivering cloud-native modernization, healthcare regtech platforms, and microservices architecture.',
  products: ['AssessLens'],
  techSignals: ['AWS', 'Microservices', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
  hiringSignals: ['Senior Cloud Architect', 'Backend Engineer'],
  recentInitiatives: ['Launched AssessLens regtech compliance platform', 'AWS Premier Tier expansion'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://sourcefuse.com',
      type: 'HOMEPAGE',
      quote: 'From Spreadsheets to a Scalable Compliance Platform Designed and built AssessLens, a cloud-native regtech platform, taking a startup from idea to market-ready product without the hiring lag.',
    },
    {
      source: 'HOMEPAGE',
      url: 'https://sourcefuse.com',
      type: 'HOMEPAGE',
      quote: 'AWS Premier Tier Services Partner specializing in cloud modernization, healthcare compliance, and microservices architecture.',
    },
  ],
};

export const SOURCEFUSE_EXPECTED_REGRESSION_CRITERIA = {
  forbiddenProductionStrings: ['sourcefuse', 'SourceFuse'],
  internshipRoleTitle: 'Backend Engineering Intern',
  internshipDateRange: '2026-02 – 2026-08',
  internshipDeliverable: 'BranchGuard',
  fullTimeRoleTitle: 'Software Engineer',
  fullTimeDateRange: '2026-08 – Present',
  fullTimeDeliverable: 'Redis caching for BranchGuard',
  founderRoleTitle: 'Founder and Full Stack Lead',
  founderEmployer: "D'Rons",
};
