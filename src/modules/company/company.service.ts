import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { ResponseService } from '../../common/services/response.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CostConfiguration } from 'src/database/entities/cost-configuration.entity';
import { CreateCostConfigurationDto, UpdateCostConfigurationDto } from './dto/cost-configuration-request.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly responseService: ResponseService,
    @InjectRepository(CostConfiguration)
    private readonly costConfigRepo: Repository<CostConfiguration>,
  ) {}

  // Create Company
  async createCompany(dto: CreateCompanyDto) {
    // Check if company with same name already exists
    const existingCompany = await this.companyRepo.findOne({
      where: { name: dto.name }
    });

    if (existingCompany) {
      throw new ConflictException(
        this.responseService.error(
          'Company with this name already exists.',
          409
        )
      );
    }

    // Create new company
    const company = this.companyRepo.create(dto);
    const savedCompany = await this.companyRepo.save(company);

    return this.responseService.created(
      'Company created successfully.',
      { 
        company: savedCompany 
      }
    );
  }

  // Get All Companies (with optional active filter)
  async getAllCompanies(isActive?: boolean) {
    const whereCondition = isActive !== undefined ? { isActive } : {};
    
    const companies = await this.companyRepo.find({
      where: whereCondition,
      order: { name: 'ASC' }
    });

    return this.responseService.success(
      'Companies retrieved successfully.',
      { 
        companies,
        total: companies.length 
      }
    );
  }

  // Get Company by ID
  async getCompany(id: number) {
    const company = await this.companyRepo.findOne({ 
      where: { id },
      relations: ['departments', 'costCenters', 'costConfigurations', 'vehicles'] 
    });
    
    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    return this.responseService.success(
      'Company retrieved successfully.',
      { 
        company 
      }
    );
  }

  // Update Company
  async updateCompany(id: number, dto: UpdateCompanyDto) {
    const company = await this.companyRepo.findOne({ where: { id } });
    
    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    // Check if name is being changed and if new name already exists
    if (dto.name && dto.name !== company.name) {
      const existingCompany = await this.companyRepo.findOne({
        where: { name: dto.name }
      });

      if (existingCompany) {
        throw new ConflictException(
          this.responseService.error(
            'Company with this name already exists.',
            409
          )
        );
      }
    }

    // Update company fields
    Object.assign(company, dto);
    const updatedCompany = await this.companyRepo.save(company);

    return this.responseService.success(
      'Company updated successfully.',
      { 
        company: updatedCompany 
      }
    );
  }

  // Deactivate Company
  async deactivateCompany(id: number) {
    const company = await this.companyRepo.findOne({ 
      where: { id },
      relations: ['vehicles', 'departments', 'costCenters'] 
    });
    
    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    // Check if company is already deactivated
    if (!company.isActive) {
      throw new BadRequestException(
        this.responseService.error(
          'Company is already deactivated.',
          400
        )
      );
    }

    // Check if company has active vehicles
    const activeVehicles = company.vehicles?.filter(v => v.isActive) || [];
    if (activeVehicles.length > 0) {
      throw new BadRequestException(
        this.responseService.error(
          `Cannot deactivate company with ${activeVehicles.length} active vehicles.`,
          400
        )
      );
    }

    // Check if company has active departments
    const activeDepartments = company.departments?.filter(d => d.isActive) || [];
    if (activeDepartments.length > 0) {
      throw new BadRequestException(
        this.responseService.error(
          `Cannot deactivate company with ${activeDepartments.length} active departments.`,
          400
        )
      );
    }

    // Deactivate the company
    company.isActive = false;
    const updatedCompany = await this.companyRepo.save(company);

    return this.responseService.success(
      'Company deactivated successfully.',
      { 
        company: updatedCompany
      }
    );
  }

  // Activate Company
  async activateCompany(id: number) {
    const company = await this.companyRepo.findOne({ where: { id } });
    
    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    // Check if company is already active
    if (company.isActive) {
      throw new BadRequestException(
        this.responseService.error(
          'Company is already active.',
          400
        )
      );
    }

    // Activate the company
    company.isActive = true;
    const updatedCompany = await this.companyRepo.save(company);

    return this.responseService.success(
      'Company activated successfully.',
      { 
        company: updatedCompany 
      }
    );
  }

  // Search Companies by name
  async searchCompanies(name: string) {
    const companies = await this.companyRepo
      .createQueryBuilder('company')
      .where('company.name LIKE :name', { name: `%${name}%` })
      .andWhere('company.isActive = :isActive', { isActive: true })
      .orderBy('company.name', 'ASC')
      .getMany();

    return this.responseService.success(
      'Companies search completed.',
      { 
        companies,
        searchTerm: name,
        total: companies.length 
      }
    );
  }

  // Get Company Statistics
  async getCompanyStatistics(id: number) {
    const company = await this.companyRepo.findOne({
      where: { id },
      relations: ['vehicles', 'departments', 'costCenters', 'costConfigurations']
    });

    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    const statistics = {
      totalVehicles: company.vehicles?.length || 0,
      activeVehicles: company.vehicles?.filter(v => v.isActive).length || 0,
      totalDepartments: company.departments?.length || 0,
      activeDepartments: company.departments?.filter(d => d.isActive).length || 0,
      totalCostCenters: company.costCenters?.length || 0,
      totalCostConfigurations: company.costConfigurations?.length || 0,
      companyCreated: company.createdAt,
      lastUpdated: company.updatedAt
    };

    return this.responseService.success(
      'Company statistics retrieved.',
      { 
        company: {
          id: company.id,
          name: company.name,
          isActive: company.isActive
        },
        statistics 
      }
    );
  }

  // Hard Delete Company
  async hardDeleteCompany(id: number) {
    const company = await this.companyRepo.findOne({ 
      where: { id },
      relations: ['vehicles', 'departments', 'costCenters'] 
    });
    
    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found.',
          404
        )
      );
    }

    // Check for existing relationships before deletion
    if (company.vehicles?.length > 0 || 
        company.departments?.length > 0 ||
        company.costCenters?.length > 0) {
      throw new BadRequestException(
        this.responseService.error(
          'Cannot delete company with existing vehicles, departments, or cost centers.',
          400
        )
      );
    }

    await this.companyRepo.remove(company);
    
    return this.responseService.success(
      'Company deleted permanently.',
      { 
        deletedCompanyId: id 
      }
    );
  }

  // Cost configuration services
  async createCostConfiguration(dto: CreateCostConfigurationDto) {
    const company = await this.companyRepo.findOne({ 
      where: { id: dto.companyId } 
    });
    
    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found',
          404
        )
      );
    }

    // Check for overlapping configurations for the same vehicle type and date
    const existingConfig = await this.costConfigRepo.findOne({
      where: {
        company: { id: dto.companyId },
        vehicleType: dto.vehicleType,
        validFrom: dto.validFrom
      }
    });

    if (existingConfig) {
      throw new ConflictException(
        this.responseService.error(
          `Cost configuration for vehicle type '${dto.vehicleType}' with valid from date '${dto.validFrom}' already exists`,
          409
        )
      );
    }

    // Check if there's a configuration for the same vehicle type with future date
    const futureConfig = await this.costConfigRepo.findOne({
      where: {
        company: { id: dto.companyId },
        vehicleType: dto.vehicleType,
        validFrom: MoreThan(dto.validFrom)
      }
    });

    if (futureConfig) {
      throw new BadRequestException(
        this.responseService.error(
          `Cannot create configuration with valid from date '${dto.validFrom}' because a future configuration exists for '${futureConfig.validFrom}'`,
          400
        )
      );
    }

    const config = this.costConfigRepo.create({
      ...dto,
      company
    });

    const savedConfig = await this.costConfigRepo.save(config);

    return this.responseService.created(
      'Cost configuration created successfully',
      { costConfiguration: savedConfig }
    );
  }

  async updateCostConfiguration(id: number, dto: UpdateCostConfigurationDto) {
    const config = await this.costConfigRepo.findOne({ 
      where: { id },
      relations: ['company'] 
    });
    
    if (!config) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost configuration not found',
          404
        )
      );
    }

    // If validFrom is being updated, check for conflicts
    if (dto.validFrom && dto.validFrom !== config.validFrom) {
      const existingConfig = await this.costConfigRepo.findOne({
        where: {
          company: { id: config.company.id },
          vehicleType: dto.vehicleType || config.vehicleType,
          validFrom: dto.validFrom
        }
      });

      if (existingConfig && existingConfig.id !== id) {
        throw new ConflictException(
          this.responseService.error(
            `Cost configuration for this vehicle type with valid from date '${dto.validFrom}' already exists`,
            409
          )
        );
      }
    }

    Object.assign(config, dto);
    const updatedConfig = await this.costConfigRepo.save(config);

    return this.responseService.success(
      'Cost configuration updated successfully',
      { costConfiguration: updatedConfig }
    );
  }

  async getCostConfiguration(id: number) {
    const config = await this.costConfigRepo.findOne({
      where: { id },
      relations: ['company']
    });

    if (!config) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost configuration not found',
          404
        )
      );
    }

    return this.responseService.success(
      'Cost configuration retrieved successfully',
      { costConfiguration: config }
    );
  }

  async getCompanyCostConfigurations(companyId: number, vehicleType?: string) {
    const whereCondition: any = { company: { id: companyId } };
    
    if (vehicleType) {
      whereCondition.vehicleType = vehicleType;
    }

    const configs = await this.costConfigRepo.find({
      where: whereCondition,
      relations: ['company'],
      order: { validFrom: 'DESC' }
    });

    return this.responseService.success(
      'Cost configurations retrieved successfully',
      { 
        costConfigurations: configs,
        total: configs.length 
      }
    );
  }

  async getCurrentCostConfiguration(companyId: number, vehicleType: string) {
    const currentDate = new Date();
    
    const config = await this.costConfigRepo.findOne({
      where: {
        company: { id: companyId },
        vehicleType: vehicleType,
        validFrom: LessThanOrEqual(currentDate)
      },
      relations: ['company'],
      order: { validFrom: 'DESC' }
    });

    if (!config) {
      throw new NotFoundException(
        this.responseService.error(
          `No active cost configuration found for vehicle type '${vehicleType}'`,
          404
        )
      );
    }

    return this.responseService.success(
      'Current cost configuration retrieved',
      { costConfiguration: config }
    );
  }

  async deleteCostConfiguration(id: number) {
    const config = await this.costConfigRepo.findOne({ 
      where: { id },
      relations: ['company'] 
    });
    
    if (!config) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost configuration not found',
          404
        )
      );
    }

    // Check if this is the current active configuration
    const currentDate = new Date();
    const currentConfig = await this.costConfigRepo.findOne({
      where: {
        company: { id: config.company.id },
        vehicleType: config.vehicleType,
        validFrom: LessThanOrEqual(currentDate)
      },
      order: { validFrom: 'DESC' }
    });

    if (currentConfig && currentConfig.id === id) {
      throw new BadRequestException(
        this.responseService.error(
          'Cannot delete the current active cost configuration',
          400
        )
      );
    }

    await this.costConfigRepo.remove(config);

    return this.responseService.success(
      'Cost configuration deleted successfully',
      { deletedConfigurationId: id }
    );
  }

  async getCostConfigurationHistory(companyId: number, vehicleType: string) {
    const configs = await this.costConfigRepo.find({
      where: {
        company: { id: companyId },
        vehicleType: vehicleType
      },
      relations: ['company'],
      order: { validFrom: 'DESC' }
    });

    return this.responseService.success(
      'Cost configuration history retrieved',
      { 
        costConfigurations: configs,
        vehicleType,
        total: configs.length 
      }
    );
  }
}