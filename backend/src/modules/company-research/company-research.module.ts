import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CompanyResearch } from './entities/company-research.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyResearchService } from './company-research.service';
import { CompanyResearchController } from './company-research.controller';
import { Crawl4AIProvider } from './providers/crawl4ai.provider';
import { AtsDiscoveryService } from './services/ats-discovery.service';
import { ResearchQualityScorerService } from './services/research-quality-scorer.service';
import { CompanyResearchProcessor } from '../queue/processors/company-research.processor';
import { QUEUE_COMPANY_RESEARCH, CRAWL_PROVIDER_TOKEN } from '../../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyResearch, Company]),
    BullModule.registerQueue({
      name: QUEUE_COMPANY_RESEARCH,
    }),
  ],
  controllers: [CompanyResearchController],
  providers: [
    CompanyResearchService,
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
    AtsDiscoveryService,
    ResearchQualityScorerService,
    CRAWL_PROVIDER_TOKEN,
    TypeOrmModule,
    BullModule,
  ],
})
export class CompanyResearchModule {}
