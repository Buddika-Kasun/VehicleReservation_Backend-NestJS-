// src/infra/database/entities/checklist.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { ChecklistItem } from './checklist-item.entity';

export enum ChecklistStatus {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('checklists')
export class Checklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => Vehicle, (vehicle) => vehicle.checklists, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'vehicle_reg_no', length: 50 })
  vehicleRegNo: string;

  @Index()
  @Column({ type: 'date' })
  checklistDate: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'checked_by_id' })
  checkedBy: User;

  @Column({ default: false })
  isSubmitted: boolean;

  @Column({ type: 'enum', enum: ChecklistStatus, default: ChecklistStatus.SUBMITTED })
  status: ChecklistStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @OneToMany(() => ChecklistItem, (item) => item.checklist, {
    cascade: true,
    eager: true,
  })
  items: ChecklistItem[];

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}