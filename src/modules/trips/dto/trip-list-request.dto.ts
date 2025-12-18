import { IsEnum, IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { TripStatus } from 'src/infra/database/entities/trip.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum TimeFilter {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  ALL = 'all',
}

export class TripListRequestDto {
  @ApiProperty({
    description: 'Time filter for trips',
    enum: TimeFilter,
    example: TimeFilter.TODAY,
  })
  @IsEnum(TimeFilter)
  timeFilter: TimeFilter;

  @ApiProperty({
    description: 'Status filter for trips (optional)',
    enum: TripStatus,
    required: false,
    example: TripStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TripStatus)
  statusFilter?: TripStatus;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    default: 10,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

class TripCardDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Toyota Prius' })
  vehicleModel: string;

  @ApiProperty({ example: 'CBD-4324' })
  vehicleRegNo: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: '2024-12-03' })
  date: string;

  @ApiProperty({ example: '14:30' })
  time: string;

  @ApiProperty({ example: 'R', description: 'R, RO, P, or J' })
  tripType: string;

  @ApiProperty({ example: 'John Doe', required: false })
  driverName?: string;

  @ApiProperty({ example: 'Colombo Office', required: false })
  startLocation?: string;

  @ApiProperty({ example: 'Airport', required: false })
  endLocation?: string;
}

export class TripListResponseDto {
  @ApiProperty({ type: [TripCardDto] })
  trips: TripCardDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}