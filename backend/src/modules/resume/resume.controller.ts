import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
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
import { ResumeService } from './resume.service';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { UploadResumeDto } from './dto/upload-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { ResumeResponseDto } from './dto/resume-response.dto';
import { ResumeListResponseDto } from './dto/resume-list-response.dto';

@ApiTags('Resumes')
@Controller('resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload resume PDF document',
    description:
      'Uploads a resume PDF file (max 10MB). Automatically enqueues an asynchronous BullMQ parsing job to extract candidate skills, work history, education, and technical projects.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadResumeDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Resume uploaded and parsing job queued successfully.',
    type: ResumeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file format (only PDF allowed) or exceeds 10MB size limit.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate resume file detected (identical SHA-256 hash).',
  })
  async upload(
    @UploadedFile(
      new FileValidationPipe({
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['pdf'],
        maxSizeInBytes: 10 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @Body() uploadDto: UploadResumeDto,
  ): Promise<ResumeResponseDto> {
    return await this.resumeService.upload(file, uploadDto.label, uploadDto.category);
  }

  @Get()
  @ApiOperation({
    summary: 'List all resumes',
    description: 'Retrieves all uploaded resumes with their parsing status and summary profile.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of resumes retrieved successfully.',
    type: [ResumeListResponseDto],
  })
  async findAll(): Promise<ResumeListResponseDto[]> {
    return await this.resumeService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get resume details by ID',
    description: 'Retrieves full details of a resume including extracted candidate profile, skills, experience, and projects.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Resume unique identifier',
    example: '862a7f5a-1e38-4dbf-ae89-d706d2d3f93f',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resume details retrieved successfully.',
    type: ResumeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Resume with specified ID not found.',
  })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ResumeResponseDto> {
    return await this.resumeService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update resume label',
    description: 'Updates the descriptive label of an existing resume.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Resume unique identifier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resume label updated successfully.',
    type: ResumeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Resume with specified ID not found.',
  })
  async updateLabel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateResumeDto,
  ): Promise<ResumeResponseDto> {
    return await this.resumeService.updateLabel(id, updateDto);
  }

  @Post(':id/reparse')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Re-trigger resume parsing',
    description: 'Re-enqueues an asynchronous BullMQ parsing job for an existing resume file.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Resume unique identifier',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Resume re-parsing job dispatched successfully.',
    schema: {
      example: {
        id: '862a7f5a-1e38-4dbf-ae89-d706d2d3f93f',
        status: 'PENDING',
        message: 'Resume re-parse job queued successfully',
      },
    },
  })
  async reparse(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ id: string; status: string; message: string }> {
    return await this.resumeService.reparse(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete resume',
    description: 'Permanently deletes a resume file from storage and its extracted candidate profile from database.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Resume unique identifier',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Resume deleted successfully.',
  })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.resumeService.delete(id);
  }
}
