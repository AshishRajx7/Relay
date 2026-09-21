import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IAIProvider } from './ai-provider.interface';
import { CompletionRequestDto, AiCompletionResult } from '../dto/completion-request.dto';

export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

@Injectable()
export class OpenAIProvider implements IAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly openai: OpenAI | null = null;
  private readonly providerName: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly apiKey: string;

  constructor(config: AIProviderConfig) {
    this.providerName = config.provider || 'nvidia';
    this.apiKey = (config.apiKey || '').trim();
    this.baseUrl = (config.baseUrl || 'https://integrate.api.nvidia.com/v1').trim();
    this.defaultModel = config.model || 'deepseek-ai/deepseek-v4-flash-0731';
    this.defaultMaxTokens = config.maxTokens || 4096;
    this.defaultTemperature = config.temperature ?? 0.3;

    if (this.apiKey && this.apiKey !== 'sk-placeholder-for-dev') {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        fetch: globalThis.fetch,
        timeout: 90000,
      });
      this.logger.log(`Initialized AI Provider "${this.providerName}" with model "${this.defaultModel}" at "${this.baseUrl}"`);
    } else {
      this.logger.warn(`AI Provider "${this.providerName}" API key not configured. Calls will throw an initialization error until AI_API_KEY is provided.`);
    }
  }

  public isConfigured(): boolean {
    return !!this.openai;
  }

  public getModelName(): string {
    return this.defaultModel;
  }

  public getProviderName(): string {
    return this.providerName;
  }

  private ensureClient(): OpenAI {
    if (!this.openai) {
      throw new Error(
        `AI Provider "${this.providerName}" is not configured. ` +
        `Please set AI_API_KEY (e.g. your NVIDIA NIM nvapi-... key) in backend/.env and restart the server.`
      );
    }
    return this.openai;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isRateLimit = err?.status === 429 || err?.message?.includes('429');
        const isServerError = err?.status >= 500 && err?.status < 600;

        if ((isRateLimit || isServerError) && attempt <= maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          this.logger.warn(
            `[${this.providerName} / ${this.defaultModel}] Request failed (${err?.status || err?.message}). ` +
            `Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.error(`[${this.providerName} / ${this.defaultModel}] Call failed: ${err.message}`);
          throw err;
        }
      }
    }
    throw new Error(`AI request failed after ${maxRetries} retries.`);
  }

  async complete(request: CompletionRequestDto): Promise<AiCompletionResult<string>> {
    const client = this.ensureClient();
    const startTime = Date.now();
    const model = request.model || this.defaultModel;

    const response = await this.executeWithRetry(() =>
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature ?? this.defaultTemperature,
      }),
    );

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    this.logger.log(`[${this.providerName} / ${model}] ${request.feature} completed in ${latencyMs}ms (${usage.total_tokens} tokens)`);

    return {
      data: content,
      provider: this.providerName,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs,
    };
  }

  async structuredComplete<T>(request: CompletionRequestDto): Promise<AiCompletionResult<T>> {
    const client = this.ensureClient();
    const startTime = Date.now();
    const model = request.model || this.defaultModel;

    const response = await this.executeWithRetry(() =>
      client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature ?? this.defaultTemperature,
      }),
    );

    const latencyMs = Date.now() - startTime;
    let rawContent = (response.choices[0]?.message?.content || '').trim();
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Strip reasoning <think>...</think> tags if model produces Chain of Thought
    if (rawContent.includes('<think>')) {
      rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }

    // Strip markdown code fences if model enclosed JSON in ```json ... ```
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      rawContent = codeBlockMatch[1].trim();
    }

    // Strip duplicate leading braces e.g. "{\n{"
    rawContent = rawContent.replace(/^(\s*\{)+\s*\{/, '{');

    const cleanRawJson = (str: string): string => {
      return str.replace(/"([\s\S]*?)"(?=\s*[:,\]}])/g, (_match, inner) => {
        const fixed = inner
          .replace(/\r\n/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\n')
          .replace(/\t/g, '\\t');
        return `"${fixed}"`;
      });
    };

    const tryAutoCloseJson = (str: string): string => {
      let trimmed = str.trim();
      if (!trimmed.startsWith('{')) {
        const first = trimmed.indexOf('{');
        if (first !== -1) trimmed = trimmed.substring(first);
      }
      const quoteCount = (trimmed.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        trimmed += '"';
      }
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) {
        trimmed += '}';
      }
      return trimmed;
    };

    let parsedData: T;
    try {
      parsedData = JSON.parse(rawContent) as T;
    } catch {
      try {
        parsedData = JSON.parse(cleanRawJson(rawContent)) as T;
      } catch {
        // Resilient fallback 1: Outermost curly braces
        const firstBrace = rawContent.indexOf('{');
        const lastBrace = rawContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedData = JSON.parse(cleanRawJson(rawContent.substring(firstBrace, lastBrace + 1))) as T;
          } catch {
            // continue
          }
        }

        // Resilient fallback 1b: Auto-close truncated JSON
        if (!parsedData) {
          try {
            parsedData = JSON.parse(cleanRawJson(tryAutoCloseJson(rawContent))) as T;
          } catch {
            // continue
          }
        }
      }

      // Resilient fallback 2: Regex extraction of variants and key-value fields
      if (!parsedData) {
        const merged: any = {};

        // Extract technicalVariant
        const techMatch = rawContent.match(/"technicalVariant"\s*:\s*(\{[^}]+\})/);
        if (techMatch) {
          try { merged.technicalVariant = JSON.parse(cleanRawJson(techMatch[1])); } catch {}
        }
        // Extract startupVariant
        const startupMatch = rawContent.match(/"startupVariant"\s*:\s*(\{[^}]+\})/);
        if (startupMatch) {
          try { merged.startupVariant = JSON.parse(cleanRawJson(startupMatch[1])); } catch {}
        }
        // Extract directVariant
        const directMatch = rawContent.match(/"directVariant"\s*:\s*(\{[^}]+\})/);
        if (directMatch) {
          try { merged.directVariant = JSON.parse(cleanRawJson(directMatch[1])); } catch {}
        }

        const whyCompanyMatch = rawContent.match(/"whyCompany"\s*:\s*"([^"]+)"/);
        if (whyCompanyMatch) merged.whyCompany = whyCompanyMatch[1];

        const whyMeMatch = rawContent.match(/"whyMe"\s*:\s*"([^"]+)"/);
        if (whyMeMatch) merged.whyMe = whyMeMatch[1];

        const whyNowMatch = rawContent.match(/"whyNow"\s*:\s*"([^"]+)"/);
        if (whyNowMatch) merged.whyNow = whyNowMatch[1];

        const confMatch = rawContent.match(/"confidenceLevel"\s*:\s*"([^"]+)"/);
        if (confMatch) merged.confidenceLevel = confMatch[1];

        const evalMatch = rawContent.match(/"evaluations"\s*:\s*(\[\s*\{[\s\S]*\}\s*\])/);
        if (evalMatch) {
          try {
            merged.evaluations = JSON.parse(cleanRawJson(tryAutoCloseJson(evalMatch[1])));
          } catch {}
        }

        if (
          merged.technicalVariant ||
          merged.startupVariant ||
          merged.directVariant ||
          (merged.evaluations && merged.evaluations.length > 0) ||
          Object.keys(merged).length > 2
        ) {
          parsedData = merged as T;
        }
      }

      if (!parsedData) {
        this.logger.error(
          `[${this.providerName} / ${model}] Failed to parse structured JSON from ${request.feature}:\n${rawContent}`,
        );
        throw new Error(`AI structured output failed JSON parsing: invalid JSON structure`);
      }
    }

    this.logger.log(`[${this.providerName} / ${model}] ${request.feature} structured parse completed in ${latencyMs}ms (${usage.total_tokens} tokens)`);

    return {
      data: parsedData,
      provider: this.providerName,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs,
    };
  }
}
