
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { DepartmentService } from './department.service';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department-request.dto';
import { DepartmentListResponseDto, DepartmentResponseDto } from './dto/department-response.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Departments API')
@Controller('department')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post('create')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Company, cost center, or user not found' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return await this.departmentService.create(createDepartmentDto);
  }

  @Get('get-all')
  //@Roles(UserRole.ADMIN, UserRole.SYSADMIN, UserRole.HR)
  @Public()
  @ApiOperation({ summary: 'Get all departments' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiQuery({ name: 'costCenterId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Departments retrieved successfully', type: DepartmentListResponseDto })
  async findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 20;
    const companyIdNumber = companyId ? parseInt(companyId, 10) : undefined;
    const costCenterIdNumber = costCenterId ? parseInt(costCenterId, 10) : undefined;
    return await this.departmentService.findAll(pageNumber, limitNumber, search, companyIdNumber, costCenterIdNumber);
  }

  @Get('get/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiResponse({ status: 200, description: 'Department retrieved successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.departmentService.findOne(id);
  }

  @Put('update/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    return await this.departmentService.update(id, updateDepartmentDto);
  }

  @Delete('delete/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.departmentService.remove(id);
  }

  @Patch('toggle-status/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Toggle department active status' })
  @ApiResponse({ status: 200, description: 'Department status updated successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return await this.departmentService.toggleStatus(id);
  }
}