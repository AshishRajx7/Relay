import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Campaign } from './entities/campaign.entity';
import { Prospect } from '../prospects/entities/prospect.entity';
import { CandidateProfile } from '../resume/entities/candidate-profile.entity';
import { CompanyProfile } from '../company-research/entities/company-profile.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignIngestionService } from './services/campaign-ingestion.service';
import { CampaignsController } from './campaigns.controller';
import { CompanyResearchModule } from '../company-research/company-research.module';
import { OutreachModule } from '../outreach/outreach.module';
import { QUEUE_COMPANY_RESEARCH, QUEUE_DRAFT_GENERATION } from '../../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, Prospect, CandidateProfile, CompanyProfile]),
    BullModule.registerQueue(
      { name: QUEUE_COMPANY_RESEARCH },
      { name: QUEUE_DRAFT_GENERATION },
    ),
    CompanyResearchModule,
    forwardRef(() => OutreachModule),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignIngestionService],
  exports: [CampaignsService, CampaignIngestionService],
})
export class CampaignsModule {}
