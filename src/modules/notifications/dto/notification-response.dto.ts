export class NotificationResponseDto {
  id: string;
  type: string;
  priority: string;
  data: Record<string, any>;
  userId?: string;
  createdById?: string;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}