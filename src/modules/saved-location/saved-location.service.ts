// src/modules/saved-location/saved-location.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SavedLocation,
  CreateSavedLocationDto,
  UpdateSavedLocationDto,
} from 'src/infra/database/entities/saved-location.entity';

@Injectable()
export class SavedLocationService {
  constructor(
    @InjectRepository(SavedLocation)
    private readonly savedLocationRepo: Repository<SavedLocation>,
  ) {}

  async create(userId: number, dto: CreateSavedLocationDto) {
    const location = this.savedLocationRepo.create({
      ...dto,
      userId,
      isFavorite: dto.isFavorite || false,
      useCount: 0,
    });
    return await this.savedLocationRepo.save(location);
  }

  async findAll(userId: number) {
    return await this.savedLocationRepo.find({
      where: { userId },
      order: { isFavorite: 'DESC', useCount: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(userId: number, id: number) {
    const location = await this.savedLocationRepo.findOne({
      where: { id, userId },
    });
    if (!location) {
      throw new NotFoundException('Saved location not found');
    }
    return location;
  }

  async update(userId: number, id: number, dto: UpdateSavedLocationDto) {
    const location = await this.findOne(userId, id);
    Object.assign(location, dto);
    return await this.savedLocationRepo.save(location);
  }

  async incrementUseCount(userId: number, id: number) {
    const location = await this.findOne(userId, id);
    location.useCount += 1;
    location.lastUsedAt = new Date();
    return await this.savedLocationRepo.save(location);
  }

  async delete(userId: number, id: number) {
    const result = await this.savedLocationRepo.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Saved location not found');
    }
    return { success: true };
  }

  async toggleFavorite(userId: number, id: number) {
    const location = await this.findOne(userId, id);
    location.isFavorite = !location.isFavorite;
    return await this.savedLocationRepo.save(location);
  }
}
