import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from 'src/infra/database/entities/user.entity';
import { Trip } from 'src/infra/database/entities/trip.entity';
import { DashboardResponseDto, AdminStatsDto, ManagerStatsDto, EmployeeStatsDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
  ) {}

  /**
   * Get dashboard data based on user role
   */
  async getDashboardData(user: any): Promise<DashboardResponseDto> {
    const response: DashboardResponseDto = {};

    // Get basic stats based on role
    // TODO: Implement actual business logic for each role
    
    if (this.isAdmin(user.role)) {
      response.admin = await this.getAdminStats();
    }

    if (this.isManager(user.role)) {
      response.manager = await this.getManagerStats(user);
    }

    response.employee = await this.getEmployeeStats(user);

    return response;
  }

  private async getAdminStats(): Promise<AdminStatsDto> {
    // TODO: Replace with real queries
    return {
      totalUsers: 0, // await this.userRepository.count()
      totalPendingUsers: 0,
      totalTripsToday: 0,
      activeVehicles: 0,
    };
  }

  private async getManagerStats(user: any): Promise<ManagerStatsDto> {
    // TODO: Replace with real queries filtered by department/company
    return {
      pendingTripApprovals: 0,
      departmentActiveTrips: 0,
      departmentTotalUsers: 0,
    };
  }

  private async getEmployeeStats(user: any): Promise<EmployeeStatsDto> {
    // TODO: Replace with real queries filtered by user ID
    return {
      myTotalTrips: 0,
      myUpcomingTrips: 0,
      myNotificationsCount: 0,
    };
  }

  private isAdmin(role: string): boolean {
    return role === UserRole.ADMIN || role === UserRole.SYSADMIN;
  }

  private isManager(role: string): boolean {
    // Assuming managers are HR, ADMIN, or SYSADMIN for now based on previous discussions
    return [UserRole.ADMIN, UserRole.SYSADMIN, UserRole.HR].includes(role as UserRole);
  }
}
