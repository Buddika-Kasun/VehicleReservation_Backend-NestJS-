import { IsOptional, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CleanupNotificationsDto {
  @ApiPropertyOptional({
    description: 'Delete notifications expired before this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expireBefore?: string;

  @ApiPropertyOptional({
    description: 'Archive notifications created before this date',
    example: '2023-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  archiveBefore?: string;

  @ApiPropertyOptional({
    description: 'Delete read notifications before this date',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deleteReadBefore?: string;
}