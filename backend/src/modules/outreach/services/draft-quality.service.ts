import { Injectable, Logger } from '@nestjs/common';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { CandidateMatchResult } from './candidate-matching.service';

export interface DraftQualityScoreResult {
  personalizationScore: number;
  relevanceScore: number;
  spamRiskScore: number;
  technicalAlignmentScore: number;
  confidenceScore: number;
  requiresManualReview: boolean;
  flags: string[];
}

@Injectable()
export class DraftQualityService {
  private readonly logger = new Logger(DraftQualityService.name);

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
   * Evaluates draft quality across 5 dimensions and applies hard safety rejection rules.
   */
  public evaluateDraft(
    subject: string,
    body: string,
    company: CompanyProfile,
    matchResult: CandidateMatchResult,
  ): DraftQualityScoreResult {
    const flags: string[] = [];
    const lowerBody = body.toLowerCase();
    const companyNameLower = company.companyName.toLowerCase();

    // 1. Personalization Score (0-100)
    let personalizationScore = 0;
    if (lowerBody.includes(companyNameLower)) personalizationScore += 20; // Mentions company

    if (company.products && company.products.some((p) => lowerBody.includes(p.toLowerCase()))) {
      personalizationScore += 20; // Mentions product
    }

    if (company.techSignals && company.techSignals.some((t) => lowerBody.includes(t.toLowerCase()))) {
      personalizationScore += 20; // Mentions technology
    }

    if (company.recentInitiatives && company.recentInitiatives.some((i) => lowerBody.includes(i.toLowerCase().slice(0, 15)))) {
      personalizationScore += 20; // Mentions initiative
    }

    if (
      lowerBody.includes('distributed') ||
      lowerBody.includes('latency') ||
      lowerBody.includes('throughput') ||
      lowerBody.includes('idempotent') ||
      lowerBody.includes('infrastructure') ||
      lowerBody.includes('architecture') ||
      lowerBody.includes('scaling')
    ) {
      personalizationScore += 20; // Mentions engineering challenge
    }

    personalizationScore = Math.min(100, Math.max(0, personalizationScore));

    // 2. Relevance Score (0-100)
    const relevanceScore = Math.min(100, Math.max(50, matchResult.matchScore));

    // 3. Spam Risk Score (0-100, Target < 25)
    let spamRiskScore = 5;
    for (const pattern of this.spamPatterns) {
      if (pattern.test(body) || pattern.test(subject)) {
        spamRiskScore += 15;
        flags.push(`SPAM_TRIGGER: ${pattern.toString()}`);
      }
    }
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    if (wordCount > 160) {
      spamRiskScore += 15;
      flags.push('EXCESSIVE_WORD_COUNT');
    }
    spamRiskScore = Math.min(100, spamRiskScore);

    // 4. Technical Alignment Score (0-100)
    let technicalAlignmentScore = 60;
    if (matchResult.matchedTechnologies.some((t) => lowerBody.includes(t.toLowerCase()))) {
      technicalAlignmentScore += 20;
    }
    if (lowerBody.includes(matchResult.chosenProject.toLowerCase().slice(0, 10))) {
      technicalAlignmentScore += 20;
    }
    technicalAlignmentScore = Math.min(100, technicalAlignmentScore);

    // 5. Confidence Score (0-100)
    const researchScore = company.researchScore || 50;
    const confidenceScore = Math.round((researchScore * 0.4) + (relevanceScore * 0.3) + (personalizationScore * 0.3));

    // Rejection Rules:
    // personalizationScore < 60 OR relevanceScore < 60 OR confidenceScore < 60 OR spamRiskScore > 30
    const requiresManualReview =
      personalizationScore < 60 ||
      relevanceScore < 60 ||
      confidenceScore < 60 ||
      spamRiskScore > 30 ||
      wordCount > 160;

    if (personalizationScore < 60) flags.push('LOW_PERSONALIZATION_SCORE');
    if (relevanceScore < 60) flags.push('LOW_RELEVANCE_SCORE');
    if (confidenceScore < 60) flags.push('LOW_CONFIDENCE_SCORE');
    if (spamRiskScore > 30) flags.push('HIGH_SPAM_RISK');

    return {
      personalizationScore,
      relevanceScore,
      spamRiskScore,
      technicalAlignmentScore,
      confidenceScore,
      requiresManualReview,
      flags,
    };
  }
}
