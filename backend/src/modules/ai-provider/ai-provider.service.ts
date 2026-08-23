import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAIProvider } from './providers/ai-provider.interface';
import { AI_PROVIDER_TOKEN } from '../../common/constants/app.constants';
import { CompletionRequestDto, AiCompletionResult } from './dto/completion-request.dto';
import { AiRequestLog, AiRequestStatus } from './entities/ai-request-log.entity';

@Injectable()
export class AIProviderService {
  private readonly logger = new Logger(AIProviderService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN)
    private readonly provider: IAIProvider,
    @InjectRepository(AiRequestLog)
    private readonly logRepository: Repository<AiRequestLog>,
  ) {}

  async complete(request: CompletionRequestDto): Promise<AiCompletionResult<string>> {
    const startTime = Date.now();
    try {
      const result = await this.provider.complete(request);
      await this.saveLog({
        provider: result.provider,
        model: result.model,
        feature: request.feature,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
        status: AiRequestStatus.SUCCESS,
        errorMessage: null,
        metadata: request.metadata || null,
      });
      return result;
    } catch (err: any) {
      await this.saveLog({
        provider: 'openai',
        model: 'unknown',
        feature: request.feature,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - startTime,
        status: AiRequestStatus.FAILED,
        errorMessage: err.message,
        metadata: request.metadata || null,
      });
      throw err;
    }
  }

  async structuredComplete<T>(request: CompletionRequestDto): Promise<AiCompletionResult<T>> {
    const startTime = Date.now();
    try {
      const result = await this.provider.structuredComplete<T>(request);
      await this.saveLog({
        provider: result.provider,
        model: result.model,
        feature: request.feature,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
        status: AiRequestStatus.SUCCESS,
        errorMessage: null,
        metadata: request.metadata || null,
      });
      return result;
    } catch (err: any) {
      await this.saveLog({
        provider: 'openai',
        model: 'unknown',
        feature: request.feature,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - startTime,
        status: AiRequestStatus.FAILED,
        errorMessage: err.message,
        metadata: request.metadata || null,
      });
      throw err;
    }
  }

  private async saveLog(logData: Partial<AiRequestLog>): Promise<void> {
    try {
      const log = this.logRepository.create(logData);
      await this.logRepository.save(log);
      this.logger.debug(
        `AI Log [${logData.feature}] status=${logData.status} tokens=${logData.totalTokens} latency=${logData.latencyMs}ms`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to record AI request log: ${err.message}`);
    }
  }
}
