import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsObject()
  data: any;

  @IsObject()
  @IsOptional()
  metadata?: any;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  createdById?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsOptional()
  expiresAt?: Date;
}