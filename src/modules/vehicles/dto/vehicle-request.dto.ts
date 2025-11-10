import { PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsOptional, 
  IsNotEmpty, 
  IsPositive, 
  Min 
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the company that owns the vehicle',
  })
  @IsNotEmpty()
  @IsNumber()
  companyId: number;

  @ApiProperty({
    example: 'KL01AB1234',
    description: 'Unique vehicle registration number',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  regNo: string;

  @ApiPropertyOptional({
    example: 'Toyota Innova Crysta',
    description: 'Model of the vehicle',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    example: 'Diesel',
    description: 'Type of fuel used by the vehicle',
    enum: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'],
  })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({
    example: 7,
    description: 'Number of passenger seats (minimum 1)',
    minimum: 1,
    default: 4,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  seatingCapacity?: number = 4;

  @ApiPropertyOptional({
    example: 'https://example.com/vehicles/innova.jpg',
    description: 'URL to the vehicle image',
  })
  @IsOptional()
  @IsString()
  vehicleImage?: string;

  @ApiPropertyOptional({
    example: 15230.5,
    description: 'Last known odometer reading in kilometers',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  odometerLastReading?: number = 0;

  @ApiPropertyOptional({
    description: 'Daily inspection checklist (stored as JSON object)',
    type: 'object',
    example: {
      tires: true,
      lights: true,
      brakes: 'ok',
    },
  })
  @IsOptional()
  dailyInspectionChecklist?: any;

  @ApiPropertyOptional({
    example: 'SUV',
    description: 'Category or type of the vehicle',
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({
    example: 101,
    description: 'ID of the primary assigned driver (user ID)',
  })
  @IsOptional()
  @IsNumber()
  assignedDriverPrimaryId?: number;

  @ApiPropertyOptional({
    example: 105,
    description: 'ID of the secondary assigned driver (user ID)',
  })
  @IsOptional()
  @IsNumber()
  assignedDriverSecondaryId?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the vehicle is currently active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  // Re-declare isActive to give it explicit Swagger doc (optional but clearer)
  @ApiPropertyOptional({
    example: false,
    description: 'Toggle vehicle active/inactive status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignDriverDto {
  @ApiProperty({
    example: 50,
    description: 'ID of the vehicle to assign drivers to',
  })
  @IsNotEmpty()
  @IsNumber()
  vehicleId: number;

  @ApiPropertyOptional({
    example: 201,
    description: 'ID of the primary driver (user ID). Set to null to unassign.',
  })
  @IsOptional()
  @IsNumber()
  primaryDriverId?: number;

  @ApiPropertyOptional({
    example: 202,
    description: 'ID of the secondary driver (user ID). Set to null to unassign.',
  })
  @IsOptional()
  @IsNumber()
  secondaryDriverId?: number;
}