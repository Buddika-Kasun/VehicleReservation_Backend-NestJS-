import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { MarkAsReadDto } from '../dto/mark-as-read.dto';
import { NotificationsService } from '../services/notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User, UserRole } from 'src/database/entities/user.entity';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  async getUserNotifications(
    @GetUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('unreadOnly') unreadOnly?: boolean,
  ) {
    const userId = user.id.toString();
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.notificationsService.getNotifications(
      userId,
      skip,
      limit,
      type,
      unreadOnly,
    );

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount: await this.notificationsService.getUnreadCount(userId),
      },
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiResponse({ status: 200 })
  async getUnreadCount(@GetUser() user: User) {
    const userId = user.id.toString().toString();
    return {
      count: await this.notificationsService.getUnreadCount(userId),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  async getNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    const userId = user.id.toString();
    return await this.notificationsService.getNotificationById(id, userId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Create a notification (Admin only)' })
  @ApiResponse({ status: 201, type: NotificationResponseDto })
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationsService.createAndNotify(createNotificationDto);
  }

  @Post('broadcast')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Broadcast notification to all users (Admin only)' })
  async broadcastNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationsService.broadcastNotification(createNotificationDto);
  }

  @Put('mark-as-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200 })
  async markAsRead(@Body() markAsReadDto: MarkAsReadDto, @GetUser() user: User) {
    const userId = user.id.toString();
    await this.notificationsService.markAsRead(
      markAsReadDto.notificationId,
      userId,
    );
    return { message: 'Notification marked as read' };
  }

  @Put('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200 })
  async markAllAsRead(@GetUser() user: User) {
    const userId = user.id.toString();
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark specific notification as read' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  async markNotificationAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    const userId = user.id.toString();
    await this.notificationsService.markAsRead(id, userId);
    return { message: 'Notification marked as read' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    const userId = user.id.toString();
    await this.notificationsService.deleteNotification(id, userId);
    return { message: 'Notification deleted successfully' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all notifications' })
  @ApiResponse({ status: 200 })
  async deleteAllNotifications(@GetUser() user: User) {
    const userId = user.id.toString();
    const result = await this.notificationsService.deleteAllUserNotifications(userId);
    return { 
      message: 'All notifications deleted successfully',
      deletedCount: result.deleted 
    };
  }

  @Get('stats/daily')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get daily notification statistics (Admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getDailyStats(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return await this.notificationsService.getDailyStats(days);
  }

  @Get('types/count')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get notification count by type (Admin only)' })
  async getNotificationCountByType() {
    return await this.notificationsService.getNotificationCountByType();
  }
}