import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateApprovalConfigDto, UpdateApprovalConfigDto } from './dto/approval-config-request.dto';
import { ResponseService } from 'src/common/services/response.service';
import { ApprovalConfig } from 'src/infra/database/entities/approval-configuration.entity';
import { Company } from 'src/infra/database/entities/company.entity';
import { User } from 'src/infra/database/entities/user.entity';

@Injectable()
export class ApprovalConfigService {
  constructor(
    @InjectRepository(ApprovalConfig)
    private readonly approvalConfigRepo: Repository<ApprovalConfig>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly responseService: ResponseService
  ) {}

  async create(dto: CreateApprovalConfigDto) {
    const approvalConfig = this.approvalConfigRepo.create();

    if (dto.secondaryUserId) {
      const user = await this.userRepo.findOne({ where: { id: dto.secondaryUserId } });
      if (!user) throw new NotFoundException('Secondary User not found');
      approvalConfig.secondaryUser = user;
    }

    if (dto.safetyUserId) {
      const user = await this.userRepo.findOne({ where: { id: dto.safetyUserId } });
      if (!user) throw new NotFoundException('Safety User not found');
      approvalConfig.safetyUser = user;
    }

    Object.assign(approvalConfig, dto);

    const saved = await this.approvalConfigRepo.save(approvalConfig);

    return this.responseService.created('Approval config created successfully', {
      approvalConfig: saved
    });
  }

  async findMenuApproval(id: number) {
    // Find the latest active approval configuration
    const approvalConfig = await this.approvalConfigRepo.findOne({
      where: { isActive: true },
      relations: ['secondaryUser', 'safetyUser'],
      order: { createdAt: 'DESC' }
    });

    // Get user with department head
    const user = await this.userRepo.findOne({ 
      where: { id },
      relations: ['department', 'department.head']
    });

    // Extract IDs for the response
    const responseData = {
      secondaryUserId: approvalConfig?.secondaryUser?.id || null,
      safetyUserId: approvalConfig?.safetyUser?.id || null,
      hodId: user?.department?.head?.id || null
    };

    return this.responseService.success(
      'Menu approval retrieved successfully',
      responseData
    );
  }

  async findMenuApprovalForAuth(id: number) {
    // Find the latest active approval configuration
    const approvalConfig = await this.approvalConfigRepo.findOne({
      where: { isActive: true },
      relations: ['secondaryUser', 'safetyUser'],
      order: { createdAt: 'DESC' }
    });

    // Get user with department head
    const user = await this.userRepo.findOne({ 
      where: { id },
      relations: ['department', 'department.head']
    });

    // Extract IDs for the response
    const responseData = {
      secondaryUserId: approvalConfig?.secondaryUser?.id || null,
      safetyUserId: approvalConfig?.safetyUser?.id || null,
      hodId: user?.department?.head?.id || null
    };

    return responseData;
  }

  async findAll() {
    const [approvalConfigs] = await this.approvalConfigRepo.findAndCount({
      relations: ['secondaryUser', 'safetyUser'],
      order: { createdAt: 'DESC' }
    });

    const mappedConfigs = approvalConfigs.map(config => ({
      id: config.id,
      distanceLimit: config.distanceLimit,
      restrictedFrom: config.restrictedFrom,
      restrictedTo: config.restrictedTo,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,

      secondaryUser: config.secondaryUser
        ? {
            id: config.secondaryUser.id,
            displayname: config.secondaryUser.displayname,
          }
        : null,

      safetyUser: config.safetyUser
        ? {
            id: config.safetyUser.id,
            displayname: config.safetyUser.displayname,
          }
        : null,
    }));

    return this.responseService.success(
      'Approval configs retrieved successfully',
      { approvalConfigs: mappedConfigs }
    );
  }


  async findOne(id: number) {
    const config = await this.approvalConfigRepo.findOne({
      where: { id },
      relations: ['secondaryUser', 'safetyUser']
    });

    if (!config)
      throw new NotFoundException(
        this.responseService.error('Approval config not found', 404)
      );

    return this.responseService.success('Approval config retrieved successfully', {
      approvalConfig: config
    });
  }

  async update(id: number, dto: UpdateApprovalConfigDto) {
    const config = await this.approvalConfigRepo.findOne({
      where: { id },
      relations: ['secondaryUser', 'safetyUser']
    });

    if (!config)
      throw new NotFoundException(
        this.responseService.error('Approval config not found', 404)
      );

    if (dto.secondaryUserId) {
      const user = await this.userRepo.findOne({ where: { id: dto.secondaryUserId } });
      if (!user) throw new NotFoundException('Secondary User not found');
      config.secondaryUser = user;
    }

    if (dto.safetyUserId) {
      const user = await this.userRepo.findOne({ where: { id: dto.safetyUserId } });
      if (!user) throw new NotFoundException('Safety User not found');
      config.safetyUser = user;
    }

    Object.assign(config, dto);

    const updated = await this.approvalConfigRepo.save(config);

    return this.responseService.success('Approval config updated successfully', {
      approvalConfig: updated
    });
  }

  async remove(id: number) {
    const config = await this.approvalConfigRepo.findOne({ where: { id } });

    if (!config)
      throw new NotFoundException(
        this.responseService.error('Approval config not found', 404)
      );

    await this.approvalConfigRepo.remove(config);

    return this.responseService.success('Approval config deleted successfully', null);
  }

  async toggleStatus(id: number) {
    const config = await this.approvalConfigRepo.findOne({ where: { id } });

    if (!config)
      throw new NotFoundException(
        this.responseService.error('Approval config not found', 404)
      );

    config.isActive = !config.isActive;
    const updated = await this.approvalConfigRepo.save(config);

    return this.responseService.success(
      `Approval config ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      { approvalConfig: updated }
    );
  }

}
