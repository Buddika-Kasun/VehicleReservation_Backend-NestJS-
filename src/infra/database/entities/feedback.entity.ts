
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Trip } from './trip.entity';
import { User } from './user.entity';

@Entity()
export class Feedback {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Trip, t => t.feedback)
  trip: Trip;

  @Column({ type: 'int' })
  rating: number; // 1-5

  @Column({ length: 255, nullable: true })
  comments?: string;

  @ManyToOne(() => User, u => u.feedbacks)
  submittedBy: User;

  @CreateDateColumn()
  submittedAt: Date;
}
