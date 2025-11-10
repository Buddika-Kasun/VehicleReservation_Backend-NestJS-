
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class QrCodeData {
  @Expose()
  @ApiProperty({ 
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...', 
    description: 'QR code as base64 data URL' 
  })
  qrCodeDataUrl: string;

  @Expose()
  @ApiProperty({ example: 1, description: 'Vehicle ID encoded in QR' })
  vehicleId: number;

  @Expose()
  @ApiProperty({ example: '2025-11-04T10:30:00.000Z', description: 'Timestamp of QR generation' })
  timestamp: Date;
}

@Exclude()
export class ScanResultData {
  @Expose()
  @ApiProperty({ example: true, description: 'Scan operation success status' })
  success: boolean;

  @Expose()
  @ApiProperty({ 
    type: Object,
    example: { 
      id: 1, 
      regNo: 'ABC123',
      model: 'Corolla', 
      make: 'Toyota',
      year: 2023, 
      vehicleType: 'Sedan',
      odometerLastReading: 15200.5
    },
    description: 'Vehicle information' 
  })
  vehicle: {
    id: number;
    regNo: string;
    model: string;
    make: string;
    year: number;
    vehicleType: string;
    odometerLastReading: number;
  };

  @Expose()
  @ApiProperty({ example: 15200.5, description: 'Recorded odometer reading' })
  odometerReading: number;

  @Expose()
  @ApiProperty({ example: 'entry', enum: ['entry', 'exit'], description: 'Scan type' })
  scanType: 'entry' | 'exit';

  @Expose()
  @ApiProperty({ example: '2025-11-04T10:30:00.000Z', description: 'Timestamp of scan' })
  timestamp: Date;
}

@Exclude()
export class VehicleMovementData {
  @Expose()
  @ApiProperty({ example: 1, description: 'Movement record ID' })
  id: number;

  @Expose()
  @ApiProperty({ example: 1, description: 'Vehicle ID' })
  vehicleId: number;

  @Expose()
  @ApiProperty({ example: 15200.5, description: 'Odometer reading at time of movement' })
  odometerReading: number;

  @Expose()
  @ApiProperty({ example: 'entry', enum: ['entry', 'exit'], description: 'Movement type' })
  movementType: 'entry' | 'exit';

  @Expose()
  @ApiProperty({ example: '2025-11-04T10:30:00.000Z', description: 'Movement timestamp' })
  timestamp: Date;

  @Expose()
  @ApiProperty({ example: 'security_user_123', description: 'ID of personnel who scanned' })
  scannedBy: string;

  @Expose()
  @ApiProperty({ example: 'Gate entry - Main gate', description: 'Additional notes', nullable: true })
  notes?: string;
}

// Response DTOs
export class QrGenerateResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'QR code generated successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-04T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: QrCodeData })
  data: QrCodeData;
}

export class QrScanResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Vehicle entry recorded successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-04T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: ScanResultData })
  data: ScanResultData;
}

export class VehicleMovementListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Vehicle movement history retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-04T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: [VehicleMovementData] })
  data: VehicleMovementData[];

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