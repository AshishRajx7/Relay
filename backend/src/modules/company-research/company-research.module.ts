import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CompanyResearch } from './entities/company-research.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyProfile } from './entities/company-profile.entity';
import { Prospect } from '../prospects/entities/prospect.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CompanyResearchService } from './company-research.service';
import { CompanyProfileService } from './services/company-profile.service';
import { CompanyDomainService } from './services/company-domain.service';
import { CompanyResearchController } from './company-research.controller';
import { Crawl4AIProvider } from './providers/crawl4ai.provider';
import { AtsDiscoveryService } from './services/ats-discovery.service';
import { ResearchQualityScorerService } from './services/research-quality-scorer.service';
import { CompanyResearchProcessor } from '../queue/processors/company-research.processor';
import { QUEUE_COMPANY_RESEARCH, QUEUE_DRAFT_GENERATION, CRAWL_PROVIDER_TOKEN } from '../../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyResearch,
      Company,
      CompanyProfile,
      Prospect,
      Campaign,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_COMPANY_RESEARCH },
      { name: QUEUE_DRAFT_GENERATION },
    ),
  ],
  controllers: [CompanyResearchController],
  providers: [
    CompanyResearchService,
    CompanyProfileService,
    CompanyDomainService,
    AtsDiscoveryService,
    ResearchQualityScorerService,
    {
      provide: CRAWL_PROVIDER_TOKEN,
      useClass: Crawl4AIProvider,
    },
    CompanyResearchProcessor,
  ],
  exports: [
    CompanyResearchService,
    CompanyProfileService,
    CompanyDomainService,
    AtsDiscoveryService,
    ResearchQualityScorerService,
    CRAWL_PROVIDER_TOKEN,
    TypeOrmModule,
    BullModule,
  ],
})
export class CompanyResearchModule {}
