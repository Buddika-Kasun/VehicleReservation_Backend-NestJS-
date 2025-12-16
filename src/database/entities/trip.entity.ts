import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, 
  CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany, JoinTable
} from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { Approval } from './approval.entity';
import { OdometerLog } from './odometer-log.entity';
import { Feedback } from './feedback.entity';
import { TripLocation } from './trip-location.entity';

export enum TripStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  READ = 'read',
  FINISHED = 'finished',
  REJECTED = 'rejected',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export enum RepetitionType {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export enum PassengerType {
  OWN = 'own',
  OTHER_INDIVIDUAL = 'other_individual',
  GROUP = 'group',
}

@Entity()
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.trips)
  requester: User;

  @ManyToOne(() => Vehicle, vehicle => vehicle.trips, { nullable: true })
  vehicle?: Vehicle;

  // Location information
  @OneToOne(() => TripLocation, location => location.trip, { cascade: true })
  @JoinColumn()
  location: TripLocation;

  // Schedule information
  @Column('date')
  startDate: Date;

  @Column('date', { nullable: true })
  validTillDate?: Date;

  @Column('time')
  startTime: string;

  @Column({ type: 'enum', enum: RepetitionType, default: RepetitionType.ONCE })
  repetition: RepetitionType;

  @Column({ default: false })
  includeWeekends: boolean;

  @Column({ type: 'int', nullable: true })
  repeatAfterDays?: number;

  // Passenger information
  @Column({ type: 'enum', enum: PassengerType, default: PassengerType.OWN })
  passengerType: PassengerType;

  @Column({ type: 'int', default: 1 })
  passengerCount: number;

  @Column({ type: 'int', nullable: true })
  endPassengerCount: number;

  @ManyToOne(() => User, { nullable: true })
  selectedIndividual?: User;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'trip_selected_group_users',
    joinColumn: { name: 'trip_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' }
  })
  selectedGroupUsers: User[];

  @Column('jsonb', { nullable: true })
  selectedOthers: Array<{
    id: string;
    displayName: string;
    contactNo: string;
  }>;

  @Column({ default: true })
  includeMeInGroup: boolean;

  // Trip details
  @Column({ length: 255, nullable: true })
  purpose?: string;

  @Column({ length: 255, nullable: true })
  specialRemarks?: string;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.DRAFT })
  status: TripStatus;

  // Cost and mileage
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  cost?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  mileage?: number;

  //@Column('decimal', { precision: 12, scale: 2, nullable: true })
  //startOdometer?: number;

  //@Column('decimal', { precision: 12, scale: 2, nullable: true })
  //endOdometer?: number;

  // Relations
  @OneToOne(() => Approval, approval => approval.trip, { 
    cascade: true,
    onDelete: 'CASCADE' 
  })
  @JoinColumn()
  approval?: Approval;

  @OneToOne(() => OdometerLog, odometerLog => odometerLog.trip, { cascade: true })
  @JoinColumn()
  odometerLog?: OdometerLog;

  @OneToOne(() => Feedback, feedback => feedback.trip, { cascade: true })
  @JoinColumn()
  feedback?: Feedback;

  @ManyToMany(() => Trip, trip => trip.linkedTrips, { nullable: true })
  @JoinTable({
    name: 'trip_conflicts',
    joinColumn: { name: 'trip_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'conflict_trip_id', referencedColumnName: 'id' }
  })
  conflictingTrips?: Trip[];

  @ManyToMany(() => Trip, trip => trip.conflictingTrips)
  linkedTrips?: Trip[];

  // NEW
  @Column({ default: false })
  isScheduled: boolean;

  @Column({ default: false })
  isInstance: boolean;

  @Column({ nullable: true })
  masterTripId?: number;

  @Column({ type: 'date', nullable: true })
  instanceDate?: Date;
  //

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}