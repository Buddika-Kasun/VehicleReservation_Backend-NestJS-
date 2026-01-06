import { CallHandler, ExecutionContext, Injectable, NestInterceptor, LoggerService } from '@nestjs/common';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    this.logger.log(`Incoming request: ${context.switchToHttp().getRequest().url}`);
    return next.handle();
  }
}
