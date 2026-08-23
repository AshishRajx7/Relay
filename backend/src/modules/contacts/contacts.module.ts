import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Contact } from './entities/contact.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyResearch } from '../company-research/entities/company-research.entity';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyResearchModule } from '../company-research/company-research.module';
import { ContactsService } from './contacts.service';
import { ContactsCsvParserService } from './contacts-csv-parser.service';
import { ContactsController } from './contacts.controller';
import { QUEUE_COMPANY_RESEARCH } from '../../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Company, CompanyResearch]),
    CompaniesModule,
    CompanyResearchModule,
    BullModule.registerQueue({
      name: QUEUE_COMPANY_RESEARCH,
    }),
  ],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsCsvParserService],
  exports: [ContactsService, ContactsCsvParserService, TypeOrmModule],
})
export class ContactsModule {}
