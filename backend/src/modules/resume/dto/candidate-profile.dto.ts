import {
  SkillsJson,
  ExperienceJson,
  EducationJson,
  ProjectJson,
  LinksJson,
} from '../entities/candidate-profile.entity';

export class CandidateProfileDto {
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
  parsedAt: Date;
}
