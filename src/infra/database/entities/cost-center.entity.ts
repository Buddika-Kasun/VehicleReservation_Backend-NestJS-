
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Company } from './company.entity';
import { Department } from './department.entity';

@Entity()
export class CostCenter {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.costCenters, { onDelete: 'CASCADE' })
  company: Company;

  @OneToMany(() => Department, department => department.costCenter)
  departments: Department[];

  @Column({ length: 100 })
  name: string;

  @Column('decimal',{ precision: 10, scale: 2 })
  budget: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
