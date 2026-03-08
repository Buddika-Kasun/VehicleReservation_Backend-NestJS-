import { IsEnum, IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { TripStatus } from 'src/infra/database/entities/trip.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum TimeFilter {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  ALL = 'all',
}

export enum SortField {
  ID = 'id',
  START_TIME = 'startTime',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

// Define a type that combines enum values with additional string literals
export type TripStatusFilter = TripStatus | 'scheduled';

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
    enum: [...Object.values(TripStatus), 'scheduled'],
    required: false,
    example: TripStatus.PENDING,
  })
  @IsOptional()
  statusFilter?: TripStatusFilter;

  @ApiProperty({
    description: 'Search query for trips - search by ID, date, time, requester name, etc.',
    required: false,
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;
  
  @ApiProperty({
    description: 'Field to sort by',
    enum: SortField,
    required: false,
    default: SortField.START_TIME,
    example: SortField.START_TIME,
  })
  @IsOptional()
  @IsEnum(SortField)
  sortField?: SortField = SortField.START_TIME;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    required: false,
    default: SortOrder.DESC,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

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