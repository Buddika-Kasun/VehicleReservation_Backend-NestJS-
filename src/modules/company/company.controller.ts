
import { 
  Controller, Get, Post, Put, Patch, Delete, 
  Body, Param, Query, UseGuards, 
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiInternalServerErrorResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Company API')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ 
  description: 
  `
        Unauthorized - Invalid or missing JWT token
  `
})
@ApiInternalServerErrorResponse({ 
  description: 
  `
        Internal server error.
  `
})
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('create')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({
    status: 409,
    description:
    `
        Company with this name already exists.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Company created successfully.
    `
  })
  async createCompany(@Body() dto: CreateCompanyDto) {
    return this.companyService.createCompany(dto);
  }

  @Get('get-all')
  @Roles(UserRole.SYSADMIN, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all companies' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Companies retrieved successfully.
    `
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  async getAllCompanies(@Query('isActive') isActive?: boolean) {
    return this.companyService.getAllCompanies(isActive);
  }

  @Get('search')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Search companies by name' })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Companies search completed.
    `
  })
  @ApiQuery({ name: 'name', required: true, description: 'Company name to search for' })
  async searchCompanies(@Query('name') name: string) {
    return this.companyService.searchCompanies(name);
  }

  @Get('get/:id')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get company by ID' })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
        Company not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Companies retrieved successfully.
    `
  })
  async getCompany(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.getCompany(id);
  }

  @Get('statistics/:id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Get company statistics' })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
        Company not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Company statistics retrieved.
    `
  })
  async getCompanyStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.getCompanyStatistics(id);
  }

  @Put('update/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Update company details' })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
        Company not found.
    `
  })
  @ApiResponse({
    status: 409,
    description:
    `
        Company with this name already exists.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Company updated successfully.
    `
  })
  async updateCompany(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companyService.updateCompany(id, dto);
  }

  @Patch('deactivate/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Deactivate a company' })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
        Company is already deactivated.
        Cannot deactivate company with {activeVehicles.length} active vehicles.
        Cannot deactivate company with {activeDepartments.length} active departments.
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
        Company not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Company deactivated successfully.
    `
  })
  async deactivateCompany(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.deactivateCompany(id);
  }

  @Patch('activate/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Activate a company' })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
        Company is already activated.
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
        Company not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Company activated successfully.
    `
  })
  async activateCompany(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.activateCompany(id);
  }

  @Delete('delete/:id')
  @Roles(UserRole.ADMIN, UserRole.SYSADMIN)
  @ApiOperation({ summary: 'Permanently delete a company (use with caution)' })
  @ApiResponse({ 
    status: 400, 
    description: 
    `
        Cannot delete company with existing vehicles, departments, or cost centers.
    `
  })
  @ApiResponse({ 
    status: 404, 
    description: 
    `
        Company not found.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
        Company deleted permanently.
    `
  })
  async deleteCompany(@Param('id', ParseIntPipe) id: number) {
    return await this.companyService.hardDeleteCompany(id);
  }
  
}