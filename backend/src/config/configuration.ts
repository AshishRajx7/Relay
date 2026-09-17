import * as Joi from 'joi';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
  };
  redis: {
    host: string;
    port: number;
  };
  ai: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    matchingModel?: string;
    maxTokens: number;
    temperature: number;
  };
  storage: {
    type: string;
    localRoot: string;
  };
  crawl4ai: {
    url: string;
    apiToken: string;
    mock: boolean;
    timeoutMs: number;
  };
  upload: {
    maxFileSize: number;
  };
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(true),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  AI_PROVIDER: Joi.string().default('nvidia'),
  AI_API_KEY: Joi.string().allow('').optional(),
  AI_BASE_URL: Joi.string().default('https://integrate.api.nvidia.com/v1'),
  AI_MODEL: Joi.string().default('deepseek-ai/deepseek-v4-flash-0731'),
  AI_MATCHING_MODEL: Joi.string().optional(),
  AI_MAX_TOKENS: Joi.number().default(4096),
  AI_TEMPERATURE: Joi.number().default(0.3),

  // Backwards compatibility fallbacks
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_MODEL: Joi.string().optional(),
  OPENAI_MAX_TOKENS: Joi.number().optional(),
  OPENAI_TEMPERATURE: Joi.number().optional(),

  STORAGE_TYPE: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_ROOT: Joi.string().default('./uploads'),

  CRAWL4AI_URL: Joi.string().default('http://localhost:11235'),
  CRAWL4AI_API_TOKEN: Joi.string().default('relay_crawl_secret'),
  CRAWL4AI_MOCK: Joi.boolean().default(false),
  CRAWL4AI_TIMEOUT_MS: Joi.number().default(30000),

  UPLOAD_MAX_FILE_SIZE: Joi.number().default(10485760),

  // Google / Gmail OAuth Credentials
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_REFRESH_TOKEN: Joi.string().allow('').optional(),
  GOOGLE_REDIRECT_URI: Joi.string().allow('').optional(),
  GMAIL_CLIENT_ID: Joi.string().allow('').optional(),
  GMAIL_CLIENT_SECRET: Joi.string().allow('').optional(),
  GMAIL_REFRESH_TOKEN: Joi.string().allow('').optional(),
  GMAIL_REDIRECT_URI: Joi.string().allow('').optional(),
});

export const configuration = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'relay',
    password: process.env.DB_PASSWORD || 'relay_dev_password',
    database: process.env.DB_DATABASE || 'relay',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'nvidia',
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'deepseek-ai/deepseek-v4-flash-0731',
    matchingModel: process.env.AI_MATCHING_MODEL || process.env.AI_MODEL || 'meta/llama-3.2-11b-vision-instruct',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || process.env.OPENAI_TEMPERATURE || '0.3'),
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localRoot: process.env.STORAGE_LOCAL_ROOT || './uploads',
  },
  crawl4ai: {
    url: process.env.CRAWL4AI_URL || 'http://localhost:11235',
    apiToken: process.env.CRAWL4AI_API_TOKEN || 'relay_crawl_secret',
    mock: process.env.CRAWL4AI_MOCK === 'true',
    timeoutMs: parseInt(process.env.CRAWL4AI_TIMEOUT_MS || '30000', 10),
  },
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '10485760', 10),
  },
});
