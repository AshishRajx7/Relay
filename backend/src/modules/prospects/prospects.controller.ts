import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProspectsService } from './prospects.service';
import { ProspectResponseDto } from './dto/prospect-response.dto';
import { ProspectResearchStatus } from './entities/prospect.entity';

@ApiTags('Prospects')
@Controller('campaigns/:campaignId/prospects')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all prospects inside a campaign with optional status filter' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ProspectResearchStatus,
    description: 'Filter by research status (PENDING, RESEARCHED, MANUAL_REVIEW, FAILED)',
  })
  @ApiResponse({ status: 200, description: 'List of prospects', type: [ProspectResponseDto] })
  async findByCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query('status') status?: ProspectResearchStatus,
  ): Promise<ProspectResponseDto[]> {
    return this.prospectsService.findByCampaign(campaignId, status);
  }
}
