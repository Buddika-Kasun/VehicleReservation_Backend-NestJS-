import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from 'src/infra/database/entities/company.entity';
import { CostCenter } from 'src/infra/database/entities/cost-center.entity';
import { Department } from 'src/infra/database/entities/department.entity';
import { User, UserRole } from 'src/infra/database/entities/user.entity';
import { Brackets, Repository } from 'typeorm';
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

    const sysAdmins = await this.userRepository.find({
      where: {
        role: UserRole.SYSADMIN
      }
    });

    const sysAdminsToUpdate = sysAdmins.filter(
      user => !user.company || !user.department
    );

    if (sysAdminsToUpdate.length > 0) {
      for (const user of sysAdminsToUpdate) {
        user.company = company;
        user.department = savedDepartment;
      }

      await this.userRepository.save(sysAdminsToUpdate);
    }


    return this.responseService.created(
      'Department created successfully',
      {
        department: savedDepartment
      }
    );
  }

  async findAll(page = 1, limit?: number, search?: string, companyId?: number, costCenterId?: number) {
    const skip = (page - 1) * (limit || 0);
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

    // If limit is provided, use pagination
    if (limit) {
      query
        .skip(skip)
        .take(limit)
        .orderBy('department.createdAt', 'DESC');
    } else {
      // If no limit, just order the results
      query.orderBy('department.createdAt', 'DESC');
    }

    const [departments, total] = await query.getManyAndCount();

    return this.responseService.success(
      'Departments retrieved successfully',
      {
        departments,
        pagination: {
          page,
          limit: limit || total, // If no limit, show total as limit
          total,
          totalPages: limit ? Math.ceil(total / limit) : 1,
        },
      }
    );
  }

  async findUserAll(page = 1, limit?: number, user?: any) { 
    
    const userData = await this.userRepository.findOne({
      where: { id: user.userId },
      relations: ['company', 'department']
    });
    
    const skip = (page - 1) * (limit || 0);
    
    // Create base query
    const query = this.departmentRepository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.company', 'company')
      .leftJoinAndSelect('department.costCenter', 'costCenter')
      .leftJoinAndSelect('department.head', 'head');

    // Filter based on user role and department
    if (userData) {
      const userRole = userData.role;
      const userDepartmentId = userData.department?.id;
      const userId = userData.id;

      switch (userRole) {
        case UserRole.SYSADMIN:
        case UserRole.HR:
          // Sysadmin and HR can see all departments
          // Optionally filter by company if multi-tenant
          // if (user.company?.id) {
          //   query.andWhere('company.id = :companyId', { companyId: user.company.id });
          // }
          break;
        default: 
          // user is head of department OR belongs to department
          query.andWhere(new Brackets(qb => {
            qb.where('head.id = :userId', { userId: userId }) // User is head
              .orWhere('department.id = :userDepartmentId', { userDepartmentId: userDepartmentId }); // User belongs to
          }));
          break;
      }
    } else {
      // If no user provided (public API), return empty or handle as needed
      query.andWhere('1 = 0');
    }

    // If limit is provided, use pagination
    if (limit) {
      query
        .skip(skip)
        .take(limit)
        .orderBy('department.createdAt', 'DESC');
    } else {
      // If no limit, just order the results
      query.orderBy('department.createdAt', 'DESC');
    }

    const [departments, total] = await query.getManyAndCount();

    return this.responseService.success(
      'Departments retrieved successfully',
      {
        departments,
        pagination: {
          page,
          limit: limit || total, // If no limit, show total as limit
          total,
          totalPages: limit ? Math.ceil(total / limit) : 1,
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