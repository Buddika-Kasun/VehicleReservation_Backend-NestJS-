
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Sales Team', description: 'Name of department' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 1, description: 'Cost Center ID', required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  costCenterId?: number;

  @ApiProperty({ example: 2, description: 'Department Head User ID', required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  headId?: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}