/**
 * Generalized Multi-Scenario Company Fixtures (Relay V3)
 *
 * Grounded fixtures representing diverse engineering domains to validate:
 * 1. Company A (Identity / Auth Platform): tenant-scoped authorization -> BranchGuard (Intern role)
 * 2. Company B (Event / Queue Platform): BullMQ / Redis worker pipelines -> SWE role
 * 3. Company C (Commerce / Product Platform - D'Rons Match): quick-commerce, order routing, vendor onboarding -> D'Rons Founder role
 * 4. Company D (Generic Stack): standard Postgres/AWS agency -> GENERIC_TECH_OVERLAP_ONLY
 * 5. Company E (AI/ML Infra - Negative Test): GPU cluster orchestration -> NO_SUFFICIENT_OUTREACH_ANGLE
 *    (Candidate only has Amazon ML Challenge under Activities; no production AI/ML deliverables are invented)
 * 6. Company F (Unrelated Domain): Casual mobile games -> NO_DOMAIN_ALIGNMENT / LOW_RELATIONSHIP_STRENGTH
 * 7. Company G (Insufficient Research): 0 crawl pages, empty summary -> INSUFFICIENT_COMPANY_RESEARCH
 * 8. Company H (Transient Crawl Failure): scraping timeout -> RESEARCH_RETRY_REQUIRED
 */

export interface ScenarioFixtureData {
  domain: string;
  companyName: string;
  website: string;
  industry: string;
  businessModel: string;
  companyStage: string;
  employeeRange: string;
  summary: string;
  products: string[];
  techSignals: string[];
  hiringSignals: string[];
  recentInitiatives: string[];
  evidence: Array<{
    source: string;
    url: string;
    type: string;
    quote: string;
  }>;
}

/**
 * FIXTURE A: Identity & Authorization Platform
 * Strong match on tenant-scoped authorization (BranchGuard - Intern)
 */
export const FIXTURE_A_AUTH_PLATFORM: ScenarioFixtureData = {
  domain: 'authzero-security.io',
  companyName: 'AuthZero Security',
  website: 'https://authzero-security.io',
  industry: 'Enterprise Identity & Cloud Security',
  businessModel: 'B2B SaaS',
  companyStage: 'Series B',
  employeeRange: '51-200',
  summary: 'Enterprise zero-trust authorization platform enforcing tenant-scoped access control, fine-grained RBAC policies, and real-time privilege escalation defense.',
  products: ['TenantGuard Cloud', 'AccessPolicy Engine'],
  techSignals: ['TypeScript', 'Node.js', 'PostgreSQL', 'OAuth2', 'RBAC', 'Docker'],
  hiringSignals: ['Senior Security Engineer', 'Backend Authorization Engineer'],
  recentInitiatives: ['Shipped automated tenant isolation policy validator', 'SOC2 type II compliance automation'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://authzero-security.io',
      type: 'HOMEPAGE',
      quote: 'Our multi-tenant access control engine enforces tenant-scoped authorization and prevents cross-tenant data leaks across microservices.',
    },
    {
      source: 'PRODUCT',
      url: 'https://authzero-security.io/product',
      type: 'PRODUCT',
      quote: 'Designed for zero-trust enterprise cloud environments requiring automated privilege escalation defense and branch-based policy evaluation.',
    },
  ],
};

/**
 * FIXTURE B: Distributed Event & Queue Platform
 * Strong match on BullMQ notification engine / event-driven ActivityLog (SWE role)
 */
export const FIXTURE_B_EVENT_QUEUE_PLATFORM: ScenarioFixtureData = {
  domain: 'queuepulse-systems.io',
  companyName: 'QueuePulse Systems',
  website: 'https://queuepulse-systems.io',
  industry: 'Distributed Systems & Event Infrastructure',
  businessModel: 'B2B Infrastructure SaaS',
  companyStage: 'Series A',
  employeeRange: '20-50',
  summary: 'High-throughput asynchronous event orchestration platform processing background queue pipelines, automated retry policies, and centralized audit trails.',
  products: ['EventPulse Engine', 'StreamWorker'],
  techSignals: ['Redis', 'BullMQ', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
  hiringSignals: ['Distributed Systems Engineer', 'Backend Platform Engineer'],
  recentInitiatives: ['Scaled asynchronous task execution engine to 10M daily events', 'Introduced dead-letter queue recovery workflows'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://queuepulse-systems.io',
      type: 'HOMEPAGE',
      quote: 'High-throughput asynchronous job workers running on Redis and BullMQ to power decoupled background processing at scale.',
    },
    {
      source: 'ARCHITECTURE',
      url: 'https://queuepulse-systems.io/architecture',
      type: 'ARCHITECTURE',
      quote: 'Centralized event logging infrastructure standardizing audit trails across distributed microservice transactions with guaranteed idempotent delivery.',
    },
  ],
};

/**
 * FIXTURE C: Quick-Commerce & Merchant Delivery (D'Rons Match)
 * Strong match on D'Rons Founder experience (custom backend APIs, WordPress integration, order-management workflows).
 * Validates zero cross-role bleed with The Ninja Studio.
 */
export const FIXTURE_C_COMMERCE_PRODUCT: ScenarioFixtureData = {
  domain: 'dropcart-commerce.shop',
  companyName: 'DropCart Commerce',
  website: 'https://dropcart-commerce.shop',
  industry: 'Quick Commerce & Marketplace Logistics',
  businessModel: 'Marketplace & B2B SaaS',
  companyStage: 'Seed',
  employeeRange: '10-25',
  summary: 'Quick-commerce and merchant delivery infrastructure powering local vendor onboarding, real-time inventory synchronization, and custom checkout workflows.',
  products: ['DropCart Core', 'Merchant Connect'],
  techSignals: ['WordPress', 'WooCommerce', 'REST APIs', 'Node.js', 'MySQL', 'JavaScript'],
  hiringSignals: ['Full Stack Lead', 'Commerce Backend Engineer'],
  recentInitiatives: ['Expanded vendor onboarding workflow to 50 local retail partners', 'Integrated custom order routing gateway with WordPress storefront'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://dropcart-commerce.shop',
      type: 'HOMEPAGE',
      quote: 'Built custom backend APIs and order-management workflows integrated with our storefront to streamline fast local delivery.',
    },
    {
      source: 'ABOUT',
      url: 'https://dropcart-commerce.shop/about',
      type: 'ABOUT',
      quote: 'End-to-end merchant platform supporting rapid vendor onboarding, custom catalog management, and automated fulfillment routing.',
    },
  ],
};

/**
 * FIXTURE D: Generic Tech Stack Agency
 * Standard web agency using Node.js / PostgreSQL / AWS with no architectural alignment.
 * Must produce GENERIC_TECH_OVERLAP_ONLY.
 */
export const FIXTURE_D_GENERIC_STACK: ScenarioFixtureData = {
  domain: 'standardweb-digital.agency',
  companyName: 'StandardWeb Digital',
  website: 'https://standardweb-digital.agency',
  industry: 'Web Design & Digital Marketing',
  businessModel: 'Agency & Services',
  companyStage: 'Bootstrapped',
  employeeRange: '10-20',
  summary: 'Full-service digital agency building standard web portals, responsive landing pages, and content management websites for regional retail businesses.',
  products: ['Business Web Portals', 'Marketing Sites'],
  techSignals: ['AWS', 'Node.js', 'PostgreSQL', 'HTML5', 'CSS3', 'WordPress'],
  hiringSignals: ['Junior Web Developer'],
  recentInitiatives: ['Launched redesigned company portfolio website'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://standardweb-digital.agency',
      type: 'HOMEPAGE',
      quote: 'We design clean digital web portals hosted on AWS utilizing standard PostgreSQL databases and Node.js backends for small business clients.',
    },
  ],
};

/**
 * FIXTURE E: AI/ML Infrastructure & GPU Orchestration (NEGATIVE TEST)
 * Deep neural network training, CUDA kernels, and GPU cluster orchestration.
 * Candidate's resume contains only Amazon ML Challenge under Activities (no production AI/ML engineering deliverables).
 * Must produce NO_SUFFICIENT_OUTREACH_ANGLE without inventing deliverables.
 */
export const FIXTURE_E_AIML_INFRA: ScenarioFixtureData = {
  domain: 'tensorgrid-compute.ai',
  companyName: 'TensorGrid Compute',
  website: 'https://tensorgrid-compute.ai',
  industry: 'AI/ML Infrastructure & GPU Orchestration',
  businessModel: 'Enterprise Infrastructure SaaS',
  companyStage: 'Series A',
  employeeRange: '30-60',
  summary: 'Distributed GPU compute fabric optimizing multi-node deep neural network training, automated tensor parallelism, and low-latency LLM inference pipelines.',
  products: ['TensorCluster', 'vLLM Gateway'],
  techSignals: ['PyTorch', 'CUDA', 'vLLM', 'Triton', 'Ray', 'Python', 'Kubernetes'],
  hiringSignals: ['Staff GPU Systems Engineer', 'Distributed Training Specialist'],
  recentInitiatives: ['Benchmarked custom Triton flash-attention kernels on H100 clusters', 'Deployed automated PyTorch checkpoint sharding'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://tensorgrid-compute.ai',
      type: 'HOMEPAGE',
      quote: 'Automated distributed GPU orchestration engine managing large language model inference pipelines and PyTorch checkpoint synchronization.',
    },
    {
      source: 'TECHNOLOGY',
      url: 'https://tensorgrid-compute.ai/technology',
      type: 'TECHNOLOGY',
      quote: 'Custom CUDA kernel optimization and tensor parallelism for multi-node deep neural network training clusters.',
    },
  ],
};

/**
 * FIXTURE F: Completely Unrelated Domain
 * Casual mobile game studio.
 * Must produce NO_DOMAIN_ALIGNMENT or LOW_RELATIONSHIP_STRENGTH.
 */
export const FIXTURE_F_UNRELATED_DOMAIN: ScenarioFixtureData = {
  domain: 'pixelpop-games.com',
  companyName: 'PixelPop Casual Games',
  website: 'https://pixelpop-games.com',
  industry: 'Mobile Gaming & Entertainment',
  businessModel: 'B2C Mobile Gaming',
  companyStage: 'Seed',
  employeeRange: '15-30',
  summary: 'Casual mobile game studio creating free-to-play match-3 puzzle titles and interactive cartoon characters for mobile app stores.',
  products: ['JellyBlast Pop', 'GemQuest 3D'],
  techSignals: ['Unity', 'C#', 'Unreal Engine', 'Blender', 'Swift'],
  hiringSignals: ['Game Animator', 'Level Designer'],
  recentInitiatives: ['Released Halloween theme pack for JellyBlast Pop'],
  evidence: [
    {
      source: 'HOMEPAGE',
      url: 'https://pixelpop-games.com',
      type: 'HOMEPAGE',
      quote: 'Creating addictive match-3 puzzle mechanics and vibrant 3D animations for millions of casual mobile gamers worldwide.',
    },
  ],
};

/**
 * FIXTURE G: Deficient Company Research
 * 0 crawl pages, empty summary.
 * Must produce INSUFFICIENT_COMPANY_RESEARCH.
 */
export const FIXTURE_G_EMPTY_RESEARCH: ScenarioFixtureData = {
  domain: 'stealth-empty-profile.io',
  companyName: 'Stealth Empty Inc',
  website: 'https://stealth-empty-profile.io',
  industry: '',
  businessModel: '',
  companyStage: '',
  employeeRange: '',
  summary: '',
  products: [],
  techSignals: [],
  hiringSignals: [],
  recentInitiatives: [],
  evidence: [],
};

/**
 * FIXTURE H: Transient Crawler Failure
 * Transient scrape error.
 * Must be marked RESEARCH_RETRY_REQUIRED.
 */
export const FIXTURE_H_TRANSIENT_FAILURE = {
  domain: 'flaky-transient-network.io',
  companyName: 'FlakyNet Systems',
  errorMessage: 'ETIMEDOUT: Connection timed out after 30000ms while fetching homepage',
};
