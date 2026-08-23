import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CompanyListResponseDto } from './dto/company-list-response.dto';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all companies',
    description: 'Retrieves all registered companies with contact counts and latest research summaries.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of companies retrieved successfully.',
    type: [CompanyListResponseDto],
  })
  async findAll(): Promise<CompanyListResponseDto[]> {
    return await this.companiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get company by ID',
    description: 'Retrieves a single company by its UUID, including its full research metadata and contact count.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Company unique identifier',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company details retrieved successfully.',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company with specified ID was not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Provided ID is not a valid UUID.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CompanyResponseDto> {
    return await this.companiesService.findOne(id);
  }
}
