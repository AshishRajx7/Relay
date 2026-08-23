import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyResearch } from './entities/company-research.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyResearchService } from './company-research.service';
import { CompanyResearchController } from './company-research.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyResearch, Company])],
  controllers: [CompanyResearchController],
  providers: [CompanyResearchService],
  exports: [CompanyResearchService, TypeOrmModule],
})
export class CompanyResearchModule {}
