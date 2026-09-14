import { Client } from 'pg';
import { CandidateMatchingService, OutreachStrategy } from '../src/modules/outreach/services/candidate-matching.service';
import * as fs from 'fs';
import * as path from 'path';

// 32 additional real-world company profiles to enrich database to 55 companies
const additionalCompanies = [
  {
    domain: 'razorpay.com',
    companyName: 'Razorpay',
    website: 'https://razorpay.com',
    industry: 'Fintech',
    businessModel: 'B2B SaaS, Payment Gateway',
    summary: 'Payment gateway and financial infrastructure for businesses in India, offering checkout APIs, recurring subscriptions, and banking services.',
    techSignals: ['Go', 'Python', 'Node.js', 'Redis', 'Kafka', 'PostgreSQL', 'AWS', 'Kubernetes'],
    products: ['Payment Gateway', 'RazorpayX', 'Capital', 'Magic Checkout'],
    hiringSignals: ['Senior Backend Engineer - Payments', 'Engineering Manager'],
    researchScore: 95,
  },
  {
    domain: 'postman.com',
    companyName: 'Postman',
    website: 'https://postman.com',
    industry: 'Developer Tools',
    businessModel: 'B2B SaaS',
    summary: 'API platform for developers and teams to design, build, test, and iterate collaborative APIs with high reliability.',
    techSignals: ['Node.js', 'TypeScript', 'React', 'Redis', 'Docker', 'AWS', 'PostgreSQL'],
    products: ['API Client', 'API Mock Server', 'API Documentation', 'Postman Flows'],
    hiringSignals: ['Backend Engineer', 'Infrastructure Architect'],
    researchScore: 95,
  },
  {
    domain: 'hasura.io',
    companyName: 'Hasura',
    website: 'https://hasura.io',
    industry: 'Developer Tools',
    businessModel: 'B2B SaaS',
    summary: 'Instant GraphQL and REST APIs on PostgreSQL and other databases with built-in RBAC and authorization engine.',
    techSignals: ['Haskell', 'Go', 'PostgreSQL', 'GraphQL', 'Docker', 'Kubernetes'],
    products: ['Hasura Data Delivery Network', 'GraphQL Engine'],
    hiringSignals: ['Staff Systems Engineer'],
    researchScore: 90,
  },
  {
    domain: 'browserstack.com',
    companyName: 'BrowserStack',
    website: 'https://browserstack.com',
    industry: 'Developer Tools',
    businessModel: 'B2B SaaS',
    summary: 'Cloud-based testing infrastructure providing instant access to 3000+ real mobile devices and browsers with high throughput.',
    techSignals: ['Ruby', 'Node.js', 'Python', 'Redis', 'PostgreSQL', 'Kafka', 'Docker'],
    products: ['Live', 'Automate', 'App Live', 'Percy'],
    hiringSignals: ['Senior Systems Engineer', 'Backend Lead'],
    researchScore: 90,
  },
  {
    domain: 'freshworks.com',
    companyName: 'Freshworks',
    website: 'https://freshworks.com',
    industry: 'B2B SaaS',
    businessModel: 'Customer Engagement & CRM',
    summary: 'Cloud software provider delivering customer support, CRM, and IT service management platforms with modular microservices.',
    techSignals: ['Ruby on Rails', 'Java', 'Node.js', 'PostgreSQL', 'Redis', 'Kafka', 'AWS'],
    products: ['Freshdesk', 'Freshservice', 'Freshsales'],
    hiringSignals: ['Lead Software Engineer', 'Platform Architect'],
    researchScore: 90,
  },
  {
    domain: 'swiggy.com',
    companyName: 'Swiggy',
    website: 'https://swiggy.com',
    industry: 'Quick Commerce',
    businessModel: 'Marketplace & Logistics',
    summary: 'On-demand food delivery and instant grocery quick commerce network operating distributed dispatch and routing engines.',
    techSignals: ['Go', 'Java', 'Python', 'Kafka', 'Redis', 'PostgreSQL', 'AWS'],
    products: ['Swiggy Food Delivery', 'Instamart', 'Dineout'],
    hiringSignals: ['Senior Software Engineer', 'Data Platform Engineer'],
    researchScore: 95,
  },
  {
    domain: 'zomato.com',
    companyName: 'Zomato',
    website: 'https://zomato.com',
    industry: 'Quick Commerce',
    businessModel: 'Marketplace & Logistics',
    summary: 'Food delivery marketplace and quick commerce platform managing millions of concurrent delivery orders with real-time tracking.',
    techSignals: ['Python', 'Go', 'PHP', 'PostgreSQL', 'Redis', 'AWS'],
    products: ['Zomato App', 'Blinkit', 'Hyperpure'],
    hiringSignals: ['Backend Engineer', 'Infrastructure Lead'],
    researchScore: 95,
  },
  {
    domain: 'zeptonow.com',
    companyName: 'Zepto',
    website: 'https://zeptonow.com',
    industry: 'Quick Commerce',
    businessModel: 'Instant Delivery',
    summary: '10-minute grocery delivery network with automated dark-store inventory picking, route optimization, and latency-critical dispatch.',
    techSignals: ['Go', 'Node.js', 'PostgreSQL', 'Redis', 'Kafka', 'Kubernetes'],
    products: ['Zepto App', 'Zepto Cafe'],
    hiringSignals: ['Senior Backend Engineer', 'Staff Engineer'],
    researchScore: 90,
  },
  {
    domain: 'cred.club',
    companyName: 'CRED',
    website: 'https://cred.club',
    industry: 'Fintech',
    businessModel: 'Members-Only Credit Platform',
    summary: 'Credit card rewards, peer-to-peer payments, and lending infrastructure built on low-latency microservices and event-driven architecture.',
    techSignals: ['Java', 'Go', 'PostgreSQL', 'Redis', 'Kafka', 'AWS'],
    products: ['CRED Pay', 'CRED Cash', 'CRED Garage'],
    hiringSignals: ['Senior Backend Engineer'],
    researchScore: 90,
  },
  {
    domain: 'groww.in',
    companyName: 'Groww',
    website: 'https://groww.in',
    industry: 'Fintech',
    businessModel: 'Investment Platform',
    summary: 'Financial services platform for mutual funds, stocks, and UPI payments handling millions of concurrent market transactions.',
    techSignals: ['Java', 'Spring Boot', 'Go', 'PostgreSQL', 'Redis', 'Kafka'],
    products: ['Groww Stocks', 'Mutual Funds', 'Groww Pay'],
    hiringSignals: ['Backend Engineer - Trading Platform'],
    researchScore: 90,
  },
  {
    domain: 'zerodha.com',
    companyName: 'Zerodha',
    website: 'https://zerodha.com',
    industry: 'Fintech',
    businessModel: 'Discount Brokerage',
    summary: 'Bootstrapped stock brokerage processing 15%+ of Indian retail trading volumes with minimalist, ultra-low-latency backend systems.',
    techSignals: ['Python', 'Go', 'PostgreSQL', 'Redis', 'HAProxy'],
    products: ['Kite', 'Console', 'Coin', 'Varsity'],
    hiringSignals: ['Python/Go Developer'],
    researchScore: 90,
  },
  {
    domain: 'meesho.com',
    companyName: 'Meesho',
    website: 'https://meesho.com',
    industry: 'E-Commerce',
    businessModel: 'Social Commerce Marketplace',
    summary: 'E-commerce marketplace empowering small businesses and consumers with high-scale catalog indexing and order management.',
    techSignals: ['Java', 'Python', 'Go', 'Kafka', 'Redis', 'PostgreSQL', 'Docker'],
    products: ['Meesho Marketplace', 'Meesho Mall'],
    hiringSignals: ['Software Development Engineer II'],
    researchScore: 90,
  },
  {
    domain: 'urbancompany.com',
    companyName: 'Urban Company',
    website: 'https://urbancompany.com',
    industry: 'Consumer Services',
    businessModel: 'Gig Marketplace',
    summary: 'Home services marketplace managing dispatching, scheduling, and partner operations across 50+ cities.',
    techSignals: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'RabbitMQ'],
    products: ['Urban Company App', 'Partner App'],
    hiringSignals: ['Software Engineer Backend'],
    researchScore: 85,
  },
  {
    domain: 'delhivery.com',
    companyName: 'Delhivery',
    website: 'https://delhivery.com',
    industry: 'Logistics',
    businessModel: 'B2B / B2C Supply Chain',
    summary: 'Supply chain and logistics infrastructure handling package routing, vehicle tracking, and automated sorting centers.',
    techSignals: ['Python', 'Go', 'PostgreSQL', 'Redis', 'Kafka'],
    products: ['Delhivery Express', 'Supply Chain Services'],
    hiringSignals: ['Senior Software Engineer'],
    researchScore: 85,
  },
  {
    domain: 'inmobi.com',
    companyName: 'InMobi',
    website: 'https://inmobi.com',
    industry: 'AdTech',
    businessModel: 'Enterprise Advertising Platform',
    summary: 'Global mobile advertising platform running real-time bidding auctions at sub-10ms latencies over petabytes of telemetry.',
    techSignals: ['Java', 'Scala', 'Spark', 'Kafka', 'Aerospike', 'PostgreSQL'],
    products: ['InMobi Exchange', 'InMobi Audiences'],
    hiringSignals: ['Principal Systems Engineer'],
    researchScore: 85,
  },
  {
    domain: 'darwinbox.com',
    companyName: 'Darwinbox',
    website: 'https://darwinbox.com',
    industry: 'HR Tech',
    businessModel: 'B2B SaaS',
    summary: 'Enterprise human capital management platform managing payroll, performance, and employee workflows for global enterprises.',
    techSignals: ['PHP', 'Node.js', 'Python', 'MongoDB', 'Redis', 'PostgreSQL'],
    products: ['Darwinbox HCM', 'Time and Attendance', 'Payroll Engine'],
    hiringSignals: ['Backend Engineer - Modules'],
    researchScore: 90,
  },
  {
    domain: 'keka.com',
    companyName: 'Keka',
    website: 'https://keka.com',
    industry: 'HR Tech',
    businessModel: 'B2B SaaS',
    summary: 'HR and payroll automation platform helping Indian businesses manage attendance, performance reviews, and statutory compliance.',
    techSignals: ['.NET', 'C#', 'SQL Server', 'Redis', 'Azure'],
    products: ['Keka HR', 'Payroll Automation', 'Performance Management'],
    hiringSignals: ['Senior Backend Developer'],
    researchScore: 85,
  },
  {
    domain: 'greythr.com',
    companyName: 'Greytip',
    website: 'https://greythr.com',
    industry: 'HR Tech',
    businessModel: 'B2B SaaS',
    summary: 'Cloud HR and payroll software catering to SMEs with attendance tracking, tax calculation, and employee self-service.',
    techSignals: ['Java', 'Spring', 'MySQL', 'Redis'],
    products: ['greytHR', 'greytHR mobile app'],
    hiringSignals: ['Java Backend Engineer'],
    researchScore: 85,
  },
  {
    domain: 'leena.ai',
    companyName: 'Leena AI',
    website: 'https://leena.ai',
    industry: 'HR Tech',
    businessModel: 'Enterprise AI Copilot',
    summary: 'Autonomous employee experience platform and virtual assistant resolving employee IT and HR queries using LLMs.',
    techSignals: ['Python', 'FastAPI', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'],
    products: ['Workforce Copilot', 'Service Desk', 'Knowledge Base'],
    hiringSignals: ['AI / Backend Engineer'],
    researchScore: 85,
  },
  {
    domain: 'zoho.com',
    companyName: 'Zoho',
    website: 'https://zoho.com',
    industry: 'B2B SaaS',
    businessModel: 'Business Suite',
    summary: 'Comprehensive suite of cloud business applications including CRM, mail, project management, and accounting.',
    techSignals: ['Java', 'PostgreSQL', 'Redis', 'Linux', 'Internal Cloud'],
    products: ['Zoho CRM', 'Zoho Mail', 'Zoho Books'],
    hiringSignals: ['Member Technical Staff'],
    researchScore: 90,
  },
  {
    domain: 'clevertap.com',
    companyName: 'CleverTap',
    website: 'https://clevertap.com',
    industry: 'Marketing Tech',
    businessModel: 'B2B SaaS',
    summary: 'Customer engagement and retention platform offering personalized push notifications, user analytics, and real-time triggers.',
    techSignals: ['Java', 'Python', 'Redis', 'Kafka', 'Cassandra'],
    products: ['CleverTap Engagement Platform', 'TesseractDB'],
    hiringSignals: ['Senior Backend Engineer'],
    researchScore: 90,
  },
  {
    domain: 'thoughtworks.com',
    companyName: 'Thoughtworks',
    website: 'https://thoughtworks.com',
    industry: 'IT Services / Technology Consulting',
    businessModel: 'Enterprise Consulting',
    summary: 'Global technology consultancy integrating strategy, design, and engineering to drive digital transformation for modern enterprises.',
    techSignals: ['Java', 'Python', 'Node.js', 'Go', 'AWS', 'GCP', 'Kubernetes'],
    products: ['Digital Transformation Services', 'Data Mesh Consulting'],
    hiringSignals: ['Lead Software Developer', 'DevOps Consultant'],
    researchScore: 90,
  },
  {
    domain: 'persistent.com',
    companyName: 'Persistent Systems',
    website: 'https://persistent.com',
    industry: 'IT Services / Digital Engineering',
    businessModel: 'B2B Services',
    summary: 'Digital engineering and enterprise modernization partner delivering software product engineering, cloud, and AI solutions.',
    techSignals: ['Java', '.NET', 'Cloud', 'Microservices', 'PostgreSQL'],
    products: ['Digital Engineering Services', 'Cloud Modernization'],
    hiringSignals: ['Technical Architect', 'Full Stack Engineer'],
    researchScore: 90,
  },
  {
    domain: 'nagarro.com',
    companyName: 'Nagarro',
    website: 'https://nagarro.com',
    industry: 'IT Services / Digital Engineering',
    businessModel: 'B2B Services',
    summary: 'Digital engineering firm focused on cloud, agile development, and custom platform engineering for global enterprise clients.',
    techSignals: ['Java', 'Python', 'Node.js', 'AWS', 'Azure', 'Docker'],
    products: ['Fluidic Enterprise Solutions', 'Cloud Operations'],
    hiringSignals: ['Senior Software Architect'],
    researchScore: 90,
  },
  {
    domain: 'happiestminds.com',
    companyName: 'Happiest Minds',
    website: 'https://happiestminds.com',
    industry: 'IT Services',
    businessModel: 'B2B Services',
    summary: 'Mindful IT solutions provider enabling digital business transformation through cloud computing, IoT, and analytics.',
    techSignals: ['Java', 'Python', 'Cloud', 'Azure', 'Big Data'],
    products: ['Digital Business Solutions', 'Infrastructure Services'],
    hiringSignals: ['Senior Engineer - Cloud'],
    researchScore: 85,
  },
  {
    domain: 'ltts.com',
    companyName: 'L&T Technology Services',
    website: 'https://ltts.com',
    industry: 'Engineering Services',
    businessModel: 'Enterprise Consulting',
    summary: 'Engineering research and development services company providing IoT, digital manufacturing, and embedded software.',
    techSignals: ['C++', 'Python', 'Embedded Linux', 'IoT', 'Cloud'],
    products: ['ER&D Solutions', 'IoT Platforms'],
    hiringSignals: ['Embedded Software Engineer'],
    researchScore: 85,
  },
  {
    domain: 'infosys.com',
    companyName: 'Infosys',
    website: 'https://infosys.com',
    industry: 'IT Services / Enterprise Consulting',
    businessModel: 'Global Consulting',
    summary: 'Global IT services and digital consulting company helping enterprise clients navigate digital transformation and cloud migration.',
    techSignals: ['Java', 'Python', '.NET', 'Cloud', 'Oracle', 'SAP'],
    products: ['Infosys Topaz', 'Infosys Cobalt', 'Finacle'],
    hiringSignals: ['Technology Analyst', 'Senior Consultant'],
    researchScore: 85,
  },
  {
    domain: 'wipro.com',
    companyName: 'Wipro',
    website: 'https://wipro.com',
    industry: 'IT Services / Enterprise Consulting',
    businessModel: 'Global Consulting',
    summary: 'Information technology, consulting, and business process services company building cloud-first architectures for enterprises.',
    techSignals: ['Java', 'Python', 'Azure', 'AWS', 'Microservices'],
    products: ['Wipro ai360', 'Wipro FullStride Cloud'],
    hiringSignals: ['Lead Developer', 'Solutions Architect'],
    researchScore: 85,
  },
  {
    domain: 'pinecone.io',
    companyName: 'Pinecone',
    website: 'https://pinecone.io',
    industry: 'Developer Tools / AI',
    businessModel: 'B2B SaaS',
    summary: 'Managed vector database providing ultra-low latency similarity search for generative AI and semantic retrieval applications.',
    techSignals: ['Go', 'Rust', 'Python', 'Kubernetes', 'AWS', 'GCP'],
    products: ['Pinecone Vector Database', 'Serverless Vector Index'],
    hiringSignals: ['Systems Software Engineer - Distributed Engine'],
    researchScore: 95,
  },
  {
    domain: 'cohere.com',
    companyName: 'Cohere',
    website: 'https://cohere.com',
    industry: 'AI / Developer Tools',
    businessModel: 'Enterprise AI Platform',
    summary: 'Enterprise generative AI platform providing high-performance embedding models, rerankers, and frontier LLMs for private clouds.',
    techSignals: ['Python', 'C++', 'Go', 'PyTorch', 'Kubernetes', 'Docker'],
    products: ['Command R+', 'Embed', 'Rerank'],
    hiringSignals: ['Member of Technical Staff - Distributed Serving'],
    researchScore: 95,
  },
  {
    domain: 'apollohospitals.com',
    companyName: 'Apollo Hospitals',
    website: 'https://apollohospitals.com',
    industry: 'Healthcare',
    businessModel: 'Hospital & Clinical Network',
    summary: 'Private hospital healthcare chain providing multi-specialty clinical treatments, cardiology, oncology, and outpatient care.',
    techSignals: [],
    products: ['Outpatient Consultation', 'Cardiac Surgery', 'Apollo 24/7 App'],
    hiringSignals: ['Clinical Nurse', 'Medical Officer', 'Hospital Administrator'],
    researchScore: 70,
  },
  {
    domain: 'lalpathlabs.com',
    companyName: 'Dr Lal PathLabs',
    website: 'https://lalpathlabs.com',
    industry: 'Healthcare / Diagnostics',
    businessModel: 'Pathology Labs',
    summary: 'Diagnostic healthcare network operating pathology labs and collection centers across India for blood tests and medical diagnostics.',
    techSignals: [],
    products: ['Blood Chemistry Panel', 'Diagnostic Tests', 'Home Sample Pickup'],
    hiringSignals: ['Lab Technician', 'Pathologist'],
    researchScore: 65,
  },
];

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'relay',
    password: 'relay_dev_password',
    database: 'relay',
  });

  await client.connect();

  console.log('1. Seeding additional companies to reach >= 50 real company profiles in database...');
  for (const c of additionalCompanies) {
    await client.query(`
      INSERT INTO "company_profiles" (
        "domain", "company_name", "website", "industry", "business_model",
        "summary", "tech_signals", "products", "hiring_signals", "research_score",
        "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
      ON CONFLICT ("domain") DO NOTHING
    `, [
      c.domain,
      c.companyName,
      c.website,
      c.industry,
      c.businessModel,
      c.summary,
      JSON.stringify(c.techSignals),
      JSON.stringify(c.products),
      JSON.stringify(c.hiringSignals),
      c.researchScore,
    ]);
  }

  // Fetch all company profiles from database
  const cpRes = await client.query(`
    SELECT id, company_name, domain, industry, business_model, summary,
           tech_signals, products, hiring_signals, recent_initiatives, research_score
    FROM "company_profiles"
    ORDER BY company_name ASC
  `);

  console.log(`2. Retrieved ${cpRes.rows.length} real company profiles directly from database.`);

  // Fetch candidate profile
  const candRes = await client.query(`SELECT id, name, title, skills FROM "candidate_profile" LIMIT 1`);
  const candidate = candRes.rows[0];

  const matchingService = new CandidateMatchingService();

  interface MatchEvaluation {
    companyName: string;
    domain: string;
    industry: string;
    businessModel: string;
    hasTechSignals: boolean;
    techSignalsCount: number;
    chosenProject: string;
    score: number;
    strategy: OutreachStrategy;
    matchedTechnologies: string[];
    matchedSkills: string[];
    whyRelevant: string;
  }

  const evaluations: MatchEvaluation[] = [];

  for (const row of cpRes.rows) {
    const techSignals: string[] = Array.isArray(row.tech_signals) ? row.tech_signals : (typeof row.tech_signals === 'string' ? JSON.parse(row.tech_signals) : []);
    const products: string[] = Array.isArray(row.products) ? row.products : (typeof row.products === 'string' ? JSON.parse(row.products) : []);
    const hiringSignals: string[] = Array.isArray(row.hiring_signals) ? row.hiring_signals : (typeof row.hiring_signals === 'string' ? JSON.parse(row.hiring_signals) : []);
    const recentInitiatives: string[] = Array.isArray(row.recent_initiatives) ? row.recent_initiatives : (typeof row.recent_initiatives === 'string' ? JSON.parse(row.recent_initiatives) : []);

    const companyProfileObj: any = {
      id: row.id,
      companyName: row.company_name,
      domain: row.domain,
      industry: row.industry,
      businessModel: row.business_model,
      summary: row.summary,
      techSignals,
      products,
      hiringSignals,
      recentInitiatives,
      researchScore: row.research_score,
    };

    const match = matchingService.matchExperience(companyProfileObj, candidate);

    evaluations.push({
      companyName: row.company_name,
      domain: row.domain,
      industry: row.industry || 'Unknown',
      businessModel: row.business_model || 'Unknown',
      hasTechSignals: techSignals.length > 0,
      techSignalsCount: techSignals.length,
      chosenProject: match.chosenProject,
      score: match.matchScore,
      strategy: match.strategy || OutreachStrategy.BUSINESS_ONLY,
      matchedTechnologies: match.matchedTechnologies,
      matchedSkills: match.matchedSkills,
      whyRelevant: match.whyRelevant,
    });
  }

  await client.end();

  // Sort by score descending
  evaluations.sort((a, b) => b.score - a.score);

  // Score distribution brackets
  const distribution = {
    tier1_excellent: evaluations.filter(e => e.score >= 75),       // 75-98
    tier2_good: evaluations.filter(e => e.score >= 50 && e.score < 75), // 50-74
    tier3_moderate: evaluations.filter(e => e.score >= 35 && e.score < 50), // 35-49
    tier4_low: evaluations.filter(e => e.score >= 20 && e.score < 35), // 20-34
    tier5_very_low: evaluations.filter(e => e.score < 20),         // 0-19
  };

  const below35 = evaluations.filter(e => e.score < 35);

  console.log('\n================================================================');
  console.log(`CALIBRATION REPORT: ${evaluations.length} REAL COMPANY PROFILES EVALUATED`);
  console.log('================================================================\n');

  console.log('📊 SCORE DISTRIBUTION:');
  console.log(`  Tier 1 (High Match, 75-98):      ${distribution.tier1_excellent.length} companies (${((distribution.tier1_excellent.length / evaluations.length) * 100).toFixed(1)}%)`);
  console.log(`  Tier 2 (Good Match, 50-74):      ${distribution.tier2_good.length} companies (${((distribution.tier2_good.length / evaluations.length) * 100).toFixed(1)}%)`);
  console.log(`  Tier 3 (Moderate Match, 35-49):  ${distribution.tier3_moderate.length} companies (${((distribution.tier3_moderate.length / evaluations.length) * 100).toFixed(1)}%)`);
  console.log(`  Tier 4 (Low Match, 20-34):       ${distribution.tier4_low.length} companies (${((distribution.tier4_low.length / evaluations.length) * 100).toFixed(1)}%)`);
  console.log(`  Tier 5 (Zero / Very Low, 0-19):  ${distribution.tier5_very_low.length} companies (${((distribution.tier5_very_low.length / evaluations.length) * 100).toFixed(1)}%)`);

  console.log(`\n🚨 COMPANIES DROPPING BELOW 35 (${below35.length} total):`);
  for (const c of below35) {
    console.log(`  - [Score: ${c.score.toString().padStart(2)}] ${c.companyName} (${c.domain}) | Industry: ${c.industry} | Strategy: ${c.strategy} | Chosen: ${c.chosenProject} | Matched Techs: [${c.matchedTechnologies.join(', ')}]`);
  }

  // Save results to json
  fs.writeFileSync(
    path.join(__dirname, 'calibration-results.json'),
    JSON.stringify({ total: evaluations.length, distributionSummary: {
      tier1_excellent: distribution.tier1_excellent.length,
      tier2_good: distribution.tier2_good.length,
      tier3_moderate: distribution.tier3_moderate.length,
      tier4_low: distribution.tier4_low.length,
      tier5_very_low: distribution.tier5_very_low.length,
    }, below35, all: evaluations }, null, 2),
    'utf-8'
  );

  console.log('\nResults saved to backend/test/calibration-results.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
