
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { Trip } from './trip.entity';
import { OdometerLog } from './odometer-log.entity';

@Entity()
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.vehicles)
  company: Company;

  @Index()
  @Column({ length: 50, unique: true })
  regNo: string;

  @Column({ length: 100, nullable: true })
  model?: string;

  @Column({ length: 50, nullable: true })
  fuelType?: string;

  @Column({ type: 'int', default: 4 })
  seatingCapacity: number;

  @ManyToOne(() => User, { nullable: true })
  assignedDriver?: User;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  odometerLastReading: number;

  @Column({ length: 50, nullable: true })
  vehicleType?: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Trip, t => t.vehicle)
  trips: Trip[];

  @OneToMany(() => OdometerLog, o => o.vehicle)
  odometerLogs: OdometerLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
