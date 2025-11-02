
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { ResponseService } from '../../common/services/response.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly responseService: ResponseService,
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
          'Company not found,.',
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

    // Add this method to your CompanyService class
    async hardDeleteCompany(id: number) {
        const company = await this.companyRepo.findOne({ where: { id } });
        
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

}