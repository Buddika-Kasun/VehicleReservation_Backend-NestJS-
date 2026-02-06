import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_APPROVED = 'USER_APPROVED',
  USER_REJECTED = 'USER_REJECTED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_AUTH_LEVEL_CHANGED = 'USER_AUTH_LEVEL_CHANGED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  TRIP_CREATED = 'TRIP_CREATED',
  TRIP_CONFIRMED = 'TRIP_CONFIRMED',
  TRIP_UPDATED = 'TRIP_UPDATED',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  TRIP_APPROVED = 'TRIP_APPROVED',
  TRIP_REJECTED = 'TRIP_REJECTED',
  TRIP_CANCELLED = 'TRIP_CANCELLED',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_FINISHED = 'TRIP_FINISHED',
  TRIP_READING_START = 'TRIP_READING_START',
  TRIP_READING_END = 'TRIP_READING_END',
  TRIP_APPROVAL_NEEDED = 'TRIP_APPROVAL_NEEDED',
  ASSIGNMENT_CREATED = 'ASSIGNMENT_CREATED',
  ASSIGNMENT_UPDATED = 'ASSIGNMENT_UPDATED',
  VEHICLE_ASSIGNED = 'VEHICLE_ASSIGNED',
  VEHICLE_UNASSIGNED = 'VEHICLE_UNASSIGNED',
  VEHICLE_UPDATED = 'VEHICLE_UPDATED',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('notifications')
@Index('IDX_notifications_userId', ['userId'])
@Index('IDX_notifications_isActive', ['isActive'])
@Index('IDX_notifications_createdAt', ['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Column('jsonb')
  data: any;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  createdById: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;
}