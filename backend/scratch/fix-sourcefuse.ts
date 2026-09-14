import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { Prospect } from '../src/modules/prospects/entities/prospect.entity';
import { EmailDraft } from '../src/modules/outreach/entities/email-draft.entity';
import { EmailGenerationService } from '../src/modules/outreach/services/email-generation.service';
import { GmailDraftService, EmailAttachment } from '../src/modules/outreach/services/gmail-draft.service';
import * as fs from 'fs';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const candidateProfileRepo = app.get<Repository<CandidateProfile>>(getRepositoryToken(CandidateProfile));
  const emailDraftRepo = app.get<Repository<EmailDraft>>(getRepositoryToken(EmailDraft));
  const emailGenService = app.get<EmailGenerationService>(EmailGenerationService);
  const gmailDraftService = app.get<GmailDraftService>(GmailDraftService);

  const candidate = await candidateProfileRepo.findOne({
    where: { name: 'Ashish Raj' },
    relations: ['resumeFile'],
    order: { updatedAt: 'DESC' },
  });
  if (!candidate) throw new Error('Candidate not found');

  let attachment: EmailAttachment | undefined;
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
    .leftJoinAndSelect('prospect.companyProfile', 'companyProfile')
    .where('prospect.email = :email', { email: 'akanksha.puri@sourcefuse.com' })
    .getMany();

  console.log(`Found ${drafts.length} drafts for akanksha.puri@sourcefuse.com`);

  for (const draft of drafts) {
    const prospect = draft.prospect;
    const company = prospect.companyProfile || {
      companyName: 'SourceFuse',
      domain: 'sourcefuse.com',
    } as any;

    const draftResult = await emailGenService.generatePersonalizedDraft(prospect, company, candidate);

    draft.subject = draftResult.subject;
    draft.body = draftResult.body;
    await emailDraftRepo.save(draft);

    if (draft.gmailDraftId && attachment) {
      await gmailDraftService.createOrUpdateDraft(
        draft.id,
        prospect.email,
        draft.subject,
        draft.body,
        candidate.id,
        attachment,
        draft.gmailDraftId,
      );
      console.log(`✅ Synced updated draft ${draft.id} to Gmail ID: ${draft.gmailDraftId}`);
    }
  }

  await app.close();
}

main().catch(console.error);
