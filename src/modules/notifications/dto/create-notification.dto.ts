import { IsEnum, IsOptional, IsObject, IsUUID, IsString } from 'class-validator';
import { NotificationType, NotificationPriority } from '../types/notification-types.enum';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  expiresIn?: number; // seconds
}