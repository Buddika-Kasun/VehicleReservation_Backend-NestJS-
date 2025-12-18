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

export enum StatusApproval {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ApproverType {
  HOD = 'hod',           // Department Head
  SECONDARY = 'secondary', // Distance/Limit approver
  SAFETY = 'safety',     // Safety approver
  COMPLETED = 'completed' // Approval process completed
}

@Entity()
export class Approval {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Trip, t => t.approval, { onDelete: 'CASCADE' })
  @JoinColumn()
  trip: Trip;

  // Main department HOD approver
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver1_id' })
  approver1?: User;

  @Column({ 
    type: 'enum', 
    enum: StatusApproval, 
    default: StatusApproval.PENDING,
    nullable: true 
  })
  approver1Status?: StatusApproval;

  @Column({ type: 'timestamp', nullable: true })
  approver1ApprovedAt?: Date;

  @Column({ length: 255, nullable: true })
  approver1Comments?: string;

  // Secondary approver (distance/limit checker)
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver2_id' })
  approver2?: User;

  @Column({ 
    type: 'enum', 
    enum: StatusApproval, 
    default: StatusApproval.PENDING,
    nullable: true 
  })
  approver2Status?: StatusApproval;

  @Column({ type: 'timestamp', nullable: true })
  approver2ApprovedAt?: Date;

  @Column({ length: 255, nullable: true })
  approver2Comments?: string;

  // Safety approver
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'safety_approver_id' })
  safetyApprover?: User;

  @Column({ 
    type: 'enum', 
    enum: StatusApproval, 
    default: StatusApproval.PENDING,
    nullable: true 
  })
  safetyApproverStatus?: StatusApproval;

  @Column({ type: 'timestamp', nullable: true })
  safetyApproverApprovedAt?: Date;

  @Column({ length: 255, nullable: true })
  safetyApproverComments?: string;

  // Overall approval status
  @Column({ 
    type: 'enum', 
    enum: StatusApproval, 
    default: StatusApproval.PENDING 
  })
  overallStatus: StatusApproval;

  // Current step in approval workflow
  @Column({ 
    type: 'enum', 
    enum: ApproverType, 
    default: ApproverType.HOD 
  })
  currentStep: ApproverType;

  // Track which approvers are required for this trip
  @Column({ default: true })
  requireApprover1: boolean;

  @Column({ default: false })
  requireApprover2: boolean;

  @Column({ default: false })
  requireSafetyApprover: boolean;

  // General comments from any approver
  @Column({ type: 'text', nullable: true })
  comments?: string;

  // Rejection reason if overall status is REJECTED
  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isFullyApproved(): boolean {
    return this.overallStatus === StatusApproval.APPROVED;
  }

  isPending(): boolean {
    return this.overallStatus === StatusApproval.PENDING;
  }

  isRejected(): boolean {
    return this.overallStatus === StatusApproval.REJECTED;
  }

  // Check if all required approvers have approved
  areAllRequiredApproversApproved(): boolean {
    let allApproved = true;
    
    if (this.requireApprover1) {
      allApproved = allApproved && (this.approver1Status === StatusApproval.APPROVED);
    }
    
    if (this.requireApprover2) {
      allApproved = allApproved && (this.approver2Status === StatusApproval.APPROVED);
    }
    
    if (this.requireSafetyApprover) {
      allApproved = allApproved && (this.safetyApproverStatus === StatusApproval.APPROVED);
    }
    
    return allApproved;
  }

  // Check if any approver has rejected
  hasAnyRejection(): boolean {
    return (
      (this.approver1Status === StatusApproval.REJECTED) ||
      (this.approver2Status === StatusApproval.REJECTED) ||
      (this.safetyApproverStatus === StatusApproval.REJECTED)
    );
  }

  // Move to next step in workflow
  moveToNextStep(): void {
    if (this.currentStep === ApproverType.HOD && this.requireApprover2) {
      this.currentStep = ApproverType.SECONDARY;
    } else if (this.currentStep === ApproverType.SECONDARY && this.requireSafetyApprover) {
      this.currentStep = ApproverType.SAFETY;
    } else {
      //this.currentStep = null; // Approval process complete
      this.currentStep = ApproverType.HOD; // Keep at last step if no more steps
    }
  }

  // Update overall status based on individual approvals
  updateOverallStatus(): void {
    if (this.hasAnyRejection()) {
      this.overallStatus = StatusApproval.REJECTED;
    } else if (this.areAllRequiredApproversApproved()) {
      this.overallStatus = StatusApproval.APPROVED;
    } else {
      this.overallStatus = StatusApproval.PENDING;
    }
  }

  // Approve by specific approver type
  approveBy(approverType: ApproverType, user: User, comments?: string): void {
    const now = new Date();
    
    switch (approverType) {
      case ApproverType.HOD:
        this.approver1Status = StatusApproval.APPROVED;
        this.approver1ApprovedAt = now;
        this.approver1Comments = comments;
        break;
        
      case ApproverType.SECONDARY:
        this.approver2Status = StatusApproval.APPROVED;
        this.approver2ApprovedAt = now;
        this.approver2Comments = comments;
        break;
        
      case ApproverType.SAFETY:
        this.safetyApproverStatus = StatusApproval.APPROVED;
        this.safetyApproverApprovedAt = now;
        this.safetyApproverComments = comments;
        break;
    }
    
    this.updateOverallStatus();
    if (!this.hasAnyRejection()) {
      this.moveToNextStep();
    }
  }

  // Reject by specific approver type
  rejectBy(approverType: ApproverType, user: User, reason: string): void {
    switch (approverType) {
      case ApproverType.HOD:
        this.approver1Status = StatusApproval.REJECTED;
        this.approver1Comments = reason;
        break;
        
      case ApproverType.SECONDARY:
        this.approver2Status = StatusApproval.REJECTED;
        this.approver2Comments = reason;
        break;
        
      case ApproverType.SAFETY:
        this.safetyApproverStatus = StatusApproval.REJECTED;
        this.safetyApproverComments = reason;
        break;
    }
    
    this.rejectionReason = reason;
    this.updateOverallStatus();
  }
}