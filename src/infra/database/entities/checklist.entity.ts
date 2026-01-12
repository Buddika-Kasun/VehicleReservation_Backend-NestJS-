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

  @OneToMany(() => ChecklistItem, (item) => item.checklist, {
    cascade: true,
    eager: true,
  })
  items: ChecklistItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}