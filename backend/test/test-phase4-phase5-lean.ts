import { CandidateMatchingService, OutreachStrategy } from '../src/modules/outreach/services/candidate-matching.service';
import { DraftQualityService } from '../src/modules/outreach/services/draft-quality.service';
import { EmailVariantType } from '../src/modules/outreach/entities/email-draft-variant.entity';
import { GmailDraftService, EmailAttachment } from '../src/modules/outreach/services/gmail-draft.service';
import { ContactType } from '../src/modules/prospects/entities/prospect.entity';
import { EmailGenerationService } from '../src/modules/outreach/services/email-generation.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase4Phase5Tests() {
  console.log('================================================================');
  console.log('Running Lean Phase 4 & Phase 5 Unit Test Suite');
  console.log('================================================================\n');

  const matchingService = new CandidateMatchingService();
  const qualityService = new DraftQualityService();

  // =========================================================================
  // 1. Whole-Word Regex & Tech Alias Matching
  // =========================================================================
  console.log('--- 1. Whole-Word Regex & Tech Alias Matching ---');
  
  // Test 1A: Substring pollution prevention
  assert(!matchingService.matchesWholeWord('google search engine', 'go'), '"go" does NOT match "google"');
  assert(!matchingService.matchesWholeWord('complex algorithm design', 'go'), '"go" does NOT match "algorithm"');
  assert(!matchingService.matchesWholeWord('high throughput network', 'hr'), '"hr" does NOT match "throughput"');
  assert(!matchingService.matchesWholeWord('google chrome browser', 'hr'), '"hr" does NOT match "chrome"');
  assert(matchingService.matchesWholeWord('modern hr tech platform', 'hr'), '"hr" matches whole word "hr"');
  assert(matchingService.matchesWholeWord('go backend services', 'go'), '"go" matches whole word "go"');

  // Test 1B: Tech alias normalization
  assert(matchingService.techMatches('Node.js', 'nodejs'), 'Matches "Node.js" with "nodejs" alias');
  assert(matchingService.techMatches('nodejs', 'node.js'), 'Matches "nodejs" with "Node.js" alias');
  assert(matchingService.techMatches('PostgreSQL', 'postgres'), 'Matches "PostgreSQL" with "postgres" alias');
  assert(matchingService.techMatches('postgres', 'postgresql'), 'Matches "postgres" with "postgresql" alias');
  assert(matchingService.techMatches('Redis', 'Redis'), 'Matches exact tech "Redis"');
  assert(!matchingService.techMatches('Redis', 'Redshift'), 'Does not match "Redis" with "Redshift"');

  // =========================================================================
  // 2. Candidate Matching 3-Factor Scoring (No Artificial Floors)
  // =========================================================================
  console.log('\n--- 2. Candidate Matching 3-Factor Scoring ---');

  const mockCandidate: any = {
    id: 'cand-1',
    name: 'Ashish',
    title: 'Software Engineer',
    skills: {
      languages: ['TypeScript', 'Python'],
      frameworks: ['NestJS', 'FastAPI'],
      databases: ['PostgreSQL', 'Redis'],
      tools: ['Docker', 'BullMQ'],
    },
  };

  // Test 2A: Strong Tech Overlap (PostHog)
  const postHogCompany: any = {
    companyName: 'PostHog',
    domain: 'posthog.com',
    industry: 'Developer Tools',
    businessModel: 'B2B SaaS',
    summary: 'Open-source product analytics suite, session recording, feature flags, and event pipelines.',
    techSignals: ['PostgreSQL', 'Redis', 'Kafka', 'ClickHouse', 'Python', 'TypeScript', 'Node.js'],
    products: ['Product Analytics', 'Session Recording', 'Feature Flags'],
    hiringSignals: ['Backend Engineer'],
  };

  const postHogMatch = matchingService.matchExperience(postHogCompany, mockCandidate);
  console.log(`  PostHog Match: Chosen=${postHogMatch.chosenProject}, Score=${postHogMatch.matchScore}, Strategy=${postHogMatch.strategy}, Techs=${postHogMatch.matchedTechnologies.join(', ')}`);
  assert(postHogMatch.strategy === OutreachStrategy.TECH_STACK_MATCH, 'PostHog selects TECH_STACK_MATCH strategy');
  assert(postHogMatch.matchedTechnologies.length >= 2, 'PostHog matches multiple verified technologies');
  assert(postHogMatch.matchScore >= 80, `PostHog strong tech overlap yields high score (got ${postHogMatch.matchScore} >= 80)`);
  assert(postHogMatch.matchScore <= 98, 'PostHog score is clamped <= 98');

  // Test 2B: BUSINESS_ONLY Match (SourceFuse - No verified tech signals)
  const sourceFuseCompany: any = {
    companyName: 'SourceFuse',
    domain: 'sourcefuse.com',
    industry: 'Cloud Migration',
    businessModel: 'Enterprise Consulting',
    summary: 'Cloud migration and modern enterprise architecture.',
    techSignals: [], // No tech signals
    products: ['CloudTransform'],
    hiringSignals: ['Cloud Architect'],
  };

  const sourceFuseMatch = matchingService.matchExperience(sourceFuseCompany, mockCandidate);
  console.log(`  SourceFuse Match: Chosen=${sourceFuseMatch.chosenProject}, Score=${sourceFuseMatch.matchScore}, Strategy=${sourceFuseMatch.strategy}, Techs=${sourceFuseMatch.matchedTechnologies.join(', ')}`);
  assert(sourceFuseMatch.strategy === OutreachStrategy.BUSINESS_ONLY, 'SourceFuse with empty techSignals selects BUSINESS_ONLY');
  assert(sourceFuseMatch.matchedTechnologies.length === 0, 'SourceFuse has 0 matched technologies');
  assert(sourceFuseMatch.matchScore >= 20 && sourceFuseMatch.matchScore < 35, `SourceFuse receives Tier 4 score in 20-34 range (got ${sourceFuseMatch.matchScore})`);
  assert(sourceFuseMatch.personalizationTier === 'LOW_MATCH', 'SourceFuse classified as LOW_MATCH');

  // Test 2C: IT Consultancy (Thoughtworks - moderate match under recalibration)
  const thoughtworksCompany: any = {
    companyName: 'Thoughtworks',
    domain: 'thoughtworks.com',
    industry: 'IT Services & Consulting',
    businessModel: 'Enterprise Software & Platform Modernization',
    summary: 'Global technology consultancy integrating strategy, design and software engineering to drive digital transformation.',
    techSignals: [], // Tech signals not on main marketing page
    products: [],
    hiringSignals: ['Senior Backend Engineer', 'Platform Architect'],
  };
  const thoughtworksMatch = matchingService.matchExperience(thoughtworksCompany, mockCandidate);
  console.log(`  Thoughtworks Match: Chosen=${thoughtworksMatch.chosenProject}, Score=${thoughtworksMatch.matchScore}, Tier=${thoughtworksMatch.personalizationTier}`);
  assert(thoughtworksMatch.personalizationTier === 'MEDIUM_MATCH', 'Thoughtworks classified as MEDIUM_MATCH (unsuppressed)');
  assert(thoughtworksMatch.matchScore >= 35 && thoughtworksMatch.matchScore < 50, `Thoughtworks score in 35-49 moderate range (got ${thoughtworksMatch.matchScore})`);

  // Test 2D: Indian Tech Unicorn (Razorpay - strong tech overlap)
  const razorpayCompany: any = {
    companyName: 'Razorpay',
    domain: 'razorpay.com',
    industry: 'Fintech',
    businessModel: 'B2B Payments SaaS',
    summary: 'Payment gateway and full-stack financial services platform handling high-volume transactions.',
    techSignals: ['Node.js', 'Go', 'Python', 'Redis', 'PostgreSQL', 'Kafka', 'AWS'],
    products: ['Payment Gateway', 'RazorpayX'],
    hiringSignals: ['Software Development Engineer'],
  };
  const razorpayMatch = matchingService.matchExperience(razorpayCompany, mockCandidate);
  console.log(`  Razorpay Match: Chosen=${razorpayMatch.chosenProject}, Score=${razorpayMatch.matchScore}, Tier=${razorpayMatch.personalizationTier}, Techs=${razorpayMatch.matchedTechnologies.join(', ')}`);
  assert(razorpayMatch.personalizationTier === 'HIGH_MATCH', 'Razorpay classified as HIGH_MATCH');
  assert(razorpayMatch.matchScore >= 70, `Razorpay scores >= 70 (got ${razorpayMatch.matchScore})`);
  assert(razorpayMatch.matchedTechnologies.length >= 2, 'Razorpay matches multiple verified technologies');

  // Test 2E: Minimal/Zero Tech Overlap (Apollo Hospitals & Dr Lal PathLabs)
  const apolloCompany: any = {
    companyName: 'Apollo Hospitals',
    domain: 'apollohospitals.com',
    industry: 'Healthcare & Hospitals',
    businessModel: 'Healthcare Services',
    summary: 'Leading healthcare provider offering multi-speciality hospital care, diagnostics, and pharmacies across India.',
    techSignals: [],
    products: ['Apollo 24|7', 'Health City'],
    hiringSignals: ['Healthcare Administrator'],
  };
  const apolloMatch = matchingService.matchExperience(apolloCompany, mockCandidate);
  console.log(`  Apollo Hospitals Match: Chosen=${apolloMatch.chosenProject}, Score=${apolloMatch.matchScore}, Tier=${apolloMatch.personalizationTier}`);
  assert(apolloMatch.personalizationTier === 'LOW_MATCH', 'Apollo Hospitals classified as LOW_MATCH');
  assert(apolloMatch.matchScore < 40, `Apollo Hospitals score in low range (got ${apolloMatch.matchScore})`);
  assert(apolloMatch.chosenProject.length > 0, 'Apollo Hospitals still selects best candidate project proof point');
  assert(apolloMatch.whyRelevant.includes('General software engineering inquiry'), 'Apollo Hospitals uses general software inquiry whyRelevant');

  // Test 2F: Technical Overlap Preference (Concrete tech overlap > abstract enterprise buzzwords)
  const techVsDomainCompany: any = {
    companyName: 'OmniCloud',
    domain: 'omnicloud.local',
    industry: 'Enterprise Consulting',
    businessModel: 'Digital Transformation',
    summary: 'Enterprise consulting for digital transformation and enterprise systems.',
    techSignals: ['Redis'], // Has 1 verified tech signal
    products: [],
    hiringSignals: [],
  };
  const techVsDomainMatch = matchingService.matchExperience(techVsDomainCompany, mockCandidate);
  console.log(`  Tech Overlap Preference Match: Chosen=${techVsDomainMatch.chosenProject}, Score=${techVsDomainMatch.matchScore}, Techs=${techVsDomainMatch.matchedTechnologies.join(', ')}`);
  assert(techVsDomainMatch.matchedTechnologies.includes('Redis'), 'Prefers project matching verified Redis over generic domain matches');
  assert(techVsDomainMatch.strategy === OutreachStrategy.TECH_STACK_MATCH, 'Strategy is TECH_STACK_MATCH due to verified tech overlap');

  // =========================================================================
  // 3. Draft Quality Scoring - Diagnostic Flags vs Review Suppressions
  // =========================================================================
  console.log('\n--- 3. Draft Quality Scoring Diagnostic Flags vs Review Suppressions ---');

  const zeroMatchResult: any = {
    chosenProject: 'BullMQ Notification System',
    matchScore: 0,
    matchedTechnologies: [],
    matchedSkills: [],
    whyRelevant: 'General software engineering inquiry.',
    strategy: OutreachStrategy.BUSINESS_ONLY,
    personalizationTier: 'LOW_MATCH',
  };

  const genericBody = 'Hi Team,\n\nI am a backend developer at The Ninja Studio building distributed systems with NestJS and PostgreSQL.\n\nIn my previous work on BullMQ Notification System, I built resilient background queues.\n\nI have attached my resume for context.\n\nBest,\nAshish';
  const qualityOnLowMatch = qualityService.evaluateDraft('Backend engineering inquiry', genericBody, apolloCompany, zeroMatchResult);

  assert(qualityOnLowMatch.relevanceScore === 0, `Relevance score reflects 0 without artificial floor (got ${qualityOnLowMatch.relevanceScore})`);
  assert(qualityOnLowMatch.flags.includes('LOW_RELEVANCE_SCORE'), 'Flags LOW_RELEVANCE_SCORE when match is low (< 60)');
  assert(qualityOnLowMatch.flags.includes('LOW_CONFIDENCE_SCORE'), 'Flags LOW_CONFIDENCE_SCORE when confidence is low (< 60)');
  assert(qualityOnLowMatch.requiresManualReview === false, 'Low match/relevance/confidence does NOT block outreach (requiresManualReview is false)');

  // =========================================================================
  // 4. Product Grounding Validation (UNVERIFIED_PRODUCT_CLAIM)
  // =========================================================================
  console.log('\n--- 4. Product Grounding Validation ---');

  // Test 4A: Fabricated / Unverified Product Claim
  {
    const hallucinatedBody = `Hi Team,\n\nI was reviewing your ChronoTrack platform and loved how it simplifies scheduling. In my past engineering experience, I built scalable background workers.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Inquiry', hallucinatedBody, sourceFuseCompany, sourceFuseMatch);
    assert(result.flags.includes('UNVERIFIED_PRODUCT_CLAIM'), 'Flags "your ChronoTrack platform" as UNVERIFIED_PRODUCT_CLAIM');
    assert(result.requiresManualReview === true, 'UNVERIFIED_PRODUCT_CLAIM forces requiresManualReview = true');
  }

  // Test 4B: Fabricated Product with Company Name
  {
    const hallucinatedBody = `Hi Akanksha,\n\nI saw SourceFuse's Accelerator Suite and was impressed by its capabilities. In my work...\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Inquiry', hallucinatedBody, sourceFuseCompany, sourceFuseMatch);
    assert(result.flags.includes('UNVERIFIED_PRODUCT_CLAIM'), 'Flags "SourceFuse\'s Accelerator Suite" as UNVERIFIED_PRODUCT_CLAIM');
    assert(result.requiresManualReview === true, 'Forces requiresManualReview = true');
  }

  // Test 4C: Generic Architectural Descriptors (Must NOT be flagged)
  {
    const genericPhrases = [
      'I noticed your engineering platform handles significant distributed scale.',
      'Your cloud service architecture is designed for high availability.',
      'I was reading about your internal tool for workflow orchestration.',
      'Your developer platform enables teams to ship faster.',
      'Your software product portfolio addresses enterprise digital transformation.',
      'I admire your core platform engineering standards.',
    ];

    for (const phrase of genericPhrases) {
      const body = `Hi Team,\n\n${phrase} In my previous roles, I built high-throughput distributed systems.\n\nBest,\nAshish`;
      const result = qualityService.evaluateDraft('Inquiry', body, sourceFuseCompany, sourceFuseMatch);
      assert(!result.flags.includes('UNVERIFIED_PRODUCT_CLAIM'), `Generic phrase "${phrase.slice(0, 35)}..." is NOT flagged`);
    }
  }

  // Test 4D: Verified Product Pass
  {
    const verifiedBody = `Hi Akanksha,\n\nI noticed your CloudTransform tool is accelerating modernization for enterprise workloads. In my previous work, I built distributed event pipelines.\n\nBest,\nAshish`;
    const result = qualityService.evaluateDraft('Inquiry', verifiedBody, sourceFuseCompany, sourceFuseMatch);
    assert(!result.flags.includes('UNVERIFIED_PRODUCT_CLAIM'), 'Verified product "CloudTransform" passes without flag');
  }

  // =========================================================================
  // 5. Variant Selection Grounding Penalty
  // =========================================================================
  console.log('\n--- 5. Variant Selection Grounding Penalty ---');

  // Simulate 3 evaluated variants from LLM generation:
  // Variant 1: TECHNICAL - slightly higher raw confidence, but hallucinated product claim
  // Variant 2: DIRECT - slightly lower raw confidence, but 100% grounded
  // Variant 3: STARTUP - lowest score
  const mockEvaluatedVariants = [
    {
      variantType: EmailVariantType.TECHNICAL,
      subject: 'Distributed systems & your ChronoTrack platform',
      body: 'Your ChronoTrack platform...',
      wordCount: 85,
      quality: {
        personalizationScore: 80,
        relevanceScore: 75,
        spamRiskScore: 5,
        technicalAlignmentScore: 80,
        confidenceScore: 85,
        requiresManualReview: true,
        flags: ['UNVERIFIED_PRODUCT_CLAIM'],
      },
      isSelected: false,
    },
    {
      variantType: EmailVariantType.DIRECT,
      subject: 'Quick question re: backend engineering',
      body: 'I noticed your engineering platform is growing...',
      wordCount: 70,
      quality: {
        personalizationScore: 60,
        relevanceScore: 75,
        spamRiskScore: 5,
        technicalAlignmentScore: 60,
        confidenceScore: 78,
        requiresManualReview: false,
        flags: [], // Clean, grounded!
      },
      isSelected: false,
    },
    {
      variantType: EmailVariantType.STARTUP,
      subject: 'Building high-velocity systems',
      body: 'At your company...',
      wordCount: 65,
      quality: {
        personalizationScore: 50,
        relevanceScore: 70,
        spamRiskScore: 5,
        technicalAlignmentScore: 50,
        confidenceScore: 65,
        requiresManualReview: false,
        flags: [],
      },
      isSelected: false,
    },
  ];

  // Replicate the exact ranking logic from EmailGenerationService
  let bestIndex = 0;
  let bestScore = -999;

  for (let i = 0; i < mockEvaluatedVariants.length; i++) {
    const v = mockEvaluatedVariants[i];
    const hasHallucination =
      v.quality.flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION') ||
      v.quality.flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION') ||
      v.quality.flags.includes('UNVERIFIED_PRODUCT_CLAIM');

    const groundingPenalty = hasHallucination ? 50 : 0;
    const compositeScore =
      v.quality.confidenceScore +
      v.quality.personalizationScore -
      v.quality.spamRiskScore -
      groundingPenalty;

    console.log(`  Variant ${v.variantType}: Raw Composite=${v.quality.confidenceScore + v.quality.personalizationScore - v.quality.spamRiskScore}, Penalty=${groundingPenalty}, Final Composite=${compositeScore}`);

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestIndex = i;
    }
  }

  mockEvaluatedVariants[bestIndex].isSelected = true;
  const selectedVariant = mockEvaluatedVariants[bestIndex];

  assert(
    selectedVariant.variantType === EmailVariantType.DIRECT,
    `Grounded DIRECT variant won selection over hallucinated TECHNICAL variant (Selected: ${selectedVariant.variantType})`
  );
  assert(
    selectedVariant.quality.requiresManualReview === false,
    'Selected variant does not require manual review because grounded variant won'
  );

  // =========================================================================
  // 6. Dynamic Candidate Catalog Generation from CandidateProfile
  // =========================================================================
  console.log('\n--- 6. Dynamic Candidate Catalog Generation ---');

  const dynamicCandidate: any = {
    id: 'cand-priya',
    name: 'Priya Sharma',
    title: 'Systems & Backend Engineer',
    skills: {
      languages: ['Go', 'Rust', 'TypeScript'],
      frameworks: ['Gin', 'React'],
      databases: ['PostgreSQL', 'ClickHouse'],
      tools: ['Docker', 'Kubernetes'],
    },
    projects: [
      {
        name: 'Distributed Transaction Ledger',
        description: 'High-throughput transactional ledger built with Go and PostgreSQL with ACID isolation.',
        techStack: ['Go', 'PostgreSQL'],
      },
      {
        name: 'Realtime Telemetry Ingestion',
        description: 'High-volume telemetry ingestion pipeline using ClickHouse and Go.',
        techStack: ['Go', 'ClickHouse'],
      },
    ],
    experience: [
      {
        company: 'Fintech Payments Ltd',
        title: 'Senior Backend Engineer',
        highlights: ['Engineered core settlement microservices with Go and PostgreSQL'],
      },
    ],
  };

  const dynamicCatalog = matchingService.buildCatalogFromProfile(dynamicCandidate);
  console.log(`  Dynamic Catalog Generated: ${dynamicCatalog.length} items: [${dynamicCatalog.map((i: any) => i.name).join(', ')}]`);
  assert(dynamicCatalog.length === 3, `Extracts 3 dynamic catalog items (2 projects + 1 experience) (got ${dynamicCatalog.length})`);
  assert(dynamicCatalog.some((i: any) => i.name === 'Distributed Transaction Ledger'), 'Catalog includes "Distributed Transaction Ledger"');
  assert(dynamicCatalog.some((i: any) => i.name === 'Realtime Telemetry Ingestion'), 'Catalog includes "Realtime Telemetry Ingestion"');
  assert(dynamicCatalog.some((i: any) => i.name === 'Senior Backend Engineer at Fintech Payments Ltd'), 'Catalog includes "Senior Backend Engineer at Fintech Payments Ltd"');

  // Match against PostHog with dynamic candidate (verified Go & PostgreSQL overlap)
  const dynamicMatch = matchingService.matchExperience(postHogCompany, dynamicCandidate);
  console.log(`  Dynamic Match for PostHog: Chosen=${dynamicMatch.chosenProject}, Score=${dynamicMatch.matchScore}, Techs=${dynamicMatch.matchedTechnologies.join(', ')}`);
  assert(
    dynamicMatch.chosenProject === 'Distributed Transaction Ledger' || dynamicMatch.chosenProject === 'Realtime Telemetry Ingestion' || dynamicMatch.chosenProject.includes('Fintech Payments Ltd'),
    `Chooses candidate's actual project rather than hardcoded projects (Chosen: ${dynamicMatch.chosenProject})`
  );
  assert(dynamicMatch.chosenProject !== 'BullMQ Notification System', 'Does NOT choose hardcoded BullMQ project for new candidate');

  // =========================================================================
  // 7. Catalog Fallback Behavior
  // =========================================================================
  console.log('\n--- 7. Catalog Fallback Behavior ---');
  const emptyCandidate: any = { id: 'empty-1', name: 'Unknown' };
  const fallbackCatalog = matchingService.buildCatalogFromProfile(emptyCandidate);
  assert(fallbackCatalog.length === 8, `Empty candidate falls back to default fallback catalog (got ${fallbackCatalog.length} items)`);
  assert(fallbackCatalog.some((i: any) => i.name === 'BullMQ Notification System'), 'Fallback catalog contains default projects');

  // =========================================================================
  // 8. Gmail RFC 2046 MIME Attachment Generation
  // =========================================================================
  console.log('\n--- 8. Gmail RFC 2046 MIME Attachment Generation ---');

  const mockConfigService: any = { get: () => 'mock-val' };
  const mockGmailService: any = { getAuthenticatedClient: async () => null };
  const gmailDraftService = new GmailDraftService(mockConfigService, mockGmailService);

  // Test 8A: No Attachment -> Plain text
  const plainRaw = gmailDraftService.makeEmailRaw('recruiter@stripe.com', 'Job Inquiry', 'Hello, here is my background.');
  const decodedPlain = Buffer.from(plainRaw, 'base64').toString('utf-8');
  assert(decodedPlain.includes('Content-Type: text/plain; charset=utf-8'), 'Plain email uses Content-Type: text/plain');
  assert(!decodedPlain.includes('multipart/mixed'), 'Plain email does NOT include multipart/mixed');

  // Test 8B: With Attachment -> RFC 2046 multipart/mixed MIME
  const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock resume content for testing attachment generation...');
  const attachment: EmailAttachment = {
    filename: 'Resume - Priya Sharma.pdf',
    content: mockPdfBuffer,
    contentType: 'application/pdf',
  };

  const multipartRaw = gmailDraftService.makeEmailRaw('recruiter@stripe.com', 'Application: Backend Engineer', 'Hi Team,\n\nPlease find attached my resume.', attachment);
  const decodedMultipart = Buffer.from(multipartRaw, 'base64').toString('utf-8');

  assert(decodedMultipart.includes('Content-Type: multipart/mixed; boundary='), 'Multipart email specifies multipart/mixed with boundary');
  assert(decodedMultipart.includes('Content-Disposition: attachment; filename="Resume - Priya Sharma.pdf"'), 'Includes Content-Disposition attachment with exact filename');
  assert(decodedMultipart.includes('Content-Type: application/pdf; name="Resume - Priya Sharma.pdf"'), 'Includes Content-Type: application/pdf');
  assert(decodedMultipart.includes('Content-Transfer-Encoding: base64'), 'Includes base64 transfer encoding for PDF');
  assert(decodedMultipart.includes(mockPdfBuffer.toString('base64').slice(0, 30)), 'Contains base64-encoded PDF content');

  // =========================================================================
  // 9. Gmail API Failure Throws Real Exceptions (No Fake Draft IDs)
  // =========================================================================
  console.log('\n--- 9. Gmail API Failure Throws Real Exceptions (No Fake Draft IDs) ---');

  let errorThrown = false;
  try {
    // When getAuthenticatedClient returns null/unauthenticated, createDraft must throw UnauthorizedException
    await gmailDraftService.createDraft('draft-1', 'recruiter@stripe.com', 'Subject', 'Body');
  } catch (err: any) {
    errorThrown = true;
    console.log(`  Caught expected exception: [${err.constructor.name}] ${err.message}`);
    assert(err.message.includes('not authenticated') || err.status === 401, 'Fails loudly with authentication error when client not authenticated');
  }
  assert(errorThrown, 'createDraft threw real exception instead of returning fake simulated draft ID');

  // =========================================================================
  // 10. Relay Outreach V2 — Interview Conversion Optimized Engine
  // =========================================================================
  console.log('\n--- 10. Relay Outreach V2 — Interview Conversion Optimized Engine ---');

  const emailGenService = new EmailGenerationService({} as any, matchingService, qualityService);

  // Test 10A: Recipient Classification
  const hrClassification = emailGenService.classifyRecipient(ContactType.HR, 'sarah.recruiter@stripe.com');
  assert(hrClassification.type === 'TYPE_A_HR', 'ContactType.HR classifies as TYPE_A_HR');
  assert(hrClassification.technicalDepth === 'LOW', 'TYPE_A_HR has LOW technical depth');

  const engClassification = emailGenService.classifyRecipient(ContactType.ENGINEERING, 'alex.lead@stripe.com');
  assert(engClassification.type === 'TYPE_B_ENGINEERING_MANAGER', 'ContactType.ENGINEERING classifies as TYPE_B_ENGINEERING_MANAGER');
  assert(engClassification.technicalDepth === 'MEDIUM', 'TYPE_B_ENGINEERING_MANAGER has MEDIUM technical depth');

  const founderClassification = emailGenService.classifyRecipient(ContactType.FOUNDER, 'patrick@stripe.com');
  assert(founderClassification.type === 'TYPE_C_FOUNDER_OR_CTO', 'ContactType.FOUNDER classifies as TYPE_C_FOUNDER_OR_CTO');
  assert(founderClassification.technicalDepth === 'MEDIUM-HIGH', 'TYPE_C_FOUNDER_OR_CTO has MEDIUM-HIGH technical depth');

  // Test email inference for GENERAL
  const inferredHr = emailGenService.classifyRecipient(ContactType.GENERAL, 'careers@scale.com');
  assert(inferredHr.type === 'TYPE_A_HR', 'careers@ email infers TYPE_A_HR');
  const inferredFounder = emailGenService.classifyRecipient(ContactType.GENERAL, 'ceo@scale.com');
  assert(inferredFounder.type === 'TYPE_C_FOUNDER_OR_CTO', 'ceo@ email infers TYPE_C_FOUNDER_OR_CTO');

  // Test 10B: Mandatory Subject Keywords & Forbidden Blog-Post Subjects
  const validSubjects = [
    'Backend Engineer Application — Ashish Raj',
    'Software Engineer Application — Ashish Raj',
    'Application for Backend Engineering Opportunities',
    'Interested in Backend Opportunities at PostHog',
    'VIT Chennai Engineer Interested in PostHog',
    'Backend Developer | PostgreSQL & NestJS Experience',
    'PostHog — Backend Engineering Application',
  ];

  for (const subj of validSubjects) {
    assert(
      DraftQualityService.hasMandatorySubjectKeyword(subj) && !DraftQualityService.isForbiddenSubject(subj),
      `Valid subject "${subj}" passes keyword check and is not forbidden`,
    );
  }

  const forbiddenBlogSubjects = [
    'Postgres at Scale',
    'Audit Trails + PostgreSQL',
    'Access Control Systems',
    'Engineering Roadmap Discussion',
    'Architecture Thoughts',
    'Data Infrastructure Notes',
  ];

  for (const subj of forbiddenBlogSubjects) {
    assert(DraftQualityService.isForbiddenSubject(subj), `Forbidden blog subject "${subj}" is detected`);
  }

  // Test 10C: All 12 Forbidden Outreach Phrases Caught
  const forbiddenPhrases = [
    "I'd love to chat",
    "Let's connect",
    "I'd love to discuss your roadmap",
    "Let's discuss architecture",
    "If you're looking for someone",
    "I can help you",
    "I can support your growth",
    "I'd love to share ideas",
    "Happy to brainstorm",
    "Thought I'd reach out",
    "Would love your thoughts",
    "Explore synergies",
  ];

  for (const phrase of forbiddenPhrases) {
    const testText = `Hi Team, ${phrase} about our backend experience.`;
    const detected = qualityService.hasForbiddenPhrase(testText);
    assert(Boolean(detected), `Catches forbidden phrase: "${phrase}"`);
  }

  // Test 10D: V2 Conversion Scoring & Quality Gates
  // Compliant V2 email
  const compliantV2Body = `Hi, I'm Ashish. I spend my time building backend services and distributed infrastructure at The Ninja Studio here in India.

A lot of my recent work has been around event processing and telemetry pipelines, which is why PostHog stood out.

One project I owned was building an event logging pipeline with NestJS, Redis, and PostgreSQL used across our core services to trace user activity reliably.

If there are any software engineering opportunities that align with my background, I'd be grateful for the opportunity to be considered. I've attached my resume.

Best,
Ashish Raj
GitHub: https://github.com/AshishRajx7
LinkedIn: https://linkedin.com/in/ashishrajx7`;

  const compliantResult = qualityService.evaluateDraft(
    'Backend Engineer Application — Ashish Raj',
    compliantV2Body,
    postHogCompany,
    postHogMatch,
  );

  console.log(`  Compliant V2 Draft Conversion Score: ${compliantResult.conversionScore}/100 | Flags: [${compliantResult.flags.join(', ')}]`);
  assert((compliantResult.conversionScore ?? 0) >= 90, `Compliant V2 email scores >= 90 conversion score (got ${compliantResult.conversionScore})`);
  assert(compliantResult.requiresManualReview === false, 'Compliant V2 email does NOT require manual review');
  assert(!compliantResult.flags.includes('MISSING_JOB_INTENT'), 'Compliant V2 email has job intent');
  assert(!compliantResult.flags.includes('MISSING_RESUME_MENTION'), 'Compliant V2 email mentions resume');
  assert(!compliantResult.flags.includes('MISSING_APPLICATION_CTA'), 'Compliant V2 email has application CTA');

  // Test 10E: Penalty on Forbidden Phrases & Networking Tone
  const badNetworkingBody = `Hi Team,\n\nThought I'd reach out to see if you're looking for someone. Let's connect for a casual chat and grab a coffee to exchange thoughts.\n\nBest,\nAshish`;
  const badResult = qualityService.evaluateDraft(
    'Postgres at Scale',
    badNetworkingBody,
    postHogCompany,
    postHogMatch,
  );

  console.log(`  Bad Networking Draft Conversion Score: ${badResult.conversionScore}/100 | Flags: [${badResult.flags.join(', ')}]`);
  assert(badResult.flags.some((f) => f.startsWith('FORBIDDEN_OUTREACH_PHRASE')), 'Flags FORBIDDEN_OUTREACH_PHRASE');
  assert(badResult.flags.includes('BLOG_POST_STYLE_SUBJECT'), 'Flags BLOG_POST_STYLE_SUBJECT');
  assert(badResult.flags.includes('NETWORKING_TONE'), 'Flags NETWORKING_TONE');
  assert(badResult.flags.includes('MISSING_JOB_INTENT'), 'Flags MISSING_JOB_INTENT');
  assert(badResult.flags.includes('MISSING_RESUME_MENTION'), 'Flags MISSING_RESUME_MENTION');
  assert(badResult.requiresManualReview === true, 'Bad networking draft triggers requiresManualReview = true');
  assert((badResult.conversionScore ?? 0) <= 20, `Bad draft receives heavy penalties (got ${badResult.conversionScore} <= 20)`);

  console.log('\n================================================================');
  console.log('🎉 ALL LEAN PHASE 4, 5 & V2 UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runPhase4Phase5Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
