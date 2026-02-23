import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUpdateDto } from './dto/create-update.dto';
import { CheckUpdateDto } from './dto/check-update.dto';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppUpdate } from 'src/infra/database/entities/update.entity';

@Injectable()
export class UpdatesService {
  constructor(
    @InjectRepository(AppUpdate)
    private updateRepository: Repository<AppUpdate>,
  ) {}

  async create(createUpdateDto: CreateUpdateDto): Promise<AppUpdate> {
    const update = this.updateRepository.create(createUpdateDto);
    return await this.updateRepository.save(update);
  }

  async createWithFile(
    createUpdateDto: CreateUpdateDto,
    file: Express.Multer.File,
  ): Promise<AppUpdate> {
    try {
      const fileSizeMB = file.size / (1024 * 1024);
      
      // Create the update record first to get an ID
      const updateData = {
        ...createUpdateDto,
        fileName: file.filename,
        filePath: file.path,
        originalFileName: file.originalname,
        fileSize: parseFloat(fileSizeMB.toFixed(2)),
        downloadUrl: '', // Temporary empty, will update after save
      };

      const update = this.updateRepository.create(updateData);
      const savedUpdate = await this.updateRepository.save(update);
      
      // Now that we have an ID, generate the correct download URL
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const downloadUrl = `${baseUrl}/api/v1/updates/${savedUpdate.id}/download`;
      
      // Update the record with the correct download URL
      savedUpdate.downloadUrl = downloadUrl;
      return await this.updateRepository.save(savedUpdate);
      
    } catch (error) {
      // Clean up uploaded file if there's an error
      if (file?.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw new InternalServerErrorException(
        `Failed to create update: ${error.message}`,
      );
    }
  }

  async findAll(): Promise<AppUpdate[]> {
    return await this.updateRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllWithInactive(): Promise<AppUpdate[]> {
    return await this.updateRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AppUpdate> {
    const update = await this.updateRepository.findOne({ where: { id } });
    if (!update) {
      throw new NotFoundException(`Update with ID ${id} not found`);
    }
    return update;
  }

  async checkForUpdate(checkUpdateDto: CheckUpdateDto) {
    const { currentVersion, currentBuild, platform } = checkUpdateDto;
    
    // Get all active updates for the platform
    const updates = await this.updateRepository.find({
      where: [
        { isActive: true, platform: 'both' },
        { isActive: true, platform: platform === 'web' ? 'web' : platform },
      ],
      order: { createdAt: 'DESC' },
    });

    if (updates.length === 0) {
      return {
        updateAvailable: false,
        message: 'No updates available',
      };
    }

    // Find updates that are newer than current version
    const newerUpdates = updates.filter((update) => {
      return this.compareVersions(update.version, currentVersion);
    });

    if (newerUpdates.length === 0) {
      return {
        updateAvailable: false,
        message: 'App is up to date',
      };
    }

    // Get the latest update
    const latestUpdate = newerUpdates[0];
    
    // Check if this is a silent update
    if (latestUpdate.isSilent && latestUpdate.downloadUrl) {
      return {
        updateAvailable: true,
        updateType: 'silent',
        data: latestUpdate,
        message: 'Silent update available',
      };
    }

    // Check if it's a store redirect
    if (latestUpdate.redirectToStore) {
      return {
        updateAvailable: true,
        updateType: 'store_redirect',
        data: latestUpdate,
        message: 'Update available on store',
      };
    }

    // Regular update with user confirmation
    return {
      updateAvailable: true,
      updateType: 'user_confirmation',
      data: latestUpdate,
      message: 'Update available',
    };
  }

  private compareVersions(newVersion: string, currentVersion: string): boolean {
    // Simple version comparison
    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }
    
    return false;
  }

  async update(id: string, updateData: Partial<AppUpdate>): Promise<AppUpdate> {
    const update = await this.findOne(id);
    Object.assign(update, updateData);
    return await this.updateRepository.save(update);
  }

  async remove(id: string): Promise<void> {
    const update = await this.findOne(id);
    
    // Delete file if exists
    if (update.filePath && existsSync(update.filePath)) {
      try {
        unlinkSync(update.filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    await this.updateRepository.delete(id);
  }

  async getUpdateFile(id: string): Promise<{ filePath: string; fileName: string }> {
    const update = await this.findOne(id);
    
    if (!update.filePath) {
      throw new NotFoundException('File not found for this update');
    }

    if (!existsSync(update.filePath)) {
      throw new NotFoundException('File does not exist on server');
    }

    return {
      filePath: update.filePath,
      fileName: update.originalFileName || update.fileName,
    };
  }

  async getStats(): Promise<any> {
    const updates = await this.updateRepository.find();
    
    const stats = {
      totalUpdates: updates.length,
      androidUpdates: updates.filter(u => u.platform === 'android').length,
      iosUpdates: updates.filter(u => u.platform === 'ios').length,
      webUpdates: updates.filter(u => u.platform === 'web').length,
      bothUpdates: updates.filter(u => u.platform === 'both').length,
      mandatoryUpdates: updates.filter(u => u.isMandatory).length,
      silentUpdates: updates.filter(u => u.isSilent).length,
      activeUpdates: updates.filter(u => u.isActive).length,
      averageFileSize: updates.length > 0 
        ? updates.reduce((sum, u) => sum + u.fileSize, 0) / updates.length 
        : 0,
      totalFileSize: updates.reduce((sum, u) => sum + u.fileSize, 0),
    };

    return stats;
  }

  async toggleActive(id: string): Promise<AppUpdate> {
    const update = await this.findOne(id);
    update.isActive = !update.isActive;
    return await this.updateRepository.save(update);
  }

  async searchUpdates(query: string): Promise<AppUpdate[]> {
    return await this.updateRepository
      .createQueryBuilder('update')
      .where('update.version LIKE :query', { query: `%${query}%` })
      .orWhere('update.updateTitle LIKE :query', { query: `%${query}%` })
      .orWhere('update.updateDescription LIKE :query', { query: `%${query}%` })
      .orderBy('update.createdAt', 'DESC')
      .getMany();
  }
}