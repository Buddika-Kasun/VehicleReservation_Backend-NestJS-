
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreateCostCenterDto {
  @ApiProperty({ example: 'Sales Department', description: 'Name of cost center' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 1000, description: 'Allocated budget', default: 0 })
  @IsNumber()
  @IsOptional()
  budget?:number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCostCenterDto extends PartialType(CreateCostCenterDto) {
  @ApiPropertyOptional({ example: 1, description: 'Company ID' })
  @IsNumber()
  @IsOptional()
  companyId?: number;
}