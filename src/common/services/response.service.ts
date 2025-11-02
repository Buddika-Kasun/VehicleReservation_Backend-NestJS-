// src/common/services/response.service.ts
import { Injectable } from '@nestjs/common';
import { ApiResponse } from '../interfaces/response.interface';

@Injectable()
export class ResponseService {
  success<T>(message: string, data?: T, statusCode: number = 200): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      statusCode,
    };
  }

  error(message: string, statusCode: number = 400): ApiResponse {
    return {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      statusCode,
    };
  }

  created<T>(message: string, data?: T): ApiResponse<T> {
    return this.success(message, data, 201);
  }

  noContent(message: string): ApiResponse {
    return this.success(message, undefined, 204);
  }
}