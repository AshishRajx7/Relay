import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        redis: 'disconnected',
        storage: 'writable',
      },
    };

    let isHealthy = true;

    // 1. Check DB
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        health.services.database = 'connected';
      }
    } catch {
      health.services.database = 'error';
      isHealthy = false;
    }

    // 2. Check Redis
    let redisClient: Redis | null = null;
    try {
      const host = this.configService.get<string>('redis.host', '127.0.0.1');
      const port = this.configService.get<number>('redis.port', 6379);
      redisClient = new Redis({
        host,
        port,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redisClient.connect();
      const pong = await redisClient.ping();
      if (pong === 'PONG') {
        health.services.redis = 'connected';
      }
    } catch {
      health.services.redis = 'error';
      isHealthy = false;
    } finally {
      if (redisClient) {
        try {
          await redisClient.quit();
        } catch {
          // ignore disconnect error
        }
      }
    }

    health.status = isHealthy ? 'ok' : 'degraded';
    res.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(health);
  }
}
