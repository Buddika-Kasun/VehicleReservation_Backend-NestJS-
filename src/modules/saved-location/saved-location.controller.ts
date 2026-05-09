// src/modules/saved-location/saved-location.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SavedLocationService } from './saved-location.service';
import {
  CreateSavedLocationDto,
  UpdateSavedLocationDto,
} from 'src/infra/database/entities/saved-location.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/common/decorators/user.decorator';

@Controller('saved-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SYSADMIN,
  UserRole.ADMIN,
  UserRole.DRIVER,
  UserRole.EMPLOYEE,
  UserRole.HR,
  UserRole.SECURITY,
  UserRole.SUPERVISOR,
)
@ApiBearerAuth()
export class SavedLocationController {
  constructor(private readonly savedLocationService: SavedLocationService) {}

  @Post('save')
  async create(@GetUser() user: any, @Body() dto: CreateSavedLocationDto) {
    const userId = user.userId;
    const location = await this.savedLocationService.create(userId, dto);
    return {
      success: true,
      message: 'Location saved successfully',
      data: location,
    };
  }

  @Get('get-all')
  async findAll(@GetUser() user: any) {
    const userId = user.userId;
    const locations = await this.savedLocationService.findAll(userId);
    return {
      success: true,
      data: locations,
    };
  }

  @Get('get/:id')
  async findOne(@GetUser() user: any, @Param('id') id: string) {
    const userId = user.userId;
    const location = await this.savedLocationService.findOne(userId, parseInt(id));
    return {
      success: true,
      data: location,
    };
  }

  @Put('update/:id')
  async update(@GetUser() user: any, @Param('id') id: string, @Body() dto: UpdateSavedLocationDto) {
    const userId = user.userId;
    const location = await this.savedLocationService.update(userId, parseInt(id), dto);
    return {
      success: true,
      message: 'Location updated successfully',
      data: location,
    };
  }

  @Post('use/:id')
  async incrementUseCount(@GetUser() user: any, @Param('id') id: string) {
    const userId = user.userId;
    const location = await this.savedLocationService.incrementUseCount(userId, parseInt(id));
    return {
      success: true,
      data: location,
    };
  }

  @Post('favorite/:id')
  async toggleFavorite(@GetUser() user: any, @Param('id') id: string) {
    const userId = user.userId;
    const location = await this.savedLocationService.toggleFavorite(userId, parseInt(id));
    return {
      success: true,
      message: location.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      data: location,
    };
  }

  @Delete('delete/:id')
  async delete(@GetUser() user: any, @Param('id') id: string) {
    const userId = user.userId;
    await this.savedLocationService.delete(userId, parseInt(id));
    return {
      success: true,
      message: 'Location deleted successfully',
    };
  }
}
