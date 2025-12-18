
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Company } from './company.entity';
import { Vehicle } from './vehicle.entity';

@Entity()
export class CostConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.costConfigurations, { onDelete: 'CASCADE' })
  company: Company;

  @Column({ length: 50 })
  vehicleType: string; 

  @OneToMany(() => Vehicle, v => v.vehicleType)
  vehicle: Vehicle[];

  @Column('decimal',{ precision: 10, scale: 2 })
  costPerKm: number;

  @Column('date')
  validFrom: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
