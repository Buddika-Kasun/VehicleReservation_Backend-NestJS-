// src/modules/notifications/entities/notification.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { NotificationType, NotificationPriority } from '../types/notification-types.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: string;

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
  data: Record<string, any>;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  userId?: string; // Target user

  @Column({ type: 'varchar', nullable: true })
  createdById?: string; // Who triggered it

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  expiresAt?: Date;

  @Index()
  @Column({ default: true })
  isActive: boolean;
}