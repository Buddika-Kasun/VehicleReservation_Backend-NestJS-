import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Status, User, UserRole } from 'src/infra/database/entities/user.entity';
import { Trip, TripStatus } from 'src/infra/database/entities/trip.entity';
import { DashboardResponseDto, AdminStatsDto, ManagerStatsDto, EmployeeStatsDto } from './dto/dashboard-response.dto';
import { CostCenter } from 'src/infra/database/entities/cost-center.entity';
import { AdminDashboardStatsDto } from './dto/admin-dashboard-stats.dto';
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
     @InjectRepository(CostCenter)
    private readonly costCenterRepository: Repository<CostCenter>,
  ) {}

  /**
   * Get dashboard data based on user role
   */
  async getDashboardData(user: any): Promise<DashboardResponseDto> {
    const response: DashboardResponseDto = {};

    // Get basic stats based on role
    // TODO: Implement actual business logic for each role
    
    if (this.isAdmin(user.role)) {
      //response.admin = await this.getAdminStats();
    }

    if (this.isManager(user.role)) {
      response.manager = await this.getManagerStats(user);
    }

    response.employee = await this.getEmployeeStats(user);

    return response;
  }

  /**
   * Get comprehensive dashboard statistics for admin view
   */
  async getAdminDashboardStats(): Promise<AdminDashboardStatsDto> {
    // Get current date and calculate date ranges
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // Execute all queries in parallel for better performance
    const [
      totalRides,
      pendingSupervisorRides,
      totalUsers,
      pendingUserCreations,
      ridesToday,
      budgetAmount,
      currentMonthCost,
      previousMonthCost,
    ] = await Promise.all([
      // 1. Total completed rides (all trips status=completed)
      this.getTotalCompletedRides(),
      
      // 2. Pending rides for supervisor (all trips status=draft)
      this.getPendingSupervisorRides(),
      
      // 3. Total approved users (all approved user count)
      this.getTotalApprovedUsers(),
      
      // 4. Pending user creations (all pending user count)
      this.getPendingUserCreations(),
      
      // 5. Today's rides (today approved trips)
      this.getTodaysRides(todayStart, todayEnd),
      
      // 6. Total budget amount (all cost centers budget)
      this.getTotalBudgetAmount(),
      
      // 7. Current month actual cost (current month all completed trip cost)
      this.getCurrentMonthCost(currentMonthStart, currentMonthEnd),
      
      // 8. Previous month actual cost (previous month all completed trip cost)
      this.getPreviousMonthCost(previousMonthStart, previousMonthEnd),
    ]);

    // Calculate derived values
    const actualCost = currentMonthCost;
    const costVariance = budgetAmount - actualCost;
    const costVariancePercent = budgetAmount > 0 
      ? (costVariance / budgetAmount) * 100 
      : 0;

    const monthOverMonthChange = currentMonthCost - previousMonthCost;
    const monthOverMonthPercent = previousMonthCost > 0 
      ? (monthOverMonthChange / previousMonthCost) * 100 
      : (currentMonthCost > 0 ? 100 : 0);

    return {
      totalRides,
      pendingSupervisorRides,
      totalUsers,
      ridesToday,
      pendingUserCreations,
      budgetAmount,
      actualCost,
      costVariance,
      costVariancePercent,
      currentMonthCost,
      previousMonthCost,
      monthOverMonthChange,
      monthOverMonthPercent,
    };
  }

  /**
   * Get total completed rides (status = COMPLETED)
   */
  private async getTotalCompletedRides(): Promise<number> {
    const result = await this.tripRepository
      .createQueryBuilder('trip')
      .where('trip.status = :status', { status: TripStatus.COMPLETED })
      .getCount();

    return result;
  }

  /**
   * Get pending rides for supervisor (status = DRAFT)
   */
  private async getPendingSupervisorRides(): Promise<number> {
    const result = await this.tripRepository
      .createQueryBuilder('trip')
      .where('trip.status = :status', { status: TripStatus.DRAFT })
      .getCount();

    return result;
  }

  /**
   * Get total approved users (isApproved = APPROVED)
   */
  private async getTotalApprovedUsers(): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .where('user.isApproved = :status', { status: Status.APPROVED })
      .getCount();

    return result;
  }

  /**
   * Get pending user creations (isApproved = PENDING)
   */
  private async getPendingUserCreations(): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .where('user.isApproved = :status', { status: Status.PENDING })
      .getCount();

    return result;
  }

  /**
   * Get today's approved trips
   */
  private async getTodaysRides(todayStart: Date, todayEnd: Date): Promise<number> {
    const result = await this.tripRepository
      .createQueryBuilder('trip')
      .where('trip.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [TripStatus.DRAFT, TripStatus.REJECTED, TripStatus.CANCELED]
      })
      .andWhere('trip.startDate BETWEEN :todayStart AND :todayEnd', {
        todayStart,
        todayEnd,
      })
      .getCount();

    return result;
  }

  /**
   * Get total budget amount from all active cost centers
   */
  private async getTotalBudgetAmount(): Promise<number> {
    const result = await this.costCenterRepository
      .createQueryBuilder('costCenter')
      .select('SUM(costCenter.budget)', 'totalBudget')
      .where('costCenter.isActive = :isActive', { isActive: true })
      .getRawOne();

    return parseFloat(result.totalBudget) || 0;
  }

  /**
   * Get current month actual cost from completed trips
   */
  private async getCurrentMonthCost(
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number> {
    // First try to get cost from completed trips in current month
    const tripCostResult = await this.tripRepository
      .createQueryBuilder('trip')
      .select('SUM(trip.cost)', 'totalCost')
      .where('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere('trip.updatedAt BETWEEN :monthStart AND :monthEnd', {
        monthStart,
        monthEnd,
      })
      .getRawOne();

    let tripCost = parseFloat(tripCostResult.totalCost) || 0;

    return tripCost;
  }

  /**
   * Get previous month actual cost from completed trips
   */
  private async getPreviousMonthCost(
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number> {
    // Try to get cost from completed trips in previous month
    const tripCostResult = await this.tripRepository
      .createQueryBuilder('trip')
      .select('SUM(trip.cost)', 'totalCost')
      .where('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere('trip.updatedAt BETWEEN :monthStart AND :monthEnd', {
        monthStart,
        monthEnd,
      })
      .getRawOne();

    let tripCost = parseFloat(tripCostResult.totalCost) || 0;

    return tripCost;
  }

  /**
   * Alternative method for calculating costs using a more robust approach
   */
  async getCostAnalysis(
    startDate: Date,
    endDate: Date,
  ): Promise<{ tripCost: number; odometerCost: number; totalCost: number }> {
    // Get cost from trip table
    const tripCostResult = await this.tripRepository
      .createQueryBuilder('trip')
      .select('SUM(trip.cost)', 'tripCost')
      .where('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere('trip.updatedAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getRawOne();

    const tripCost = parseFloat(tripCostResult.tripCost) || 0;

    // Get cost from odometer logs as fallback
    const odometerCostResult = await this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.odometerLog', 'odometerLog')
      .select('SUM(odometerLog.cost)', 'odometerCost')
      .where('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere('odometerLog.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getRawOne();

    const odometerCost = parseFloat(odometerCostResult.odometerCost) || 0;

    // Use whichever is available (prefer trip.cost, fallback to odometerLog.cost)
    const totalCost = tripCost > 0 ? tripCost : odometerCost;

    return {
      tripCost,
      odometerCost,
      totalCost,
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
