import { CallHandler, ExecutionContext, Injectable, NestInterceptor, TimeoutError } from '@nestjs/common';
import { Observable, throwError, timeout, catchError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError(err => throwError(() => new TimeoutError())),
    );
  }
}
