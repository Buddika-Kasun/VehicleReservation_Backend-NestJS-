
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CostCenterData {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Sales Department' })
  name: string;

  @ApiPropertyOptional({ example: 1000 })
  budget?: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  companyId: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.598Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-11-03T10:48:48.598Z' })
  updatedAt: string;

  @ApiPropertyOptional({ example: 5, description: 'Number of departments in this cost center' })
  departmentCount?: number;
}

export class CostCenterResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Cost center retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.608Z' })
  timestamp: string;

  @ApiProperty({ type: CostCenterData })
  data: CostCenterData;
}

export class CostCenterListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Cost centers retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.608Z' })
  timestamp: string;

  @ApiProperty({ type: [CostCenterData] })
  data: CostCenterData[];

  @ApiProperty({ example: { page: 1, limit: 10, total: 25, totalPages: 3 } })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}