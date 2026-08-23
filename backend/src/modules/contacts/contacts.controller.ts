import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { UploadContactsDto } from './dto/upload-contacts.dto';
import { ContactsUploadResultDto } from './dto/contacts-upload-result.dto';
import { ContactResponseDto } from './dto/contact-response.dto';
import { ContactsQueryDto } from './dto/contacts-query.dto';

@ApiTags('Contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload contacts via CSV',
    description:
      'Uploads a CSV file containing contact records (name, email, company, website). ' +
      'Automatically validates emails, normalizes domains, links or creates companies, and deduplicates contacts.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadContactsDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'CSV batch processed successfully.',
    type: ContactsUploadResultDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'File is not a valid CSV or has missing header columns.',
  })
  async upload(
    @UploadedFile(
      new FileValidationPipe({
        allowedMimeTypes: [
          'text/csv',
          'application/vnd.ms-excel',
          'text/plain',
          'application/csv',
          'text/x-csv',
        ],
        allowedExtensions: ['csv'],
        maxSizeInBytes: 5 * 1024 * 1024, // 5MB
      }),
    )
    file: Express.Multer.File,
  ): Promise<ContactsUploadResultDto> {
    return await this.contactsService.uploadCsv(file);
  }

  @Get()
  @ApiOperation({
    summary: 'List contacts',
    description:
      'Retrieves all contacts with linked company metadata. Supports optional filtering by companyId and case-insensitive keyword search on name and email.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contacts retrieved successfully.',
    type: [ContactResponseDto],
  })
  async findAll(@Query() query: ContactsQueryDto): Promise<ContactResponseDto[]> {
    return await this.contactsService.findAll(query);
  }
}
