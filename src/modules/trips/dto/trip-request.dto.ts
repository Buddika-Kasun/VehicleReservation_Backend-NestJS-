import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsDateString, IsEnum, IsOptional, IsPositive, Min, Max, IsBoolean } from 'class-validator';
import { TripStatus } from 'src/database/entities/trip.entity';

export class CreateTripDto {
  @ApiProperty({ example: 1, description: 'Vehicle ID' })
  @IsNumber()
  @IsPositive()
  vehicleId: number;

  @ApiProperty({ example: 'Company Headquarters', description: 'Trip origin' })
  @IsString()
  origin: string;

  @ApiProperty({ example: 'Client Office', description: 'Trip destination' })
  @IsString()
  destination: string;

  @ApiProperty({ example: '2024-01-15', description: 'Start date' })
  @IsDateString()
  startDate: Date;

  @ApiProperty({ example: '14:30', description: 'Start time' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: 'Client meeting', description: 'Trip purpose', required: false })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({ example: 3, description: 'Number of passengers', minimum: 1 })
  @IsNumber()
  @IsPositive()
  passengers: number;

  @ApiProperty({ example: 'Need extra space for equipment', description: 'Special remarks', required: false })
  @IsOptional()
  @IsString()
  specialRemarks?: string;

  @ApiProperty({ 
    enum: TripStatus, 
    example: TripStatus.DRAFT, 
    description: 'Trip status',
    default: TripStatus.DRAFT 
  })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @ApiProperty({ example: 101, description: 'First approver ID', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  approver1Id?: number;

  @ApiProperty({ example: 102, description: 'Second approver ID', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  approver2Id?: number;

  @ApiProperty({ example: 103, description: 'Safety approver ID', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  safetyApproverId?: number;
}

export class SubmitApprovalDto {
  @ApiProperty({ example: 101, description: 'First approver ID', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  approver1Id?: number;

  @ApiProperty({ example: 102, description: 'Second approver ID', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  approver2Id?: number;

  @ApiProperty({ example: 103, description: 'Safety approver ID', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  safetyApproverId?: number;
}

export class ProcessApprovalDto {
  @ApiProperty({ 
    enum: ['approve', 'reject'], 
    example: 'approve', 
    description: 'Approval decision' 
  })
  @IsEnum(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiProperty({ 
    example: 'Looks good, approved', 
    description: 'Approval comments', 
    required: false 
  })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({ 
    example: false, 
    description: 'Is safety department approval', 
    required: false,
    default: false 
  })
  @IsOptional()
  @IsBoolean()
  isSafetyApprover?: boolean;
}

export class CancelTripDto {
  @ApiProperty({ 
    example: 'Meeting cancelled by client', 
    description: 'Cancellation reason' 
  })
  @IsString()
  reason: string;
}

export class RecordOdometerDto {
  @ApiProperty({ example: 15200.5, description: 'Odometer reading' })
  @IsNumber()
  @IsPositive()
  odometerReading: number;

  @ApiProperty({ example: true, description: 'Is start reading' })
  @IsBoolean()
  isStart: boolean;

  @ApiProperty({ 
    example: 3, 
    description: 'Actual number of passengers (mandatory for end reading)', 
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  actualPassengers?: number;
}