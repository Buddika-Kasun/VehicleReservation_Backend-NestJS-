
import { ApiProperty } from '@nestjs/swagger';

class DepartmentHeadData {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'john.doe' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  displayname: string;

  @ApiProperty({ example: 'john.doe@company.com' })
  email: string;
}

class CostCenterData {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Sales Department' })
  name: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class DepartmentData {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Sales Team' })
  name: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  companyId: number;

  @ApiProperty({ type: CostCenterData, nullable: true })
  costCenter: CostCenterData | null;

  @ApiProperty({ type: DepartmentHeadData, nullable: true })
  head: DepartmentHeadData | null;

  @ApiProperty({ example: '2025-11-03T10:48:48.598Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-11-03T10:48:48.598Z' })
  updatedAt: string;
}

export class DepartmentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Department retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.608Z' })
  timestamp: string;

  @ApiProperty({ type: DepartmentData })
  data: DepartmentData;
}

export class DepartmentListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Departments retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-11-03T10:48:48.608Z' })
  timestamp: string;

  @ApiProperty({ type: [DepartmentData] })
  data: DepartmentData[];

  @ApiProperty({ example: { page: 1, limit: 10, total: 25, totalPages: 3 } })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}