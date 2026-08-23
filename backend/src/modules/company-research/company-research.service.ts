import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CompanyResearch } from './entities/company-research.entity';
import { Company } from '../companies/entities/company.entity';
import { ResearchStatus } from './enums/research-status.enum';

@Injectable()
export class CompanyResearchService {
  private readonly logger = new Logger(CompanyResearchService.name);

  constructor(
    @InjectRepository(CompanyResearch)
    private readonly researchRepository: Repository<CompanyResearch>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Retrieves the most recent research record for a company.
   */
  async getLatest(companyId: string): Promise<CompanyResearch | null> {
    return await this.researchRepository
      .createQueryBuilder('research')
      .where('research.companyId = :companyId', { companyId })
      .orderBy('research.researchedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('research.createdAt', 'DESC')
      .getOne();
  }

  /**
   * Retrieves the latest valid, unexpired completed research for a company (30-day cache check).
   */
  async getValidResearch(companyId: string): Promise<CompanyResearch | null> {
    return await this.researchRepository.findOne({
      where: {
        companyId,
        status: ResearchStatus.COMPLETED,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        researchedAt: 'DESC',
      },
    });
  }

  /**
   * Finds a research record by its own UUID.
   */
  async findById(id: string): Promise<CompanyResearch | null> {
    return await this.researchRepository.findOne({ where: { id } });
  }

  /**
   * Creates a new pending research record in database for a company.
   */
  async createPendingResearch(companyId: string): Promise<CompanyResearch> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found.`);
    }

    const research = this.researchRepository.create({
      companyId,
      status: ResearchStatus.PENDING,
      keywords: [],
      techStack: [],
      products: [],
    });

    const saved = await this.researchRepository.save(research);
    this.logger.log(`Created pending research ID: ${saved.id} for company: ${company.name}`);
    return saved;
  }

  /**
   * Marks research as currently processing by worker.
   */
  async markProcessing(id: string): Promise<CompanyResearch> {
    const research = await this.researchRepository.findOne({ where: { id } });
    if (!research) {
      throw new NotFoundException(`Research record with ID "${id}" not found.`);
    }

    research.status = ResearchStatus.PROCESSING;
    return await this.researchRepository.save(research);
  }

  /**
   * Marks research as completed with structured company profile metadata and 30-day expiry.
   */
  async markCompleted(
    id: string,
    payload: Partial<CompanyResearch>,
  ): Promise<CompanyResearch> {
    const research = await this.researchRepository.findOne({ where: { id } });
    if (!research) {
      throw new NotFoundException(`Research record with ID "${id}" not found.`);
    }

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    research.status = ResearchStatus.COMPLETED;
    research.persona = payload.persona ?? null;
    research.industry = payload.industry ?? null;
    research.companySize = payload.companySize ?? null;
    research.summary = payload.summary ?? null;
    research.keywords = payload.keywords ?? [];
    research.techStack = payload.techStack ?? [];
    research.products = payload.products ?? [];
    research.rawMarkdown = payload.rawMarkdown ?? null;
    research.researchQualityScore = payload.researchQualityScore ?? null;
    research.qualityReason = payload.qualityReason ?? null;
    research.crawlMetadata = payload.crawlMetadata ?? null;
    research.lastError = null;
    research.researchedAt = payload.researchedAt ?? now;
    research.expiresAt = payload.expiresAt ?? thirtyDaysLater;

    const saved = await this.researchRepository.save(research);
    this.logger.log(`Marked research ID: ${id} as COMPLETED (score: ${saved.researchQualityScore})`);
    return saved;
  }

  /**
   * Marks research as insufficient when content quality or confidence is below threshold (<40).
   */
  async markInsufficient(
    id: string,
    reason: string,
    score: number,
    payload?: Partial<CompanyResearch>,
  ): Promise<CompanyResearch> {
    const research = await this.researchRepository.findOne({ where: { id } });
    if (!research) {
      throw new NotFoundException(`Research record with ID "${id}" not found.`);
    }

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    research.status = ResearchStatus.INSUFFICIENT;
    research.researchQualityScore = score;
    research.qualityReason = reason;
    research.summary = payload?.summary ?? null;
    research.keywords = payload?.keywords ?? [];
    research.techStack = payload?.techStack ?? [];
    research.products = payload?.products ?? [];
    research.rawMarkdown = payload?.rawMarkdown ?? null;
    research.crawlMetadata = payload?.crawlMetadata ?? null;
    research.researchedAt = now;
    research.expiresAt = thirtyDaysLater;

    const saved = await this.researchRepository.save(research);
    this.logger.warn(`Marked research ID: ${id} as INSUFFICIENT (score: ${score}): ${reason}`);
    return saved;
  }

  /**
   * Marks research as failed due to crawling or unhandled extraction errors.
   */
  async markFailed(id: string, error: string): Promise<CompanyResearch> {
    const research = await this.researchRepository.findOne({ where: { id } });
    if (!research) {
      throw new NotFoundException(`Research record with ID "${id}" not found.`);
    }

    research.status = ResearchStatus.FAILED;
    research.lastError = error;

    const saved = await this.researchRepository.save(research);
    this.logger.error(`Marked research ID: ${id} as FAILED: ${error}`);
    return saved;
  }
}
