// src/modules/checklist/checklist.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Brackets } from 'typeorm';
import { Checklist, ChecklistStatus } from 'src/infra/database/entities/checklist.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { ChecklistSubmitRequestDto } from './dto/checklist-request.dto';
import { ChecklistResponseDto } from './dto/checklist-response.dto';
import { ChecklistItem } from 'src/infra/database/entities/checklist-item.entity';
import { EventBusService } from 'src/infra/redis/event-bus.service';

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
    private readonly eventBus: EventBusService,
  ) {}

  async getChecklistByDate(vehicleId: number, dateString: string): Promise<ChecklistResponseDto> {
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
      relations: ['vehicle', 'checkedBy', 'items', 'approvedBy'],
    });

    if (!checklist) {
      throw new NotFoundException(`Checklist not found for vehicle ${vehicleId} on ${dateString}`);
    }

    return this.mapToResponseDto(checklist);
  }

  async getChecklistById(id: number): Promise<ChecklistResponseDto> {
    const checklist = await this.checklistRepository.findOne({
      where: { id },
      relations: ['vehicle', 'checkedBy', 'items', 'approvedBy'],
    });

    if (!checklist) {
      throw new NotFoundException(`Checklist with ID ${id} not found`);
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

  async checklistApproved(vehicleId: number, dateString: string): Promise<number> {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const checklists = await this.checklistRepository.find({
      where: {
        vehicle: { id: vehicleId },
        checklistDate: date,
      },
      select: ['status'], // Only select status for efficiency
    });

    if (checklists.length === 0) {
      return 0; // No checklist found
    }

    const hasApproved = checklists.some(
      (checklist) => checklist.status === ChecklistStatus.APPROVED,
    );

    return hasApproved ? 2 : 1; // 2 if approved, 1 if exists but not approved
  }

  async approveChecklist(id: number, approvedById: number, comment?: string) {
    const checklist = await this.checklistRepository.findOne({
      where: { id },
      relations: ['vehicle', 'checkedBy', 'items', 'approvedBy'],
    });

    if (!checklist) {
      throw new NotFoundException(`Checklist with ID ${id} not found`);
    }

    const user = await this.userRepository.findOne({
      where: { id: approvedById },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${approvedById} not found`);
    }

    checklist.status = ChecklistStatus.APPROVED;
    checklist.approvedBy = { id: approvedById } as User;
    checklist.comment = comment;

    const updatedChecklist = await this.checklistRepository.save(checklist);

    // Publish VEHICLE.CHECKLIST_APPROVED event
    try {
      await this.eventBus.publish('VEHICLE', 'CHECKLIST_APPROVED', {
        vehicleId: checklist.vehicle.id,
        vehicleRegNo: checklist.vehicle.regNo,
        approverId: user.id,
        approverName: user.displayname,
        approverRole: user.role,
        checklistId: updatedChecklist?.id,
        checklistDate: updatedChecklist?.checklistDate,
        driverId: checklist.checkedBy?.id,
        driverName: checklist.checkedBy?.displayname,
      });
    } catch (e) {
      console.error('Failed to send checklist approved notification', e);
    }

    return {
      success: true,
      message: 'Checklist approved successfully',
    };
  }

  async rejectChecklist(id: number, rejectedById: number, comment?: string) {
    const checklist = await this.checklistRepository.findOne({
      where: { id },
      relations: ['vehicle', 'checkedBy', 'items', 'approvedBy'],
    });

    if (!checklist) {
      throw new NotFoundException(`Checklist with ID ${id} not found`);
    }

    const user = await this.userRepository.findOne({
      where: { id: rejectedById },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${rejectedById} not found`);
    }

    checklist.status = ChecklistStatus.REJECTED;
    checklist.approvedBy = { id: rejectedById } as User;
    checklist.comment = comment;

    const updatedChecklist = await this.checklistRepository.save(checklist);

    // Publish VEHICLE.CHECKLIST_REJECTED event
    try {
      await this.eventBus.publish('VEHICLE', 'CHECKLIST_REJECTED', {
        vehicleId: checklist.vehicle.id,
        vehicleRegNo: checklist.vehicle.regNo,
        approverId: user.id,
        approverName: user.displayname,
        approverRole: user.role,
        checklistId: updatedChecklist?.id,
        checklistDate: updatedChecklist?.checklistDate,
        driverId: checklist.checkedBy?.id,
        driverName: checklist.checkedBy?.displayname,
      });
    } catch (e) {
      console.error('Failed to send checklist rejected notification', e);
    }

    return {
      success: true,
      message: 'Checklist rejected successfully',
    };
  }

  async submitChecklist(checklistDto: ChecklistSubmitRequestDto): Promise<ChecklistResponseDto> {
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
      relations: ['assignedDriverPrimary'],
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${checklistDto.vehicleId} not found`);
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: checklistDto.checkedById },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${checklistDto.checkedById} not found`);
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
      status: ChecklistStatus.SUBMITTED,
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

    // Publish VEHICLE.CHECKLIST_SUBMITTED event
    try {
      await this.eventBus.publish('VEHICLE', 'CHECKLIST_SUBMITTED', {
        vehicleId: vehicle.id,
        vehicleRegNo: vehicle.regNo,
        checkById: user.id,
        checkByName: user.displayname,
        checkByRole: user.role,
        driverId: vehicle.assignedDriverPrimary.id,
        driverName: vehicle.assignedDriverPrimary.displayname,
        checklistId: completeChecklist?.id,
        checklistDate: completeChecklist?.checklistDate,
      });
    } catch (e) {
      console.error('Failed to send checklist submitted notification', e);
    }

    return this.mapToResponseDto(completeChecklist);
  }

  // Simplified getAllChecklists method
  async getAllChecklists(user: any, requestDto: any) {
    try {
      //console.log('Request DTO:', JSON.stringify(requestDto, null, 2));

      // Create base query builder with necessary joins
      const queryBuilder = this.checklistRepository
        .createQueryBuilder('checklist')
        .leftJoinAndSelect('checklist.vehicle', 'vehicle')
        .leftJoinAndSelect('checklist.checkedBy', 'checkedBy')
        .leftJoinAndSelect('checklist.approvedBy', 'approvedBy');

      // Apply status filter
      if (requestDto.statusFilter) {
        queryBuilder.andWhere('checklist.status = :status', {
          status: requestDto.statusFilter == 'pending' ? 'submitted' : requestDto.statusFilter,
        });
      } else {
        queryBuilder.andWhere('checklist.status = :status', {
          status: 'submitted',
        });
      }

      // Apply search filter if provided
      if (requestDto.search && requestDto.search.trim() !== '') {
        const searchTerm = `%${requestDto.search.trim()}%`;
        const cleanSearch = requestDto.search.trim();

        if (cleanSearch.startsWith('#')) {
          const idSearch = cleanSearch.substring(1).trim();

          if (/^\d+$/.test(idSearch)) {
            queryBuilder.andWhere('CAST(checklist.id AS TEXT) LIKE :idSearch', {
              idSearch: `%${idSearch}%`,
            });
          } else {
            queryBuilder.andWhere(
              new Brackets((qb) => {
                qb.where('CAST(checklist.id AS TEXT) LIKE :searchTerm', { searchTerm })
                  .orWhere('CAST(checklist.checklistDate AS TEXT) LIKE :searchTerm', { searchTerm })
                  .orWhere('CAST(checklist.createdAt AS TEXT) LIKE :searchTerm', { searchTerm })
                  .orWhere('checklist.vehicleRegNo LIKE :searchTerm', { searchTerm })
                  .orWhere('checkedBy.displayname LIKE :searchTerm', { searchTerm })
                  .orWhere('approvedBy.displayname LIKE :searchTerm', { searchTerm });
              }),
            );
          }
        } else {
          queryBuilder.andWhere(
            new Brackets((qb) => {
              qb.where('CAST(checklist.id AS TEXT) LIKE :searchTerm', { searchTerm })
                .orWhere('CAST(checklist.checklistDate AS TEXT) LIKE :searchTerm', { searchTerm })
                .orWhere('CAST(checklist.createdAt AS TEXT) LIKE :searchTerm', { searchTerm })
                .orWhere('checklist.vehicleRegNo LIKE :searchTerm', { searchTerm })
                .orWhere('checkedBy.displayname LIKE :searchTerm', { searchTerm })
                .orWhere('approvedBy.displayname LIKE :searchTerm', { searchTerm });
            }),
          );
        }
      }

      // Apply time filter
      if (requestDto.timeFilter && requestDto.timeFilter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestDto.timeFilter === 'today') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          queryBuilder.andWhere('checklist.checklistDate >= :startDate', { startDate: today });
          queryBuilder.andWhere('checklist.checklistDate < :endDate', { endDate: tomorrow });
        } else if (
          requestDto.timeFilter !== 'today' &&
          requestDto.timeFilter !== 'date' &&
          requestDto.timeFilter !== 'all'
        ) {
          try {
            const selectedDate = new Date(requestDto.timeFilter);
            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            queryBuilder.andWhere('checklist.checklistDate >= :startDate', {
              startDate: selectedDate,
            });
            queryBuilder.andWhere('checklist.checklistDate < :endDate', { endDate: nextDay });
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        } else if (requestDto.timeFilter === 'date' && requestDto.selectedDate) {
          const selectedDate = new Date(requestDto.selectedDate);
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          queryBuilder.andWhere('checklist.checklistDate >= :startDate', {
            startDate: selectedDate,
          });
          queryBuilder.andWhere('checklist.checklistDate < :endDate', { endDate: nextDay });
        }
      }

      // Calculate pagination
      const page = parseInt(requestDto.page) || 1;
      const limit = parseInt(requestDto.limit) || 10;
      const skip = (page - 1) * limit;

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting - ONLY use fields that exist in Checklist entity
      if (requestDto.sortField === 'id') {
        queryBuilder.orderBy('checklist.id', requestDto.sortOrder === 'asc' ? 'ASC' : 'DESC');
      } else if (requestDto.sortField === 'vehicleRegNo') {
        queryBuilder.orderBy(
          'checklist.vehicleRegNo',
          requestDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
      } else if (requestDto.sortField === 'checkedBy') {
        queryBuilder.orderBy(
          'checkedBy.displayname',
          requestDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
      } else if (requestDto.sortField === 'status') {
        queryBuilder.orderBy('checklist.status', requestDto.sortOrder === 'asc' ? 'ASC' : 'DESC');
      } else if (requestDto.sortField === 'createdAt') {
        queryBuilder.orderBy(
          'checklist.createdAt',
          requestDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
      } else {
        // Default sort by checklistDate descending (newest first)
        queryBuilder.orderBy(
          'checklist.checklistDate',
          requestDto.sortOrder === 'asc' ? 'ASC' : 'DESC',
        );
      }

      // Get paginated results
      const checklists = await queryBuilder.skip(skip).take(limit).getMany();

      // Transform checklists to response format
      const checklistCards = checklists.map((checklist) => {
        try {
          return {
            id: checklist.id,
            vehicleId: checklist.vehicle?.id || null,
            vehicleRegNo: checklist.vehicleRegNo,
            checklistDate: checklist.checklistDate,
            checkedBy: checklist.checkedBy
              ? {
                  id: checklist.checkedBy.id,
                  name: checklist.checkedBy.displayname || checklist.checkedBy.username,
                  role: checklist.checkedBy.role,
                }
              : null,
            createdAt: checklist.createdAt,
            updatedAt: checklist.updatedAt,
            isSubmitted: checklist.isSubmitted,
            status: checklist.status,
            approvedBy: checklist.approvedBy
              ? {
                  id: checklist.approvedBy.id,
                  name: checklist.approvedBy.displayname || checklist.approvedBy.username,
                  role: checklist.approvedBy.role,
                }
              : null,
            responses: {},
          };
        } catch (error) {
          console.error(`Error processing checklist ${checklist.id}:`, error);
          return {
            id: checklist.id,
            vehicleId: checklist.vehicle?.id || null,
            vehicleRegNo: checklist.vehicleRegNo,
            checklistDate: checklist.checklistDate,
            checkedBy: null,
            createdAt: checklist.createdAt,
            isSubmitted: checklist.isSubmitted,
            status: checklist.status,
            approvedBy: null,
            responses: {},
          };
        }
      });

      const hasMore = skip + checklists.length < total;

      return {
        success: true,
        data: {
          checklists: checklistCards,
          total,
          page,
          limit,
          hasMore,
          sortField: requestDto.sortField || 'checklistDate',
          sortOrder: requestDto.sortOrder || 'desc',
        },
        statusCode: 200,
      };
    } catch (error) {
      console.error('Error in getAllChecklists:', error);
      console.error('Stack trace:', error.stack);

      return {
        success: false,
        error: error.message || 'Failed to fetch checklists',
        statusCode: 500,
        data: {
          checklists: [],
          total: 0,
          page: parseInt(requestDto.page) || 1,
          limit: parseInt(requestDto.limit) || 10,
          hasMore: false,
        },
      };
    }
  }

  async getAllVehiclesChecklists(user: any, requestDto: any) {
    try {
      // Get all vehicles first
      const vehiclesQueryBuilder = this.vehicleRepository
        .createQueryBuilder('vehicle')
        .select(['vehicle.id', 'vehicle.regNo']);

      // Apply search filter for vehicles if provided
      if (requestDto.search && requestDto.search.trim() !== '') {
        const searchTerm = `%${requestDto.search.trim()}%`;
        vehiclesQueryBuilder.andWhere('vehicle.regNo ILIKE :searchTerm', { searchTerm });
      }

      const allVehicles = await vehiclesQueryBuilder.getMany();

      // Build checklist query
      const queryBuilder = this.checklistRepository
        .createQueryBuilder('checklist')
        .leftJoinAndSelect('checklist.vehicle', 'vehicle')
        .leftJoinAndSelect('checklist.checkedBy', 'checkedBy')
        .leftJoinAndSelect('checklist.approvedBy', 'approvedBy');

      // Apply time filter for checklist date
      if (requestDto.timeFilter && requestDto.timeFilter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestDto.timeFilter === 'today') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          queryBuilder.andWhere('checklist.checklistDate >= :startDate', { startDate: today });
          queryBuilder.andWhere('checklist.checklistDate < :endDate', { endDate: tomorrow });
        } else if (requestDto.timeFilter !== 'today' && requestDto.timeFilter !== 'date') {
          try {
            const selectedDate = new Date(requestDto.timeFilter);
            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            queryBuilder.andWhere('checklist.checklistDate >= :startDate', {
              startDate: selectedDate,
            });
            queryBuilder.andWhere('checklist.checklistDate < :endDate', { endDate: nextDay });
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        } else if (requestDto.timeFilter === 'date' && requestDto.selectedDate) {
          const selectedDate = new Date(requestDto.selectedDate);
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          queryBuilder.andWhere('checklist.checklistDate >= :startDate', {
            startDate: selectedDate,
          });
          queryBuilder.andWhere('checklist.checklistDate < :endDate', { endDate: nextDay });
        }
      }

      // Get all checklists matching filters
      const checklists = await queryBuilder.getMany();

      // Create a map of vehicleId to checklist
      const checklistMap = new Map();
      checklists.forEach((checklist) => {
        if (checklist.vehicle) {
          checklistMap.set(checklist.vehicle.id, checklist);
        }
      });

      // Transform to response format
      const allChecklistCards = allVehicles.map((vehicle) => {
        const checklist = checklistMap.get(vehicle.id);

        if (checklist) {
          // Vehicle has a checklist
          return {
            id: checklist.id.toString(),
            vehicleId: checklist.vehicle?.id.toString() || vehicle.id.toString(),
            vehicleRegNo: checklist.vehicleRegNo || vehicle.regNo,
            checklistDate: checklist.checklistDate,
            checkedBy: checklist.checkedBy
              ? {
                  id: checklist.checkedBy.id.toString(),
                  name: checklist.checkedBy.displayname || checklist.checkedBy.username,
                  role: checklist.checkedBy.role,
                }
              : null,
            createdAt: checklist.createdAt,
            isSubmitted: checklist.isSubmitted || false,
            status: checklist.status,
          };
        } else {
          // Vehicle has no checklist
          return {
            id: '',
            vehicleId: vehicle.id.toString(),
            vehicleRegNo: vehicle.regNo,
            checklistDate: null,
            checkedBy: null,
            createdAt: null,
            isSubmitted: false,
            status: null,
          };
        }
      });

      // Apply pagination
      const page = parseInt(requestDto.page) || 1;
      const limit = parseInt(requestDto.limit) || 10;
      const skip = (page - 1) * limit;

      const total = allChecklistCards.length;
      const totalChecklists = checklists.length;
      const paginatedChecklists = allChecklistCards.slice(skip, skip + limit);

      // Apply sorting
      if (requestDto.sortField === 'vehicleRegNo') {
        paginatedChecklists.sort((a, b) => {
          const comparison = a.vehicleRegNo.localeCompare(b.vehicleRegNo);
          return requestDto.sortOrder === 'asc' ? comparison : -comparison;
        });
      } else if (requestDto.sortField === 'checkedBy') {
        paginatedChecklists.sort((a, b) => {
          const nameA = a.checkedBy?.name || '';
          const nameB = b.checkedBy?.name || '';
          const comparison = nameA.localeCompare(nameB);
          return requestDto.sortOrder === 'asc' ? comparison : -comparison;
        });
      } else {
        // Default sort by checklistDate (submitted ones first, then draft)
        paginatedChecklists.sort((a, b) => {
          if (a.isSubmitted === b.isSubmitted) {
            if (a.checklistDate && b.checklistDate) {
              const comparison =
                new Date(a.checklistDate).getTime() - new Date(b.checklistDate).getTime();
              return requestDto.sortOrder === 'asc' ? comparison : -comparison;
            }
            return 0;
          }
          return a.isSubmitted ? -1 : 1;
        });
      }

      const hasMore = skip + paginatedChecklists.length < total;

      return {
        success: true,
        data: {
          checklists: paginatedChecklists,
          total,
          totalChecklists,
          page,
          limit,
          hasMore,
          sortField: requestDto.sortField || 'checklistDate',
          sortOrder: requestDto.sortOrder || 'desc',
        },
        statusCode: 200,
      };
    } catch (error) {
      console.error('Error in getAllVehiclesChecklists:', error);
      console.error('Stack trace:', error.stack);

      return {
        success: false,
        error: error.message || 'Failed to fetch vehicles checklists',
        statusCode: 500,
        data: {
          checklists: [],
          total: 0,
          page: parseInt(requestDto.page) || 1,
          limit: parseInt(requestDto.limit) || 10,
          hasMore: false,
        },
      };
    }
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
      approvedBy: checklist.approvedBy
        ? {
            id: checklist.approvedBy.id,
            name: checklist.approvedBy.displayname || checklist.approvedBy.username,
            role: checklist.approvedBy.role,
          }
        : undefined,
      comment: checklist.comment,
      responses,
      isSubmitted: checklist.isSubmitted,
      status: checklist.status,
      createdAt: checklist.createdAt,
      updatedAt: checklist.updatedAt,
    };
  }
}
