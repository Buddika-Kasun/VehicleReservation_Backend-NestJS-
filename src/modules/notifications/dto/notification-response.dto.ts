import { Expose } from 'class-transformer';
import { NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';

export class NotificationResponseDto {
  @Expose()
  id: number;

  @Expose()
  type: NotificationType;

  @Expose()
  priority: NotificationPriority;

  @Expose()
  data: any;

  @Expose()
  metadata: any;

  @Expose()
  userId: string;

  @Expose()
  createdById: string;

  @Expose()
  organizationId: string;

  @Expose()
  read: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  expiresAt: Date;

  @Expose()
  isActive: boolean;
}