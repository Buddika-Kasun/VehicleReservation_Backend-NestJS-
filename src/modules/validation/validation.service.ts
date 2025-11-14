import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Company } from "src/database/entities/company.entity";
import { Department } from "src/database/entities/department.entity";
import { ResponseService } from "src/common/services/response.service";
import { CostCenter } from "src/database/entities/cost-center.entity";

@Injectable()
export class ValidationService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,

    @InjectRepository(CostCenter)
    private readonly costCenterRepo: Repository<CostCenter>,

    private readonly responseService: ResponseService,
  ) {}

  /**
   * ✅ Check if there is at least one active company
   */
  async haveCompany() {
    const count = await this.companyRepo.count({ where: { isActive: true } });
    return this.responseService.success(
      'Company existence check successful.',
      count > 0
    );
  }

  /**
   * ✅ Check if there is at least one department
   */
  async haveDepartment() {
    const count = await this.departmentRepo.count({ where: { isActive: true } });
    return this.responseService.success(
      'Department existence check successful.',
      count > 0
    );
  }

  /**
   * ✅ Check if there is at least one cost center
   */
  async haveCostCenter() {
    const count = await this.costCenterRepo.count({ where: { isActive: true } });
    return this.responseService.success(
      'Cost center existence check successful.',
      count > 0
    );
  }

  /**
   * ✅ Check if the app can register a user
   * (true only if company, department, and cost center exist)
   */
  async canRegisterUser() {
    const companyCount = await this.companyRepo.count({ where: { isActive: true } });
    const departmentCount = await this.departmentRepo.count({ where: { isActive: true } });
    const costCenterCount = await this.costCenterRepo.count({ where: { isActive: true } });

    const canRegister = companyCount > 0 && departmentCount > 0 && costCenterCount > 0;

    return this.responseService.success(
      'User registration validation successful.',
      canRegister
    );
  }
}
