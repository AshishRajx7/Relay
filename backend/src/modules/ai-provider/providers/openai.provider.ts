import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IAIProvider } from './ai-provider.interface';
import { CompletionRequestDto, AiCompletionResult } from '../dto/completion-request.dto';

@Injectable()
export class OpenAIProvider implements IAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly openai: OpenAI | null = null;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly apiKey: string;

  constructor(config: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  }) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.model || 'gpt-4o';
    this.defaultMaxTokens = config.maxTokens || 4096;
    this.defaultTemperature = config.temperature ?? 0.3;

    if (this.apiKey && this.apiKey !== 'sk-placeholder-for-dev') {
      this.openai = new OpenAI({ apiKey: this.apiKey });
    } else {
      this.logger.warn('OpenAI API key not configured or using placeholder. Running in simulation/dev mode if live call is made.');
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isRateLimit = err?.status === 429 || err?.message?.includes('429');
        const isServerError = err?.status >= 500 && err?.status < 600;

        if ((isRateLimit || isServerError) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          this.logger.warn(`OpenAI call failed (${err?.status || err?.message}). Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`OpenAI request failed after ${maxRetries} attempts.`);
  }

  async complete(request: CompletionRequestDto): Promise<AiCompletionResult<string>> {
    const startTime = Date.now();
    const model = this.defaultModel;

    if (!this.openai) {
      // Development mock fallback
      return {
        data: `[DEV_MOCK_COMPLETION] Response for ${request.feature}`,
        provider: 'openai-mock',
        model,
        promptTokens: 50,
        completionTokens: 20,
        totalTokens: 70,
        latencyMs: Date.now() - startTime,
      };
    }

    const response = await this.executeWithRetry(() =>
      this.openai!.chat.completions.create({
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

    return {
      data: content,
      provider: 'openai',
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs,
    };
  }

  async structuredComplete<T>(request: CompletionRequestDto): Promise<AiCompletionResult<T>> {
    const startTime = Date.now();
    const model = this.defaultModel;

    if (!this.openai) {
      if (request.feature === 'COMPANY_RESEARCH') {
        const mockCompany: any = {
          persona: 'SAAS',
          industry: 'Cloud Infrastructure & Developer Tools',
          companySize: '51-200',
          summary: 'High-growth technology company building mission-critical modern infrastructure and developer tools.',
          keywords: ['Cloud', 'Infrastructure', 'Developer Tools', 'B2B', 'APIs'],
          techStack: ['TypeScript', 'NestJS', 'Go', 'Python', 'PostgreSQL', 'Redis', 'Kubernetes', 'AWS'],
          products: ['Core Engine', 'Developer API', 'Enterprise Shield'],
          targetDepartments: ['Engineering', 'Product', 'Platform Infrastructure'],
          locations: ['San Francisco, CA', 'Remote US'],
          outreachHooks: {
            whyThisCompany: 'Market leader building high-throughput distributed infrastructure processing 50M+ requests daily.',
            whyNow: 'Actively expanding distributed backend platform teams following Series B growth.',
            keyProblemsSolving: ['Distributed consensus', 'High-throughput low-latency caching'],
            engineeringCultureSignals: ['High ownership', 'Fast shipping cadence', 'Remote-first'],
            recentMilestones: ['Launched v2 Core API', 'Expanded North American hiring'],
          },
        };
        return {
          data: mockCompany as T,
          provider: 'openai-mock',
          model,
          promptTokens: 450,
          completionTokens: 280,
          totalTokens: 730,
          latencyMs: Date.now() - startTime,
        };
      }

      // Mock structured response for resume parsing
      const mockResult: any = {
        name: 'Alex Mercer',
        email: 'alex.mercer@example.com',
        phone: '+1 (555) 019-2834',
        location: 'San Francisco, CA',
        title: 'Staff Backend Engineer',
        summary: 'Accomplished backend engineer with 8+ years experience designing scalable microservices, distributed systems, and cloud infrastructure.',
        totalYearsExperience: 8.5,
        skills: {
          languages: ['TypeScript', 'Python', 'Go', 'SQL'],
          frameworks: ['NestJS', 'Express', 'FastAPI', 'Next.js'],
          databases: ['PostgreSQL', 'Redis', 'MongoDB'],
          tools: ['Docker', 'Kubernetes', 'AWS', 'BullMQ', 'Git'],
          other: ['System Architecture', 'Microservices', 'Distributed Systems', 'CI/CD'],
        },
        experience: [
          {
            company: 'TechFlow Systems',
            title: 'Senior Backend Engineer',
            location: 'San Francisco, CA',
            startDate: '2021-03',
            endDate: 'Present',
            highlights: [
              'Architected event-driven microservices serving 10M+ daily requests using NestJS, Redis, and PostgreSQL',
              'Spearheaded background job processing infrastructure with BullMQ, reducing queue latency by 45%',
              'Mentored 6 junior and mid-level software engineers',
            ],
          },
          {
            company: 'CloudScale Inc',
            title: 'Software Engineer',
            location: 'Austin, TX',
            startDate: '2018-06',
            endDate: '2021-02',
            highlights: [
              'Developed high-throughput REST APIs and GraphQL gateways in TypeScript',
              'Implemented automated CI/CD deployment pipelines on AWS ECS',
            ],
          },
        ],
        education: [
          {
            institution: 'University of Texas at Austin',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            graduationDate: '2018-05',
            gpa: '3.8',
          },
        ],
        projects: [
          {
            name: 'Relay Outreach Engine',
            description: 'AI-driven personalized cold outreach platform built with NestJS, BullMQ, and OpenAI',
            techStack: ['NestJS', 'TypeScript', 'PostgreSQL', 'BullMQ', 'OpenAI'],
            url: 'https://github.com/example/relay',
          },
        ],
        certifications: ['AWS Certified Solutions Architect - Associate'],
        links: {
          linkedin: 'https://linkedin.com/in/alexmercer',
          github: 'https://github.com/alexmercer',
          portfolio: 'https://alexmercer.dev',
        },
      };

      return {
        data: mockResult as T,
        provider: 'openai-mock',
        model,
        promptTokens: 450,
        completionTokens: 280,
        totalTokens: 730,
        latencyMs: Date.now() - startTime,
      };
    }

    const response = await this.executeWithRetry(() =>
      this.openai!.chat.completions.create({
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
    const content = response.choices[0]?.message?.content || '{}';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    let parsedData: T;
    try {
      parsedData = JSON.parse(content) as T;
    } catch (parseErr: any) {
      this.logger.error(`Failed to parse structured JSON from OpenAI: ${content}`);
      throw new Error(`OpenAI structured output failed JSON parsing: ${parseErr.message}`);
    }

    return {
      data: parsedData,
      provider: 'openai',
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs,
    };
  }
}
