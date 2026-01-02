// src/dashboard/dto/dashboard-stats.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardStatsDto {
  @ApiProperty({ description: 'Total completed rides' })
  totalRides: number;

  @ApiProperty({ description: 'Pending rides for supervisor approval' })
  pendingSupervisorRides: number;

  @ApiProperty({ description: 'Total approved users' })
  totalUsers: number;

  @ApiProperty({ description: "Today's approved trips" })
  ridesToday: number;

  @ApiProperty({ description: 'Pending user creations awaiting approval' })
  pendingUserCreations: number;

  @ApiProperty({ description: 'Total budget amount from all cost centers' })
  budgetAmount: number;

  @ApiProperty({ description: 'Total actual cost of completed trips this month' })
  actualCost: number;

  @ApiProperty({ description: 'Variance between budget and actual cost' })
  costVariance: number;

  @ApiProperty({ description: 'Variance percentage' })
  costVariancePercent: number;

  @ApiProperty({ description: 'Current month total cost of completed trips' })
  currentMonthCost: number;

  @ApiProperty({ description: 'Previous month total cost of completed trips', required: false })
  previousMonthCost?: number;

  @ApiProperty({ description: 'Month over month change amount' })
  monthOverMonthChange: number;

  @ApiProperty({ description: 'Month over month percentage change' })
  monthOverMonthPercent: number;
}