import { HttpCode, HttpStatus } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Internal server error.' })
  message: string;

  @ApiProperty({ example: HttpStatus.INTERNAL_SERVER_ERROR })
  statusCode: number;

  @ApiProperty({ example: '2025-01-20T10:30:00.000Z' })
  timestamp: string;

  constructor(message: string, statusCode: number, message1?: string) {
    this.success = false;
    this.message = message;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Static helper that generates Swagger-ready examples
   */
  static example(message: string, statusCode: number): ErrorResponseDto {
    return new ErrorResponseDto(message, statusCode);
  }
}