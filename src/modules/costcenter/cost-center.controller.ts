import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CostCenterService } from './cost-center.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateCostCenterDto, UpdateCostCenterDto } from './dto/cost-center-request.dto';
import { CostCenterListResponseDto, CostCenterResponseDto } from './dto/cost-center-response.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Cost Center API')
@Controller('cost-center')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CostCenterController {
  constructor(private readonly costCenterService: CostCenterService) {}

  @Post('create')
  @Roles(UserRole.SYSADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new cost center' })
  @ApiResponse({ status: 201, description: 'Cost center created successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async create(@Body() createCostCenterDto: CreateCostCenterDto) {
    return await this.costCenterService.create(createCostCenterDto);
  }

  @Get('get-all')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get all cost centers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Cost centers retrieved successfully', type: CostCenterListResponseDto })
  async findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 20;
    const companyIdNumber = companyId ? parseInt(companyId, 10) : undefined;
    return await this.costCenterService.findAll(pageNumber, limitNumber, search, companyIdNumber);
  }

  @Get('get/:id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get a cost center by ID' })
  @ApiResponse({ status: 200, description: 'Cost center retrieved successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.costCenterService.findOne(id);
  }

  @Put('update/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Update a cost center' })
  @ApiResponse({ status: 200, description: 'Cost center updated successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCostCenterDto: UpdateCostCenterDto
  ) {
    return await this.costCenterService.update(id, updateCostCenterDto);
  }

  @Delete('delete/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Delete a cost center' })
  @ApiResponse({ status: 200, description: 'Cost center deleted successfully' })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete cost center with departments' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.costCenterService.remove(id);
  }

  @Patch('toggle-status/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Toggle cost center active status' })
  @ApiResponse({ status: 200, description: 'Cost center status updated successfully', type: CostCenterResponseDto })
  @ApiResponse({ status: 404, description: 'Cost center not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return await this.costCenterService.toggleStatus(id);
  }
}