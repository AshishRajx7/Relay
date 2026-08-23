import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as pdfParse from 'pdf-parse';
import { ResumeFile, ResumeFileStatus } from './entities/resume-file.entity';
import { CandidateProfile, SkillsJson, ExperienceJson, EducationJson, ProjectJson, LinksJson } from './entities/candidate-profile.entity';
import { StorageService } from '../storage/storage.service';
import { AIProviderService } from '../ai-provider/ai-provider.service';

export interface CandidateProfileExtractedData {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  totalYearsExperience: number | null;
  skills: SkillsJson;
  experience: ExperienceJson[];
  education: EducationJson[];
  projects: ProjectJson[];
  certifications: string[];
  links: LinksJson;
}

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  constructor(
    @InjectRepository(ResumeFile)
    private readonly resumeFileRepository: Repository<ResumeFile>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepository: Repository<CandidateProfile>,
    private readonly storageService: StorageService,
    private readonly aiProviderService: AIProviderService,
  ) {}

  async extractText(buffer: Buffer): Promise<string> {
    try {
      let cleaned = '';
      try {
        const data = await pdfParse(buffer);
        cleaned = (data.text || '').replace(/\r\n/g, '\n').trim();
      } catch (pdfErr: any) {
        // Fallback: extract string tokens if PDF stream text format is present
        const ascii = buffer.toString('latin1');
        const textMatches = ascii.match(/\((.*?)\)\s*'/g);
        if (textMatches && textMatches.length > 0) {
          cleaned = textMatches.map((m) => m.slice(1, -2).replace(/\\\(/g, '(').replace(/\\\)/g, ')')).join('\n').trim();
        } else {
          throw pdfErr;
        }
      }

      if (cleaned.length < 30) {
        throw new Error('Insufficient readable text in PDF. The document might be an image-only scan.');
      }
      return cleaned;
    } catch (err: any) {
      this.logger.error(`PDF text extraction failed: ${err.message}`);
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  }

  async parseWithAi(rawText: string, metadata?: Record<string, any>): Promise<CandidateProfileExtractedData> {
    const systemPrompt = `You are a professional resume parser. Extract structured data from the candidate resume text below.
Be thorough and precise. Capture all skills across programming languages, frameworks, databases, and tools. Extract all work experience with quantifiable highlights and exact role dates. Extract key technical projects with their tech stacks.
If information is missing or ambiguous, use null or an empty array. Do not fabricate or extrapolate information not present in the text.

Return a JSON object conforming to this exact JSON schema:
{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "title": "string or null (e.g. Senior Backend Engineer)",
  "summary": "string or null (concise 2-3 sentence professional summary)",
  "totalYearsExperience": "number or null (e.g. 5.5)",
  "skills": {
    "languages": ["TypeScript", "Python"],
    "frameworks": ["NestJS", "React"],
    "databases": ["PostgreSQL", "Redis"],
    "tools": ["Docker", "Git", "Kubernetes"],
    "other": ["System Architecture", "Microservices"]
  },
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "location": "City, State or null",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "highlights": ["Key achievement 1", "Key achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "University / College",
      "degree": "Degree Title (e.g. BS, MS)",
      "field": "Major / Field of Study",
      "graduationDate": "YYYY-MM or null",
      "gpa": "string or null"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Short project description",
      "techStack": ["Tech1", "Tech2"],
      "url": "URL or null"
    }
  ],
  "certifications": ["Certification 1"],
  "links": {
    "linkedin": "URL or null",
    "github": "URL or null",
    "portfolio": "URL or null"
  }
}`;

    // Truncate raw text if extraordinarily long (e.g. max ~20,000 characters)
    const truncatedText = rawText.length > 20000 ? rawText.substring(0, 20000) + '\n...[TRUNCATED]' : rawText;

    const result = await this.aiProviderService.structuredComplete<CandidateProfileExtractedData>({
      systemPrompt,
      userPrompt: `RESUME TEXT:\n${truncatedText}`,
      feature: 'RESUME_PARSE',
      maxTokens: 4000,
      temperature: 0.2,
      metadata,
    });

    return result.data;
  }

  async parseResume(resumeId: string): Promise<CandidateProfile> {
    this.logger.log(`Starting parse pipeline for resume ID: ${resumeId}`);
    const resume = await this.resumeFileRepository.findOne({ where: { id: resumeId } });
    if (!resume) {
      throw new NotFoundException(`Resume with ID ${resumeId} not found`);
    }

    try {
      // 1. Update status to PARSING
      resume.status = ResumeFileStatus.PARSING;
      resume.parseError = null;
      await this.resumeFileRepository.save(resume);

      // 2. Read PDF from storage
      const buffer = await this.storageService.readFile(resume.storagePath);

      // 3. Extract text
      const rawText = await this.extractText(buffer);
      resume.rawText = rawText;
      await this.resumeFileRepository.save(resume);

      // 4. Parse with AI
      const extracted = await this.parseWithAi(rawText, { resumeId: resume.id, originalFileName: resume.originalFileName });

      // 5. Upsert CandidateProfile
      let profile = await this.candidateProfileRepository.findOne({ where: { resumeFileId: resume.id } });
      if (!profile) {
        profile = this.candidateProfileRepository.create({
          resumeFileId: resume.id,
        });
      }

      profile.name = extracted.name || null;
      profile.email = extracted.email || null;
      profile.phone = extracted.phone || null;
      profile.location = extracted.location || null;
      profile.title = extracted.title || null;
      profile.summary = extracted.summary || null;
      profile.totalYearsExperience = extracted.totalYearsExperience || null;
      profile.skills = extracted.skills || { languages: [], frameworks: [], databases: [], tools: [], other: [] };
      profile.experience = extracted.experience || [];
      profile.education = extracted.education || [];
      profile.projects = extracted.projects || [];
      profile.certifications = extracted.certifications || [];
      profile.links = extracted.links || { linkedin: null, github: null, portfolio: null };
      profile.parsedAt = new Date();

      const savedProfile = await this.candidateProfileRepository.save(profile);

      // 6. Update status to PARSED
      resume.status = ResumeFileStatus.PARSED;
      resume.parseError = null;
      await this.resumeFileRepository.save(resume);

      this.logger.log(`Successfully parsed resume ${resumeId} for candidate: ${savedProfile.name || 'Unknown'}`);
      return savedProfile;
    } catch (err: any) {
      this.logger.error(`Error parsing resume ${resumeId}: ${err.message}`, err.stack);
      resume.status = ResumeFileStatus.FAILED;
      resume.parseError = err.message || 'Unknown parsing error';
      await this.resumeFileRepository.save(resume);
      throw err;
    }
  }
}
