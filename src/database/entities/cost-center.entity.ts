
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Company } from './company.entity';

@Entity()
export class CostCenter {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.costCenters, { onDelete: 'CASCADE' })
  company: Company;

  @Column({ length: 100 })
  name: string;
}
