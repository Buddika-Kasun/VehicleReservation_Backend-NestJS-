import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationPaginationDto } from './dto/notification-pagination.dto';
// Assumes JwtAuthGuard is available globally or needs import. 
// Since I haven't moved AuthModule yet, I'll use the relative path IF I can find it, or string for now if I use global guard.
// But specific guard import is better. 
// For now, I'll comment out the Guard import and usage until AuthModule is sorted, OR use the path I know.
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

import { ResponseService } from 'src/common/services/response.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly responseService: ResponseService,
  ) {}

  @Post()

  async create(@Body() createNotificationDto: CreateNotificationDto) {
    const notification = await this.notificationsService.create(createNotificationDto);
    return this.responseService.created('Notification created successfully', { notification });
  }

  @Get()

  async findAll(@Req() req, @Query() paginationDto: NotificationPaginationDto) {
    // Assuming req.user contains the authenticated user
    const result = await this.notificationsService.findAllForUser(req.user.id, paginationDto);
    return this.responseService.success('Notifications retrieved successfully', {
      notifications: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      }
    });
  }

  @Get('unread-count')

  async getUnreadCount(@Req() req) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return this.responseService.success('Unread count retrieved successfully', { count });
  }

  @Get(':id')

  async findOne(@Param('id') id: string, @Req() req) {
    const notification = await this.notificationsService.findOne(+id, req.user.id);
    return this.responseService.success('Notification retrieved successfully', { notification });
  }

  @Patch('read-all')

  async markAllAsRead(@Req() req) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return this.responseService.success('All notifications marked as read', null);
  }

  @Patch(':id/read')

  async markAsRead(@Param('id') id: string, @Req() req) {
    const notification = await this.notificationsService.markAsRead(+id, req.user.id);
    return this.responseService.success('Notification marked as read', { notification });
  }

  @Delete(':id')

  async remove(@Param('id') id: string, @Req() req) {
    await this.notificationsService.delete(+id, req.user.id);
    return this.responseService.success('Notification deleted successfully', null);
  }
}
