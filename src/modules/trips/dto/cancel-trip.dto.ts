import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelTripDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Meeting was rescheduled',
    required: false,
    maxLength: 500
  })
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}