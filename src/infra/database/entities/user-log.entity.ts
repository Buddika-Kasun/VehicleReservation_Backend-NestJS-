import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@Entity('user_activity_logs')
export class UserActivityLog {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName: string;

  @Column({ type: 'varchar', length: 50 })
  platform: string; // e.g., 'android', 'ios', 'web'

  @Column({ type: 'varchar', length: 50 })
  appVersion: string; // e.g., '1.0.0'

  @Column({ type: 'boolean', default: false })
  isLogin: boolean; // true for login, false for access/track

  @Column({ type: 'timestamp', nullable: true })
  lastAccess: string; // Last access time

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: string; // Last login time

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// DTO for the API request
export class TrackUserActivityDto {
  @IsString()
  @IsNotEmpty()
  deviceName: string;

  @IsString()
  @IsNotEmpty()
  platform: string;

  @IsString()
  @IsNotEmpty()
  appVersion: string;

  @IsDateString()
  @IsNotEmpty()
  dateTime: string; // Use string for ISO date

  @IsBoolean()
  @IsOptional()
  isLogin?: boolean;
}
