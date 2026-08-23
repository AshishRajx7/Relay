import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { CompanyResearch } from '../company-research/entities/company-research.entity';
import { CompaniesService } from './companies.service';
import { DomainNormalizerService } from './domain-normalizer.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Contact, CompanyResearch])],
  controllers: [CompaniesController],
  providers: [CompaniesService, DomainNormalizerService],
  exports: [CompaniesService, DomainNormalizerService, TypeOrmModule],
})
export class CompaniesModule {}
