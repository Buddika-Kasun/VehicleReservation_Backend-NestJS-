
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { CostCenter } from './cost-center.entity';

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.departments, { onDelete: 'CASCADE' })
  company: Company;

  @OneToMany(() => User, user => user.department)
  users: User[];

  @Column({ length: 100 })
  name: string;

  @ManyToOne(() => User, { nullable: true })
  head?: User;

  @ManyToOne(() => CostCenter, { nullable: true })
  costCenter: CostCenter;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
