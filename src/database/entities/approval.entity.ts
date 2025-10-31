
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, CreateDateColumn } from 'typeorm';
import { Trip } from './trip.entity';
import { User } from './user.entity';

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

  @Column({ length: 50, default: 'pending' })
  status: string; // 'pending' | 'approved' | 'rejected'

  @Column({ length: 255, nullable: true })
  comments?: string;

  @CreateDateColumn()
  decidedAt: Date;
}
