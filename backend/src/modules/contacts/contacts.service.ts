import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CompaniesService } from '../companies/companies.service';
import { ContactsCsvParserService } from './contacts-csv-parser.service';
import { ContactsUploadResultDto, ContactRowErrorDto } from './dto/contacts-upload-result.dto';
import { ContactResponseDto, ContactCompanyDto } from './dto/contact-response.dto';
import { ContactsQueryDto } from './dto/contacts-query.dto';
import { CompanyResearch } from '../company-research/entities/company-research.entity';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly companiesService: CompaniesService,
    private readonly csvParser: ContactsCsvParserService,
  ) {}

  /**
   * Processes a multipart CSV upload:
   * Parses rows, validates emails, creates/links companies, deduplicates, and saves contacts.
   * Tolerates faulty rows without aborting the batch.
   */
  async uploadCsv(file: Express.Multer.File): Promise<ContactsUploadResultDto> {
    const parseResult = this.csvParser.parse(file.buffer);
    const errors: ContactRowErrorDto[] = [];
    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const row of parseResult.rows) {
      if (!row.isValid) {
        invalid++;
        errors.push({
          row: row.rowNumber,
          email: row.email || 'N/A',
          reason: row.errorReason || 'Invalid data',
        });
        continue;
      }

      try {
        // 1. Check duplicate by email
        const existing = await this.contactRepository.findOne({
          where: { email: row.email },
        });

        if (existing) {
          duplicates++;
          errors.push({
            row: row.rowNumber,
            email: row.email,
            reason: `Duplicate contact: email "${row.email}" already exists`,
          });
          continue;
        }

        // 2. Find or create company
        const company = await this.companiesService.findOrCreate(row.company, row.website);

        // 3. Create and save contact
        const contact = this.contactRepository.create({
          name: row.name,
          email: row.email,
          companyId: company.id,
          company,
        });

        await this.contactRepository.save(contact);
        imported++;
      } catch (err: any) {
        this.logger.error(`Error processing row ${row.rowNumber} (${row.email}): ${err.message}`);
        invalid++;
        errors.push({
          row: row.rowNumber,
          email: row.email,
          reason: `Database error: ${err.message}`,
        });
      }
    }

    this.logger.log(
      `CSV Import completed: Total=${parseResult.totalRows}, Imported=${imported}, Duplicates=${duplicates}, Invalid=${invalid}`,
    );

    return {
      totalRows: parseResult.totalRows,
      imported,
      duplicates,
      invalid,
      errors,
    };
  }

  /**
   * Retrieves contacts with optional filters: companyId, case-insensitive search on name/email.
   */
  async findAll(query?: ContactsQueryDto): Promise<ContactResponseDto[]> {
    const qb = this.contactRepository
      .createQueryBuilder('contact')
      .leftJoinAndSelect('contact.company', 'company')
      .leftJoinAndSelect('company.researches', 'research')
      .orderBy('contact.createdAt', 'DESC');

    if (query?.companyId) {
      qb.andWhere('contact.companyId = :companyId', { companyId: query.companyId });
    }

    if (query?.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(contact.name) LIKE :searchTerm OR LOWER(contact.email) LIKE :searchTerm)',
        { searchTerm },
      );
    }

    const contacts = await qb.getMany();

    return contacts.map((contact) => this.mapToDto(contact));
  }

  private getLatestResearch(researches?: CompanyResearch[]): CompanyResearch | null {
    if (!researches || researches.length === 0) {
      return null;
    }
    return [...researches].sort((a, b) => {
      const timeA = a.researchedAt ? a.researchedAt.getTime() : a.createdAt.getTime();
      const timeB = b.researchedAt ? b.researchedAt.getTime() : b.createdAt.getTime();
      return timeB - timeA;
    })[0];
  }

  private mapToDto(contact: Contact): ContactResponseDto {
    let companyDto: ContactCompanyDto | null = null;

    if (contact.company) {
      const latestResearch = this.getLatestResearch(contact.company.researches);
      companyDto = {
        id: contact.company.id,
        name: contact.company.name,
        normalizedDomain: contact.company.normalizedDomain,
        researchStatus: latestResearch ? latestResearch.status : null,
      };
    }

    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      title: contact.title,
      company: companyDto,
      createdAt: contact.createdAt,
    };
  }
}
