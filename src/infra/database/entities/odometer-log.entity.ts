import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, CreateDateColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { Trip } from './trip.entity';
import { User } from './user.entity';

@Entity()
export class OdometerLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, v => v.odometerLogs)
  vehicle: Vehicle;

  @ManyToOne(() => Trip, { nullable: true })
  trip?: Trip;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  startReading?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  endReading?: number;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => User, { nullable: true })
  startRecordedBy?: User;  // Changed from recordedBy

  @ManyToOne(() => User, { nullable: true })
  endRecordedBy?: User;   // New field

  @CreateDateColumn()
  startRecordedAt?: Date; // New field

  @CreateDateColumn()
  endRecordedAt?: Date;   // New field
}