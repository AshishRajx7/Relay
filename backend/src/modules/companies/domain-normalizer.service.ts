import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class DomainNormalizerService {
  /**
   * Normalizes any website URL or domain input to a canonical lowercase domain string.
   *
   * Examples:
   * - "https://www.Company.COM/about?ref=123#test" -> "company.com"
   * - "http://company.co.uk/"                      -> "company.co.uk"
   * - "www.subdomain.company.com/path"             -> "subdomain.company.com"
   * - "company.com"                                -> "company.com"
   */
  normalize(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException('Website or domain must be a non-empty string.');
    }

    let cleaned = input.trim().toLowerCase();

    if (!cleaned) {
      throw new BadRequestException('Website or domain cannot be empty.');
    }

    // 1. If it doesn't have a protocol prefix, add temporary https:// so URL parser can handle it
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }

    let hostname: string;
    try {
      const urlObj = new URL(cleaned);
      hostname = urlObj.hostname;
    } catch {
      // Fallback regex if URL constructor fails
      const match = cleaned.replace(/^https?:\/\//, '').split(/[\/?#]/)[0];
      hostname = match || '';
    }

    // 2. Lowercase
    hostname = hostname.toLowerCase();

    // 3. Remove leading www. or wwwN. (e.g. www2., www3.)
    hostname = hostname.replace(/^www\d*\./, '');

    // 4. Remove trailing dots/slashes
    hostname = hostname.replace(/\.+$/, '').trim();

    // 5. Basic domain validation: must contain at least one dot and only valid domain characters
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!hostname || !domainRegex.test(hostname)) {
      throw new BadRequestException(
        `Invalid website domain "${input}". Could not extract a valid domain format.`,
      );
    }

    return hostname;
  }
}
