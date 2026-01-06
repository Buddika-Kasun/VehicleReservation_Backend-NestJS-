import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Trip } from './trip.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum RepetitionType {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Primary key', example: 1 })
  id: number;

  // One-to-one relationship with Trip
  @OneToOne(() => Trip, trip => trip.schedule, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'trip_id' })
  trip?: Trip;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  validTillDate?: Date;

  @Column({ type: 'time' })
  startTime: string;

  @Column({
    type: 'enum',
    enum: RepetitionType,
    default: RepetitionType.ONCE
  })
  repetition: RepetitionType;

  @Column({ default: false })
  includeWeekends: boolean = false;

  @Column({ type: 'int', nullable: true })
  repeatAfterDays?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}