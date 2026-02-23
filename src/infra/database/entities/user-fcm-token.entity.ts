import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

// entities/user-fcm-token.entity.ts
@Entity('user_fcm_tokens')
export class UserFcmToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ unique: true }) // Make deviceId unique
  deviceId: string;

  @Column({ nullable: true })
  fcmToken: string;

  @Column({ nullable: true })
  deviceName: string; // Optional: store device model/name

  @Column({ nullable: true })
  deviceType: string; // 'ios', 'android', 'web'

  @Column({ default: true })
  isActive: boolean;

  @Column()
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}