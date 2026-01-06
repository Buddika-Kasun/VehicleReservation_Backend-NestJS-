import { ApiProperty } from '@nestjs/swagger';

export class AdminStatsDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  totalPendingUsers: number;

  @ApiProperty()
  totalTripsToday: number;

  @ApiProperty()
  activeVehicles: number;
}

export class ManagerStatsDto {
  @ApiProperty()
  pendingTripApprovals: number;

  @ApiProperty()
  departmentActiveTrips: number;

  @ApiProperty()
  departmentTotalUsers: number;
}

export class EmployeeStatsDto {
  @ApiProperty()
  myTotalTrips: number;

  @ApiProperty()
  myUpcomingTrips: number;

  @ApiProperty()
  myNotificationsCount: number;
}

export class DashboardResponseDto {
  @ApiProperty({ required: false })
  admin?: AdminStatsDto;

  @ApiProperty({ required: false })
  manager?: ManagerStatsDto;

  @ApiProperty({ required: false })
  employee?: EmployeeStatsDto;
}
