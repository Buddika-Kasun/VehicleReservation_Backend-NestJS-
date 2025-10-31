import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Department } from './department.entity';
import { CostConfiguration } from './cost-configuration.entity';
import { Vehicle } from './vehicle.entity';
import { CostCenter } from './cost-center.entity';

@Entity()
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 300, nullable: true })
  address?: string;

  @Column({ length: 100, nullable: true })
  emailDomain?: string;

  @Column({ length: 20, nullable: true })
  contactNumber?: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Department, d => d.company)
  departments: Department[];

  @OneToMany(() => CostCenter, cc => cc.company)
  costCenters: CostCenter[];

  @OneToMany(() => CostConfiguration, cfg => cfg.company)
  costConfigurations: CostConfiguration[];

  @OneToMany(() => Vehicle, v => v.company)
  vehicles: Vehicle[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
