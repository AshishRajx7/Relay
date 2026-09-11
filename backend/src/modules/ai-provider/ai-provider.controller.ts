import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('AI Diagnostic')
@Controller('ai')
export class AIProviderController {
  constructor(private readonly configService: ConfigService) {}

  @Get('health')
  @ApiOperation({
    summary: 'AI Provider configuration and health diagnostic',
    description: 'Returns the active AI provider, model, and configuration readiness status without exposing secret API keys.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI Provider status returned successfully.',
    schema: {
      example: {
        provider: 'nvidia',
        model: 'deepseek-ai/deepseek-v4-flash-0731',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        configured: true,
      },
    },
  })
  getHealth() {
    const apiKey = this.configService.get<string>('ai.apiKey', '');
    const isConfigured = !!apiKey && apiKey !== 'sk-placeholder-for-dev' && apiKey.trim() !== '';

    return {
      provider: this.configService.get<string>('ai.provider', 'nvidia'),
      model: this.configService.get<string>('ai.model', 'deepseek-ai/deepseek-v4-flash-0731'),
      baseUrl: this.configService.get<string>('ai.baseUrl', 'https://integrate.api.nvidia.com/v1'),
      configured: isConfigured,
    };
  }
}
