import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadResumeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
