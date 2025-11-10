import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from 'src/database/entities/company.entity';
import { CostCenter } from 'src/database/entities/cost-center.entity';
import { Repository } from 'typeorm';
import { CreateCostCenterDto, UpdateCostCenterDto } from './dto/cost-center-request.dto';
import { ResponseService } from 'src/common/services/response.service';

@Injectable()
export class CostCenterService {
  constructor(
    @InjectRepository(CostCenter)
    private readonly costCenterRepository: Repository<CostCenter>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly responseService: ResponseService,
  ) {}

  async create(createCostCenterDto: CreateCostCenterDto) {
    // Check if company exists
    const company = await this.companyRepository.findOne({
      where: { id: createCostCenterDto.companyId }
    });

    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found',
          404
        )
      );
    }

    const costCenter = this.costCenterRepository.create({
      ...createCostCenterDto,
      company
    });

    const savedCostCenter = await this.costCenterRepository.save(costCenter);

    return this.responseService.created(
      'Cost center created successfully',
      {
        costCenter: savedCostCenter
      }
    );
  }

  async findAll(page = 1, limit = 10, search?: string, companyId?: number) {
    const skip = (page - 1) * limit;
    const query = this.costCenterRepository
      .createQueryBuilder('costCenter')
      .leftJoinAndSelect('costCenter.company', 'company')
      .leftJoinAndSelect('costCenter.departments', 'departments')
      .loadRelationCountAndMap('costCenter.departmentCount', 'costCenter.departments');

    if (search) {
      query.where('costCenter.name LIKE :search', { search: `%${search}%` });
    }

    if (companyId) {
      query.andWhere('costCenter.companyId = :companyId', { companyId });
    }

    const [costCenters, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy('costCenter.createdAt', 'DESC')
      .getManyAndCount();

    return this.responseService.success(
      'Cost centers retrieved successfully',
      {
        costCenters,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    );
  }

  async findOne(id: number) {
    const costCenter = await this.costCenterRepository
      .createQueryBuilder('costCenter')
      .leftJoinAndSelect('costCenter.company', 'company')
      .leftJoinAndSelect('costCenter.departments', 'departments')
      .loadRelationCountAndMap('costCenter.departmentCount', 'costCenter.departments')
      .where('costCenter.id = :id', { id })
      .getOne();

    if (!costCenter) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost center not found',
          404
        )
      );
    }

    return this.responseService.success(
      'Cost center retrieved successfully',
      {
        costCenter
      }
    );
  }

  async update(id: number, updateCostCenterDto: UpdateCostCenterDto) {
    const costCenter = await this.costCenterRepository.findOne({
      where: { id },
      relations: ['company']
    });

    if (!costCenter) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost center not found',
          404
        )
      );
    }

    // Check if company exists (if companyId is being updated)
    if (updateCostCenterDto.companyId && updateCostCenterDto.companyId !== costCenter.company.id) {
      const company = await this.companyRepository.findOne({
        where: { id: updateCostCenterDto.companyId }
      });

      if (!company) {
        throw new NotFoundException(
          this.responseService.error(
            'Company not found',
            404
          )
        );
      }
      costCenter.company = company;
    }

    Object.assign(costCenter, updateCostCenterDto);
    const updatedCostCenter = await this.costCenterRepository.save(costCenter);

    return this.responseService.success(
      'Cost center updated successfully',
      {
        costCenter: updatedCostCenter
      }
    );
  }

  async remove(id: number) {
    const costCenter = await this.costCenterRepository.findOne({
      where: { id },
      relations: ['departments']
    });

    if (!costCenter) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost center not found',
          404
        )
      );
    }

    // Check if cost center has departments
    if (costCenter.departments && costCenter.departments.length > 0) {
      throw new ConflictException(
        this.responseService.error(
          'Cannot delete cost center with associated departments',
          409
        )
      );
    }

    await this.costCenterRepository.remove(costCenter);

    return this.responseService.success(
      'Cost center deleted successfully',
      null
    );
  }

  async toggleStatus(id: number) {
    const costCenter = await this.costCenterRepository.findOne({ where: { id } });

    if (!costCenter) {
      throw new NotFoundException(
        this.responseService.error(
          'Cost center not found',
          404
        )
      );
    }

    costCenter.isActive = !costCenter.isActive;
    const updatedCostCenter = await this.costCenterRepository.save(costCenter);

    return this.responseService.success(
      `Cost center ${updatedCostCenter.isActive ? 'activated' : 'deactivated'} successfully`,
      {
        costCenter: updatedCostCenter
      }
    );
  }
}