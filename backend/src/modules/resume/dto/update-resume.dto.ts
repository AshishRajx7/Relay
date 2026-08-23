import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateResumeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
