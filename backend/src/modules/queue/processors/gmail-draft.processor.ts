import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_GMAIL_DRAFT, JOB_CREATE_GMAIL_DRAFT } from '../../../common/constants/app.constants';
import { EmailDraft, OutreachDraftStatus } from '../../outreach/entities/email-draft.entity';
import { Prospect, ProspectDraftStatus } from '../../prospects/entities/prospect.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { GmailDraftService } from '../../outreach/services/gmail-draft.service';

@Processor(QUEUE_GMAIL_DRAFT, { concurrency: 2 })
export class GmailDraftProcessor extends WorkerHost {
  private readonly logger = new Logger(GmailDraftProcessor.name);

  constructor(
    @InjectRepository(EmailDraft)
    private readonly emailDraftRepository: Repository<EmailDraft>,
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly gmailDraftService: GmailDraftService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[GmailDraftProcessor] Processing job ${job.id} for draft ID: ${job.data.draftId}`);

    if (job.name !== JOB_CREATE_GMAIL_DRAFT) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return null;
    }

    const { draftId } = job.data;
    const draft = await this.emailDraftRepository.findOne({
      where: { id: draftId },
      relations: ['prospect', 'prospect.campaign'],
    });

    if (!draft) {
      throw new Error(`EmailDraft with ID ${draftId} not found`);
    }

    if (!draft.prospect) {
      throw new Error(`Prospect not linked to draft ${draftId}`);
    }

    try {
      const result = await this.gmailDraftService.createDraft(
        draft.id,
        draft.prospect.email,
        draft.subject,
        draft.body,
        draft.prospect.campaign?.candidateProfileId,
      );

      draft.gmailDraftId = result.gmailDraftId;
      draft.gmailThreadId = result.gmailThreadId;
      draft.status = OutreachDraftStatus.GMAIL_DRAFT_CREATED;
      await this.emailDraftRepository.save(draft);

      draft.prospect.draftStatus = ProspectDraftStatus.GMAIL_DRAFT_CREATED;
      await this.prospectRepository.save(draft.prospect);

      if (draft.prospect.campaignId) {
        await this.campaignRepository.increment(
          { id: draft.prospect.campaignId },
          'gmailDraftCount',
          1,
        );
      }

      this.logger.log(`Gmail Draft created successfully for ${draft.prospect.email} (Draft ID: ${result.gmailDraftId})`);
      return { draftId: draft.id, gmailDraftId: result.gmailDraftId };
    } catch (err: any) {
      this.logger.error(`Failed to create Gmail draft for ${draft.prospect.email}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
