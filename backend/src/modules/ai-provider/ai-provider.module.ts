import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIProviderService } from './ai-provider.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AiRequestLog } from './entities/ai-request-log.entity';
import { AI_PROVIDER_TOKEN } from '../../common/constants/app.constants';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AiRequestLog])],
  providers: [
    {
      provide: AI_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        return new OpenAIProvider({
          apiKey: configService.get<string>('openai.apiKey', ''),
          model: configService.get<string>('openai.model', 'gpt-4o'),
          maxTokens: configService.get<number>('openai.maxTokens', 4096),
          temperature: configService.get<number>('openai.temperature', 0.3),
        });
      },
      inject: [ConfigService],
    },
    AIProviderService,
  ],
  exports: [AIProviderService, TypeOrmModule],
})
export class AIProviderModule {}
