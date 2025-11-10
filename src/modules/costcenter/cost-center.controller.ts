// src/modules/company-structure/controllers/cost-center.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CostCenterService } from './cost-center.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserRole } from 'src/database/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateCostCenterDto, UpdateCostCenterDto } from './dto/cost-center-request.dto';
import { CostCenterListResponseDto, CostCenterResponseDto } from './dto/cost-center-response.dto';

@ApiTags('Cost Center API')
@Controller('cost-center')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CostCenterController {
  constructor(private readonly costCenterService: CostCenterService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new cost center' })
  @ApiResponse({ status: 201, description: 'Cost center created successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async create(@Body() createCostCenterDto: CreateCostCenterDto) {
    const result = await this.costCenterService.create(createCostCenterDto);
    return { success: true, data: result };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all cost centers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Cost centers retrieved successfully', type: CostCenterListResponseDto })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('companyId') companyId?: number,
  ) {
    const result = await this.costCenterService.findAll(page, limit, search, companyId);
    return { success: true, data: result };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get a cost center by ID' })
  @ApiResponse({ status: 200, description: 'Cost center retrieved successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const result = await this.costCenterService.findOne(id);
    return { success: true, data: result };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a cost center' })
  @ApiResponse({ status: 200, description: 'Cost center updated successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCostCenterDto: UpdateCostCenterDto) {
    const result = await this.costCenterService.update(id, updateCostCenterDto);
    return { success: true, data: result };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a cost center' })
  @ApiResponse({ status: 200, description: 'Cost center deleted successfully' })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete cost center with departments' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.costCenterService.remove(id);
    return { success: true, data: result };
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle cost center active status' })
  @ApiResponse({ status: 200, description: 'Cost center status updated successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    const result = await this.costCenterService.toggleStatus(id);
    return { success: true, data: result };
  }
}