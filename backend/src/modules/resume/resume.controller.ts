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
import { ResumeService } from './resume.service';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { UploadResumeDto } from './dto/upload-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { ResumeResponseDto } from './dto/resume-response.dto';
import { ResumeListResponseDto } from './dto/resume-list-response.dto';

@Controller('resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(new FileValidationPipe({ maxSizeInBytes: 10 * 1024 * 1024 }))
    file: Express.Multer.File,
    @Body() uploadDto: UploadResumeDto,
  ): Promise<ResumeResponseDto> {
    return await this.resumeService.upload(file, uploadDto.label);
  }

  @Get()
  async findAll(): Promise<ResumeListResponseDto[]> {
    return await this.resumeService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ResumeResponseDto> {
    return await this.resumeService.findOne(id);
  }

  @Patch(':id')
  async updateLabel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateResumeDto,
  ): Promise<ResumeResponseDto> {
    return await this.resumeService.updateLabel(id, updateDto);
  }

  @Post(':id/reparse')
  @HttpCode(HttpStatus.ACCEPTED)
  async reparse(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ id: string; status: string; message: string }> {
    return await this.resumeService.reparse(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.resumeService.delete(id);
  }
}
