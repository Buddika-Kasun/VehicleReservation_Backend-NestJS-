import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity()
export class ApprovalConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // Example: distance limit in KM or meters
  @Column('int', { nullable: true })
  distanceLimit?: number;

  // Secondary approval user
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'secondaryUserId' })
  secondaryUser?: User;

  // Safety approval user
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'safetyUserId' })
  safetyUser?: User;

  // Restricted time window — Example: 08:00 to 17:00
  @Column({ type: 'time', nullable: true })
  restrictedFrom?: string;  // "HH:MM:SS"

  @Column({ type: 'time', nullable: true })
  restrictedTo?: string;    // "HH:MM:SS"

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}
