import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_CAMPAIGN_INGEST, JOB_INGEST_CAMPAIGN } from '../../../common/constants/app.constants';
import { CampaignIngestionService } from '../../campaigns/services/campaign-ingestion.service';

@Processor(QUEUE_CAMPAIGN_INGEST, { concurrency: 2 })
export class CampaignIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignIngestProcessor.name);

  constructor(private readonly ingestionService: CampaignIngestionService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[CampaignIngestProcessor] Processing job ${job.id} for campaign: ${job.data.campaignId}`);

    if (job.name !== JOB_INGEST_CAMPAIGN) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return null;
    }

    const { campaignId, fileBufferBase64, originalFileName, mimeType } = job.data;
    const buffer = Buffer.from(fileBufferBase64, 'base64');

    return this.ingestionService.ingestFile(campaignId, buffer, originalFileName, mimeType);
  }
}
