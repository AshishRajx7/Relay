import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { DomainNormalizerService } from './domain-normalizer.service';
import { CompanyResponseDto, CompanyResearchSummaryDto } from './dto/company-response.dto';
import { CompanyListResponseDto, CompanyListResearchSummaryDto } from './dto/company-list-response.dto';
import { CompanyResearch } from '../company-research/entities/company-research.entity';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly domainNormalizerService: DomainNormalizerService,
  ) {}

  /**
   * Retrieves all companies with their contact counts and latest research summaries.
   */
  async findAll(): Promise<CompanyListResponseDto[]> {
    const companies = await this.companyRepository.find({
      relations: ['contacts', 'researches'],
      order: { createdAt: 'DESC' },
    });

    return companies.map((company) => this.mapToListDto(company));
  }

  /**
   * Retrieves a single company by ID with its full research record and contact count.
   */
  async findOne(id: string): Promise<CompanyResponseDto> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('Invalid company ID provided');
    }
    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['contacts', 'researches'],
    });

    if (!company) {
      throw new NotFoundException(`Company with ID "${id}" not found.`);
    }

    return this.mapToResponseDto(company);
  }

  /**
   * Finds a company by its website URL or domain.
   */
  async findByDomain(domainOrUrl: string): Promise<Company | null> {
    if (!domainOrUrl || typeof domainOrUrl !== 'string' || !domainOrUrl.trim()) {
      return null;
    }
    const normalizedDomain = this.domainNormalizerService.normalize(domainOrUrl);
    return await this.companyRepository.findOne({
      where: { normalizedDomain },
      relations: ['contacts', 'researches'],
    });
  }

  /**
   * Finds an existing company by normalized domain or creates a new one.
   * Atomic and race-condition safe via PostgreSQL ON CONFLICT DO UPDATE.
   */
  async findOrCreate(name: string, website: string): Promise<Company> {
    const normalizedDomain = this.domainNormalizerService.normalize(website);
    const cleanedName = name?.trim() || normalizedDomain;
    const cleanedWebsite = website?.trim() || `https://${normalizedDomain}`;

    // Fast-path lookup
    const existing = await this.companyRepository.findOne({
      where: { normalizedDomain },
    });

    if (existing) {
      return existing;
    }

    try {
      // Atomic upsert with RETURNING to handle concurrent insert races safely
      const result = await this.companyRepository.query(
        `
        INSERT INTO "company" ("name", "website", "normalized_domain", "created_at", "updated_at")
        VALUES ($1, $2, $3, now(), now())
        ON CONFLICT ("normalized_domain") 
        DO UPDATE SET "updated_at" = now()
        RETURNING *;
        `,
        [cleanedName, cleanedWebsite, normalizedDomain],
      );

      const rawRow = result[0];
      const company = this.companyRepository.create({
        id: rawRow.id,
        name: rawRow.name,
        website: rawRow.website,
        normalizedDomain: rawRow.normalized_domain,
        createdAt: rawRow.created_at,
        updatedAt: rawRow.updated_at,
      });

      this.logger.log(`Registered company: ${company.name} (${company.normalizedDomain})`);
      return company;
    } catch (err: any) {
      this.logger.warn(
        `Direct upsert encountered race condition for ${normalizedDomain}: ${err.message}. Falling back to lookup.`,
      );
      const fallback = await this.companyRepository.findOne({
        where: { normalizedDomain },
      });
      if (fallback) {
        return fallback;
      }
      throw err;
    }
  }

  private getLatestResearch(researches?: CompanyResearch[]): CompanyResearch | null {
    if (!researches || researches.length === 0) {
      return null;
    }
    // Return newest research by researchedAt or createdAt
    return [...researches].sort((a, b) => {
      const timeA = a.researchedAt ? a.researchedAt.getTime() : a.createdAt.getTime();
      const timeB = b.researchedAt ? b.researchedAt.getTime() : b.createdAt.getTime();
      return timeB - timeA;
    })[0];
  }

  private mapToListDto(company: Company): CompanyListResponseDto {
    const latestResearch = this.getLatestResearch(company.researches);
    let researchSummary: CompanyListResearchSummaryDto | null = null;

    if (latestResearch) {
      researchSummary = {
        status: latestResearch.status,
        researchQualityScore: latestResearch.researchQualityScore,
        researchedAt: latestResearch.researchedAt,
      };
    }

    return {
      id: company.id,
      name: company.name,
      website: company.website,
      normalizedDomain: company.normalizedDomain,
      contactCount: company.contacts ? company.contacts.length : 0,
      research: researchSummary,
      createdAt: company.createdAt,
    };
  }

  private mapToResponseDto(company: Company): CompanyResponseDto {
    const latestResearch = this.getLatestResearch(company.researches);
    let researchSummary: CompanyResearchSummaryDto | null = null;

    if (latestResearch) {
      researchSummary = {
        status: latestResearch.status,
        researchQualityScore: latestResearch.researchQualityScore,
        persona: latestResearch.persona,
        industry: latestResearch.industry,
        companySize: latestResearch.companySize,
        summary: latestResearch.summary,
        researchedAt: latestResearch.researchedAt,
        expiresAt: latestResearch.expiresAt,
      };
    }

    return {
      id: company.id,
      name: company.name,
      website: company.website,
      normalizedDomain: company.normalizedDomain,
      contactCount: company.contacts ? company.contacts.length : 0,
      research: researchSummary,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}
