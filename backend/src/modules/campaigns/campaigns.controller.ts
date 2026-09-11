import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CampaignsService, CampaignOverviewDto } from './campaigns.service';
import { CampaignIngestionService, IngestionResult } from './services/campaign-ingestion.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Campaign } from './entities/campaign.entity';

@ApiTags('Campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly ingestionService: CampaignIngestionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new outreach campaign linked to a candidate profile' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully', type: Campaign })
  async create(@Body() dto: CreateCampaignDto): Promise<Campaign> {
    return this.campaignsService.createCampaign(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns' })
  @ApiResponse({ status: 200, description: 'List of campaigns', type: [Campaign] })
  async findAll(): Promise<Campaign[]> {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by UUID' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign details', type: Campaign })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.campaignsService.findOne(id);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get campaign execution overview, progress percentage, cost tracking, and duplicate warnings' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign execution overview' })
  async getOverview(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignOverviewDto> {
    return this.campaignsService.getOverview(id);
  }

  @Post(':id/retry-failed')
  @ApiOperation({ summary: 'Retry only retryable failed jobs in a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Retry jobs queued' })
  async retryFailed(@Param('id', ParseUUIDPipe) id: string): Promise<{ retriedCount: number; message: string }> {
    return this.campaignsService.retryFailedProspects(id);
  }

  @Post(':id/upload')
  @ApiOperation({ summary: 'Upload a CSV or PDF file with prospect contacts into a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV (.csv) or PDF (.pdf) file containing prospect emails',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded and prospects queued for research' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id', ParseUUIDPipe) campaignId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<IngestionResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded. Please provide a CSV or PDF file.');
    }

    return this.ingestionService.ingestFile(
      campaignId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }
}
