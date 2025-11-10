// src/vehicles/dto/generate-qr.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class GenerateQrDto {
  @ApiProperty({ example: 1, description: 'Vehicle ID' })
  @IsNumber()
  @IsPositive()
  vehicleId: number;
}

export class ScanQrDto {
  @ApiProperty({ 
    example: 'vehicle:1:odometer:15000', 
    description: 'QR code data' 
  })
  @IsString()
  qrData: string;

  @ApiProperty({ example: 15200.5, description: 'Odometer reading' })
  @IsNumber()
  @IsPositive()
  odometerReading: number;

  @ApiProperty({ 
    example: 'Main gate scan', 
    description: 'Scan notes', 
    required: false 
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ 
    example: 3, 
    description: 'Actual passengers (for trip completion)', 
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  actualPassengers?: number;
}