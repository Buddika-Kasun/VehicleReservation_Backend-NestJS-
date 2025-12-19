import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  page?: number = 0;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

export class PaginationQueryDto {
  @ApiProperty({ example: 1, description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  page?: number = 1;

  @ApiProperty({ example: 10, description: 'Items per page', required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  limit?: number = 10;
}
