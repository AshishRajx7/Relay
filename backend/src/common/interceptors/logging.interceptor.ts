import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, originalUrl } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;
          this.logger.log(`${method} ${originalUrl} ${statusCode} +${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status = err.status || 500;
          this.logger.warn(`${method} ${originalUrl} ${status} +${duration}ms - ${err.message}`);
        },
      }),
    );
  }
}
