import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class VehicleResponseData {
  @Expose()
  @ApiProperty({ example: 1, description: 'Unique ID of the vehicle' })
  id: number;

  @Expose()
  @ApiProperty({ example: 1, description: 'ID of the associated company' })
  companyId: number;

  @Expose()
  @ApiProperty({ example: 'ABC123', description: 'Vehicle registration number', maxLength: 50 })
  regNo: string;

  @Expose()
  @ApiProperty({ example: 'Toyota Corolla', description: 'Vehicle model', nullable: true })
  model?: string;

  @Expose()
  @ApiProperty({ example: 'Petrol', description: 'Type of fuel used', nullable: true })
  fuelType?: string;

  @Expose()
  @ApiProperty({ example: 5, description: 'Number of seats', minimum: 1 })
  seatingCapacity: number;

  @Expose()
  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'URL to vehicle image', nullable: true })
  vehicleImage?: string;

  @Expose()
  @ApiProperty({ example: 12500.75, description: 'Last recorded odometer reading', minimum: 0 })
  odometerLastReading: number;

  @Expose()
  @ApiProperty({ example: 'Sedan', description: 'Type/category of the vehicle', nullable: true })
  vehicleType?: string;

  @Expose()
  @ApiProperty({ example: 101, description: 'ID of primary assigned driver', nullable: true })
  assignedDriverPrimaryId?: number;

  @Expose()
  @ApiProperty({ example: 102, description: 'ID of secondary assigned driver', nullable: true })
  assignedDriverSecondaryId?: number;

  @Expose()
  @ApiProperty({ example: true, description: 'Whether the vehicle is active' })
  isActive: boolean;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Creation timestamp' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-11-04T10:30:00.000Z', description: 'Last update timestamp' })
  updatedAt: Date;
}

export class VehicleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Vehicle retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.608Z' })
  timestamp: string;

  @ApiProperty({ type: VehicleResponseData })
  data: VehicleResponseData;
}

export class VehicleListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Vehicles retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.608Z' })
  timestamp: string;

  @ApiProperty({ type: [VehicleResponseData] })
  data: VehicleResponseData[];

  @ApiProperty({ example: { page: 1, limit: 10, total: 25, totalPages: 3 } })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}