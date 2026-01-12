// src/modules/checklist/checklist.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Checklist } from 'src/infra/database/entities/checklist.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { ChecklistSubmitRequestDto } from './dto/checklist-request.dto';
import { ChecklistResponseDto } from './dto/checklist-response.dto';
import { ChecklistItem } from 'src/infra/database/entities/checklist-item.entity';

@Injectable()
export class ChecklistService {
  constructor(
    @InjectRepository(Checklist)
    private checklistRepository: Repository<Checklist>,
    @InjectRepository(ChecklistItem)
    private checklistItemRepository: Repository<ChecklistItem>,
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getChecklistByDate(
    vehicleId: number,
    dateString: string,
  ): Promise<ChecklistResponseDto> {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Check if vehicle exists
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    const checklist = await this.checklistRepository.findOne({
      where: {
        vehicle: { id: vehicleId },
        checklistDate: date,
      },
      relations: ['vehicle', 'checkedBy', 'items'],
    });

    if (!checklist) {
      throw new NotFoundException(
        `Checklist not found for vehicle ${vehicleId} on ${dateString}`,
      );
    }

    return this.mapToResponseDto(checklist);
  }

  async checklistExists(vehicleId: number, dateString: string): Promise<boolean> {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const count = await this.checklistRepository.count({
      where: {
        vehicle: { id: vehicleId },
        checklistDate: date,
      },
    });

    return count > 0;
  }

  async submitChecklist(
    checklistDto: ChecklistSubmitRequestDto,
  ): Promise<ChecklistResponseDto> {
    // Validate date
    const checklistDate = new Date(checklistDto.checklistDate);
    if (isNaN(checklistDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Check if checklist already exists for this date
    const existingChecklist = await this.checklistRepository.findOne({
      where: {
        vehicle: { id: checklistDto.vehicleId },
        checklistDate,
      },
    });

    if (existingChecklist) {
      throw new ConflictException(
        `Checklist already exists for vehicle ${checklistDto.vehicleId} on ${checklistDto.checklistDate}`,
      );
    }

    // Get vehicle
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: checklistDto.vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle with ID ${checklistDto.vehicleId} not found`,
      );
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: checklistDto.checkedById },
    });
    if (!user) {
      throw new NotFoundException(
        `User with ID ${checklistDto.checkedById} not found`,
      );
    }

    // Validate all items have status
    for (const [itemName, response] of Object.entries(checklistDto.responses)) {
      if (!response.status || !['good', 'bad'].includes(response.status)) {
        throw new BadRequestException(
          `Invalid status for item "${itemName}". Must be "good" or "bad"`,
        );
      }
    }

    // Create checklist
    const checklist = this.checklistRepository.create({
      vehicle,
      vehicleRegNo: checklistDto.vehicleRegNo,
      checklistDate,
      checkedBy: user,
      isSubmitted: true,
    });

    const savedChecklist = await this.checklistRepository.save(checklist);

    // Create checklist items
    const checklistItems: ChecklistItem[] = [];
    for (const [itemName, response] of Object.entries(checklistDto.responses)) {
      const item = this.checklistItemRepository.create({
        checklist: savedChecklist,
        itemName,
        status: response.status,
        remarks: response.remarks || null,
      });
      checklistItems.push(item);
    }

    await this.checklistItemRepository.save(checklistItems);

    // Reload with relations
    const completeChecklist = await this.checklistRepository.findOne({
      where: { id: savedChecklist.id },
      relations: ['vehicle', 'checkedBy', 'items'],
    });

    return this.mapToResponseDto(completeChecklist);
  }

  async getChecklistHistory(
    vehicleId: number,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ checklists: ChecklistResponseDto[]; total: number }> {
    const skip = (page - 1) * limit;
    
    // Build query
    const query = this.checklistRepository
      .createQueryBuilder('checklist')
      .leftJoinAndSelect('checklist.vehicle', 'vehicle')
      .leftJoinAndSelect('checklist.checkedBy', 'checkedBy')
      .leftJoinAndSelect('checklist.items', 'items')
      .where('vehicle.id = :vehicleId', { vehicleId })
      .andWhere('checklist.isSubmitted = :isSubmitted', { isSubmitted: true })
      .orderBy('checklist.checklistDate', 'DESC')
      .skip(skip)
      .take(limit);

    // Add date filters if provided
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query.andWhere('checklist.checklistDate >= :startDate', { startDate: start });
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        query.andWhere('checklist.checklistDate <= :endDate', { endDate: end });
      }
    }

    const [checklists, total] = await query.getManyAndCount();

    return {
      checklists: checklists.map((checklist) => this.mapToResponseDto(checklist)),
      total,
    };
  }

  async getUserChecklistHistory(
    userId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<ChecklistResponseDto[]> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Build query
    const query = this.checklistRepository
      .createQueryBuilder('checklist')
      .leftJoinAndSelect('checklist.vehicle', 'vehicle')
      .leftJoinAndSelect('checklist.checkedBy', 'checkedBy')
      .leftJoinAndSelect('checklist.items', 'items')
      .where('checkedBy.id = :userId', { userId })
      .andWhere('checklist.isSubmitted = :isSubmitted', { isSubmitted: true })
      .orderBy('checklist.checklistDate', 'DESC');

    // Add date filters if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        query.andWhere('checklist.checklistDate BETWEEN :startDate AND :endDate', {
          startDate: start,
          endDate: end,
        });
      }
    }

    const checklists = await query.getMany();
    return checklists.map((checklist) => this.mapToResponseDto(checklist));
  }

  private mapToResponseDto(checklist: Checklist): ChecklistResponseDto {
    const responses: Record<string, { status: string; remarks?: string }> = {};
    
    checklist.items.forEach((item) => {
      responses[item.itemName] = {
        status: item.status,
        remarks: item.remarks || undefined,
      };
    });

    return {
      id: checklist.id.toString(),
      vehicleId: checklist.vehicle.id,
      vehicleRegNo: checklist.vehicleRegNo,
      checklistDate: checklist.checklistDate,
      checkedBy: {
        id: checklist.checkedBy.id,
        name: checklist.checkedBy.displayname || checklist.checkedBy.username,
        role: checklist.checkedBy.role,
      },
      responses,
      isSubmitted: checklist.isSubmitted,
      createdAt: checklist.createdAt,
      updatedAt: checklist.updatedAt,
    };
  }
}