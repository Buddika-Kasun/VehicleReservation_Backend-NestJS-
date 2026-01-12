// src/infra/database/entities/checklist-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Checklist } from './checklist.entity';

@Entity('checklist_items')
@Index(['checklist', 'itemName'], { unique: true })
export class ChecklistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Checklist, (checklist) => checklist.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

  @Column({ name: 'item_name', length: 200 })
  itemName: string;

  @Column({ length: 10, nullable: true })
  status: string; // 'good' or 'bad'

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}