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
  BadRequestException
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { TripResponseDto, AvailableVehiclesResponseDto } from './dto/trip-response.dto';
import { AvailableVehiclesRequestDto, CreateTripDto } from './dto/create-trip.dto';
import { GetUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
//import { CancelTripDto } from './dto/trip-request.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user.entity';
import { TripListRequestDto, TripListResponseDto } from './dto/trip-list-request.dto';
import { get } from 'http';

@ApiTags('trips')
@Controller('trips')
@UsePipes(new ValidationPipe({ transform: true }))
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.HR, UserRole.SECURITY)
@ApiBearerAuth()
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('available-vehicles')
  @ApiOperation({ summary: 'Get available vehicles for trip' })
  @ApiBody({ type: AvailableVehiclesRequestDto })
  @ApiResponse({ status: 200, description: 'Available vehicles retrieved successfully', type: AvailableVehiclesResponseDto })
  async getAvailableVehicles(@Body() requestDto: AvailableVehiclesRequestDto) {
    return this.tripsService.getAvailableVehicles(requestDto);
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

  @Get('get-by-id/:id')
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.HR, UserRole.SECURITY)
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

  @Delete('cancel/:id')
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
    
    return this.tripsService.cancelTrip(tripId, user.userId, reason);
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
    
    return this.tripsService.getUserTrips(user.userId, tripListRequest);
  }

  @Post('pending-approvals')
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE, UserRole.HR, UserRole.SECURITY)
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
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.HR, UserRole.DRIVER, UserRole.EMPLOYEE)
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
  @Roles(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.HR, UserRole.DRIVER, UserRole.EMPLOYEE)
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

}