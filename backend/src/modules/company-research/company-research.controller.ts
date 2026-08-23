import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyResearchService } from './company-research.service';
import { Company } from '../companies/entities/company.entity';
import { CompanyResearchResponseDto } from './dto/company-research-response.dto';
import { TriggerResearchResponseDto } from './dto/trigger-research-response.dto';
import { RefreshResearchResponseDto } from './dto/refresh-research-response.dto';
import { QUEUE_COMPANY_RESEARCH, JOB_RESEARCH_COMPANY } from '../../common/constants/app.constants';
import { CompanyResearchJobData } from '../queue/dto/company-research-job.dto';

@ApiTags('Company Research')
@Controller()
export class CompanyResearchController {
  private readonly logger = new Logger(CompanyResearchController.name);

  constructor(
    private readonly researchService: CompanyResearchService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectQueue(QUEUE_COMPANY_RESEARCH)
    private readonly researchQueue: Queue<CompanyResearchJobData>,
  ) {}

  @Get('companies/:id/research')
  @ApiOperation({
    summary: 'Get latest company research',
    description:
      'Retrieves the most recent research profile for a company by its company UUID. ' +
      'Returns 404 if no research record has been performed for this company yet.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Company unique identifier',
    example: 'cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company research details retrieved successfully.',
    type: CompanyResearchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No research record found for the specified company.',
  })
  async getCompanyResearch(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CompanyResearchResponseDto> {
    const research = await this.researchService.getLatest(id);
    if (!research) {
      throw new NotFoundException(`No research record found for company ID "${id}".`);
    }
    return this.mapToDto(research);
  }

  @Get('companies/:id/research/raw')
  @ApiOperation({
    summary: 'Get raw crawl markdown for company',
    description:
      'Explicitly retrieves the full, unhydrated raw markdown scraped from the company website. ' +
      'Kept separate to prevent query buffer bloat on standard endpoints.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Company unique identifier',
    example: 'cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Raw markdown retrieved successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No research record found for the specified company.',
  })
  async getRawMarkdown(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string; companyId: string; rawMarkdown: string | null }> {
    const research = await this.researchService.getLatestWithMarkdown(id);
    if (!research) {
      throw new NotFoundException(`No research record found for company ID "${id}".`);
    }
    return {
      id: research.id,
      companyId: research.companyId,
      rawMarkdown: research.rawMarkdown,
    };
  }

  @Post('companies/:id/research')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger company research',
    description:
      'Creates a pending company research record and dispatches an asynchronous BullMQ research job. ' +
      'Returns 202 Accepted.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Company unique identifier',
    example: 'cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Company research request accepted and queued with PENDING status.',
    type: TriggerResearchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company with specified ID does not exist.',
  })
  async triggerResearch(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<TriggerResearchResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with ID "${id}" not found.`);
    }

    const research = await this.researchService.createPendingResearch(id);

    // Enqueue BullMQ research job with deduplication key
    await this.researchQueue.add(
      JOB_RESEARCH_COMPANY,
      {
        researchId: research.id,
        companyId: company.id,
        website: company.website,
      },
      {
        jobId: `research-${company.id}`,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Dispatched BullMQ job for company: ${company.name} (Research ID: ${research.id})`);

    return {
      id: research.id,
      companyId: research.companyId,
      status: research.status,
      message: 'Company research requested successfully.',
    };
  }

  @Post('research/:id/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Refresh existing company research',
    description:
      'Creates a new pending research record for the company and dispatches an asynchronous BullMQ refresh job. ' +
      'Returns 202 Accepted.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Research record unique identifier',
    example: '7d4fa664-e9f5-4c1c-96ad-1b99fced1d72',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'New research refresh record created and queued with PENDING status.',
    type: RefreshResearchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Research record with specified ID not found.',
  })
  async refreshResearch(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RefreshResearchResponseDto> {
    const existing = await this.researchService.findById(id);
    if (!existing) {
      throw new NotFoundException(`Research record with ID "${id}" not found.`);
    }

    const company = await this.companyRepository.findOne({ where: { id: existing.companyId } });
    if (!company) {
      throw new NotFoundException(`Company for research ID "${id}" not found.`);
    }

    const newPending = await this.researchService.createPendingResearch(company.id, true);

    // Enqueue BullMQ research job with forced refresh
    await this.researchQueue.add(
      JOB_RESEARCH_COMPANY,
      {
        researchId: newPending.id,
        companyId: company.id,
        website: company.website,
        forceRefresh: true,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Dispatched refresh BullMQ job for company: ${company.name} (Research ID: ${newPending.id})`);

    return {
      id: newPending.id,
      companyId: newPending.companyId,
      status: newPending.status,
      message: 'Research refresh requested successfully.',
    };
  }

  private mapToDto(research: any): CompanyResearchResponseDto {
    return {
      id: research.id,
      companyId: research.companyId,
      status: research.status,
      persona: research.persona,
      industry: research.industry,
      companySize: research.companySize,
      summary: research.summary,
      keywords: research.keywords || [],
      techStack: research.techStack || [],
      products: research.products || [],
      careersPageUrl: research.careersPageUrl,
      atsProvider: research.atsProvider,
      isHiring: research.isHiring || false,
      hiringSignals: research.hiringSignals || [],
      genericContactEmails: research.genericContactEmails || [],
      targetDepartments: research.targetDepartments || [],
      locations: research.locations || [],
      outreachHooks: research.outreachHooks || {},
      rawMarkdown: research.rawMarkdown,
      researchQualityScore: research.researchQualityScore,
      qualityReason: research.qualityReason,
      crawlMetadata: research.crawlMetadata,
      lastError: research.lastError,
      researchedAt: research.researchedAt,
      expiresAt: research.expiresAt,
      createdAt: research.createdAt,
      updatedAt: research.updatedAt,
    };
  }
}
