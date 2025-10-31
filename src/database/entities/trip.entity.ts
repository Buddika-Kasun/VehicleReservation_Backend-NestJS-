
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany
} from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { Approval } from './approval.entity';
import { OdometerLog } from './odometer-log.entity';
import { Feedback } from './feedback.entity';

export enum TripStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

@Entity()
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, u => u.trips)
  requester: User;

  @ManyToOne(() => Vehicle, v => v.trips, { nullable: true })
  vehicle?: Vehicle;

  @Column({ length: 150 })
  origin: string;

  @Column({ length: 150 })
  destination: string;

  @Column('date')
  startDate: Date;

  @Column('date', { nullable: true })
  endDate?: Date;

  @Column('time')
  startTime: string;

  @Column('time', { nullable: true })
  endTime?: string;

  @Column({ length: 255, nullable: true })
  purpose?: string;

  @Column({ type: 'int', default: 1 })
  passengers: number;

  @Column({ length: 255, nullable: true })
  specialRemarks?: string;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.DRAFT })
  status: TripStatus;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  cost?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  mileage?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  startOdometer?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  endOdometer?: number;

  @OneToOne(() => Approval, approval => approval.trip, { cascade: true })
  @JoinColumn()
  approval?: Approval;

  @OneToOne(() => OdometerLog, o => o.trip, { cascade: true })
  @JoinColumn()
  odometerLog?: OdometerLog;

  @OneToOne(() => Feedback, f => f.trip, { cascade: true })
  @JoinColumn()
  feedback?: Feedback;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
