import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIProviderService } from './ai-provider.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AiRequestLog } from './entities/ai-request-log.entity';
import { AI_PROVIDER_TOKEN } from '../../common/constants/app.constants';
import { AIProviderController } from './ai-provider.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AiRequestLog])],
  controllers: [AIProviderController],
  providers: [
    {
      provide: AI_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        return new OpenAIProvider({
          provider: configService.get<string>('ai.provider', 'nvidia'),
          apiKey: configService.get<string>('ai.apiKey', ''),
          baseUrl: configService.get<string>('ai.baseUrl', 'https://integrate.api.nvidia.com/v1'),
          model: configService.get<string>('ai.model', 'deepseek-ai/deepseek-v4-flash-0731'),
          maxTokens: configService.get<number>('ai.maxTokens', 4096),
          temperature: configService.get<number>('ai.temperature', 0.3),
        });
      },
      inject: [ConfigService],
    },
    AIProviderService,
  ],
  exports: [AIProviderService, TypeOrmModule],
})
export class AIProviderModule {}
