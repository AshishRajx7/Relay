import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConnectGmailDto {
  @ApiProperty({ example: 'ashishrajcr7@gmail.com', description: 'Gmail email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '1//0gK...', description: 'Google OAuth2 Refresh Token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @ApiPropertyOptional({ example: '109823487293847', description: 'Google User ID' })
  @IsString()
  @IsOptional()
  googleUserId?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Associated Candidate Profile ID' })
  @IsUUID()
  @IsOptional()
  candidateProfileId?: string;
}
