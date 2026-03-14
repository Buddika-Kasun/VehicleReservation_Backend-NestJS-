// src/infra/database/entities/trip-timeline.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  OneToOne, 
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Trip } from './trip.entity';
import { User } from './user.entity';

@Entity('trip_timelines')
export class TripTimeline {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'trip_id' })
  tripId: number;

  // ============ CREATION ============
  @Column({ type: 'varchar', length: 30, name: 'created_at', nullable: true })
  createdAt: string; // Sri Lanka time as string

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById?: number;

  // ============ CANCELLATION ============
  @Column({ type: 'varchar', length: 30, name: 'cancelled_at', nullable: true })
  cancelledAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cancelled_by_id' })
  cancelledBy?: User;

  @Column({ name: 'cancelled_by_id', nullable: true })
  cancelledById?: number;

  // ============ VEHICLE ASSIGNMENT ============
  @Column({ type: 'varchar', length: 30, name: 'vehicle_assigned_at', nullable: true })
  vehicleAssignedAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'vehicle_assigned_by_id' })
  vehicleAssignedBy?: User;

  @Column({ name: 'vehicle_assigned_by_id', nullable: true })
  vehicleAssignedById?: number;

  @Column({ type: 'varchar', length: 30, name: 'vehicle_changed_at', nullable: true })
  vehicleChangedAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'vehicle_changed_by_id' })
  vehicleChangedBy?: User;

  @Column({ name: 'vehicle_changed_by_id', nullable: true })
  vehicleChangedById?: number;

  // ============ CONFIRMATION ============
  @Column({ type: 'varchar', length: 30, name: 'confirmed_at', nullable: true })
  confirmedAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by_id' })
  confirmedBy?: User;

  @Column({ name: 'confirmed_by_id', nullable: true })
  confirmedById?: number;

  // ============ APPROVALS ============
  @Column({ type: 'varchar', length: 30, name: 'approval1_at', nullable: true })
  approval1At?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approval1_by_id' })
  approval1By?: User;

  @Column({ name: 'approval1_by_id', nullable: true })
  approval1ById?: number;

  @Column({ type: 'varchar', length: 30, name: 'approval2_at', nullable: true })
  approval2At?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approval2_by_id' })
  approval2By?: User;

  @Column({ name: 'approval2_by_id', nullable: true })
  approval2ById?: number;

  @Column({ type: 'varchar', length: 30, name: 'safety_approval_at', nullable: true })
  safetyApprovalAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'safety_approval_by_id' })
  safetyApprovalBy?: User;

  @Column({ name: 'safety_approval_by_id', nullable: true })
  safetyApprovalById?: number;

  // ============ REJECTION ============
  @Column({ type: 'varchar', length: 30, name: 'rejected_at', nullable: true })
  rejectedAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rejected_by_id' })
  rejectedBy?: User;

  @Column({ name: 'rejected_by_id', nullable: true })
  rejectedById?: number;

  // ============ ODOMETER READINGS ============
  @Column({ type: 'varchar', length: 30, name: 'start_meter_reading_at', nullable: true })
  startMeterReadingAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'start_meter_reading_by_id' })
  startMeterReadingBy?: User;

  @Column({ name: 'start_meter_reading_by_id', nullable: true })
  startMeterReadingById?: number;

  @Column({ type: 'varchar', length: 30, name: 'end_meter_reading_at', nullable: true })
  endMeterReadingAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'end_meter_reading_by_id' })
  endMeterReadingBy?: User;

  @Column({ name: 'end_meter_reading_by_id', nullable: true })
  endMeterReadingById?: number;

  // ============ DRIVER TIMELINE ============
  @Column({ type: 'varchar', length: 30, name: 'driver_started_at', nullable: true })
  driverStartedAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'driver_started_by_id' })
  driverStartedBy?: User;

  @Column({ name: 'driver_started_by_id', nullable: true })
  driverStartedById?: number;

  @Column({ type: 'varchar', length: 30, name: 'driver_ended_at', nullable: true })
  driverEndedAt?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'driver_ended_by_id' })
  driverEndedBy?: User;

  @Column({ name: 'driver_ended_by_id', nullable: true })
  driverEndedById?: number;

  // ============ STATUS ============
  @Column({ type: 'varchar', length: 20, name: 'current_status' })
  currentStatus: string;

  @Column({ type: 'varchar', length: 30, name: 'trip_date_time' })
  tripDateTime: string; // Combined startDate + startTime as Sri Lanka time

  // ============ SYSTEM TIMESTAMPS ============
  @CreateDateColumn({ name: 'created_at_db' })
  createdAtDb: Date;

  @UpdateDateColumn({ name: 'updated_at_db' })
  updatedAtDb: Date;
}