import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_updates')
export class AppUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  version: string;

  @Column()
  buildNumber: string;

  @Column()
  platform: 'android' | 'ios' | 'web' | 'both';

  @Column({ type: 'text' })
  updateTitle: string;

  @Column({ type: 'text' })
  updateDescription: string;

  @Column({ nullable: true })
  downloadUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  filePath: string;

  @Column({ nullable: true })
  originalFileName: string;

  @Column({ type: 'float', default: 0 })
  fileSize: number;

  @Column({ default: false })
  isMandatory: boolean;

  @Column({ default: false })
  isSilent: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  redirectToStore: boolean;

  @Column({ nullable: true })
  minSupportedVersion: string;

  @Column({ type: 'text', nullable: true })
  releaseNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}