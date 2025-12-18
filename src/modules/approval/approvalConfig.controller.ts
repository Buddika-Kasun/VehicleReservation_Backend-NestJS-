import { Controller, Get, Post, Put, Patch, Delete, Query, Param, Body, UseGuards, HttpStatus, HttpCode, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ApprovalConfigService } from './approvalConfig.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { CreateApprovalConfigDto, UpdateApprovalConfigDto } from './dto/approval-config-request.dto';
import { GetUser } from 'src/common/decorators/user.decorator';

@ApiTags('Approval Config API')
@Controller('approval-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ApprovalConfigController {
  constructor(private readonly service: ApprovalConfigService) {}

  @Post('create')
  @Roles(UserRole.SYSADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create approval config' })
  async create(@Body() dto: CreateApprovalConfigDto) {
    return await this.service.create(dto);
  }

  @Get('get-menu-approvals')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.SYSADMIN, UserRole.EMPLOYEE, UserRole.DRIVER, UserRole.SECURITY)
  @ApiOperation({ summary: 'Get all approvals for menu' })
  async findMenuApproval(
    @GetUser() user: any
  ) {
    return await this.service.findMenuApproval(user.userId);
  }

  @Get('get-all')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get all approval configs' })
  async findAll() {
    return await this.service.findAll();
  }

  @Get('get/:id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get approval config by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.service.findOne(id);
  }

  @Put('update/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Update approval config' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateApprovalConfigDto) {
    return await this.service.update(id, dto);
  }

  @Delete('delete/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Delete approval config' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.service.remove(id);
  }

  @Patch('toggle-status/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Toggle approval config active status' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return await this.service.toggleStatus(id);
  }
}
