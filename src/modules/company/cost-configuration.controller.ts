
import { 
  Controller, Get, Post, Put, Delete, 
  Body, Param, Query, UseGuards, HttpStatus, 
  BadRequestException
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, 
  ApiQuery, ApiParam, ApiBody, ApiOkResponse, 
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse
} from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCostConfigurationDto, UpdateCostConfigurationDto } from './dto/cost-configuration-request.dto';
import { CostConfigurationResponseDto, CostConfigurationListResponseDto } from './dto/cost-configuration-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user.entity';
import { ErrorResponseDto } from 'src/common/dto/errorResponse.dto';

@ApiTags('Cost Configurations API')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ 
  description: 'Unauthorized - Invalid or missing JWT token',
  type: ErrorResponseDto,
  example: ErrorResponseDto.example('Unauthorized - Invalid or missing JWT token', HttpStatus.UNAUTHORIZED)
})
@ApiInternalServerErrorResponse({ 
  description: 'Internal server error.',
  type: ErrorResponseDto,
  example: ErrorResponseDto.example('Internal server error.', HttpStatus.INTERNAL_SERVER_ERROR)
})
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN, UserRole.HR)
@Controller('company/:companyId/cost-configurations/')
export class CostConfigurationController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('create')
  @ApiOperation({ 
    summary: 'Create cost configuration',
    description: 'Create a new cost configuration for a company. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiBody({ type: CreateCostConfigurationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cost configuration created successfully',
    type: CostConfigurationResponseDto
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cost configuration for this vehicle type and date already exists'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot create configuration because a future configuration exists'
  })
  async createCostConfiguration(
    @Param('companyId') companyId: string,
    @Body() dto: CreateCostConfigurationDto
  ) {
    // Ensure companyId in URL matches the one in DTO
    if (dto.companyId !== +companyId) {
      throw new BadRequestException('Company ID in URL does not match request body');
    }
    return this.companyService.createCostConfiguration(dto);
  }

  @Get('get')
  @ApiOperation({ 
    summary: 'Get company cost configurations',
    description: 'Retrieve all cost configurations for a company with optional vehicle type filter. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiQuery({
    name: 'vehicleType',
    required: false,
    enum: ['Car', 'Van', 'Lorry', 'SUV', 'Truck'],
    description: 'Filter by vehicle type'
  })
  @ApiOkResponse({
    description: 'Cost configurations retrieved successfully',
    type: CostConfigurationListResponseDto
  })
  async getCompanyCostConfigurations(
    @Param('companyId') companyId: string,
    @Query('vehicleType') vehicleType?: string
  ) {
    return this.companyService.getCompanyCostConfigurations(+companyId, vehicleType);
  }

  @Get('get-current')
  @ApiOperation({ 
    summary: 'Get current cost configuration',
    description: 'Get the current active cost configuration for a specific vehicle type. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiQuery({
    name: 'vehicleType',
    required: true,
    enum: ['Car', 'Van', 'Lorry', 'SUV', 'Truck'],
    description: 'Vehicle type'
  })
  @ApiOkResponse({
    description: 'Current cost configuration retrieved',
    type: CostConfigurationResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active cost configuration found for this vehicle type'
  })
  async getCurrentCostConfiguration(
    @Param('companyId') companyId: string,
    @Query('vehicleType') vehicleType: string
  ) {
    if (!vehicleType) {
      throw new BadRequestException('Vehicle type is required');
    }
    return this.companyService.getCurrentCostConfiguration(+companyId, vehicleType);
  }

  @Get('get-history')
  @ApiOperation({ 
    summary: 'Get cost configuration history',
    description: 'Get historical cost configurations for a specific vehicle type. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiQuery({
    name: 'vehicleType',
    required: true,
    enum: ['Car', 'Van', 'Lorry', 'SUV', 'Truck'],
    description: 'Vehicle type'
  })
  @ApiOkResponse({
    description: 'Cost configuration history retrieved',
    type: CostConfigurationListResponseDto
  })
  async getCostConfigurationHistory(
    @Param('companyId') companyId: string,
    @Query('vehicleType') vehicleType: string
  ) {
    if (!vehicleType) {
      throw new BadRequestException('Vehicle type is required');
    }
    return this.companyService.getCostConfigurationHistory(+companyId, vehicleType);
  }

  @Get('get/:id')
  @ApiOperation({ 
    summary: 'Get cost configuration by ID',
    description: 'Retrieve specific cost configuration details. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiParam({
    name: 'id',
    description: 'Cost Configuration ID',
    type: Number,
    example: 1
  })
  @ApiOkResponse({
    description: 'Cost configuration retrieved successfully',
    type: CostConfigurationResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cost configuration not found'
  })
  async getCostConfiguration(
    @Param('companyId') companyId: string,
    @Param('id') id: string
  ) {
    return this.companyService.getCostConfiguration(+id);
  }

  @Put('update/:id')
  @ApiOperation({ 
    summary: 'Update cost configuration',
    description: 'Update an existing cost configuration. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiParam({
    name: 'id',
    description: 'Cost Configuration ID',
    type: Number,
    example: 1
  })
  @ApiBody({ type: UpdateCostConfigurationDto })
  @ApiOkResponse({
    description: 'Cost configuration updated successfully',
    type: CostConfigurationResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cost configuration not found'
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cost configuration for this vehicle type and date already exists'
  })
  async updateCostConfiguration(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCostConfigurationDto
  ) {
    return this.companyService.updateCostConfiguration(+id, dto);
  }

  @Delete('delete/:id')
  @ApiOperation({ 
    summary: 'Delete cost configuration',
    description: 'Delete a cost configuration. Cannot delete current active configuration. Requires Manager role or higher.'
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    type: Number,
    example: 1
  })
  @ApiParam({
    name: 'id',
    description: 'Cost Configuration ID',
    type: Number,
    example: 1
  })
  @ApiOkResponse({
    description: 'Cost configuration deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Cost configuration deleted successfully',
        data: {
          deletedConfigurationId: 1
        },
        timestamp: '2025-01-20T15:00:00.000Z',
        statusCode: 200
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cost configuration not found'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete the current active cost configuration'
  })
  async deleteCostConfiguration(
    @Param('companyId') companyId: string,
    @Param('id') id: string
  ) {
    return this.companyService.deleteCostConfiguration(+id);
  }
}