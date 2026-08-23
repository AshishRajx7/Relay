import { Injectable, Logger } from '@nestjs/common';

export interface AtsDiscoveryResult {
  careersPageUrl: string | null;
  atsProvider: string | null;
  isHiring: boolean;
  hiringSignals: string[];
  genericContactEmails: string[];
  leadershipPageUrls: string[];
  engineeringBlogUrls: string[];
}

interface AtsPattern {
  provider: string;
  regex: RegExp;
}

@Injectable()
export class AtsDiscoveryService {
  private readonly logger = new Logger(AtsDiscoveryService.name);

  private readonly atsPatterns: AtsPattern[] = [
    { provider: 'GREENHOUSE', regex: /(?:boards\.greenhouse\.io|greenhouse\.io\/embed\/job_board)/i },
    { provider: 'LEVER', regex: /jobs\.lever\.co/i },
    { provider: 'ASHBY', regex: /jobs\.ashbyhq\.com/i },
    { provider: 'WORKABLE', regex: /apply\.workable\.com/i },
    { provider: 'SMARTRECRUITERS', regex: /(?:careers\.smartrecruiters\.com|smartrecruiters\.com)/i },
    { provider: 'RIPPLING', regex: /jobs\.rippling\.com/i },
    { provider: 'BAMBOOHR', regex: /[a-zA-Z0-9-]+\.bamboohr\.com\/(?:jobs|careers)/i },
    { provider: 'TEAMTAILOR', regex: /[a-zA-Z0-9-]+\.teamtailor\.com/i },
    { provider: 'PERSONIO', regex: /[a-zA-Z0-9-]+\.personio\.(?:de|com)/i },
    { provider: 'JOBVITE', regex: /jobs\.jobvite\.com/i },
  ];

  private readonly careersPathPatterns = [
    /\/(?:careers|jobs|join-us|work-with-us|open-roles|open-positions|career|opportunities|hiring)(?:\/|$|\?)/i,
  ];

  private readonly leadershipPatterns = [
    /\/(?:about|team|leadership|about-us|company\/team|our-team|people)(?:\/|$|\?)/i,
  ];

  private readonly engineeringBlogPatterns = [
    /\/(?:engineering|tech-blog|engineering-blog|dev-blog|tech|technology)(?:\/|$|\?)/i,
  ];

  private readonly hiringPhrases = [
    /we(?:'re| are) hiring/i,
    /open (?:positions|roles|opportunities|jobs)/i,
    /join our (?:team|mission|crew)/i,
    /view (?:openings|open roles|job openings)/i,
    /explore (?:careers|open roles|jobs)/i,
    /grow with us/i,
    /see all jobs/i,
    /check out our openings/i,
  ];

  private readonly emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

  /**
   * Analyzes raw crawl markdown, extracted HTML links, and baseUrl to discover
   * ATS providers, careers portals, hiring signals, and generic recruiting emails.
   */
  discover(baseUrl: string, htmlLinks: string[], markdown: string): AtsDiscoveryResult {
    const hiringSignals: Set<string> = new Set();
    const genericContactEmails: Set<string> = new Set();
    const leadershipPageUrls: Set<string> = new Set();
    const engineeringBlogUrls: Set<string> = new Set();

    let careersPageUrl: string | null = null;
    let atsProvider: string | null = null;

    // 1. Scan HTML links for ATS providers and Careers portals
    for (const link of htmlLinks) {
      const trimmed = link.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) {
        continue;
      }

      // Check ATS match
      for (const pattern of this.atsPatterns) {
        if (pattern.regex.test(trimmed)) {
          atsProvider = pattern.provider;
          careersPageUrl = trimmed;
          hiringSignals.add(`active_ats_${pattern.provider.toLowerCase()}`);
          break;
        }
      }

      // Check Careers page path if not already found via external ATS
      if (!careersPageUrl) {
        for (const pattern of this.careersPathPatterns) {
          if (pattern.test(trimmed)) {
            careersPageUrl = this.resolveFullUrl(baseUrl, trimmed);
            hiringSignals.add('careers_page_discovered');
            break;
          }
        }
      }

      // Check Leadership / Team pages
      for (const pattern of this.leadershipPatterns) {
        if (pattern.test(trimmed)) {
          leadershipPageUrls.add(this.resolveFullUrl(baseUrl, trimmed));
          break;
        }
      }

      // Check Engineering / Tech Blog
      for (const pattern of this.engineeringBlogPatterns) {
        if (pattern.test(trimmed)) {
          engineeringBlogUrls.add(this.resolveFullUrl(baseUrl, trimmed));
          break;
        }
      }
    }

    // 2. Scan Markdown content for hiring phrases
    for (const phraseRegex of this.hiringPhrases) {
      if (phraseRegex.test(markdown)) {
        hiringSignals.add('hiring_phrase_detected');
        break;
      }
    }

    // 3. Scan Markdown content for generic contact and recruiting emails
    const matches = markdown.match(this.emailRegex) || [];
    for (const match of matches) {
      const email = match.toLowerCase();
      // Filter out image assets, file extensions, or garbage
      if (
        email.endsWith('.png') ||
        email.endsWith('.jpg') ||
        email.endsWith('.svg') ||
        email.includes('example.com')
      ) {
        continue;
      }

      // Prioritize recruiting, jobs, careers, hello, contact, info emails
      if (
        email.startsWith('careers@') ||
        email.startsWith('jobs@') ||
        email.startsWith('talent@') ||
        email.startsWith('recruiting@') ||
        email.startsWith('hiring@') ||
        email.startsWith('join@') ||
        email.startsWith('contact@') ||
        email.startsWith('hello@') ||
        email.startsWith('info@')
      ) {
        genericContactEmails.add(email);
        if (
          email.startsWith('careers@') ||
          email.startsWith('jobs@') ||
          email.startsWith('talent@') ||
          email.startsWith('recruiting@') ||
          email.startsWith('hiring@')
        ) {
          hiringSignals.add('recruiting_inbox_found');
        }
      }
    }

    const isHiring = Boolean(atsProvider || hiringSignals.size > 0 || careersPageUrl);

    if (isHiring && hiringSignals.size === 0) {
      hiringSignals.add('general_hiring_activity');
    }

    return {
      careersPageUrl,
      atsProvider,
      isHiring,
      hiringSignals: Array.from(hiringSignals),
      genericContactEmails: Array.from(genericContactEmails),
      leadershipPageUrls: Array.from(leadershipPageUrls).slice(0, 3),
      engineeringBlogUrls: Array.from(engineeringBlogUrls).slice(0, 3),
    };
  }

  private resolveFullUrl(baseUrl: string, link: string): string {
    if (link.startsWith('http://') || link.startsWith('https://')) {
      return link;
    }
    try {
      const parsed = new URL(baseUrl);
      return new URL(link, parsed.origin).href;
    } catch {
      return link;
    }
  }
}
