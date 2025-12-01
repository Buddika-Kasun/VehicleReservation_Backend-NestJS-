// src/common/dto/response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class TripResponseData {
  @Expose()
  @ApiProperty({ example: 1 })
  id: number;

  @Expose()
  @ApiProperty({ example: 'Company Headquarters' })
  origin: string;

  @Expose()
  @ApiProperty({ example: 'Client Office' })
  destination: string;

  @Expose()
  @ApiProperty({ example: '2024-01-15' })
  startDate: string;

  @Expose()
  @ApiProperty({ example: '14:30' })
  startTime: string;

  @Expose()
  @ApiProperty({ example: 'Client meeting', nullable: true })
  purpose?: string;

  @Expose()
  @ApiProperty({ example: 3 })
  passengers: number;

  @Expose()
  @ApiProperty({ example: 'draft', enum: ['draft', 'pending', 'approved', 'rejected', 'ongoing', 'completed', 'canceled'] })
  status: string;

  @Expose()
  @ApiProperty({ example: 15000.5, nullable: true })
  startOdometer?: number;

  @Expose()
  @ApiProperty({ example: 15200.5, nullable: true })
  endOdometer?: number;

  @Expose()
  @ApiProperty({ example: 200.0, nullable: true })
  mileage?: number;

  @Expose()
  @ApiProperty({ example: 350.0, nullable: true })
  cost?: number;

  @Expose()
  @ApiProperty({ example: '2024-01-10T10:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2024-01-10T10:00:00.000Z' })
  updatedAt: Date;
}

export class TripResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Trip created successfully' })
  message: string;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-10T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: TripResponseData })
  data: TripResponseData;
}

export class TripListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Trips retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-10T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: [TripResponseData] })
  data: TripResponseData[];

  @ApiProperty({ 
    example: { page: 1, limit: 10, total: 25, totalPages: 3 },
    required: false 
  })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}