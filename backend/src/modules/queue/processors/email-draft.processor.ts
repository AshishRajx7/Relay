import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_DRAFT_GENERATION } from '../../../common/constants/app.constants';
import { DraftGenerationProcessor } from './draft-generation.processor';

@Processor(QUEUE_DRAFT_GENERATION, { concurrency: 5 })
export class EmailDraftProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDraftProcessor.name);

  constructor(private readonly draftGenerationProcessor: DraftGenerationProcessor) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    return this.draftGenerationProcessor.process(job);
  }
}
