import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  UsePipes, 
  ValidationPipe, 
  Param, 
  ParseIntPipe, 
  Delete,
  HttpCode,
  Request,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  Res,
  InternalServerErrorException
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { TripResponseDto, AvailableVehiclesResponseDto } from './dto/trip-response.dto';
import { AssignVehicleToTripDto, AvailableVehiclesRequestDto, CreateTripDto } from './dto/create-trip.dto';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
//import { CancelTripDto } from './dto/trip-request.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/infra/database/entities/user.entity';
import { TripListRequestDto, TripListResponseDto } from './dto/trip-list-request.dto';
import { get } from 'http';
import { VehicleRecommendService } from './vehicleRecommend.service';

@ApiTags('trips')
@Controller('trips')
@UsePipes(new ValidationPipe({ transform: true }))
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.HR, UserRole.SECURITY, UserRole.SUPERVISOR)
@ApiBearerAuth()
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly vehicleRecommendService: VehicleRecommendService,
  ) {}

  @Post('available-vehicles')
  @ApiOperation({ summary: 'Get available vehicles for trip' })
  @ApiBody({ type: AvailableVehiclesRequestDto })
  @ApiResponse({ status: 200, description: 'Available vehicles retrieved successfully', type: AvailableVehiclesResponseDto })
  async getAvailableVehicles(@Body() requestDto: AvailableVehiclesRequestDto) {
    return this.tripsService.getAvailableVehicles(requestDto);
  }

  @Post('available-vehicles-review')
  @Roles(UserRole.SYSADMIN, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get available vehicles for trip review with pagination' })
  @ApiResponse({ status: 200, description: 'Available vehicles retrieved successfully', type: AvailableVehiclesResponseDto })
  async getReviewAvailableVehicles(
    @Query('tripId') tripId: string,
    @Query('page') page: number = 0,
    @Query('pageSize') pageSize: number = 10,
    @Query('search') search?: string,
  ) {
    const requestDto = { 
      tripId, 
      page: Number(page), 
      pageSize: Number(pageSize), 
      search 
    };
    return this.vehicleRecommendService.getReviewAvailableVehicles(requestDto);
  }

  @Post('create')
  @ApiOperation({ summary: 'FR-04.1: Create a trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiResponse({ status: 201, description: 'Trip created successfully', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async createTrip(
    @Body() createTripDto: CreateTripDto, 
    @GetUser() user: any
  ) {
    return this.tripsService.createTrip(createTripDto, user.userId);
  }

  @Post('create-as-draft')
  @ApiOperation({ summary: 'FR-04.1: Create a trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiResponse({ status: 201, description: 'Trip created successfully', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async createTripAsDraft(
    @Body() createTripDto: CreateTripDto, 
    @GetUser() user: any
  ) {
    return this.tripsService.createTripAsDraft(createTripDto, user.userId);
  }

  @Post('assign-trip-vehicle')
  @Roles(UserRole.SYSADMIN, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'FR-04.1: Add vehicle to trip' })
  @ApiResponse({ status: 201, description: 'Trip created successfully', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async assignVehicle(
    @GetUser() user: any,
    @Body() assignVehicleDto: AssignVehicleToTripDto, 
  ) {
    return this.tripsService.assignVehicleToTrip(
      assignVehicleDto.tripId,
      assignVehicleDto.vehicleId,
      user.userId
    );
  }

  @Post('confirm-review/:tripId')
  @Roles(UserRole.SYSADMIN, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'FR-XX.X: Confirm trip review completion' })
  @ApiParam({ name: 'tripId', description: 'ID of the trip to confirm review', type: Number })
  async confirmReviewTrip(
    @GetUser() user: any,
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.tripsService.confirmReviewTrip(
      tripId,
      user.userId
    );
  }

  @Get('get-by-id/:id')
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.HR, UserRole.SECURITY, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get trip by ID' })
  @ApiParam({ name: 'id', description: 'Trip ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Trip retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Trip retrieved successfully' },
        data: { $ref: '#/components/schemas/TripResponseDto' },
        timestamp: { type: 'string', format: 'date-time' },
        statusCode: { type: 'number', example: 200 }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async getTripById(@Param('id', ParseIntPipe) id: number) {
    const result = await this.tripsService.getTripById(id);
    return result;
  }

  @Get('status/:id')
  @ApiOperation({ summary: 'Get trip status' })
  @ApiParam({ name: 'id', description: 'Trip ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Trip status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'pending' },
            driverName: { type: 'string', example: 'John Doe', nullable: true },
            vehicleRegNo: { type: 'string', example: 'CBD-4324', nullable: true },
            vehicleModel: { type: 'string', example: 'Toyota', nullable: true },
            driverPhone: { type: 'string', example: '1234567890', nullable: true },
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async getTripStatus(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getTripStatus(id);
  }

  @Get('combined-trip/:id')
  @ApiOperation({ summary: 'Get combined trip details for driver' })
  @ApiParam({ name: 'id', description: 'Trip ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Combined trip details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            mainTrip: { $ref: '#/components/schemas/TripResponseDto' },
            combinedTrips: { type: 'array', items: { $ref: '#/components/schemas/TripResponseDto' } },
            combinedStops: { type: 'array' },
            vehicle: { type: 'object' },
            driverInstructions: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async getCombinedTrip(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getCombinedTripForDriver(id);
  }

  @Post('cancel/:id')
  @ApiOperation({ summary: 'Cancel a trip' })
  @ApiParam({ name: 'id', description: 'Trip ID', type: Number })
  async cancelTrip(
    @GetUser() user: any,
    @Param('id', ParseIntPipe) tripId: number,
    @Body() body: any,
  ) {
    let reason: string | undefined;
    
    // Simple validation
    if (body && body.reason !== undefined && body.reason !== null) {
      reason = String(body.reason);
      if (reason.length > 500) {
        throw new BadRequestException('Reason cannot exceed 500 characters');
      }
    }
    
    return this.tripsService.cancelTrip(tripId, user, reason);
  }

  @Get('cancelable')
  @ApiOperation({ summary: 'Get list of cancelable trips for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cancelable trips retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            trips: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  startDate: { type: 'string', example: '2024-01-01' },
                  startTime: { type: 'string', example: '10:00:00' },
                  status: { type: 'string', example: 'pending' },
                  vehicle: { 
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'number', example: 1 },
                      regNo: { type: 'string', example: 'CBD-4324' },
                      model: { type: 'string', example: 'Toyota' }
                    }
                  },
                  hasConflicts: { type: 'boolean', example: false },
                  conflictCount: { type: 'number', example: 0 },
                  purpose: { type: 'string', example: 'Business meeting', nullable: true }
                }
              }
            },
            count: { type: 'number', example: 3 }
          }
        },
        statusCode: { type: 'number', example: 200 }
      }
    }
  })
  async getCancelableTrips(@GetUser() user: any) {
    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }
    
    return this.tripsService.getCancelableTrips(user.userId);
  }

  // In trips.controller.ts - Add this method
  @Post('user-trips')
  @ApiOperation({ summary: 'Get user trips with filters' })
  @ApiBody({ type: TripListRequestDto })
  @ApiResponse({
    status: 200,
    description: 'User trips retrieved successfully',
    type: TripListResponseDto,
  })
  async getUserTrips(
    @GetUser() user: any,
    @Body() tripListRequest: TripListRequestDto,
  ) {

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    return this.tripsService.getUserTrips(user, tripListRequest);
  }

  @Post('supervisor-trips')
  @Roles(UserRole.SYSADMIN, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get user trips with filters' })
  @ApiBody({ type: TripListRequestDto })
  @ApiResponse({
    status: 200,
    description: 'User trips retrieved successfully',
    type: TripListResponseDto,
  })
  async getSupervisorTrips(
    @GetUser() user: any,
    @Body() tripListRequest: TripListRequestDto,
  ) {

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }
    
    return this.tripsService.getSupervisorTrips(user, tripListRequest);
  }

  @Post('pending-approvals')
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.HR, UserRole.SECURITY, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get trips pending user approvals' })
  @ApiResponse({
    status: 200,
    description: 'Pending approval trips retrieved successfully',
  })
  async getPendingApprovalTrips(
    @Body() filterDto: any,
    @GetUser() user: any,
  ) {
    const result = await this.tripsService.getPendingApprovalTrips(user.userId, filterDto);
    return result;
  }

  @Post('approve/:tripId')
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.HR, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Approve a trip' })
  @ApiResponse({ status: 200, description: 'Trip approved successfully' })
  async approveTrip(
    @Param('tripId') tripId: number,
    @Body() approveDto: { comment?: string },
    @GetUser() user: any
  ) {
    return await this.tripsService.approveTrip(
      tripId, 
      user.userId, 
      approveDto.comment
    );
  }

  @Post('reject/:tripId')
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.HR, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Reject a trip' })
  @ApiResponse({ status: 200, description: 'Trip rejected successfully' })
  async rejectTrip(
    @Param('tripId') tripId: number,
    @Body() rejectDto: { rejectionReason?: string },
    @GetUser() user: any
  ) {
    return await this.tripsService.rejectTrip(
      tripId, 
      user.userId, 
      rejectDto.rejectionReason
    );
  }

  @Post('for-meter-reading')
  @Roles(UserRole.SYSADMIN, UserRole.SECURITY)
  @ApiOperation({ summary: 'Get trips that need meter reading' })
  @ApiResponse({ status: 200, description: 'Trips retrieved successfully' })
  async getTripsForMeterReading(
    @Body() filterDto: any,
    @GetUser() user: any
  ) {
    return await this.tripsService.getTripsForMeterReading(filterDto);
  }

  @Post('record-odometer/:tripId')
  @Roles(UserRole.SYSADMIN, UserRole.SECURITY)
  @ApiOperation({ summary: 'Record odometer reading for a trip' })
  @ApiResponse({ status: 200, description: 'Odometer reading recorded successfully' })
  async recordOdometerReading(
    @Param('tripId') tripId: number,
    @Body() recordDto: { reading: number; readingType: 'start' | 'end' },
    @GetUser() user: any
  ) {
    return await this.tripsService.recordOdometerReading(
      tripId,
      user.userId,
      recordDto.reading,
      recordDto.readingType
    );
  }

  @Post('mid-trip-approval/:tripId')
  @Roles(UserRole.SYSADMIN, UserRole.SECURITY, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Handle mid-trip approval scenario' })
  @ApiResponse({ status: 200, description: 'Mid-trip approval handled successfully' })
  async handleMidTripApproval(
    @Param('tripId') tripId: number,
    @GetUser() user: any
  ) {
    return await this.tripsService.handleMidTripApproval(tripId, user.userId);
  }

  @Post('already-read')
  @Roles(UserRole.SYSADMIN, UserRole.SECURITY)
  @ApiOperation({ summary: 'Get trips that have been read' })
  @ApiResponse({ status: 200, description: 'Read trips retrieved successfully' })
  async getAlreadyReadTrips(
    @Body() filterDto: any,
    @GetUser() user: any
  ) {
    return await this.tripsService.getAlreadyReadTrips(filterDto);
  }


@Post('driver-assigned')
@Roles(UserRole.DRIVER, UserRole.SYSADMIN, UserRole.SUPERVISOR)
@ApiOperation({ summary: 'Get driver assigned trips' })
@ApiResponse({ status: 200, description: 'Driver trips retrieved successfully' })
async getDriverAssignedTrips(
  @Body() filterDto: any,
  @GetUser() user: any
) {
  // Use user.userId as the driverId since only drivers can access this endpoint
  return await this.tripsService.getDriverAssignedTrips(user.userId, filterDto);
}


@Post('start/:id')
@Roles(UserRole.DRIVER, UserRole.SYSADMIN, UserRole.SUPERVISOR)
@ApiOperation({ summary: 'Start a trip' })
@ApiParam({ name: 'id', description: 'Trip ID', type: Number })
@ApiResponse({ 
  status: 200, 
  description: 'Trip started successfully',
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Trip started successfully' },
      data: {
        type: 'object',
        properties: {
          tripId: { type: 'number', example: 1 },
          status: { type: 'string', example: 'ongoing' },
          startedAt: { type: 'string', format: 'date-time' },
        }
      },
      timestamp: { type: 'string', format: 'date-time' },
      statusCode: { type: 'number', example: 200 }
    }
  }
})
@ApiResponse({ status: 400, description: 'Cannot start trip' })
@ApiResponse({ status: 403, description: 'Not authorized' })
@ApiResponse({ status: 404, description: 'Trip not found' })
async startTrip(
  @Param('id', ParseIntPipe) tripId: number,
  @GetUser() user: any
) {
  return await this.tripsService.startTrip(tripId, user.userId);
}

@Post('end/:id')
@Roles(UserRole.DRIVER, UserRole.SYSADMIN, UserRole.SUPERVISOR)
@ApiOperation({ summary: 'End a trip' })
@ApiParam({ name: 'id', description: 'Trip ID', type: Number })
@ApiResponse({ 
  status: 200, 
  description: 'Trip ended successfully',
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Trip ended successfully' },
      data: {
        type: 'object',
        properties: {
          tripId: { type: 'number', example: 1 },
          status: { type: 'string', example: 'completed' },
          endedAt: { type: 'string', format: 'date-time' },
          seatsRestored: { type: 'number', example: 3 },
        }
      },
      timestamp: { type: 'string', format: 'date-time' },
      statusCode: { type: 'number', example: 200 }
    }
  }
})
@ApiResponse({ status: 400, description: 'Cannot end trip' })
@ApiResponse({ status: 403, description: 'Not authorized' })
@ApiResponse({ status: 404, description: 'Trip not found' })
async endTrip(
  @Param('id', ParseIntPipe) tripId: number,
  @GetUser() user: any,
  @Body() body: {passengerCount: number},
) {
  return await this.tripsService.endTrip(tripId, user.userId, body.passengerCount);
}


// Add to your TripsController

@Post('approve-scheduled/:masterTripId')
@Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.HR, UserRole.SUPERVISOR)
@ApiOperation({ summary: 'Approve a scheduled trip and all its instances' })
@ApiParam({ name: 'masterTripId', description: 'Master Trip ID', type: Number })
@ApiResponse({ status: 200, description: 'Scheduled trip approved successfully' })
async approveScheduledTrip(
  @Param('masterTripId', ParseIntPipe) masterTripId: number,
  @Body() approveDto: { comment?: string },
  @GetUser() user: any
) {
  return await this.tripsService.approveScheduledTrip(
    masterTripId, 
    user.userId, 
    approveDto.comment
  );
}

// Add to your TripsController

@Get('with-instances/:id')
@ApiOperation({ summary: 'Get trip with its instances (for scheduled trips)' })
@ApiParam({ name: 'id', description: 'Trip ID', type: Number })
@ApiResponse({ status: 200, description: 'Trip with instances retrieved successfully' })
async getTripWithInstances(@Param('id', ParseIntPipe) id: number) {
  return await this.tripsService.getTripWithInstances(id);
}

  // Add to TripsController class


@Post('report/download')
@Roles(UserRole.SYSADMIN, UserRole.HR)
@ApiOperation({ summary: 'Download trip report in PDF/Excel format' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      fromDate: { type: 'string', format: 'date', example: '2024-01-01' },
      toDate: { type: 'string', format: 'date', example: '2024-01-31' },
      format: { type: 'string', enum: ['pdf', 'excel'], example: 'pdf' }
    },
    required: ['fromDate', 'toDate', 'format']
  }
})
@ApiResponse({ 
  status: 200, 
  description: 'Report downloaded successfully',
  content: {
    'application/pdf': {
      schema: { type: 'string', format: 'binary' }
    },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      schema: { type: 'string', format: 'binary' }
    }
  }
})
@ApiResponse({ status: 400, description: 'Invalid date range' })
async downloadTripReport(
  @Body() reportRequest: { fromDate: string; toDate: string; format: 'pdf' | 'excel' },
  @Res() res: any,
) {
  const { fromDate, toDate, format } = reportRequest;
  
  console.log(`📋 Report request received: fromDate=${fromDate}, toDate=${toDate}, format=${format}`);
  
  try {
    // Parse dates - expecting YYYY-MM-DD format
    const startDate = new Date(fromDate + 'T00:00:00'); // Add time component for local time
    const endDate = new Date(toDate + 'T23:59:59'); // Add time component for end of day
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error(`❌ Invalid date format: fromDate=${fromDate}, toDate=${toDate}`);
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD format.');
    }
    
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }
    
    console.log(`📋 Parsed dates: start=${startDate.toISOString()}, end=${endDate.toISOString()}`);
    
    // Get report data
    console.log(`🔄 Generating ${format.toUpperCase()} report...`);
    const reportData = await this.tripsService.generateTripReport(
      startDate,
      endDate,
      format,
    );
    
    if (!reportData || reportData.length === 0) {
      throw new BadRequestException('No data found for the selected date range');
    }
    
    console.log(`✅ Report generated successfully. Size: ${reportData.length} bytes`);
    
    // Set appropriate headers based on format
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `trip-report-${timestamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', reportData.length);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', reportData.length);
    }
    
    // Send the binary data
    res.send(reportData);
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    console.error('📋 Error stack:', error.stack);
    
    if (error instanceof BadRequestException) {
      throw error;
    }
    
    // Check for specific errors
    if (error.message && error.message.includes('Cannot find module')) {
      console.error('⚠️ Missing module. Please install: npm install pdfkit exceljs');
      throw new InternalServerErrorException('Report generation module not found. Please install required packages.');
    }
    
    throw new InternalServerErrorException(`Failed to generate report: ${error.message}`);
  }

}
}