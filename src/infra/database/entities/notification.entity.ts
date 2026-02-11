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
  TRIP_CREATED_AS_DRAFT = 'TRIP_CREATED_AS_DRAFT',
  TRIP_CONFIRMED = 'TRIP_CONFIRMED',
  TRIP_CONFIRMED_FOR_APPROVAL = 'TRIP_CONFIRMED_FOR_APPROVAL',
  TRIP_UPDATED = 'TRIP_UPDATED',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  TRIP_COMPLETED_FOR_REQUESTER = 'TRIP_COMPLETED_FOR_REQUESTER',
  TRIP_COMPLETED_FOR_DRIVER = 'TRIP_COMPLETED_FOR_DRIVER',
  TRIP_COMPLETED_FOR_SUPERVISOR = 'TRIP_COMPLETED_FOR_SUPERVISOR',
  TRIP_APPROVED = 'TRIP_APPROVED',
  TRIP_APPROVED_BY_APPROVER = 'TRIP_APPROVED_BY_APPROVER',
  TRIP_APPROVED_FOR_DRIVER = 'TRIP_APPROVED_FOR_DRIVER',
  TRIP_APPROVED_FOR_SECURITY = 'TRIP_APPROVED_FOR_SECURITY',
  TRIP_REJECTED = 'TRIP_REJECTED',
  TRIP_REJECTED_BY_APPROVER = 'TRIP_REJECTED_BY_APPROVER',
  TRIP_CANCELLED = 'TRIP_CANCELLED',
  TRIP_CANCELLED_REQUESTER = 'TRIP_CANCELLED_REQUESTER',
  TRIP_CANCELLED_SUPERVISOR = 'TRIP_CANCELLED_SUPERVISOR',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_STARTED_FOR_PASSENGER = 'TRIP_STARTED_FOR_PASSENGER',
  TRIP_STARTED_FOR_SUPERVISOR = 'TRIP_STARTED_FOR_SUPERVISOR',
  TRIP_FINISHED = 'TRIP_FINISHED',
  TRIP_FINISHED_FOR_REQUESTER = 'TRIP_FINISHED_FOR_REQUESTER',
  TRIP_FINISHED_FOR_SUPERVISOR = 'TRIP_FINISHED_FOR_SUPERVISOR',
  TRIP_FINISHED_FOR_SECURITY = 'TRIP_FINISHED_FOR_SECURITY',
  TRIP_READING_START = 'TRIP_READING_START',
  TRIP_READING_START_FOR_DRIVER = 'TRIP_READING_START_FOR_DRIVER',
  TRIP_READING_START_FOR_PASSENGER = 'TRIP_READING_START_FOR_PASSENGER',
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