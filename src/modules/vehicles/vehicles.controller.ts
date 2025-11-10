import { 
  Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, 
  UseInterceptors,
  UploadedFile,
  Patch
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { UserRole } from 'src/database/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';
import { VehicleService } from './vehicles.service';
import { AssignDriverDto, CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle-request.dto';
import { VehicleListResponseDto, VehicleResponseDto } from './dto/vehicle-response.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/config/multer.config';
import { VehiclePictureDto } from './dto/vehicle-picture.dto';

@ApiTags('Vehicles API')
@Controller('vehicle')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post('create')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new vehicle' })
  @ApiBody({ type: CreateVehicleDto })
  @ApiResponse({ status: 201, description: 'Vehicle created successfully', type: VehicleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async create(@Body() createVehicleDto: CreateVehicleDto) {
    const result = await this.vehicleService.createVehicle(createVehicleDto);
    return { success: true, data: result };
  }

  @Get('get-all')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all vehicles with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Vehicles retrieved successfully', type: VehicleListResponseDto })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('companyId', new ParseIntPipe({ optional: true })) companyId?: number,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string
  ) {
    const result = await this.vehicleService.getAllVehicles(page, limit, companyId, isActive, search);
    return { success: true, data: result };
  }

  @Get('get/:id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get a vehicle by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle retrieved successfully', type: VehicleResponseDto })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const result = await this.vehicleService.getVehicle(id);
    return { success: true, data: result };
  }

  @Put('update/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiBody({ type: UpdateVehicleDto })
  @ApiResponse({ status: 200, description: 'Vehicle updated successfully', type: VehicleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle or company not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVehicleDto: UpdateVehicleDto
  ) {
    const result = await this.vehicleService.updateVehicle(id, updateVehicleDto);
    return { success: true, data: result };
  }

  @Delete('delete/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a vehicle' })
  @ApiResponse({ status: 200, description: 'Vehicle deleted successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found or already assigned' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.vehicleService.deleteVehicle(id);
    return { success: true, data: result };
  }

  @Post('assign-drivers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign drivers to a vehicle' })
  @ApiBody({ type: AssignDriverDto })
  @ApiResponse({ status: 200, description: 'Drivers assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or assignment conflicts' })
  @ApiResponse({ status: 404, description: 'Vehicle or driver not found' })
  async assignDrivers(@Body() assignDriverDto: AssignDriverDto) {
    const result = await this.vehicleService.assignDrivers(assignDriverDto);
    return { success: true, data: result };
  }

  @Put(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle vehicle active status' })
  @ApiResponse({ status: 200, description: 'Vehicle status updated successfully', type: VehicleResponseDto })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    const result = await this.vehicleService.toggleVehicleStatus(id);
    return { success: true, data: result };
  }

  @Put(':id/odometer')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update vehicle odometer reading' })
  @ApiQuery({ name: 'reading', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Odometer updated successfully', type: VehicleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid odometer reading' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async updateOdometer(
    @Param('id', ParseIntPipe) id: number,
    @Body('reading', ParseIntPipe) reading: number
  ) {
    const result = await this.vehicleService.updateOdometer(id, reading);
    return { success: true, data: result };
  }

  @Get('company/:companyId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all vehicles for a specific company' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Company vehicles retrieved successfully', type: VehicleListResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyVehicles(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('isActive') isActive?: boolean
  ) {
    const result = await this.vehicleService.getCompanyVehicles(companyId, isActive);
    return { success: true, data: result };
  }

  @Get('available-vehicles')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all available (unassigned) vehicles' })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Available vehicles retrieved successfully', type: VehicleListResponseDto })
  async getAvailableVehicles(@Query('companyId', new ParseIntPipe({ optional: true })) companyId?: number) {
    const result = await this.vehicleService.getAvailableVehicles(companyId);
    return { success: true, data: result };
  }

  @Get('driver/:driverId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all vehicles assigned to a specific driver' })
  @ApiResponse({ status: 200, description: 'Driver vehicles retrieved successfully', type: VehicleListResponseDto })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async getDriverVehicles(@Param('driverId', ParseIntPipe) driverId: number) {
    const result = await this.vehicleService.getDriverVehicles(driverId);
    return { success: true, data: result };
  }

  @Post(':id/picture-upload')
  @ApiOperation({ summary: 'Upload vehicle picture' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: Number, description: 'Vehicle ID' })
  @ApiBody({
    description: 'Vehicle picture file',
    type: VehiclePictureDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Vehicle picture uploaded successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'No file uploaded or invalid file type'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Vehicle not found'
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadVehiclePicture(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.vehicleService.updateVehiclePicture(id, file);
  }

  @Patch(':id/picture-update')
  @ApiOperation({ summary: 'Update vehicle picture' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: Number, description: 'Vehicle ID' })
  @ApiBody({
    description: 'Vehicle picture file',
    type: VehiclePictureDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Vehicle picture updated successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'No file uploaded or invalid file type'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Vehicle not found'
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async updateVehiclePicture(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.vehicleService.updateVehiclePicture(id, file);
  }

}