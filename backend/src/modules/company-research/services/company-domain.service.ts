import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CompanyDomainService {
  private readonly logger = new Logger(CompanyDomainService.name);

  // Common multi-part country code second-level domains
  private readonly multiPartTlds = new Set([
    'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'net.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
    'co.in', 'net.in', 'org.in', 'gen.in', 'ind.in',
    'co.nz', 'net.nz', 'org.nz',
    'co.za', 'org.za',
    'com.br', 'org.br', 'net.br',
    'co.jp', 'ne.jp', 'or.jp',
    'com.sg', 'org.sg',
    'com.mx', 'org.mx',
    'com.tr', 'edu.tr',
  ]);

  /**
   * Cleans and extracts canonical hostname from raw URL or string.
   */
  public cleanHost(raw: string): string {
    if (!raw) return '';
    let host = raw.trim().toLowerCase();
    host = host.replace(/^https?:\/\//i, '');
    host = host.replace(/^ftp:\/\//i, '');
    host = host.split('/')[0];
    host = host.split(':')[0];
    host = host.split('?')[0];
    host = host.split('#')[0];
    return host;
  }

  /**
   * Extracts the root domain from a hostname or URL, stripping out subdomains.
   * Examples:
   *   "jobs.resend.com" -> "resend.com"
   *   "careers.airtable.com" -> "airtable.com"
   *   "api.dev.stripe.com" -> "stripe.com"
   *   "engineering.bbc.co.uk" -> "bbc.co.uk"
   */
  public extractRootDomain(rawDomainOrUrl: string): string {
    const host = this.cleanHost(rawDomainOrUrl);
    if (!host || !host.includes('.')) return host;

    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return host;

    // Check if the last two parts match a known multi-part TLD (e.g., "co.uk")
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (this.multiPartTlds.has(lastTwo)) {
      if (parts.length >= 3) {
        return `${parts[parts.length - 3]}.${lastTwo}`;
      }
      return host;
    }

    // Default standard TLD: return last 2 parts (e.g. "stripe.com")
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }

  /**
   * Normalizes company domain to canonical form for caching and deduplication.
   */
  public normalizeCompanyDomain(rawDomainOrUrl: string): string {
    return this.extractRootDomain(rawDomainOrUrl);
  }
}
