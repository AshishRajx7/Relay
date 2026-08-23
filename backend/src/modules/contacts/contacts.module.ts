import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyResearch } from '../company-research/entities/company-research.entity';
import { CompaniesModule } from '../companies/companies.module';
import { ContactsService } from './contacts.service';
import { ContactsCsvParserService } from './contacts-csv-parser.service';
import { ContactsController } from './contacts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Company, CompanyResearch]),
    CompaniesModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsCsvParserService],
  exports: [ContactsService, ContactsCsvParserService, TypeOrmModule],
})
export class ContactsModule {}
