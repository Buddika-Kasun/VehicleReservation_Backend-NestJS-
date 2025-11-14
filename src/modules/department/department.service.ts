import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from 'src/database/entities/company.entity';
import { CostCenter } from 'src/database/entities/cost-center.entity';
import { Department } from 'src/database/entities/department.entity';
import { User } from 'src/database/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department-request.dto';
import { ResponseService } from 'src/common/services/response.service';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CostCenter)
    private readonly costCenterRepository: Repository<CostCenter>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly responseService: ResponseService,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto) {

    const companies = await this.companyRepository.find({ where: {isActive: true}});
    const company = companies[0];

    if (!company) {
      throw new NotFoundException(
        this.responseService.error(
          'Company not found',
          404
        )
      );
    }

    let costCenter: CostCenter | null = null;
    if (createDepartmentDto.costCenterId) {
      costCenter = await this.costCenterRepository.findOne({
        where: { id: createDepartmentDto.costCenterId }
      });
      if (!costCenter) {
        throw new NotFoundException(
          this.responseService.error(
            'Cost center not found',
            404
          )
        );
      }
    }

    let head: User | null = null;
    if (createDepartmentDto.headId) {
      head = await this.userRepository.findOne({
        where: { id: createDepartmentDto.headId }
      });
      if (!head) {
        throw new NotFoundException(
          this.responseService.error(
            'Department head user not found',
            404
          )
        );
      }
    }

    const department = this.departmentRepository.create({
      ...createDepartmentDto,
      company,
      costCenter,
      head
    });

    const savedDepartment = await this.departmentRepository.save(department);

    return this.responseService.created(
      'Department created successfully',
      {
        department: savedDepartment
      }
    );
  }

  async findAll(page = 1, limit = 10, search?: string, companyId?: number, costCenterId?: number) {
    const skip = (page - 1) * limit;
    const query = this.departmentRepository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.company', 'company')
      .leftJoinAndSelect('department.costCenter', 'costCenter')
      .leftJoinAndSelect('department.head', 'head');

    if (search) {
      query.where('department.name LIKE :search', { search: `%${search}%` });
    }

    if (companyId) {
      query.andWhere('department.companyId = :companyId', { companyId });
    }

    if (costCenterId) {
      query.andWhere('department.costCenterId = :costCenterId', { costCenterId });
    }

    const [departments, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy('department.createdAt', 'DESC')
      .getManyAndCount();

    return this.responseService.success(
      'Departments retrieved successfully',
      {
        departments,
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
    const department = await this.departmentRepository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.company', 'company')
      .leftJoinAndSelect('department.costCenter', 'costCenter')
      .leftJoinAndSelect('department.head', 'head')
      .where('department.id = :id', { id })
      .getOne();

    if (!department) {
      throw new NotFoundException(
        this.responseService.error(
          'Department not found',
          404
        )
      );
    }

    return this.responseService.success(
      'Department retrieved successfully',
      {
        department
      }
    );
  }

  async update(id: number, updateDepartmentDto: UpdateDepartmentDto) {
    const department = await this.departmentRepository.findOne({
      where: { id },
      relations: ['company', 'costCenter', 'head']
    });

    if (!department) {
      throw new NotFoundException(
        this.responseService.error(
          'Department not found',
          404
        )
      );
    }

    let costCenter: CostCenter | null = null;
    if (updateDepartmentDto.costCenterId) {
      costCenter = await this.costCenterRepository.findOne({
        where: { id: updateDepartmentDto.costCenterId }
      });
      if (!costCenter) {
        throw new NotFoundException(
          this.responseService.error(
            'Cost center not found',
            404
          )
        );
      }
    }

    let head: User | null = null;
    if (updateDepartmentDto.headId) {
      head = await this.userRepository.findOne({
        where: { id: updateDepartmentDto.headId }
      });
      if (!head) {
        throw new NotFoundException(
          this.responseService.error(
            'Department head user not found',
            404
          )
        );
      }
    }

    Object.assign(department, {
      ...updateDepartmentDto,
      costCenter,
      head
    }
    );
    const updatedDepartment = await this.departmentRepository.save(department);

    return this.responseService.success(
      'Department updated successfully',
      {
        department: updatedDepartment
      }
    );
  }

  async remove(id: number) {
    const department = await this.departmentRepository.findOne({ where: { id } });

    if (!department) {
      throw new NotFoundException(
        this.responseService.error(
          'Department not found',
          404
        )
      );
    }

    await this.departmentRepository.remove(department);

    return this.responseService.success(
      'Department deleted successfully',
      null
    );
  }

  async toggleStatus(id: number) {
    const department = await this.departmentRepository.findOne({ where: { id } });

    if (!department) {
      throw new NotFoundException(
        this.responseService.error(
          'Department not found',
          404
        )
      );
    }

    department.isActive = !department.isActive;
    const updatedDepartment = await this.departmentRepository.save(department);

    return this.responseService.success(
      `Department ${updatedDepartment.isActive ? 'activated' : 'deactivated'} successfully`,
      {
        department: updatedDepartment
      }
    );
  }
}