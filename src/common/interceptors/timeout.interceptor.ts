import { CallHandler, ExecutionContext, Injectable, NestInterceptor, RequestTimeoutException } from "@nestjs/common";
import { catchError, Observable, throwError, timeout, TimeoutError } from "rxjs";

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Increase timeout to 60 seconds
    return next.handle().pipe(
      timeout(60000), // 60 seconds instead of default 30
      catchError(err => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request timeout after 60 seconds'));
        }
        return throwError(() => err);
      }),
    );
  }
}