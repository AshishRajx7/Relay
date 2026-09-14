import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailDraft } from '../src/modules/outreach/entities/email-draft.entity';
import { Prospect } from '../src/modules/prospects/entities/prospect.entity';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { GmailDraftService } from '../src/modules/outreach/services/gmail-draft.service';
import * as fs from 'fs';
import * as path from 'path';

function formatParagraphs(body: string): string {
  let text = body.trim();

  // 1. Greeting
  const greetingMatch = text.match(/^(Hi\s+[^,]+,\s*|Hi,\s*)/i);
  let greeting = '';
  if (greetingMatch) {
    greeting = greetingMatch[1].trim();
    text = text.slice(greetingMatch[0].length).trim();
  }

  // Remove trailing signoff if present
  text = text.replace(/(\s*(?:Best|Best regards|Thanks|Regards),?\s*\n?Ashish Raj\s*)$/i, '').trim();

  // 4. P4: Starts with "I've attached my resume"
  let p4 = '';
  const p4Index = text.indexOf("I've attached my resume");
  if (p4Index !== -1) {
    p4 = text.slice(p4Index).trim();
    text = text.slice(0, p4Index).trim();
  }

  // 3. P3: Starts with engineering achievements
  let p3 = '';
  const p3Index = text.search(/(?:I've built|In my current|I built|Before joining The Ninja Studio|Additionally, I co-founded|I designed|As the co-founder)/i);
  if (p3Index !== -1) {
    p3 = text.slice(p3Index).trim();
    text = text.slice(0, p3Index).trim();
  }

  // What remains in `text` is P1 and P2!
  let p1 = '';
  let p2 = '';
  const oppIndex = text.indexOf('opportunities at ');
  if (oppIndex !== -1) {
    const afterOpp = text.slice(oppIndex);
    const periodIndex = afterOpp.search(/\.\s+[A-Z]/);
    if (periodIndex !== -1) {
      const splitAt = oppIndex + periodIndex + 1;
      p1 = text.slice(0, splitAt).trim();
      p2 = text.slice(splitAt).trim();
    } else {
      const dotIndex = afterOpp.indexOf('.');
      if (dotIndex !== -1) {
        const splitAt = oppIndex + dotIndex + 1;
        p1 = text.slice(0, splitAt).trim();
        p2 = text.slice(splitAt).trim();
      }
    }
  }

  if (!p1) {
    p1 = text.trim();
  }

  const parts = [];
  if (greeting) parts.push(greeting);
  if (p1) parts.push(p1);
  if (p2) parts.push(p2);
  if (p3) parts.push(p3);
  if (p4) parts.push(p4);

  return parts.join('\n\n');
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const emailDraftRepo: Repository<EmailDraft> = app.get(getRepositoryToken(EmailDraft));
  const prospectRepo: Repository<Prospect> = app.get(getRepositoryToken(Prospect));
  const candidateProfileRepo: Repository<CandidateProfile> = app.get(getRepositoryToken(CandidateProfile));
  const gmailDraftService: GmailDraftService = app.get(GmailDraftService);

  const candidate = await candidateProfileRepo.findOne({
    where: { name: 'Ashish Raj' },
    relations: ['resumeFile'],
    order: { updatedAt: 'DESC' },
  });

  if (!candidate) throw new Error('Candidate Ashish Raj not found');

  let attachment: { filename: string; content: Buffer; contentType: string } | undefined;
  if (candidate.resumeFile?.storagePath && fs.existsSync(candidate.resumeFile.storagePath)) {
    attachment = {
      filename: `Resume - ${candidate.name}.pdf`,
      content: fs.readFileSync(candidate.resumeFile.storagePath),
      contentType: 'application/pdf',
    };
  }

  const drafts = await emailDraftRepo
    .createQueryBuilder('draft')
    .leftJoinAndSelect('draft.prospect', 'prospect')
    .where('draft.status = :status', { status: 'GMAIL_DRAFT_CREATED' })
    .orderBy('draft.updatedAt', 'DESC')
    .limit(9)
    .getMany();

  console.log(`Syncing ${drafts.length} formatted drafts to database and Gmail...`);

  for (const draft of drafts) {
    const formattedBody = formatParagraphs(draft.body);
    draft.body = formattedBody;
    await emailDraftRepo.save(draft);

    if (draft.gmailDraftId && attachment) {
      console.log(`Updating Gmail draft ${draft.gmailDraftId} for ${draft.prospect.email}...`);
      await gmailDraftService.createOrUpdateDraft(
        draft.id,
        draft.prospect.email,
        draft.subject,
        formattedBody,
        candidate.id,
        attachment,
        draft.gmailDraftId,
      );
      console.log(`  ✅ Synced ${draft.prospect.email} (Preserved: ${draft.gmailDraftId})`);
    }
  }

  console.log('All 9 drafts successfully formatted and synced to Gmail!');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
