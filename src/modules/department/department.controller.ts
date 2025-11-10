
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { DepartmentService } from './department.service';
import { UserRole } from 'src/database/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department-request.dto';
import { DepartmentListResponseDto, DepartmentResponseDto } from './dto/department-response.dto';

@ApiTags('Departments API')
@Controller('departments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post('create')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Company, cost center, or user not found' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    const result = await this.departmentService.create(createDepartmentDto);
    return { success: true, data: result };
  }

  @Get('get-all')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all departments' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiQuery({ name: 'costCenterId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Departments retrieved successfully', type: DepartmentListResponseDto })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('companyId') companyId?: number,
    @Query('costCenterId') costCenterId?: number,
  ) {
    const result = await this.departmentService.findAll(page, limit, search, companyId, costCenterId);
    return { success: true, data: result };
  }

  @Get('get/:id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiResponse({ status: 200, description: 'Department retrieved successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const result = await this.departmentService.findOne(id);
    return { success: true, data: result };
  }

  @Patch('update/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    const result = await this.departmentService.update(id, updateDepartmentDto);
    return { success: true, data: result };
  }

  @Delete('delete/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.departmentService.remove(id);
    return { success: true, data: result };
  }

  @Patch('toggle-status/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle department active status' })
  @ApiResponse({ status: 200, description: 'Department status updated successfully', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    const result = await this.departmentService.toggleStatus(id);
    return { success: true, data: result };
  }
}