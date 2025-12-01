// trips.controller.ts
import { Controller, Post, Body, Get, Query, UsePipes, ValidationPipe, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiParam } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { TripResponseDto, AvailableVehiclesResponseDto } from './dto/trip-response.dto';
import { AvailableVehiclesRequestDto, CreateTripDto } from './dto/create-trip.dto';
import { GetUser } from 'src/common/decorators/user.decorator';

@ApiTags('trips')
@Controller('trips')
@UsePipes(new ValidationPipe({ transform: true }))
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
  async createTrip(@Body() createTripDto: CreateTripDto, @GetUser() user: any) {
    return this.tripsService.createTrip(createTripDto, user.id);
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

}