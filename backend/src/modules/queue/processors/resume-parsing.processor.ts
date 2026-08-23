import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_RESUME_PARSING, JOB_PARSE_RESUME } from '../../../common/constants/app.constants';
import { ResumeParseJobData } from '../dto/resume-parse-job.dto';
import { ResumeParserService } from '../../resume/resume-parser.service';

@Processor(QUEUE_RESUME_PARSING)
export class ResumeParsingProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeParsingProcessor.name);

  constructor(private readonly resumeParserService: ResumeParserService) {
    super();
  }

  async process(job: Job<ResumeParseJobData, any, string>): Promise<any> {
    this.logger.log(`Processing BullMQ job ${job.id} (${job.name}) for resume ID: ${job.data.resumeId}`);

    if (job.name === JOB_PARSE_RESUME) {
      const { resumeId } = job.data;
      const profile = await this.resumeParserService.parseResume(resumeId);
      this.logger.log(`Completed BullMQ job ${job.id} for resume ID: ${resumeId}`);
      return { resumeId, profileId: profile.id };
    }

    this.logger.warn(`Unknown job name: ${job.name}`);
    return null;
  }
}
