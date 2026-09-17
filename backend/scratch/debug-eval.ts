import 'reflect-metadata';
import { DraftQualityService } from '../src/modules/outreach/services/draft-quality.service';

const qs = new DraftQualityService();
const genericBody = 'Hi Team,\n\nI am a backend developer at The Ninja Studio building distributed systems with NestJS and PostgreSQL.\n\nIn my previous work on BullMQ Notification System, I built resilient background queues.\n\nI have attached my resume for context.\n\nBest,\nAshish';
const res = qs.evaluateDraft('Backend engineering inquiry', genericBody, { companyName: 'Apollo Hospitals' } as any, { matchScore: 0 } as any);

console.log('requiresManualReview:', res.requiresManualReview);
console.log('flags:', res.flags);
console.log('wordCount:', genericBody.split(/\s+/).filter(Boolean).length);
console.log('paragraphs:', genericBody.split(/\n\s*\n/).filter(Boolean).length);
console.log('hasRoleIntent:', qs.hasRoleIntent(genericBody));
console.log('hasResumeMention:', qs.hasResumeMention(genericBody));
console.log('hasForbiddenCta:', qs.hasForbiddenCta(genericBody));
console.log('networkingTone:', qs.hasNetworkingTone(genericBody));
console.log('consultingTone:', qs.hasConsultingTone(genericBody));
console.log('hasSignatureOrClosingSentence:', DraftQualityService.hasSignatureOrClosingSentence(genericBody));
console.log('hasForbiddenPhrase:', qs.hasForbiddenPhrase(genericBody));
