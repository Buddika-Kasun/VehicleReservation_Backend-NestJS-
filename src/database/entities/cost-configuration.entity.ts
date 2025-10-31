
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Company } from './company.entity';

@Entity()
export class CostConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.costConfigurations, { onDelete: 'CASCADE' })
  company: Company;

  @Column({ length: 50 })
  vehicleType: string; // Car / Van / Lorry

  @Column('decimal',{ precision: 10, scale: 2 })
  costPerKm: number;

  @Column('date')
  validFrom: Date;

  @CreateDateColumn()
  createdAt: Date;
}
