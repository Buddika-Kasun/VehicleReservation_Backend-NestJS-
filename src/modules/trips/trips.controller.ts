import { 
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiQuery 
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CancelTripDto, CreateTripDto, ProcessApprovalDto, RecordOdometerDto, SubmitApprovalDto } from './dto/trip-request.dto';
import { GetUser } from 'src/common/decorators/user.decorator';
import { TripListResponseDto, TripResponseDto } from './dto/trip-response.dto';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('create')
  @ApiOperation({ summary: 'FR-04.1: Create a trip' })
  @ApiBody({ type: CreateTripDto })
  @ApiResponse({ status: 201, description: 'Trip created successfully', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async createTrip(@Body() createTripDto: CreateTripDto, @GetUser() user: any) {
    return this.tripsService.createTrip(createTripDto, user.id);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'FR-04.2: Submit trip for approval' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: SubmitApprovalDto })
  @ApiResponse({ status: 200, description: 'Trip submitted for approval', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or trip cannot be submitted' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async submitForApproval(
    @Param('id', ParseIntPipe) id: number, 
    @Body() submitApprovalDto: SubmitApprovalDto,
    @GetUser() user: any
  ) {
    return this.tripsService.submitForApproval(id, user.id, submitApprovalDto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'FR-04.3: Approve/Reject trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: ProcessApprovalDto })
  @ApiResponse({ status: 200, description: 'Trip approval processed', type: TripResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to approve this trip' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async processApproval(
    @Param('id', ParseIntPipe) id: number,
    @Body() processApprovalDto: ProcessApprovalDto,
    @GetUser() user: any
  ) {
    return this.tripsService.processApproval(id, user.id, processApprovalDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'FR-04.5: Cancel trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: CancelTripDto })
  @ApiResponse({ status: 200, description: 'Trip canceled successfully', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot cancel trip in current status' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async cancelTrip(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelTripDto: CancelTripDto,
    @GetUser() user: any
  ) {
    return this.tripsService.cancelTrip(id, user.id, cancelTripDto);
  }

  @Patch(':id/odometer')
  @ApiOperation({ summary: 'FR-04.6 & FR-04.8: Record trip odometer reading' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: RecordOdometerDto })
  @ApiResponse({ status: 200, description: 'Odometer recorded successfully', type: TripResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid odometer reading or passenger count' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async recordOdometer(
    @Param('id', ParseIntPipe) id: number,
    @Body() recordOdometerDto: RecordOdometerDto,
    @GetUser() user: any
  ) {
    return this.tripsService.processTripOdometer(id, user.id, recordOdometerDto);
  }

  @Get('navigation')
  @ApiOperation({ summary: 'FR-04.7: Get active trips for navigation' })
  @ApiResponse({ status: 200, description: 'Active trips retrieved', type: TripListResponseDto })
  async getActiveTrips() {
    return this.tripsService.getActiveTripsForNavigation();
  }

  @Get('approvals/pending')
  @ApiOperation({ summary: 'Get pending approvals for user' })
  @ApiResponse({ status: 200, description: 'Pending approvals retrieved' })
  async getPendingApprovals(@GetUser() user: any) {
    return this.tripsService.getPendingApprovals(user.id);
  }
}