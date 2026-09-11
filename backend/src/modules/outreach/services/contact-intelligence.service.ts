import { Injectable, Logger } from '@nestjs/common';
import { ContactType } from '../../prospects/entities/prospect.entity';

@Injectable()
export class ContactIntelligenceService {
  private readonly logger = new Logger(ContactIntelligenceService.name);

  // System, robot, automated, or unmonitored email patterns
  private readonly unsupportedPatterns = [
    /^no-?reply/i,
    /^dont-?reply/i,
    /^do-not-reply/i,
    /^admin(istrator)?([._\d].*)?$/i,
    /^support([._\d].*)?$/i,
    /^help(desk)?([._\d].*)?$/i,
    /^system(s)?([._\d].*)?$/i,
    /^alerts?([._\d].*)?$/i,
    /^notifications?([._\d].*)?$/i,
    /^billing([._\d].*)?$/i,
    /^payments?([._\d].*)?$/i,
    /^postmaster([._\d].*)?$/i,
    /^mailer-daemon([._\d].*)?$/i,
    /^security([._\d].*)?$/i,
    /^abuse([._\d].*)?$/i,
    /^privacy([._\d].*)?$/i,
  ];

  /**
   * Classifies an email address into contact role types:
   * UNSUPPORTED_CONTACT, HR, RECRUITER, FOUNDER, ENGINEERING, PRODUCT, GENERAL
   */
  public classifyContact(email: string): ContactType {
    if (!email || !email.includes('@')) return ContactType.GENERAL;
    const localPart = email.split('@')[0].toLowerCase().trim();

    // 1. Check if unmonitored / automated bot address
    for (const pattern of this.unsupportedPatterns) {
      if (pattern.test(localPart)) {
        return ContactType.UNSUPPORTED_CONTACT;
      }
    }

    // 2. HR: hr@, people@, careers@, jobs@, recruitment@
    if (
      /^(hr|people|careers|jobs|recruitment|talent-acq|hiring)$/.test(localPart) ||
      localPart.startsWith('hr.') ||
      localPart.startsWith('careers.') ||
      localPart.startsWith('jobs.')
    ) {
      return ContactType.HR;
    }

    // 3. Recruiter: recruiter@, talent@, talent-acquisition@, sourcer@
    if (
      /^(recruiter|talent|talent-acquisition|sourcer|headhunter)$/.test(localPart) ||
      localPart.includes('recruiter') ||
      localPart.includes('sourcer')
    ) {
      return ContactType.RECRUITER;
    }

    // 4. Founder: founder@, ceo@, cofounder@, owner@
    if (
      /^(founder|ceo|cofounder|co-founder|owner|partner|president)$/.test(localPart) ||
      localPart.includes('founder') ||
      localPart.includes('ceo')
    ) {
      return ContactType.FOUNDER;
    }

    // 5. Engineering: cto@, engineering@, dev@, platform@, backend@, architect@
    if (
      /^(cto|engineering|dev|platform|backend|architect|tech|infra|vpe|vp-eng)$/.test(localPart) ||
      localPart.includes('cto') ||
      localPart.includes('tech-lead') ||
      localPart.includes('engineering')
    ) {
      return ContactType.ENGINEERING;
    }

    // 6. Product: product@, pm@
    if (
      /^(product|pm|cpo|head-of-product)$/.test(localPart) ||
      localPart.startsWith('product.') ||
      localPart.startsWith('pm.')
    ) {
      return ContactType.PRODUCT;
    }

    // 7. General default: info@, hello@, contact@, team@
    return ContactType.GENERAL;
  }
}
