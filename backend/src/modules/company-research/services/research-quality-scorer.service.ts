import { Injectable } from '@nestjs/common';
import { CrawlResult } from '../providers/crawl-provider.interface';

export interface QualityScorerResult {
  score: number;
  isSufficient: boolean;
  reason: string;
  breakdown: {
    pageCoverage: number;
    contentVolume: number;
    aiConfidence: number;
    keywordRichness: number;
  };
}

export interface ExtractedProfileData {
  persona?: string | null;
  industry?: string | null;
  companySize?: string | null;
  summary?: string | null;
  keywords?: string[];
  techStack?: string[];
  products?: string[];
  outreachHooks?: Record<string, any>;
}

@Injectable()
export class ResearchQualityScorerService {
  /**
   * Evaluates research across 4 deterministic dimensions (0-25 pts each, Total: 0-100).
   * Minimum threshold for COMPLETED status is 40 points.
   */
  score(crawlResult: CrawlResult, profile: ExtractedProfileData): QualityScorerResult {
    // 1. Page Coverage (0 - 25 pts)
    const pagesCrawled = (crawlResult.subpagesCrawled?.length || 0) + 1;
    let pageCoverage = 0;
    if (pagesCrawled >= 3) {
      pageCoverage = 25;
    } else if (pagesCrawled === 2) {
      pageCoverage = 15;
    } else if (pagesCrawled === 1 && crawlResult.success) {
      pageCoverage = 10;
    }

    // 2. Content Volume (0 - 25 pts)
    const wordCount = crawlResult.wordCount || 0;
    let contentVolume = 0;
    if (wordCount >= 1500) {
      contentVolume = 25;
    } else if (wordCount >= 800) {
      contentVolume = 18;
    } else if (wordCount >= 300) {
      contentVolume = 10;
    } else {
      contentVolume = 0;
    }

    // 3. AI Extraction Confidence (0 - 25 pts)
    let aiConfidence = 0;
    const hasSummary = Boolean(profile.summary && profile.summary.length >= 30);
    const hasPersona = Boolean(profile.persona);
    const hasIndustry = Boolean(profile.industry);
    const hasProducts = Boolean(profile.products && profile.products.length > 0);
    const hasHooks = Boolean(profile.outreachHooks && Object.keys(profile.outreachHooks).length > 0);

    if (hasSummary && hasPersona && hasIndustry && hasProducts && hasHooks) {
      aiConfidence = 25;
    } else if (hasSummary && hasPersona && hasIndustry) {
      aiConfidence = 18;
    } else if (hasSummary || hasPersona) {
      aiConfidence = 10;
    } else {
      aiConfidence = 0;
    }

    // 4. Keyword Richness (0 - 25 pts)
    const totalKeywords = (profile.keywords?.length || 0) + (profile.techStack?.length || 0);
    let keywordRichness = 0;
    if (totalKeywords >= 8) {
      keywordRichness = 25;
    } else if (totalKeywords >= 4) {
      keywordRichness = 15;
    } else if (totalKeywords >= 1) {
      keywordRichness = 5;
    } else {
      keywordRichness = 0;
    }

    const totalScore = Math.min(100, Math.max(0, pageCoverage + contentVolume + aiConfidence + keywordRichness));
    const isSufficient = totalScore >= 40;

    const reason = `Coverage: ${pageCoverage}/25 | Volume: ${contentVolume}/25 (${wordCount} words) | AI: ${aiConfidence}/25 | Keywords: ${keywordRichness}/25 (${totalKeywords} terms)`;

    return {
      score: totalScore,
      isSufficient,
      reason,
      breakdown: {
        pageCoverage,
        contentVolume,
        aiConfidence,
        keywordRichness,
      },
    };
  }
}
