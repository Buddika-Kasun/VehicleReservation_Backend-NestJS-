import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  OneToOne, 
  ManyToOne, 
  CreateDateColumn, 
  UpdateDateColumn,
  JoinColumn 
} from 'typeorm';
import { Trip } from './trip.entity';
import { User } from './user.entity';

export enum ExceedStatusApproval {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELED = 'canceled',
}

@Entity()
export class ExceedApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Trip, t => t.approval, { onDelete: 'CASCADE' })
  @JoinColumn()
  trip: Trip;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_id' })
  approver?: User;


  @Column({ type: 'timestamp', nullable: true })
  approverApprovedAt?: Date;

  @Column({ length: 255, nullable: true })
  approverComments?: string;

  // Overall approval status
  @Column({ 
    type: 'enum', 
    enum: ExceedStatusApproval, 
    default: ExceedStatusApproval.PENDING 
  })
  Status: ExceedStatusApproval;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}