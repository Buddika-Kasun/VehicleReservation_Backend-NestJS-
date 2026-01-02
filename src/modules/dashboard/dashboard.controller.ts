import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AdminDashboardStatsDto } from './dto/admin-dashboard-stats.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get role-based dashboard statistics' })
  @ApiResponse({ status: 200, type: DashboardResponseDto })
  async getStats(@GetUser() user: any): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboardData(user);
  }

  @Get('admin/stats')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN, UserRole.HR)
  @ApiOperation({ 
    summary: 'Get admin dashboard statistics',
    description: 'Returns comprehensive statistics for admin dashboard including rides, users, and budget information'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard statistics retrieved successfully', 
    type: AdminDashboardStatsDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - insufficient permissions' 
  })
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return await this.dashboardService.getAdminDashboardStats();
  }

}
