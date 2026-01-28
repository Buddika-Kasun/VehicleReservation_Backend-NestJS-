// src/modules/checklist/dto/checklist-request.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsObject,
  IsOptional,
  IsIn,
  IsNumber,
} from 'class-validator';

export class ChecklistItemRequestDto {
  @ApiProperty({ example: 'good' })
  @IsString()
  @IsIn(['good', 'bad'])
  status: string;

  @ApiProperty({ example: 'In good condition', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ChecklistSubmitRequestDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  vehicleId: number;

  @ApiProperty({ example: 'ABC-1234' })
  @IsString()
  vehicleRegNo: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  checklistDate: string;

  @ApiProperty({ example: 123 })
  @IsNumber()
  checkedById: number;

  @ApiProperty({
    example: {
      'Tyre condition': { status: 'good', remarks: 'In good condition' },
      'Main lamp': { status: 'bad', remarks: 'Needs replacement' },
    },
  })
  @IsObject()
  responses: Record<string, ChecklistItemRequestDto>;
}