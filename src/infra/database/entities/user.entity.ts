
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';
import { Company } from './company.entity';
import { Department } from './department.entity';
import { Trip } from './trip.entity';
import { Feedback } from './feedback.entity';

export enum UserRole {
  SYSADMIN = 'sysadmin',
  EMPLOYEE = 'employee',
  DRIVER = 'driver',
  ADMIN = 'admin',
  HR = 'hr',
  SECURITY = 'security',
  SUPERVISOR = 'supervisor',
}

export enum Status {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, { nullable: true })
  company?: Company;

  @ManyToOne(() => Department, { nullable: true })
  department?: Department;

  @Column({ length: 100, unique: true })
  username: string;

  @Column({ length: 100 })
  displayname: string;

  @Column({ nullable: true })
  profilePicture?: string;

  @Index()
  @Column({ length: 100, unique: true, nullable:true })
  email?: string;

  @Column({ length: 20, nullable: true, unique:true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ nullable: true })
  passwordHash?: string;

  @Column({ default: 0 })
  authenticationLevel: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'enum', enum: Status, default: Status.PENDING })
  isApproved: Status;

  @Column({ nullable: true })
  fcmToken: string;

  @OneToMany(() => Trip, t => t.requester)
  trips: Trip[];

  @OneToMany(() => Feedback, f => f.submittedBy)
  feedbacks: Feedback[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
