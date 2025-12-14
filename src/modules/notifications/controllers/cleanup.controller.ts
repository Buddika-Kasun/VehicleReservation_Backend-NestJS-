import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationCleanupService } from '../services/notification-cleanup.service';
import { CleanupNotificationsDto } from '../dto/cleanup-notifications.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/database/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('notifications-cleanup')
@Controller('notifications/cleanup')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CleanupController {
  constructor(
    private readonly cleanupService: NotificationCleanupService,
  ) {}

  @Post('manual')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Manually trigger notifications cleanup' })
  async manualCleanup(@Body() dto: CleanupNotificationsDto) {
    const options: any = {};
    
    if (dto.expireBefore) {
      options.expireBefore = new Date(dto.expireBefore);
    }
    if (dto.archiveBefore) {
      options.archiveBefore = new Date(dto.archiveBefore);
    }
    if (dto.deleteReadBefore) {
      options.deleteReadBefore = new Date(dto.deleteReadBefore);
    }

    return await this.cleanupService.manualCleanup(options);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get notifications cleanup statistics' })
  async getStats() {
    return await this.cleanupService.getCleanupStats();
  }

  @Post('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Cleanup notifications for a specific user' })
  async cleanupUser(
    @Param('userId') userId: string,
    @Body() body: { keepLast?: number; deleteRead?: boolean },
  ) {
    return await this.cleanupService.cleanupUserNotifications(userId, body);
  }
}