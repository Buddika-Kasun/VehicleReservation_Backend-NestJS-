import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Status, User, UserRole } from 'src/infra/database/entities/user.entity';
import { Trip, TripStatus } from 'src/infra/database/entities/trip.entity';
import { DashboardResponseDto, AdminStatsDto, ManagerStatsDto, EmployeeStatsDto } from './dto/dashboard-response.dto';
import { CostCenter } from 'src/infra/database/entities/cost-center.entity';
import { AdminDashboardStatsDto } from './dto/admin-dashboard-stats.dto';
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { Department } from 'src/infra/database/entities/department.entity';
import * as moment from 'moment-timezone';

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
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>
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
  /*
  async getAdminDashboardStats(userId: number): Promise<AdminDashboardStatsDto> {
    // Get current date and calculate date ranges
    //const now = new Date();
    const now = moment().tz('Asia/Colombo').toDate();
    
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // First, get the user with their department details
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    const isSysAdmin = user.role === UserRole.SYSADMIN;
    const isAdmin = user.role === UserRole.ADMIN;
    
    let departmentId: number | undefined;
    let departmentName: string | undefined;

    // If user is admin (not sysadmin), get their department
    if (isAdmin && user.department) {
      departmentId = user.department.id;
      departmentName = user.department.name;
    }

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
      departmentsCount,
      activeDepartments,
    ] = await Promise.all([
      // 1. Total completed rides
      this.getTotalCompletedRides(departmentId),
      
      // 2. Pending rides for supervisor
      this.getPendingSupervisorRides(departmentId),
      
      // 3. Total approved users
      this.getTotalApprovedUsers(departmentId),
      
      // 4. Pending user creations
      this.getPendingUserCreations(departmentId),
      
      // 5. Today's rides
      this.getTodaysRides(todayStart, todayEnd, departmentId),
      
      // 6. Budget amount
      this.getBudgetAmount(departmentId),
      
      // 7. Current month actual cost
      this.getCurrentMonthCost(currentMonthStart, currentMonthEnd, departmentId),
      
      // 8. Previous month actual cost
      this.getPreviousMonthCost(previousMonthStart, previousMonthEnd, departmentId),
      
      // 9. Departments count (only for sysadmin)
      isSysAdmin ? this.getDepartmentsCount() : Promise.resolve(0),
      
      // 10. Active departments (only for sysadmin)
      isSysAdmin ? this.getActiveDepartments() : Promise.resolve(0),
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

    const response: AdminDashboardStatsDto = {
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

    // Add role-specific fields
    if (isSysAdmin) {
      // For sysadmin, show "All Departments" in title
      response.departmentsCount = departmentsCount;
      if (departmentsCount > 1) {
        response.dashboardTitle = `All ${departmentsCount} Departments`;
      } else {
        response.dashboardTitle = 'All Departments';
      }
      response.activeDepartments = activeDepartments;
    } else if (isAdmin && departmentName) {
      // For admin, show their department name in title
      response.dashboardTitle = departmentName;
      response.departmentId = departmentId;
      response.departmentName = departmentName;
    }

    return response;
  }
  */

  async getAdminDashboardStats(
  userId: number, 
  departmentId?: number
): Promise<AdminDashboardStatsDto> {
    // Get current date and calculate date ranges
    const now = moment().tz('Asia/Colombo').toDate();
    
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // Get user with their department details
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    const isSysAdmin = user.role === UserRole.SYSADMIN || user.role === UserRole.HR;
    const isAdmin = user.role === UserRole.ADMIN;
    
    let finalDepartmentId: number | undefined;
    let accessibleDepartmentIds: number[] = [];
    let departmentName: string | undefined;

    // Determine accessible departments
    if (departmentId) {
      // User requested a specific department
      finalDepartmentId = departmentId;
      
      // Get department name
      const department = await this.departmentRepository.findOne({
        where: { id: departmentId },
        select: ['id', 'name']
      });
      departmentName = department?.name;
    } else {
      // No specific department requested - get all accessible departments
      if (isSysAdmin) {
        // Sysadmin/HR can access all departments
        // We'll get all active departments
        const allDepartments = await this.departmentRepository.find({
          where: { isActive: true },
          select: ['id', 'name']
        });
        accessibleDepartmentIds = allDepartments.map(dept => dept.id);
      } else {
        // For other roles, get departments where they are head OR belong to
        const accessibleDepartments = await this.departmentRepository
          .createQueryBuilder('department')
          .leftJoin('department.head', 'head')
          .select(['department.id', 'department.name'])
          .where(new Brackets(qb => {
            qb.where('head.id = :userId', { userId: user.id }) // User is head
              .orWhere('department.id = :userDepartmentId', { 
                userDepartmentId: user.department?.id || 0 
              }); // User belongs to
          }))
          .andWhere('department.isActive = :isActive', { isActive: true })
          .getMany();
        
        accessibleDepartmentIds = accessibleDepartments.map(dept => dept.id);
        
        // If only one accessible department, use it as the default
        if (accessibleDepartmentIds.length === 1) {
          finalDepartmentId = accessibleDepartmentIds[0];
          departmentName = accessibleDepartments[0].name;
        }
        // If multiple departments, we'll use the array (no single department filter)
      }
    }

    // Execute all queries in parallel
    const [
      totalRides,
      pendingSupervisorRides,
      totalUsers,
      pendingUserCreations,
      ridesToday,
      budgetAmount,
      currentMonthCost,
      previousMonthCost,
      departmentsCount,
      activeDepartments,
    ] = await Promise.all([
      // Pass either single department ID or array of accessible departments
      this.getTotalCompletedRides(finalDepartmentId, accessibleDepartmentIds),
      
      this.getPendingSupervisorRides(finalDepartmentId, accessibleDepartmentIds),
      
      this.getTotalApprovedUsers(finalDepartmentId, accessibleDepartmentIds, user.role),
      
      this.getPendingUserCreations(finalDepartmentId, accessibleDepartmentIds),
      
      this.getTodaysRides(todayStart, todayEnd, finalDepartmentId, accessibleDepartmentIds),
      
      this.getBudgetAmount(finalDepartmentId, accessibleDepartmentIds),
      
      this.getCurrentMonthCost(currentMonthStart, currentMonthEnd, finalDepartmentId, accessibleDepartmentIds),
      
      this.getPreviousMonthCost(previousMonthStart, previousMonthEnd, finalDepartmentId, accessibleDepartmentIds),
      
      // Departments count logic
      (isSysAdmin && !finalDepartmentId && accessibleDepartmentIds.length === 0) 
        ? this.getDepartmentsCount() 
        : Promise.resolve(accessibleDepartmentIds.length || 0),
      
      // Active departments logic
      (isSysAdmin && !finalDepartmentId && accessibleDepartmentIds.length === 0) 
        ? this.getActiveDepartments() 
        : Promise.resolve(accessibleDepartmentIds.length || 0),
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

    const response: AdminDashboardStatsDto = {
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

    // Determine dashboard title and add metadata
    if (finalDepartmentId && departmentName) {
      // Showing specific department
      response.dashboardTitle = "Filtered department";
      response.departmentId = finalDepartmentId;
      response.departmentName = departmentName;
      response.departmentsCount = 1;
    } else if (accessibleDepartmentIds.length > 0) {
      // Showing multiple departments
      response.dashboardTitle = `All ${accessibleDepartmentIds.length} Departments`;
      response.departmentsCount = accessibleDepartmentIds.length;
      //response.accessibleDepartmentsCount = accessibleDepartmentIds.length;
      
      // If admin has a primary department, show it as "primary"
      if (user.department && accessibleDepartmentIds.includes(user.department.id)) {
        //response.primaryDepartmentId = user.department.id;
        //response.primaryDepartmentName = user.department.name;
      }
    } else if (isSysAdmin && !finalDepartmentId) {
      // Sysadmin viewing all departments (no filters)
      response.dashboardTitle = departmentsCount > 1 
        ? `All ${departmentsCount} Departments` 
        : 'All Departments';
      response.departmentsCount = departmentsCount;
      response.activeDepartments = activeDepartments;
    } else {
      response.dashboardTitle = 'Dashboard';
    }

    // If user is head of any departments, add that info
    if (!isSysAdmin && !finalDepartmentId) {
      const headDepartments = await this.departmentRepository.find({
        where: { head: { id: user.id }, isActive: true },
        select: ['id', 'name']
      });
      
      if (headDepartments.length > 0) {
        //response.headDepartmentsCount = headDepartments.length;
        //response.isDepartmentHead = true;
      }
    }

    return response;
  }

  /**
 * Get total completed rides (status = COMPLETED) with department filter
 */
private async getTotalCompletedRides(
  departmentId?: number, 
  departmentsArray?: number[]
): Promise<number> {
  const query = this.tripRepository
    .createQueryBuilder('trip')
    .leftJoin('trip.requester', 'requester')
    .leftJoin('requester.department', 'department')
    .where('trip.status = :status', { status: TripStatus.COMPLETED });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  } else {
    // No department filter applied - will count all completed trips
  }

  const result = await query.getCount();
  return result;
}

/**
 * Get pending rides for supervisor (status = DRAFT) with department filter
 */
private async getPendingSupervisorRides(
  departmentId?: number,
  departmentsArray?: number[]
): Promise<number> {
  const query = this.tripRepository
    .createQueryBuilder('trip')
    .leftJoin('trip.requester', 'requester')
    .leftJoin('requester.department', 'department')
    .where('trip.status = :status', { status: TripStatus.DRAFT });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  }

  const result = await query.getCount();
  return result;
}

/**
 * Get total approved users (isApproved = APPROVED) with department filter
 */
private async getTotalApprovedUsers(
  departmentId?: number,
  departmentsArray?: number[],
  userRole?: UserRole
): Promise<number> {
  const query = this.userRepository
    .createQueryBuilder('user')
    .leftJoin('user.department', 'department')
    .where('user.isApproved = :status', { status: Status.APPROVED })
    .andWhere('user.isActive = :isActive', { isActive: true });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  }

  // For sysadmin viewing all departments (no filter), exclude sysadmin users from count
  if (!departmentId && !departmentsArray && userRole === UserRole.SYSADMIN) {
    query.andWhere('user.role NOT IN (:...excludedRoles)', {
      excludedRoles: [UserRole.SYSADMIN, UserRole.HR]
    });
  } else {
    // For filtered views, exclude SYSADMIN and HR from counts as they are not department-based
    query.andWhere('user.role NOT IN (:...excludedRoles)', {
      excludedRoles: [UserRole.SYSADMIN, UserRole.HR]
    });
  }

  const result = await query.getCount();
  return result;
}

/**
 * Get pending user creations (isApproved = PENDING) with department filter
 */
private async getPendingUserCreations(
  departmentId?: number,
  departmentsArray?: number[]
): Promise<number> {
  const query = this.userRepository
    .createQueryBuilder('user')
    .leftJoin('user.department', 'department')
    .where('user.isApproved = :status', { status: Status.PENDING });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  }

  const result = await query.getCount();
  return result;
}

/**
 * Get today's approved trips with department filter
 */
private async getTodaysRides(
  todayStart: Date,
  todayEnd: Date,
  departmentId?: number,
  departmentsArray?: number[]
): Promise<number> {
  const query = this.tripRepository
    .createQueryBuilder('trip')
    .leftJoin('trip.requester', 'requester')
    .leftJoin('requester.department', 'department')
    .where('trip.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [TripStatus.DRAFT, TripStatus.REJECTED, TripStatus.CANCELED]
    })
    .andWhere('trip.startDate BETWEEN :todayStart AND :todayEnd', {
      todayStart,
      todayEnd,
    });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  }

  const result = await query.getCount();
  return result;
}

/**
 * Get budget amount with department filter
 */
private async getBudgetAmount(
  departmentId?: number,
  departmentsArray?: number[]
): Promise<number> {
  if (departmentId) {
    // Single department: get budget from cost center linked to specific department
    const result = await this.costCenterRepository
      .createQueryBuilder('costCenter')
      .leftJoin('costCenter.departments', 'department')
      .select('COALESCE(SUM(costCenter.budget), 0)', 'budget')
      .where('department.id = :departmentId', { departmentId })
      .andWhere('costCenter.isActive = :isActive', { isActive: true })
      .getRawOne();

    return parseFloat(result?.budget) || 0;
  } else if (departmentsArray && departmentsArray.length > 0) {
    // Multiple departments: sum budgets for all specified departments
    const result = await this.costCenterRepository
      .createQueryBuilder('costCenter')
      .leftJoin('costCenter.departments', 'department')
      .select('COALESCE(SUM(DISTINCT costCenter.budget), 0)', 'totalBudget')
      .where('department.id IN (:...departmentIds)', { departmentIds: departmentsArray })
      .andWhere('costCenter.isActive = :isActive', { isActive: true })
      .getRawOne();

    return parseFloat(result?.totalBudget) || 0;
  } else {
    // No filter: get total budget from all active cost centers
    const result = await this.costCenterRepository
      .createQueryBuilder('costCenter')
      .select('COALESCE(SUM(costCenter.budget), 0)', 'totalBudget')
      .where('costCenter.isActive = :isActive', { isActive: true })
      .getRawOne();

    return parseFloat(result?.totalBudget) || 0;
  }
}

/**
 * Get current month actual cost from completed trips with department filter
 */
private async getCurrentMonthCost(
  monthStart: Date,
  monthEnd: Date,
  departmentId?: number,
  departmentsArray?: number[]
): Promise<number> {
  const query = this.tripRepository
    .createQueryBuilder('trip')
    .leftJoin('trip.requester', 'requester')
    .leftJoin('requester.department', 'department')
    .select('COALESCE(SUM(trip.cost), 0)', 'totalCost')
    .where('trip.status = :status', { status: TripStatus.COMPLETED })
    .andWhere('trip.updatedAt BETWEEN :monthStart AND :monthEnd', {
      monthStart,
      monthEnd,
    });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  }

  const result = await query.getRawOne();
  return parseFloat(result?.totalCost) || 0;
}

/**
 * Get previous month actual cost from completed trips with department filter
 */
private async getPreviousMonthCost(
  monthStart: Date,
  monthEnd: Date,
  departmentId?: number,
  departmentsArray?: number[]
): Promise<number> {
  const query = this.tripRepository
    .createQueryBuilder('trip')
    .leftJoin('trip.requester', 'requester')
    .leftJoin('requester.department', 'department')
    .select('COALESCE(SUM(trip.cost), 0)', 'totalCost')
    .where('trip.status = :status', { status: TripStatus.COMPLETED })
    .andWhere('trip.updatedAt BETWEEN :monthStart AND :monthEnd', {
      monthStart,
      monthEnd,
    });

  if (departmentId) {
    query.andWhere('department.id = :departmentId', { departmentId });
  } else if (departmentsArray && departmentsArray.length > 0) {
    query.andWhere('department.id IN (:...departmentIds)', { departmentIds: departmentsArray });
  }

  const result = await query.getRawOne();
  return parseFloat(result?.totalCost) || 0;
}

/**
 * Get total number of departments (sysadmin only)
 */
private async getDepartmentsCount(): Promise<number> {
  const result = await this.departmentRepository
    .createQueryBuilder('department')
    .select('COUNT(department.id)', 'count')
    .where('department.isActive = :isActive', { isActive: true })
    .getRawOne();

  return parseInt(result?.count) || 0;
}

/**
 * Get number of active departments (sysadmin only)
 */
private async getActiveDepartments(): Promise<number> {
  // Assuming a department is active if it has at least one active user
  const result = await this.userRepository
    .createQueryBuilder('user')
    .leftJoin('user.department', 'department')
    .select('COUNT(DISTINCT department.id)', 'count')
    .where('user.isActive = :isActive', { isActive: true })
    .andWhere('user.isApproved = :approved', { approved: Status.APPROVED })
    .andWhere('department.id IS NOT NULL')
    .andWhere('department.isActive = :deptActive', { deptActive: true })
    .andWhere('user.role NOT IN (:...excludedRoles)', {
      excludedRoles: [UserRole.SYSADMIN, UserRole.HR]
    })
    .getRawOne();

  return parseInt(result?.count) || 0;
}

/**
 * Get departments where user is head or belongs to
 */
private async getAccessibleDepartments(userId: number, userDepartmentId?: number): Promise<Department[]> {
  const query = this.departmentRepository
    .createQueryBuilder('department')
    .leftJoin('department.head', 'head')
    .select(['department.id', 'department.name'])
    .where('department.isActive = :isActive', { isActive: true });

  // User is head OR belongs to department
  const conditions = [];
  const parameters: any = { isActive: true };

  // User is head of department
  conditions.push('head.id = :userId');
  parameters.userId = userId;

  // User belongs to department (if they have a department)
  if (userDepartmentId) {
    conditions.push('department.id = :userDepartmentId');
    parameters.userDepartmentId = userDepartmentId;
  }

  if (conditions.length > 0) {
    query.andWhere(new Brackets(qb => {
      qb.where(conditions.join(' OR '));
    }));
    query.setParameters(parameters);
  }

  return await query.getMany();
}

/**
 * Get all active departments (for sysadmin/HR)
 */
private async getAllActiveDepartments(): Promise<Department[]> {
  return await this.departmentRepository.find({
    where: { isActive: true },
    select: ['id', 'name'],
    order: { name: 'ASC' }
  });
}

/**
 * Get cost centers for departments (for budget calculation)
 */
private async getCostCentersForDepartments(departmentIds: number[]): Promise<CostCenter[]> {
  if (departmentIds.length === 0) {
    return [];
  }

  return await this.costCenterRepository
    .createQueryBuilder('costCenter')
    .leftJoinAndSelect('costCenter.departments', 'department')
    .where('department.id IN (:...departmentIds)', { departmentIds })
    .andWhere('costCenter.isActive = :isActive', { isActive: true })
    .getMany();
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