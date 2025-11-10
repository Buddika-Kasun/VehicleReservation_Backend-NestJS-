// src/trips/trips.service.ts (Fixed version)
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ResponseService } from 'src/common/services/response.service';
import { Approval, StatusApproval } from 'src/database/entities/approval.entity';
import { OdometerLog } from 'src/database/entities/odometer-log.entity';
import { Trip, TripStatus } from 'src/database/entities/trip.entity';
import { User } from 'src/database/entities/user.entity';
import { Vehicle } from 'src/database/entities/vehicle.entity';
import { Repository, In } from 'typeorm';
import { CancelTripDto, CreateTripDto, ProcessApprovalDto, RecordOdometerDto, SubmitApprovalDto } from './dto/trip-request.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(OdometerLog)
    private readonly odometerLogRepo: Repository<OdometerLog>,
    private readonly responseService: ResponseService,
  ) {}

  // FR-04.1: Create a trip
  async createTrip(createTripDto: CreateTripDto, requesterId: number) {
    const requester = await this.userRepo.findOne({ where: { id: requesterId } });
    if (!requester) {
      throw new NotFoundException(this.responseService.error('Requester not found', 404));
    }

    // Validate vehicle exists
    const vehicle = await this.vehicleRepo.findOne({ 
      where: { id: createTripDto.vehicleId } 
    });
    if (!vehicle) {
      throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
    }

    // Check for nearby rides
    const conflictingTrips = await this.findConflictingTrips(createTripDto);
    if (conflictingTrips.length > 0) {
      return this.responseService.success('Nearby rides found', { 
        availableRides: conflictingTrips,
        canBookNew: false 
      });
    }

    const trip = this.tripRepo.create({
      ...createTripDto,
      vehicle,
      requester,
      status: createTripDto.status || TripStatus.DRAFT,
    });

    const savedTrip = await this.tripRepo.save(trip);

    // Create approval record if submitted directly
    if (createTripDto.status === TripStatus.PENDING) {
      await this.createApprovalRecord(savedTrip.id, requester, createTripDto);
    }

    return this.responseService.success(
      createTripDto.status === TripStatus.PENDING 
        ? 'Trip submitted for approval' 
        : 'Trip saved as draft',
      savedTrip
    );
  }

  // FR-04.2: Save as draft and submit for approval
  async submitForApproval(tripId: number, requesterId: number, submitApprovalDto: SubmitApprovalDto) {
    const trip = await this.tripRepo.findOne({ 
      where: { id: tripId, requester: { id: requesterId } },
      relations: ['requester', 'vehicle']
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException(this.responseService.error('Only draft trips can be submitted', 400));
    }

    // Check for restricted hours (FR-04.11)
    const requiresSafetyApproval = this.requiresSafetyApproval(trip);
    
    if (requiresSafetyApproval && !trip.vehicle?.assignedDriverSecondary) {
      throw new BadRequestException(
        this.responseService.error('Restricted period requires secondary driver', 400)
      );
    }

    trip.status = TripStatus.PENDING;
    await this.tripRepo.save(trip);

    // Create approval record with designated approvers
    await this.createApprovalRecord(trip.id, trip.requester, {
      ...submitApprovalDto,
      requiresSafetyApproval
    });

    return this.responseService.success('Trip submitted for approval', trip);
  }

  // FR-04.3: Approve/Reject trip with multiple approvers
  async processApproval(
    tripId: number, 
    approverId: number, 
    processApprovalDto: ProcessApprovalDto
  ) {
    const trip = await this.tripRepo.findOne({ 
      where: { id: tripId },
      relations: ['approval', 'requester', 'vehicle']
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    if (trip.status !== TripStatus.PENDING) {
      throw new BadRequestException(this.responseService.error('Trip is not pending approval', 400));
    }

    const approval = await this.approvalRepo.findOne({ 
      where: { trip: { id: tripId } },
      relations: ['approver1', 'approver2', 'safetyApprover']
    });

    if (!approval) {
      throw new NotFoundException(this.responseService.error('Approval record not found', 404));
    }

    // Update approval based on approver type
    if (processApprovalDto.isSafetyApprover) {
      if (approval.safetyApprover && approval.safetyApprover.id !== approverId) {
        throw new ForbiddenException(this.responseService.error('Not authorized as safety approver', 403));
      }
      approval.safetyApprover = { id: approverId } as User;
    } else {
      // Check if user is one of the designated approvers
      const isApprover1 = approval.approver1?.id === approverId;
      const isApprover2 = approval.approver2?.id === approverId;
      
      if (!isApprover1 && !isApprover2) {
        throw new ForbiddenException(this.responseService.error('Not authorized as approver', 403));
      }

      if (isApprover1) {
        approval.approver1 = { id: approverId } as User;
      } else if (isApprover2) {
        approval.approver2 = { id: approverId } as User;
      }
    }

    // Update approval status and comments
    approval.statusApproval = processApprovalDto.decision === 'approve' ? StatusApproval.APPROVED : StatusApproval.REJECTED;
    approval.comments = processApprovalDto.comments;
    await this.approvalRepo.save(approval);

    // Check if all required approvals are completed
    const isFullyApproved = await this.isFullyApproved(approval);
    
    if (isFullyApproved) {
      trip.status = TripStatus.APPROVED;
    } else if (processApprovalDto.decision === 'reject') {
      trip.status = TripStatus.REJECTED;
    }

    const updatedTrip = await this.tripRepo.save(trip);

    // FR-04.4: Send notifications
    await this.sendStatusUpdate(trip.requester.id, trip.status);

    return this.responseService.success(
      `Trip ${processApprovalDto.decision}${processApprovalDto.isSafetyApprover ? ' by safety department' : ''} successfully`,
      updatedTrip
    );
  }

  // FR-04.5: Cancel trip
  async cancelTrip(tripId: number, requesterId: number, cancelTripDto: CancelTripDto) {
    const trip = await this.tripRepo.findOne({ 
      where: { id: tripId, requester: { id: requesterId } }
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    if (![TripStatus.DRAFT, TripStatus.PENDING, TripStatus.APPROVED].includes(trip.status)) {
      throw new BadRequestException(
        this.responseService.error('Cannot cancel trip in current status', 400)
      );
    }

    trip.status = TripStatus.CANCELED;
    trip.specialRemarks = `CANCELED: ${cancelTripDto.reason}. Previous: ${trip.specialRemarks || 'No remarks'}`;
    
    const updatedTrip = await this.tripRepo.save(trip);

    return this.responseService.success('Trip canceled successfully', updatedTrip);
  }

  // FR-04.6 & FR-04.8: Start/End trip via QR scan
  async processTripOdometer(
    tripId: number, 
    recordedById: number, 
    recordOdometerDto: RecordOdometerDto
  ) {
    const trip = await this.tripRepo.findOne({ 
      where: { id: tripId },
      relations: ['vehicle']
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    if (recordOdometerDto.isStart && trip.status !== TripStatus.APPROVED) {
      throw new BadRequestException(
        this.responseService.error('Only approved trips can be started', 400)
      );
    }

    if (!recordOdometerDto.isStart && trip.status !== TripStatus.ONGOING) {
      throw new BadRequestException(
        this.responseService.error('Only ongoing trips can be ended', 400)
      );
    }

    // FR-04.8: Validate passenger count at trip end
    if (!recordOdometerDto.isStart && (recordOdometerDto.actualPassengers === undefined || recordOdometerDto.actualPassengers < 1)) {
      throw new BadRequestException(
        this.responseService.error('Passenger count is mandatory when ending trip', 400)
      );
    }

    const recordedBy = await this.userRepo.findOne({ where: { id: recordedById } });
    if (!recordedBy) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Update trip odometer
    if (recordOdometerDto.isStart) {
      trip.startOdometer = recordOdometerDto.odometerReading;
      trip.status = TripStatus.ONGOING;
    } else {
      trip.endOdometer = recordOdometerDto.odometerReading;
      trip.passengers = recordOdometerDto.actualPassengers!; // Update with actual passenger count
      
      // FR-04.9: Calculate mileage
      if (trip.startOdometer) {
        trip.mileage = Number((recordOdometerDto.odometerReading - trip.startOdometer).toFixed(2));
      }
      
      trip.status = TripStatus.COMPLETED;
      trip.endDate = new Date();
      trip.endTime = new Date().toTimeString().split(' ')[0];
      
      // FR-04.10: Calculate cost
      trip.cost = await this.calculateTripCost(trip);
    }

    const updatedTrip = await this.tripRepo.save(trip);

    // Update vehicle's last odometer reading
    if (trip.vehicle) {
      await this.vehicleRepo.update(trip.vehicle.id, {
        odometerLastReading: recordOdometerDto.odometerReading
      });
    }

    // Create odometer log
    await this.createOdometerLog(
      trip.vehicle?.id,
      trip.id,
      recordOdometerDto.odometerReading,
      recordOdometerDto.isStart,
      recordedBy
    );

    return this.responseService.success(
      recordOdometerDto.isStart ? 'Trip started successfully' : 'Trip completed successfully',
      updatedTrip
    );
  }

  // FR-04.7: Get trips for navigation view
  async getActiveTripsForNavigation() {
    const activeTrips = await this.tripRepo.find({
      where: { status: TripStatus.ONGOING },
      relations: ['vehicle', 'requester'],
      select: ['id', 'origin', 'destination', 'vehicle']
    });

    return this.responseService.success(
      'Active trips retrieved',
      activeTrips
    );
  }

  // Helper methods (same as before, but with proper typing)
  private async findConflictingTrips(tripData: CreateTripDto): Promise<Trip[]> {
    return this.tripRepo.find({
      where: {
        destination: tripData.destination,
        startDate: tripData.startDate,
        status: In([TripStatus.APPROVED, TripStatus.ONGOING])
      },
      relations: ['vehicle']
    });
  }

  private requiresSafetyApproval(trip: Trip): boolean {
    const startTime = new Date(trip.startDate + ' ' + trip.startTime);
    const hours = startTime.getHours();
    return hours >= 0 && hours < 4; // 00:00 to 04:00
  }

  private async createApprovalRecord(tripId: number, requester: User, data?: any) {
    const approvalData: any = {
      trip: { id: tripId },
      statusApproval: StatusApproval.PENDING,
    };

    // Assign approvers based on department logic
    if (data?.approver1Id) {
      approvalData.approver1 = { id: data.approver1Id };
    }
    if (data?.approver2Id) {
      approvalData.approver2 = { id: data.approver2Id };
    }

    // Assign safety approver if required
    if (data?.requiresSafetyApproval && data?.safetyApproverId) {
      approvalData.safetyApprover = { id: data.safetyApproverId };
    }

    const approval = this.approvalRepo.create(approvalData);
    return this.approvalRepo.save(approval);
  }

  private async isFullyApproved(approval: Approval): Promise<boolean> {
    if (approval.statusApproval === StatusApproval.REJECTED) {
      return false;
    }

    // Check if both primary approvers have approved
    const primaryApproved = approval.approver1 !== null && approval.approver2 !== null;
    
    // Check if safety approval is required and completed
    const needsSafetyApproval = approval.safetyApprover !== null;
    const safetyApproved = !needsSafetyApproval || approval.safetyApprover !== null;

    return primaryApproved && safetyApproved;
  }

  private async sendStatusUpdate(userId: number, status: TripStatus) {
    // Implement notification logic
    console.log(`Status update sent to user ${userId}: ${status}`);
  }

  private async calculateTripCost(trip: Trip): Promise<number> {
    const baseRate = 50;
    const mileageRate = 2;
    const passengerRate = 5;
    const cost = baseRate + (trip.mileage || 0) * mileageRate + (trip.passengers || 1) * passengerRate;
    return Number(cost.toFixed(2));
  }

  private async createOdometerLog(
    vehicleId: number | undefined,
    tripId: number,
    reading: number,
    isStart: boolean,
    recordedBy: User
  ) {
    const log = this.odometerLogRepo.create({
      vehicle: vehicleId ? { id: vehicleId } : undefined,
      trip: { id: tripId },
      [isStart ? 'startReading' : 'endReading']: reading,
      recordedBy,
      timestamp: new Date()
    });
    return this.odometerLogRepo.save(log);
  }

  // Get pending approvals for a user
  async getPendingApprovals(userId: number) {
    const approvals = await this.approvalRepo.find({
      where: [
        { approver1: { id: userId }, statusApproval: StatusApproval.PENDING },
        { approver2: { id: userId }, statusApproval: StatusApproval.PENDING },
        { safetyApprover: { id: userId }, statusApproval: StatusApproval.PENDING }
      ],
      relations: ['trip', 'trip.requester', 'trip.vehicle']
    });

    return this.responseService.success('Pending approvals retrieved', approvals);
  }
}