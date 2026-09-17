import { Injectable, Logger } from '@nestjs/common';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateMatchResult, OutreachStrategy } from './candidate-matching.service';

export interface DraftQualityScoreResult {
  personalizationScore: number;
  relevanceScore: number;
  spamRiskScore: number;
  technicalAlignmentScore: number;
  confidenceScore: number;
  conversionScore?: number;
  requiresManualReview: boolean;
  flags: string[];
}

@Injectable()
export class DraftQualityService {
  private readonly logger = new Logger(DraftQualityService.name);

  public static readonly KNOWN_TECHNOLOGIES: string[] = [
    'nestjs', 'node.js', 'nodejs', 'react', 'typescript', 'redis', 'postgresql', 'postgres',
    'bullmq', 'kafka', 'docker', 'kubernetes', 'aws', 'gcp', 'python', 'go', 'golang',
    'fastapi', 'mongodb', 'elasticsearch', 'opentelemetry', 'graphql', 'grpc', 'rabbitmq',
    'dynamodb', 'spark', 'airflow', 'cassandra', 'snowflake', 'mysql', 'django', 'flask'
  ];

  public static readonly GENERIC_PRODUCT_WORDS: Set<string> = new Set([
    'software', 'cloud', 'developer', 'engineering', 'core', 'internal',
    'data', 'analytics', 'infrastructure', 'platform', 'service', 'system',
    'api', 'app', 'application', 'solution', 'tool', 'product',
    'backend', 'frontend', 'stack', 'pipeline', 'workflow', 'architecture',
    'suite', 'enterprise', 'modern', 'digital', 'tech', 'technology',
    'b2b', 'saas', 'web', 'mobile', 'flagship', 'main', 'primary', 'portal',
    'open-source', 'open', 'source',
  ]);

  // Common spam trigger patterns
  private readonly spamPatterns = [
    /\bguarantee(d)?\b/i,
    /\b100%\s*(free|satisfaction)\b/i,
    /\bact now\b/i,
    /\bexclusive deal\b/i,
    /\blimited time\b/i,
    /\bclick here\b/i,
    /\bunbelievable\b/i,
    /\brevolutionary\b/i,
    /\bsynergy\b/i,
    /\bwin-win\b/i,
    /!{2,}/,
    /\b[A-Z]{4,}\b/, // ALL CAPS words
  ];

  /**
   * Detects technologies specifically attributed to the target company in email text.
   * Avoids flagging technologies mentioned purely as candidate's own background experience.
   */
  public detectAttributedTechnologies(body: string, companyName?: string): string[] {
    const attributedTechs = new Set<string>();
    const lowerBody = body.toLowerCase();

    for (const tech of DraftQualityService.KNOWN_TECHNOLOGIES) {
      const escapedTech = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 1. "your <tech> stack/infrastructure/architecture/platform/pipeline/system/backend/database"
      const yourTechNounRegex = new RegExp(
        `\\byour\\s+${escapedTech}\\s+(?:stack|infra|infrastructure|architecture|platform|pipeline|system|backend|database|microservices?|services?)\\b`,
        'i',
      );

      // 2. "you / your team use(s)/leverage(s)/run(s)/build(s) with <tech>"
      const youUseTechRegex = new RegExp(
        `\\b(?:you|your\\s+team)\\s+(?:use|uses|are\\s+using|leverage|leverages|run|runs|build\\s+with|built\\s+with)\\s+${escapedTech}\\b`,
        'i',
      );

      // 3. "backend / platform / stack / architecture / infrastructure runs on / built on / powered by <tech>"
      const stackRunsOnTechRegex = new RegExp(
        `\\b(?:your\\s+)?(?:backend|platform|system|stack|infra|infrastructure|architecture)\\s+(?:runs\\s+on|is\\s+built\\s+on|is\\s+powered\\s+by|built\\s+with)\\s+${escapedTech}\\b`,
        'i',
      );

      // 4. "at <company>, you use / your <tech>"
      let atCompanyRegex: RegExp | null = null;
      if (companyName) {
        const escapedCompany = companyName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        atCompanyRegex = new RegExp(
          `\\bat\\s+${escapedCompany}\\s*,?\\s*(?:you\\s+use|your\\s+${escapedTech})\\b`,
          'i',
        );
      }

      if (
        yourTechNounRegex.test(lowerBody) ||
        youUseTechRegex.test(lowerBody) ||
        stackRunsOnTechRegex.test(lowerBody) ||
        (atCompanyRegex && atCompanyRegex.test(lowerBody))
      ) {
        attributedTechs.add(tech);
      }
    }

    return Array.from(attributedTechs);
  }

  /**
   * Detects claims about specific company products/tools that are not verified in company.products.
   * Whitelists generic architectural/software descriptors to prevent false positives.
   */
  public detectUnverifiedProductClaims(body: string, company: CompanyProfile): string[] {
    const unverifiedClaims: string[] = [];
    const verifiedProducts = (company?.products || []).map((p) => p.toLowerCase().trim());
    const companyName = company?.companyName ? company.companyName.toLowerCase().trim() : '';

    const patterns: RegExp[] = [
      /\byour\s+([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)?)\s+(?:product|tool|platform|offering|solution|suite|app|portal)\b/gi,
      /\byour\s+(?:product|tool|platform|offering|solution|suite|app|portal)(?:,?\s+(?:called|named)?\s+)([A-Za-z0-9_-]+)\b/gi,
    ];

    if (companyName) {
      const escapedCompany = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      patterns.push(
        new RegExp(`\\b${escapedCompany}'s\\s+([A-Za-z0-9_-]+(?:\\s+[A-Za-z0-9_-]+)?)\\s+(?:product|tool|platform|offering|solution|suite|app|portal)\\b`, 'gi'),
        new RegExp(`\\b${escapedCompany}'s\\s+([A-Za-z0-9_-]+(?:\\s+[A-Za-z0-9_-]+)?)\\b`, 'gi'),
      );
    }

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(body)) !== null) {
        const candidateRaw = match[1]?.trim();
        if (!candidateRaw) continue;

        const candidateLower = candidateRaw.toLowerCase();

        // Check if candidate is purely composed of generic product words
        const candidateWords = candidateLower.split(/\s+/).filter(Boolean);
        const isPurelyGeneric = candidateWords.every((word) =>
          DraftQualityService.GENERIC_PRODUCT_WORDS.has(word)
        );
        if (isPurelyGeneric) continue;

        // Ignore if candidate matches company name itself
        if (
          companyName &&
          (candidateLower === companyName ||
            candidateLower.includes(companyName) ||
            companyName.includes(candidateLower))
        ) {
          continue;
        }

        // Check against verified products
        const isVerified = verifiedProducts.some(
          (vp) =>
            vp === candidateLower ||
            vp.includes(candidateLower) ||
            candidateLower.includes(vp),
        );

        if (!isVerified) {
          unverifiedClaims.push(candidateRaw);
        }
      }
    }

    return Array.from(new Set(unverifiedClaims));
  }

  public static readonly FORBIDDEN_OUTREACH_PHRASES: string[] = [
    // Forbidden Outreach Phrases & Generic AI Filler
    "saw what you're building",
    "would appreciate your consideration",
    "would appreciate consideration",
    "please review my resume",
    "looking forward to hearing from you",
    "please find my resume attached",
    "kindly review the attached resume",
    "i request you to review my resume",
    "thank you for your time and consideration",
    "thank you for your time",
    "i am excited to apply",
    "i'm excited to apply",
    "i believe i would be a great fit",
    "i believe i'd be a great fit",
    "i am passionate about",
    "i'm passionate about",
    "reaching out regarding",
    "reaching out about",
    "caught my attention",
    "particularly drawn to",
    "resonates with me",
    "resonates with how",
    "opportunity to discuss",
    "introductory conversation",
    "schedule a conversation",
    "hop on a call",
    "quick call",
    "brief call",
    "coffee chat",
    "would love to chat",
    "love to chat",
    "happy to chat",
    "let's connect",
    "happy to connect",
    "explore synergies",
    "follow up",
    "circle back",
    "touch base",

    // V5 AI Writing Patterns
    "additionally",
    "furthermore",
    "moreover",
    "notably",
    "importantly",
    "in my current role",
    "i have had the opportunity to",
    "i've had the opportunity to",
    "i have owned and maintained",
    "i've owned and maintained",
    "i have successfully",
    "i am particularly interested in",
    "i'm particularly interested in",
    "i am excited to apply",
    "i'm excited to apply",
    "i am writing to express interest",
    "i'm writing to express interest",

    // Older AI & networking cliches
    "i'd love to chat",
    "i'd love to discuss your roadmap",
    "let's discuss architecture",
    "happy to brainstorm",
    "thought i'd reach out",
    "would love your thoughts",
    "i'm impressed by",
    "i am impressed by",
    "i admire",
    "i've been following",
    "i have been following",
    "i appreciate",
    "i love what you're building",
    "i wanted to introduce myself",
    "hope you're doing well",
    "hope this email finds you well",
    "passionate about",
    "rockstar engineer",
    "world-class team",
    "cutting-edge",
    "game-changing",
    "revolutionary",
    "i'm inspired by",
    "i am inspired by",
    "i've observed that",
    "i observed that",
    "goklaim",
    "final year student",
    "pursuing degree",
    "vit chennai",
    "july 2026",
    "graduated",
    "cgpa",
    "i am excited to apply",
    "i'm excited to apply",
    "i believe i would be a great fit",
    "i believe i'd be a great fit",
    "i am passionate about",
    "i'm passionate about",
    "i would appreciate your consideration",
    "i'd appreciate your consideration",
    "please review my resume",
    "looking forward to hearing from you",
    "please find my resume attached",
    "kindly review the attached resume",
    "i request you to review my resume",
    "thank you for your time and consideration",
  ];

  public static readonly MANDATORY_SUBJECT_KEYWORDS: string[] = [
    'engineer',
    'engineering',
    'developer',
    'software',
    'backend',
    'resume',
    'ashish',
    'raj',
  ];

  public static readonly FORBIDDEN_SUBJECT_PATTERNS: RegExp[] = [
    /\bat scale\b/i,
    /\broadmap discussion\b/i,
    /\barchitecture thoughts\b/i,
    /\bdata infrastructure notes\b/i,
    /\baudit trails\s*\+/i,
    /\baccess control systems\b/i,
    /\bscaling event driven systems\b/i,
    /\bengineering thoughts\b/i,
    /\bquick introduction\b/i,
    /\binterested in connecting\b/i,
    /\blet's talk\b/i,
  ];

  public static hasMandatorySubjectKeyword(subject: string): boolean {
    if (!subject) return false;
    const lower = subject.toLowerCase();
    return DraftQualityService.MANDATORY_SUBJECT_KEYWORDS.some((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(lower);
    });
  }

  public static isForbiddenSubject(subject: string): boolean {
    if (!subject) return false;
    return DraftQualityService.FORBIDDEN_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
  }

  public static hasForbiddenPunctuation(text: string): boolean {
    return /[—–•]/.test(text) || /!{2,}/.test(text);
  }

  public static sanitizePunctuation(text: string): string {
    if (!text) return text;
    return text
      .replace(/[—–]/g, ' - ')
      .replace(/•\s*/g, '')
      .replace(/!{2,}/g, '.')
      .replace(/\s+-\s+/g, ' - ')
      .replace(/\s{2,}/g, ' ');
  }

  public hasForbiddenPhrase(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase().replace(/['']/g, "'");
    for (const phrase of DraftQualityService.FORBIDDEN_OUTREACH_PHRASES) {
      if (lower.includes(phrase)) return phrase;
    }
    const patterns: Array<{ regex: RegExp; name: string }> = [
      { regex: /\bi(?:'d|\s+would)?\s+love\s+to\s+chat\b/i, name: "i'd love to chat" },
      { regex: /\blet(?:'s|\s+us)\s+connect\b/i, name: "let's connect" },
      { regex: /\bi(?:'d|\s+would)?\s+love\s+to\s+discuss\s+your\s+roadmap\b/i, name: "i'd love to discuss your roadmap" },
      { regex: /\blet(?:'s|\s+us)\s+discuss\s+architecture\b/i, name: "let's discuss architecture" },
      { regex: /\bif\s+you(?:'re|\s+are)\s+looking\s+for\s+someone\b/i, name: "if you're looking for someone" },
      { regex: /\bi\s+can\s+help\s+you\b/i, name: "i can help you" },
      { regex: /\bi\s+can\s+support\s+your\s+growth\b/i, name: "i can support your growth" },
      { regex: /\bi(?:'d|\s+would)?\s+love\s+to\s+share\s+ideas\b/i, name: "i'd love to share ideas" },
      { regex: /\bhapp(?:y|ier)\s+to\s+brainstorm\b/i, name: "happy to brainstorm" },
      { regex: /\bthought\s+i(?:'d|\s+would)?\s+reach\s+out\b/i, name: "thought i'd reach out" },
      { regex: /\b(?:would|i(?:'d)?)\s+love\s+your\s+thoughts\b/i, name: "would love your thoughts" },
      { regex: /\bexplore\s+synerg(?:y|ies)\b/i, name: "explore synergies" },
      { regex: /\bi(?:'m|\s+am)\s+impressed\s+by\b/i, name: "i'm impressed by" },
      { regex: /\bi(?:'m|\s+am)\s+excited\s+about\b/i, name: "i'm excited about" },
      { regex: /\bi\s+admire\b/i, name: "i admire" },
      { regex: /\bi(?:'ve|\s+have)\s+been\s+following\b/i, name: "i've been following" },
      { regex: /\bi\s+appreciate\b/i, name: "i appreciate" },
      { regex: /\bi\s+love\s+what\s+you(?:'re|\s+are)\s+building\b/i, name: "i love what you're building" },
      { regex: /\bi\s+wanted\s+to\s+introduce\s+myself\b/i, name: "i wanted to introduce myself" },
      { regex: /\bhope\s+you(?:'re|\s+are)\s+doing\s+well\b/i, name: "hope you're doing well" },
      { regex: /\bhope\s+this\s+email\s+finds\s+you\s+well\b/i, name: "hope this email finds you well" },
      { regex: /\bpassionate\s+about\b/i, name: "passionate about" },
      { regex: /\brockstar\s+(?:engineer|developer)\b/i, name: "rockstar engineer" },
      { regex: /\bworld-class\s+team\b/i, name: "world-class team" },
      { regex: /\bcutting-edge\b/i, name: "cutting-edge" },
      { regex: /\bgame-changing\b/i, name: "game-changing" },
      { regex: /\brevolutionary\b/i, name: "revolutionary" },
      { regex: /\bi(?:'m|\s+am)\s+inspired\s+by\b/i, name: "i'm inspired by" },
    ];
    for (const { regex, name } of patterns) {
      if (regex.test(lower)) return name;
    }
    return null;
  }

  public hasForbiddenCta(body: string): boolean {
    if (!body) return false;
    const lower = body.toLowerCase();
    const pattern = /\b(?:(?:open\s+to|time\s+for|schedule|grab)\s+(?:a\s+)?(?:call|chat|coffee|meeting)|(?:hop\s+on\s+a\s+call)|(?:let\s+me\s+know\s+if\s+you(?:'d|\s+would)?\s+be\s+open)|(?:look(?:ing)?\s+forward\s+to\s+hearing)|(?:would\s+love\s+to\s+(?:talk|chat|connect|speak))|(?:happy\s+to\s+talk)|(?:brief\s+call)|(?:quick\s+call)|(?:coffee\s+chat)|(?:introductory\s+conversation)|(?:introductory\s+call)|(?:follow\s+up)|(?:circle\s+back)|(?:touch\s+base))\b/i;
    return pattern.test(lower);
  }

  public static hasSignatureOrClosingSentence(body: string): boolean {
    if (!body) return false;
    // Disallow corporate fluff sign-offs like "Thank you for your time", "Looking forward", etc.
    return /\b(?:thank\s+you\s+for\s+your\s+time|looking\s+forward\s+to\s+hearing|cheers|sincerely)\b/i.test(body);
  }

  public hasRoleIntent(body: string): boolean {
    if (!body) return false;
    const lower = body.toLowerCase();
    const rolePattern =
      /\b(?:(?:backend|software|systems?|platform)\s+(?:engineer|developer|systems?|services?|infrastructure|apis?)|work\s+on\s+backend|building\s+(?:backend\s+)?apis?|databases?\s+and\s+(?:internal\s+)?services?)\b/i;
    const companyPattern = /the\s+ninja\s+studio/i;
    return rolePattern.test(lower) && companyPattern.test(lower);
  }

  public hasResumeMention(body: string): boolean {
    if (!body) return false;
    const lower = body.toLowerCase();
    const pattern = /\b(?:(?:attached\s+(?:is\s+)?(?:my\s+)?resume)|(?:resume\s+(?:is\s+)?attached)|(?:attached\s+my\s+cv)|(?:my\s+resume\s+is\s+attached)|(?:find\s+attached\s+my\s+resume)|(?:i've\s+attached\s+my\s+resume)|(?:have\s+attached\s+my\s+resume)|(?:i\s+have\s+attached\s+my\s+resume)|(?:attached\s+my\s+resume\s+for\s+review)|(?:attached\s+my\s+resume\s+in\s+case)|(?:attached\s+my\s+resume\s+below)|(?:attached\s+my\s+resume\s+here)|(?:resume\s+is\s+attached\s+below)|(?:i've\s+included\s+my\s+resume)|(?:included\s+my\s+resume)|(?:attached\s+my\s+resume\s+for\s+context))\b/i;
    return pattern.test(lower);
  }

  public hasApplicationCta(body: string): boolean {
    if (!body) return false;
    // In V6.1, clean CTA means resume is mentioned, no forbidden call/meeting requests, and no signature block
    return this.hasResumeMention(body) && !this.hasForbiddenCta(body) && !DraftQualityService.hasSignatureOrClosingSentence(body);
  }

  public hasNetworkingTone(body: string): boolean {
    if (!body) return false;
    const lower = body.toLowerCase();
    const pattern = /\b(?:quick\s+call\s+to\s+exchange|pick\s+your\s+brain|grab\s+(?:a\s+)?coffee|connect\s+on\s+linkedin|expand\s+my\s+network|casual\s+chat)\b/i;
    return pattern.test(lower);
  }

  public hasConsultingTone(body: string): boolean {
    if (!body) return false;
    const lower = body.toLowerCase();
    const pattern = /\b(?:audit\s+your\s+(?:code|stack|systems?)|help\s+you\s+scale\s+your|consult\s+on\s+your|advise\s+your\s+team|streamline\s+your\s+workflows|offer\s+my\s+consulting)\b/i;
    return pattern.test(lower);
  }

  /**
   * Evaluates draft quality across 5 dimensions and applies hard safety rejection rules.
   * Calibrated for Relay Outreach to optimize human engineer tone and application replies.
   */
  public evaluateDraft(
    subject: string,
    body: string,
    company: CompanyProfile,
    matchResult: CandidateMatchResult,
  ): DraftQualityScoreResult {
    const flags: string[] = [];
    const lowerBody = body.toLowerCase();
    const companyNameLower = company?.companyName ? company.companyName.toLowerCase() : '';

    // 1. Personalization Score (0-100)
    let personalizationScore = 40;
    if (companyNameLower && lowerBody.includes(companyNameLower)) personalizationScore += 30; // Mentions company
    if (company?.products && company.products.some((p) => lowerBody.includes(p.toLowerCase()))) {
      personalizationScore += 15; // Mentions product
    }
    if (company?.techSignals && company.techSignals.some((t) => lowerBody.includes(t.toLowerCase()))) {
      personalizationScore += 15; // Mentions technology
    }
    personalizationScore = Math.min(100, Math.max(0, personalizationScore));

    // 2. Relevance Score (0-100)
    const relevanceScore = Math.min(100, Math.max(0, matchResult.matchScore));

    // 3. Spam Risk Score (0-100, Target < 25)
    let spamRiskScore = 5;
    for (const pattern of this.spamPatterns) {
      if (pattern.test(body) || pattern.test(subject)) {
        spamRiskScore += 15;
        flags.push(`SPAM_TRIGGER: ${pattern.toString()}`);
      }
    }
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    if (wordCount > 130) {
      spamRiskScore += 25;
      flags.push('EXCESSIVE_WORD_COUNT');
    } else if (wordCount < 40) {
      spamRiskScore += 25;
      flags.push('TOO_SHORT');
    }

    const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length > 6 || paragraphs.length < 3) {
      flags.push('INVALID_PARAGRAPH_COUNT');
    }
    if (DraftQualityService.hasSignatureOrClosingSentence(body)) {
      flags.push('FORBIDDEN_SIGNATURE_OR_CLOSING');
    }

    // 4. Technical Alignment Score (0-100)
    let technicalAlignmentScore = 0;
    if (matchResult.matchedTechnologies && matchResult.matchedTechnologies.length > 0) {
      if (matchResult.matchedTechnologies.some((t) => lowerBody.includes(t.toLowerCase()))) {
        technicalAlignmentScore += 60;
      } else {
        technicalAlignmentScore += 20;
      }
    } else {
      // In BUSINESS_ONLY, baseline alignment reflects engineering fit without tech claims
      technicalAlignmentScore = 40;
    }
    if (matchResult.chosenProject && lowerBody.includes(matchResult.chosenProject.toLowerCase().slice(0, 10))) {
      technicalAlignmentScore += 40;
    }
    technicalAlignmentScore = Math.min(100, technicalAlignmentScore);

    // 5. Hallucination Detection & Technology Attribution Guardrails
    const strategy = matchResult.strategy || (
      matchResult.matchedTechnologies && matchResult.matchedTechnologies.length > 0
        ? OutreachStrategy.TECH_STACK_MATCH
        : OutreachStrategy.BUSINESS_ONLY
    );

    const attributedTechs = this.detectAttributedTechnologies(body, company?.companyName);

    if (strategy === OutreachStrategy.BUSINESS_ONLY) {
      if (attributedTechs.length > 0) {
        flags.push('HALLUCINATED_COMPANY_TECH_ATTRIBUTION');
      }
    } else if (strategy === OutreachStrategy.TECH_STACK_MATCH) {
      const verifiedTechs = (matchResult.matchedTechnologies || []).map((t) => t.toLowerCase());
      const hasUnverified = attributedTechs.some(
        (t) => !verifiedTechs.some((vt) => vt === t || vt.includes(t) || t.includes(vt)),
      );
      if (hasUnverified) {
        flags.push('UNVERIFIED_COMPANY_TECH_ATTRIBUTION');
      }
    }

    // Product Claim Verification Guardrails
    const unverifiedProducts = this.detectUnverifiedProductClaims(body, company);
    if (unverifiedProducts.length > 0) {
      flags.push('UNVERIFIED_PRODUCT_CLAIM');
    }

    // -------------------------------------------------------------
    // 6. Relay Outreach V2 Conversion Scoring & Quality Gates
    // -------------------------------------------------------------
    let conversionScore = 0;

    // Gate 1: Role Intent (+25 / -50)
    const roleIntentPresent = this.hasRoleIntent(body);
    if (roleIntentPresent) {
      conversionScore += 25;
    } else {
      conversionScore -= 50;
      flags.push('MISSING_JOB_INTENT');
    }

    // Gate 2: Resume Mentioned (+20)
    const resumeMentioned = this.hasResumeMention(body);
    if (resumeMentioned) {
      conversionScore += 20;
    } else {
      flags.push('MISSING_RESUME_MENTION');
    }

    // Gate 3: Application CTA (+20)
    const applicationCta = this.hasApplicationCta(body);
    if (applicationCta) {
      conversionScore += 20;
    } else {
      flags.push('MISSING_APPLICATION_CTA');
    }

    // Relevant Experience (+15)
    const hasRelevantExp =
      (matchResult.chosenProject && lowerBody.includes(matchResult.chosenProject.toLowerCase().slice(0, 8))) ||
      (matchResult.matchedTechnologies && matchResult.matchedTechnologies.some((t) => lowerBody.includes(t.toLowerCase()))) ||
      DraftQualityService.KNOWN_TECHNOLOGIES.some((t) => lowerBody.includes(t));
    if (hasRelevantExp) {
      conversionScore += 15;
    }

    // Company Personalization (+10)
    if (companyNameLower && lowerBody.includes(companyNameLower)) {
      conversionScore += 10;
    }

    // Grounded Content (+10 / -50)
    const hasGroundingViolation =
      flags.includes('HALLUCINATED_COMPANY_TECH_ATTRIBUTION') ||
      flags.includes('UNVERIFIED_COMPANY_TECH_ATTRIBUTION') ||
      flags.includes('UNVERIFIED_PRODUCT_CLAIM');
    if (!hasGroundingViolation) {
      conversionScore += 10;
    } else {
      conversionScore -= 50;
    }

    // Gate 4: Forbidden Phrases (-50, +30 spam risk)
    const forbiddenPhrase = this.hasForbiddenPhrase(body) || this.hasForbiddenPhrase(subject);
    if (forbiddenPhrase) {
      conversionScore -= 50;
      spamRiskScore += 30;
      flags.push(`FORBIDDEN_OUTREACH_PHRASE: ${forbiddenPhrase}`);
    }

    // Blog Style Subject (-25, +20 spam risk)
    const isBlogSubject = DraftQualityService.isForbiddenSubject(subject);
    if (isBlogSubject) {
      conversionScore -= 25;
      spamRiskScore += 20;
      flags.push('BLOG_POST_STYLE_SUBJECT');
    }

    // Gate 5: Subject Missing Application Keyword (-25)
    const hasSubjectKeyword = DraftQualityService.hasMandatorySubjectKeyword(subject);
    if (!hasSubjectKeyword) {
      conversionScore -= 25;
      flags.push('SUBJECT_MISSING_APPLICATION_KEYWORD');
    }

    // Gate 6: Tone Checks (-40)
    const networkingTone = this.hasNetworkingTone(body);
    if (networkingTone) {
      conversionScore -= 40;
      flags.push('NETWORKING_TONE');
    }

    const consultingTone = this.hasConsultingTone(body);
    if (consultingTone) {
      conversionScore -= 40;
      flags.push('CONSULTING_TONE');
    }

    spamRiskScore = Math.min(100, spamRiskScore);
    conversionScore = Math.max(0, Math.min(100, conversionScore));

    // Confidence Score combines interview conversion score, research score, and relevance score
    const researchScore = company?.researchScore ?? 0;
    const confidenceScore = Math.round(
      (conversionScore * 0.5) + (researchScore * 0.25) + (relevanceScore * 0.25)
    );

    // Informational quality flags (observability only, does not suppress outreach)
    if (personalizationScore < 40) flags.push('LOW_PERSONALIZATION_SCORE');
    if (relevanceScore < 60) flags.push('LOW_RELEVANCE_SCORE');
    if (confidenceScore < 60) flags.push('LOW_CONFIDENCE_SCORE');
    if (spamRiskScore > 30) flags.push('HIGH_SPAM_RISK');

    // Review Rules for Job-Seeker Cold Outreach:
    // Low match/relevance reduces confidenceScore but DOES NOT block outreach.
    // Manual review is triggered ONLY by genuine risk: high spam risk, excessive word count, grounding violations,
    // forbidden phrases, missing job intent, or networking/consulting tone.
    const requiresManualReview =
      spamRiskScore > 30 ||
      wordCount > 130 ||
      wordCount < 40 ||
      paragraphs.length > 6 ||
      paragraphs.length < 3 ||
      DraftQualityService.hasSignatureOrClosingSentence(body) ||
      hasGroundingViolation ||
      Boolean(forbiddenPhrase) ||
      !roleIntentPresent ||
      !resumeMentioned ||
      this.hasForbiddenCta(body) ||
      networkingTone ||
      consultingTone;

    return {
      personalizationScore,
      relevanceScore,
      spamRiskScore,
      technicalAlignmentScore,
      confidenceScore,
      conversionScore,
      requiresManualReview,
      flags,
    };
  }
}
