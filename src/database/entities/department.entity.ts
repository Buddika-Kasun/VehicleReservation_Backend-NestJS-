
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.departments, { onDelete: 'CASCADE' })
  company: Company;

  @Column({ length: 100 })
  name: string;

  @ManyToOne(() => User, { nullable: true })
  head?: User;

  @Column({ nullable: true })
  costCenterId?: number;
}
