
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  action: string;

  @Column({ type: 'json', nullable: true })
  payload?: any;

  @Column({ nullable: true })
  actorId?: number;

  @CreateDateColumn()
  createdAt: Date;
}
