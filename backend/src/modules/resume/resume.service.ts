import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { ResumeFile, ResumeFileStatus } from './entities/resume-file.entity';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { StorageService } from '../storage/storage.service';
import { QUEUE_RESUME_PARSING, JOB_PARSE_RESUME } from '../../common/constants/app.constants';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { ResumeResponseDto } from './dto/resume-response.dto';
import { ResumeListResponseDto } from './dto/resume-list-response.dto';
import { CandidateProfileDto } from './dto/candidate-profile.dto';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    @InjectRepository(ResumeFile)
    private readonly resumeFileRepository: Repository<ResumeFile>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepository: Repository<CandidateProfile>,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUE_RESUME_PARSING)
    private readonly resumeQueue: Queue,
  ) {}

  private computeHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async upload(file: Express.Multer.File, label?: string): Promise<ResumeResponseDto> {
    const fileHash = this.computeHash(file.buffer);

    // Check for duplicate resume
    const existing = await this.resumeFileRepository.findOne({
      where: { fileHash },
    });
    if (existing) {
      throw new ConflictException(
        `A resume with identical content already exists (${existing.originalFileName}, ID: ${existing.id})`,
      );
    }

    // Create initial entity to generate UUID
    const resume = this.resumeFileRepository.create({
      originalFileName: file.originalname,
      fileName: 'pending',
      storagePath: 'pending',
      fileHash,
      label: label?.trim() || null,
      status: ResumeFileStatus.UPLOADED,
    });

    const savedResume = await this.resumeFileRepository.save(resume);

    // Save to storage
    const storagePath = await this.storageService.saveResume(
      savedResume.id,
      file.originalname,
      file.buffer,
    );
    const fileName = storagePath.split('/').pop() || file.originalname;

    savedResume.storagePath = storagePath;
    savedResume.fileName = fileName;
    await this.resumeFileRepository.save(savedResume);

    // Dispatch BullMQ async parsing job
    await this.resumeQueue.add(
      JOB_PARSE_RESUME,
      { resumeId: savedResume.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
      },
    );

    this.logger.log(`Enqueued parsing job for resume ID: ${savedResume.id}`);

    return this.mapToResponseDto(savedResume);
  }

  async findAll(): Promise<ResumeListResponseDto[]> {
    const resumes = await this.resumeFileRepository.find({
      order: { uploadedAt: 'DESC' },
    });

    return resumes.map((resume) => {
      let slimProfile = null;
      if (resume.profile) {
        const skills = resume.profile.skills || { languages: [], frameworks: [], databases: [], tools: [], other: [] };
        const combinedSkills = [
          ...(skills.languages || []),
          ...(skills.frameworks || []),
          ...(skills.databases || []),
          ...(skills.tools || []),
          ...(skills.other || []),
        ];
        slimProfile = {
          name: resume.profile.name,
          title: resume.profile.title,
          topSkills: combinedSkills.slice(0, 6),
        };
      }

      return {
        id: resume.id,
        originalFileName: resume.originalFileName,
        label: resume.label,
        status: resume.status,
        profile: slimProfile,
        uploadedAt: resume.uploadedAt,
      };
    });
  }

  async findOne(id: string): Promise<ResumeResponseDto> {
    const resume = await this.resumeFileRepository.findOne({
      where: { id },
    });
    if (!resume) {
      throw new NotFoundException(`Resume with ID ${id} not found`);
    }
    return this.mapToResponseDto(resume);
  }

  async updateLabel(id: string, updateDto: UpdateResumeDto): Promise<ResumeResponseDto> {
    const resume = await this.resumeFileRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException(`Resume with ID ${id} not found`);
    }

    if (updateDto.label !== undefined) {
      resume.label = updateDto.label.trim() || null;
      await this.resumeFileRepository.save(resume);
    }

    return this.mapToResponseDto(resume);
  }

  async reparse(id: string): Promise<{ id: string; status: string; message: string }> {
    const resume = await this.resumeFileRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException(`Resume with ID ${id} not found`);
    }

    // Reset status
    resume.status = ResumeFileStatus.UPLOADED;
    resume.parseError = null;
    await this.resumeFileRepository.save(resume);

    // Re-queue job
    await this.resumeQueue.add(
      JOB_PARSE_RESUME,
      { resumeId: resume.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
      },
    );

    this.logger.log(`Re-queued parsing job for resume ID: ${resume.id}`);

    return {
      id: resume.id,
      status: ResumeFileStatus.UPLOADED,
      message: 'Resume re-parsing job queued successfully',
    };
  }

  async delete(id: string): Promise<void> {
    const resume = await this.resumeFileRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException(`Resume with ID ${id} not found`);
    }

    // 1. Delete file from storage
    if (resume.storagePath && resume.storagePath !== 'pending') {
      await this.storageService.deleteFile(resume.storagePath);
    }

    // 2. Delete database record (cascade removes CandidateProfile)
    await this.resumeFileRepository.remove(resume);
    this.logger.log(`Deleted resume ID: ${id}`);
  }

  private mapToResponseDto(resume: ResumeFile): ResumeResponseDto {
    let profileDto: CandidateProfileDto | null = null;

    if (resume.profile) {
      profileDto = {
        name: resume.profile.name,
        email: resume.profile.email,
        phone: resume.profile.phone,
        location: resume.profile.location,
        title: resume.profile.title,
        summary: resume.profile.summary,
        totalYearsExperience: resume.profile.totalYearsExperience,
        skills: resume.profile.skills,
        experience: resume.profile.experience,
        education: resume.profile.education,
        projects: resume.profile.projects,
        certifications: resume.profile.certifications,
        achievements: resume.profile.achievements || [],
        links: resume.profile.links,
        parsedAt: resume.profile.parsedAt,
      };
    }

    return {
      id: resume.id,
      originalFileName: resume.originalFileName,
      fileName: resume.fileName,
      label: resume.label,
      status: resume.status,
      rawText: resume.rawText,
      parseError: resume.parseError,
      profile: profileDto,
      uploadedAt: resume.uploadedAt,
      updatedAt: resume.updatedAt,
    };
  }
}
