// src/modules/company/dto/cost-configuration.dto.ts
import { IsString, IsNumber, IsDateString, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCostConfigurationDto {
  @ApiProperty({
    description: 'Vehicle type',
    example: 'Car',
    enum: ['Car', 'Van', 'Lorry', 'SUV', 'Truck'],
    maxLength: 50
  })
  @IsString()
  vehicleType: string;

  @ApiProperty({
    description: 'Cost per kilometer',
    example: 2.5,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  costPerKm: number;

  @ApiProperty({
    description: 'Date from which this cost configuration is valid',
    example: '2025-01-01'
  })
  @IsDateString()
  validFrom: Date;

  @ApiProperty({
    description: 'Company ID',
    example: 1
  })
  @IsInt()
  companyId: number;
}

export class UpdateCostConfigurationDto {
  @ApiPropertyOptional({
    description: 'Vehicle type',
    example: 'Van',
    enum: ['Car', 'Van', 'Lorry', 'SUV', 'Truck'],
    maxLength: 50
  })
  @IsString()
  @IsOptional()
  vehicleType?: string;

  @ApiPropertyOptional({
    description: 'Cost per kilometer',
    example: 3.0,
    minimum: 0
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  costPerKm?: number;

  @ApiPropertyOptional({
    description: 'Date from which this cost configuration is valid',
    example: '2025-02-01'
  })
  @IsDateString()
  @IsOptional()
  validFrom?: Date;
}