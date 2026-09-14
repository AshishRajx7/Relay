import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from '../src/modules/resume/entities/candidate-profile.entity';
import { Prospect } from '../src/modules/prospects/entities/prospect.entity';
import { EmailDraft, OutreachDraftStatus } from '../src/modules/outreach/entities/email-draft.entity';
import { DraftReasoning } from '../src/modules/outreach/entities/draft-reasoning.entity';
import { DraftQuality } from '../src/modules/outreach/entities/draft-quality.entity';
import { EmailDraftVariant, EmailVariantType } from '../src/modules/outreach/entities/email-draft-variant.entity';
import { EmailGenerationService } from '../src/modules/outreach/services/email-generation.service';
import { GmailDraftService, EmailAttachment } from '../src/modules/outreach/services/gmail-draft.service';
import { DraftQualityService } from '../src/modules/outreach/services/draft-quality.service';
import * as fs from 'fs';

async function main() {
  console.log('================================================================');
  console.log('🚀 RELAY OUTREACH V4 — HUMAN-LIKE JOB APPLICATION EMAILS');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const candidateProfileRepo = app.get<Repository<CandidateProfile>>(getRepositoryToken(CandidateProfile));
  const prospectRepo = app.get<Repository<Prospect>>(getRepositoryToken(Prospect));
  const emailDraftRepo = app.get<Repository<EmailDraft>>(getRepositoryToken(EmailDraft));
  const reasoningRepo = app.get<Repository<DraftReasoning>>(getRepositoryToken(DraftReasoning));
  const qualityRepo = app.get<Repository<DraftQuality>>(getRepositoryToken(DraftQuality));
  const variantRepo = app.get<Repository<EmailDraftVariant>>(getRepositoryToken(EmailDraftVariant));
  const emailGenService = app.get<EmailGenerationService>(EmailGenerationService);
  const gmailDraftService = app.get<GmailDraftService>(GmailDraftService);
  const draftQualityService = app.get<DraftQualityService>(DraftQualityService);

  const candidate = await candidateProfileRepo.findOne({
    where: { name: 'Ashish Raj' },
    relations: ['resumeFile'],
    order: { updatedAt: 'DESC' },
  });

  if (!candidate) throw new Error('Candidate Ashish Raj not found');

  let attachment: EmailAttachment | undefined;
  if (candidate.resumeFile?.storagePath && fs.existsSync(candidate.resumeFile.storagePath)) {
    attachment = {
      filename: `Resume - ${candidate.name}.pdf`,
      content: fs.readFileSync(candidate.resumeFile.storagePath),
      contentType: 'application/pdf',
    };
  }

  // Fetch all 9 drafts
  const existingDrafts = await emailDraftRepo
    .createQueryBuilder('draft')
    .leftJoinAndSelect('draft.prospect', 'prospect')
    .leftJoinAndSelect('prospect.companyProfile', 'companyProfile')
    .where('draft.status = :status', { status: OutreachDraftStatus.GMAIL_DRAFT_CREATED })
    .orderBy('draft.updatedAt', 'DESC')
    .limit(9)
    .getMany();

  console.log(`Processing ${existingDrafts.length} targets with V4 Human-Like Generation...\n`);

  const results: any[] = [];

  for (const draft of existingDrafts) {
    const prospect = draft.prospect;
    const company = prospect.companyProfile || {
      companyName: prospect.companyName || prospect.domain,
      domain: prospect.domain,
    } as any;

    console.log(`----------------------------------------------------------------`);
    console.log(`Generating V4 Email for: ${prospect.email} (${company.companyName})`);

    const draftResult = await emailGenService.generatePersonalizedDraft(prospect, company, candidate);

    // Overwrite EmailDraft in DB
    draft.subject = draftResult.subject;
    draft.body = draftResult.body;
    draft.status = OutreachDraftStatus.GMAIL_DRAFT_CREATED;
    const savedDraft = await emailDraftRepo.save(draft);

    // Update Reasoning
    let reasoning = await reasoningRepo.findOne({ where: { emailDraftId: savedDraft.id } });
    if (!reasoning) reasoning = reasoningRepo.create({ emailDraftId: savedDraft.id });
    reasoning.whyCompany = draftResult.whyCompany;
    reasoning.whyMe = draftResult.whyMe;
    reasoning.whyNow = draftResult.whyNow;
    reasoning.confidenceLevel = draftResult.confidenceLevel;
    await reasoningRepo.save(reasoning);

    // Update Quality
    let quality = await qualityRepo.findOne({ where: { emailDraftId: savedDraft.id } });
    if (!quality) quality = qualityRepo.create({ emailDraftId: savedDraft.id });
    quality.personalizationScore = draftResult.quality.personalizationScore;
    quality.relevanceScore = draftResult.quality.relevanceScore;
    quality.spamRiskScore = draftResult.quality.spamRiskScore;
    quality.technicalAlignmentScore = draftResult.quality.technicalAlignmentScore;
    quality.confidenceScore = draftResult.quality.confidenceScore;
    quality.requiresManualReview = draftResult.quality.requiresManualReview;
    quality.flags = draftResult.quality.flags;
    await qualityRepo.save(quality);

    // Update Variants
    await variantRepo.delete({ emailDraftId: savedDraft.id });
    for (const v of draftResult.variants) {
      const vEntity = variantRepo.create({
        emailDraftId: savedDraft.id,
        variantType: v.variantType,
        subject: v.subject,
        body: v.body,
        wordCount: v.wordCount,
        personalizationScore: v.quality.personalizationScore,
        relevanceScore: v.quality.relevanceScore,
        spamRiskScore: v.quality.spamRiskScore,
        technicalAlignmentScore: v.quality.technicalAlignmentScore,
        confidenceScore: v.quality.confidenceScore,
        isSelected: v.isSelected,
      });
      await variantRepo.save(vEntity);
    }

    // Sync to live Gmail Draft (preserving existing ID)
    if (savedDraft.gmailDraftId && attachment) {
      console.log(`  Updating Gmail Draft ${savedDraft.gmailDraftId}...`);
      await gmailDraftService.createOrUpdateDraft(
        savedDraft.id,
        prospect.email,
        savedDraft.subject,
        savedDraft.body,
        candidate.id,
        attachment,
        savedDraft.gmailDraftId,
      );
      console.log(`  ✅ Synced to Gmail with preserved ID: ${savedDraft.gmailDraftId}`);
    }

    const wordCount = savedDraft.body.split(/\s+/).filter(Boolean).length;
    results.push({
      email: prospect.email,
      company: company.companyName,
      subject: savedDraft.subject,
      body: savedDraft.body,
      wordCount,
      gmailDraftId: savedDraft.gmailDraftId,
      flags: draftResult.quality.flags,
    });
  }

  console.log('\n================================================================');
  console.log('📊 V4 HUMAN-LIKE APPLICATION GENERATION RESULTS');
  console.log('================================================================\n');

  for (const r of results) {
    console.log(`[${r.company}] ${r.email}`);
    console.log(`  Subject:    ${r.subject}`);
    console.log(`  Word Count: ${r.wordCount} words (Target: 70-120, Max: 140)`);
    console.log(`  Gmail ID:   ${r.gmailDraftId}`);
    console.log(`  Body:\n${r.body}\n`);
    console.log('----------------------------------------------------------------\n');
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
