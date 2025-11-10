import { ApiProperty } from '@nestjs/swagger';

export class CostConfigurationData {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Car' })
  vehicleType: string;

  @ApiProperty({ example: 2.5 })
  costPerKm: number;

  @ApiProperty({ example: '2025-01-01' })
  validFrom: string;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: 1 })
  companyId: number;

  @ApiProperty({ example: 'ABC Corporation' })
  companyName: string;
}

export class CostConfigurationResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Cost configuration retrieved successfully' })
    message: string;

    @ApiProperty({ example: 200 })
    statusCode: number;

    @ApiProperty({ example: '2025-01-20T10:30:00.000Z' })
    timestamp: string;

    @ApiProperty({ type: CostConfigurationData })
    data: {
      costConfiguration: CostConfigurationData;
    };
}

/*
export class CostConfigurationListResponseDto {
  @ApiProperty({ type: [CostConfigurationResponseDto] })
  costConfigurations: CostConfigurationResponseDto[];

  @ApiProperty({ example: 3 })
  total: number;
}
*/

export class CostConfigurationListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Cost configurations retrieved successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2025-01-20T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({
    example: {
      costConfigurations: [
        {
          id: 1,
          vehicleType: 'Car',
          costPerKm: 2.5,
          validFrom: '2025-01-01',
          createdAt: '2025-01-15T10:30:00.000Z',
          companyId: 1,
          companyName: 'ABC Corporation'
        },
        {
          id: 2,
          vehicleType: 'Van',
          costPerKm: 3.5,
          validFrom: '2025-01-01',
          createdAt: '2025-01-16T11:30:00.000Z',
          companyId: 1,
          companyName: 'ABC Corporation'
        }
      ],
      total: 2
    }
  })
  data: {
    costConfigurations: CostConfigurationData[];
    total: number;
  };
}