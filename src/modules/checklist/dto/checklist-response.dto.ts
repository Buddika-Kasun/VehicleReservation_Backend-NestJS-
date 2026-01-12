// src/modules/checklist/dto/checklist-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class CheckedByDto {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'Driver' })
  role: string;
}

class ChecklistItemResponseDto {
  @ApiProperty({ example: 'good' })
  status: string;

  @ApiProperty({ example: 'In good condition', required: false })
  remarks?: string;
}

export class ChecklistResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 1 })
  vehicleId: number;

  @ApiProperty({ example: 'ABC-1234' })
  vehicleRegNo: string;

  @ApiProperty({ example: '2024-01-15' })
  checklistDate: Date;

  @ApiProperty({ type: CheckedByDto })
  checkedBy: CheckedByDto;

  @ApiProperty({
    example: {
      'Tyre condition': { status: 'good', remarks: 'In good condition' },
      'Main lamp': { status: 'bad', remarks: 'Needs replacement' },
    },
  })
  responses: Record<string, ChecklistItemResponseDto>;

  @ApiProperty({ example: true })
  isSubmitted: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}