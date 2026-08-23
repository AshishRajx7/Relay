import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CompanyResearchService } from './company-research.service';
import { CompanyResearchResponseDto } from './dto/company-research-response.dto';
import { TriggerResearchResponseDto } from './dto/trigger-research-response.dto';
import { RefreshResearchResponseDto } from './dto/refresh-research-response.dto';

@ApiTags('Company Research')
@Controller()
export class CompanyResearchController {
  constructor(private readonly researchService: CompanyResearchService) {}

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

  @Post('companies/:id/research')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger company research',
    description:
      'Creates a pending company research record in the database. ' +
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
    description: 'Company research request accepted and stored with PENDING status.',
    type: TriggerResearchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company with specified ID does not exist.',
  })
  async triggerResearch(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<TriggerResearchResponseDto> {
    const research = await this.researchService.createPendingResearch(id);
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
      'Creates a new pending research record for the company associated with the given research ID. ' +
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
    description: 'New research refresh record created with PENDING status.',
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

    const newPending = await this.researchService.createPendingResearch(existing.companyId);
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
