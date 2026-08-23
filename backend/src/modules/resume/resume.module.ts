import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ResumeFile } from './entities/resume-file.entity';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { ResumeService } from './resume.service';
import { ResumeParserService } from './resume-parser.service';
import { ResumeController } from './resume.controller';
import { ResumeParsingProcessor } from '../queue/processors/resume-parsing.processor';
import { QUEUE_RESUME_PARSING } from '../../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResumeFile, CandidateProfile]),
    BullModule.registerQueue({
      name: QUEUE_RESUME_PARSING,
    }),
  ],
  controllers: [ResumeController],
  providers: [ResumeService, ResumeParserService, ResumeParsingProcessor],
  exports: [ResumeService, ResumeParserService],
})
export class ResumeModule {}
