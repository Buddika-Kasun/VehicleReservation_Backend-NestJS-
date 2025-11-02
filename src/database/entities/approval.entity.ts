
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Trip } from './trip.entity';
import { User } from './user.entity';

export enum StatusApproval {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity()
export class Approval {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Trip, t => t.approval)
  trip: Trip;

  @ManyToOne(() => User, { nullable: true })
  approver1?: User;

  @ManyToOne(() => User, { nullable: true })
  approver2?: User;

  @ManyToOne(() => User, { nullable: true })
  safetyApprover?: User;

  @Column({ type: 'enum', enum: StatusApproval, default: StatusApproval.PENDING })
  statusApproval: StatusApproval;

  @Column({ length: 255, nullable: true })
  comments?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
