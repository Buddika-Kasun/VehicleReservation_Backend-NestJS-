// trips.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ResponseService } from 'src/common/services/response.service';
import { Approval, StatusApproval } from 'src/database/entities/approval.entity';
import { OdometerLog } from 'src/database/entities/odometer-log.entity';
import { Trip, TripStatus, RepetitionType, PassengerType } from 'src/database/entities/trip.entity';
import { TripLocation } from 'src/database/entities/trip-location.entity';
import { User } from 'src/database/entities/user.entity';
import { Vehicle } from 'src/database/entities/vehicle.entity';
import { Repository, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AvailableVehiclesResponseDto, AvailableVehicleDto, TripResponseDto } from './dto/trip-response.dto';
import { AvailableVehiclesRequestDto, CreateTripDto } from './dto/create-trip.dto';

@Injectable()
export class TripsService {
  private readonly CONFLICT_TIME_WINDOW = 60; // 1 hour in minutes
  private readonly SEARCH_RADIUS = 10; // 10 km

  constructor(
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TripLocation)
    private readonly tripLocationRepo: Repository<TripLocation>,
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(OdometerLog)
    private readonly odometerLogRepo: Repository<OdometerLog>,
    private readonly responseService: ResponseService,
  ) {}

  // Calculate distance using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  // Check for conflicting trips in the same area and time - FIXED
  private async findConflictingTrips(
    locationData: any, 
    scheduleData: any, 
    passengerCount: number
  ): Promise<Trip[]> {
    const startCoords = locationData.startLocation.coordinates.coordinates;
    const startLat = startCoords[1];
    const startLng = startCoords[0];

    // Get all trips in the time window - USING FIXED TIME COMPARISON
    const conflictingTrips = await this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('trip.status IN (:...statuses)', { 
        statuses: [TripStatus.APPROVED, TripStatus.PENDING, TripStatus.ONGOING] 
      })
      .andWhere('trip.startDate = :date', { date: scheduleData.startDate })
      .andWhere(
        `ABS(EXTRACT(EPOCH FROM (trip."startTime"::time - CAST(:startTime AS time)))) <= :window`,
        { 
          startTime: scheduleData.startTime, 
          window: this.CONFLICT_TIME_WINDOW * 60 
        }
      )
      .getMany();

    // Filter by distance and passenger capacity
    return conflictingTrips.filter(trip => {
      if (!trip.location) return false;
      
      // Check distance from start location
      const distance = this.calculateDistance(
        startLat, startLng,
        trip.location.startLatitude, trip.location.startLongitude
      );

      // Check if vehicle has enough capacity
      const hasEnoughCapacity = trip.vehicle?.seatingCapacity >= passengerCount;

      return distance <= this.SEARCH_RADIUS && hasEnoughCapacity;
    });
  }

  // Get available vehicles with recommendation logic
  async getAvailableVehicles(requestDto: AvailableVehiclesRequestDto): Promise<AvailableVehiclesResponseDto> {
    const passengerCount = this.calculatePassengerCount(requestDto.passengerData);
    
    // Check for conflicting trips first
    const conflictingTrips = await this.findConflictingTrips(
      requestDto.locationData,
      requestDto.scheduleData,
      passengerCount
    );

    // Get all active vehicles
    const allVehicles = await this.vehicleRepo.find({
      where: { isActive: true },
      relations: ['vehicleType']
    });

    // Filter vehicles by passenger capacity
    const capacityFilteredVehicles = allVehicles.filter(
      vehicle => vehicle.seatingCapacity >= passengerCount
    );

    // Get vehicle locations (you'll need to implement this based on your tracking system)
    const vehicleLocations = await this.getVehicleLocations();

    // Analyze and recommend vehicles
    const availableVehicles = await this.analyzeAndRecommendVehicles(
      capacityFilteredVehicles,
      vehicleLocations,
      requestDto.locationData,
      requestDto.scheduleData,
      conflictingTrips
    );

    const recommendedVehicles = availableVehicles.filter(v => v.isRecommended);
    const otherVehicles = availableVehicles.filter(v => !v.isRecommended);

    return {
      recommendedVehicles,
      allVehicles: availableVehicles,
      conflictingTrips,
      canBookNew: conflictingTrips.length === 0
    };
  }

  private async analyzeAndRecommendVehicles(
    vehicles: Vehicle[],
    vehicleLocations: Map<number, { lat: number; lng: number; lastUpdated: Date }>,
    locationData: any,
    scheduleData: any,
    conflictingTrips: Trip[]
  ): Promise<AvailableVehicleDto[]> {
    const startCoords = locationData.startLocation.coordinates.coordinates;
    const startLat = startCoords[1];
    const startLng = startCoords[0];

    const result: AvailableVehicleDto[] = [];

    for (const vehicle of vehicles) {
      const vehicleLocation = vehicleLocations.get(vehicle.id);
      let distanceFromStart = 0;
      let estimatedArrivalTime = 0;
      let isRecommended = false;
      let recommendationReason = 'Available vehicle';

      if (vehicleLocation) {
        // Calculate distance from start location
        distanceFromStart = this.calculateDistance(
          startLat, startLng,
          vehicleLocation.lat, vehicleLocation.lng
        ) * 1000; // Convert to meters

        // Estimate arrival time (assuming average speed of 30 km/h in city traffic)
        estimatedArrivalTime = (distanceFromStart / 1000) / 30 * 60; // in minutes
      }

      // Recommendation logic
      if (distanceFromStart <= 5000) { // Within 5 km
        isRecommended = true;
        recommendationReason = 'Close to pickup location';
      } else if (this.isVehicleSuitableForTime(vehicle, scheduleData)) {
        isRecommended = true;
        recommendationReason = 'Suitable for scheduled time';
      }

      // Check if vehicle is in conflicting trips
      const isInConflict = conflictingTrips.some(trip => trip.vehicle?.id === vehicle.id);
      if (isInConflict) {
        isRecommended = false;
        recommendationReason = 'Vehicle has conflicting schedule';
      }

      result.push({
        vehicle,
        isRecommended,
        recommendationReason,
        distanceFromStart,
        estimatedArrivalTime
      });
    }

    // Sort by recommendation status and distance
    return result.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return a.distanceFromStart - b.distanceFromStart;
    });
  }

  private isVehicleSuitableForTime(vehicle: Vehicle, scheduleData: any): boolean {
    // Implement logic based on vehicle type, maintenance schedule, etc.
    // For now, return true for all vehicles
    return true;
  }

  private async getVehicleLocations(): Promise<Map<number, { lat: number; lng: number; lastUpdated: Date }>> {
    // Implement this based on your vehicle tracking system
    // This is a mock implementation
    const locations = new Map<number, { lat: number; lng: number; lastUpdated: Date }>();
    
    // You would typically get this from your GPS tracking system
    const vehicles = await this.vehicleRepo.find({ where: { isActive: true } });
    
    vehicles.forEach(vehicle => {
      // Mock locations - replace with actual GPS data
      locations.set(vehicle.id, {
        lat: 6.899286 + (Math.random() - 0.5) * 0.1,
        lng: 79.882153 + (Math.random() - 0.5) * 0.1,
        lastUpdated: new Date()
      });
    });

    return locations;
  }

  private calculatePassengerCount(passengerData: any): number {
    switch (passengerData.passengerType) {
      case PassengerType.OWN:
        return 1;
      case PassengerType.OTHER_INDIVIDUAL:
        return 1;
      case PassengerType.GROUP:
        let count = passengerData.includeMeInGroup ? 1 : 0;
        count += passengerData.selectedGroupUsers?.length || 0;
        count += passengerData.selectedOthers?.length || 0;
        return count;
      default:
        return 1;
    }
  }

  // Enhanced createTrip method
  async createTrip(createTripDto: CreateTripDto, requesterId: number) {
    console.log("Data: ", createTripDto);

    const requester = await this.userRepo.findOne({ where: { id: requesterId } });
    if (!requester) {
      throw new NotFoundException(this.responseService.error('Requester not found', 404));
    }

    // Calculate passenger count
    const passengerCount = this.calculatePassengerCount(createTripDto.passengerData);

    // Check for nearby conflicting trips
    const conflictingTrips = await this.findConflictingTrips(
      createTripDto.locationData,
      createTripDto.scheduleData,
      passengerCount
    );

    if (conflictingTrips.length > 0 && !createTripDto.vehicleId) {
      return this.responseService.success('Nearby rides found', { 
        availableRides: conflictingTrips,
        canBookNew: false 
      });
    }

    // Validate vehicle if provided
    let vehicle: Vehicle | undefined;
    if (createTripDto.vehicleId) {
      vehicle = await this.vehicleRepo.findOne({ 
        where: { id: createTripDto.vehicleId },
        relations: ['assignedDriverPrimary', 'assignedDriverSecondary']
      });
      if (!vehicle) {
        throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
      }

      // Check vehicle capacity
      if (vehicle.seatingCapacity < passengerCount) {
        throw new BadRequestException(
          this.responseService.error('Vehicle does not have enough seating capacity', 400)
        );
      }
    }

    // Create trip location
    const startCoords = createTripDto.locationData.startLocation.coordinates.coordinates;
    const endCoords = createTripDto.locationData.endLocation.coordinates.coordinates;

    const tripLocation = this.tripLocationRepo.create({
      startLatitude: startCoords[1],
      startLongitude: startCoords[0],
      startAddress: createTripDto.locationData.startLocation.address,
      endLatitude: endCoords[1],
      endLongitude: endCoords[0],
      endAddress: createTripDto.locationData.endLocation.address,
      intermediateStops: createTripDto.locationData.intermediateStops,
      totalStops: createTripDto.locationData.totalStops,
    });

    const savedLocation = await this.tripLocationRepo.save(tripLocation);

    // Handle passenger data
    let selectedIndividual: User | undefined;
    let selectedGroupUsers: User[] = [];

    if (createTripDto.passengerData.selectedIndividual) {
      selectedIndividual = await this.userRepo.findOne({
        where: { id: createTripDto.passengerData.selectedIndividual }
      });
    }

    if (createTripDto.passengerData.selectedGroupUsers?.length) {
      selectedGroupUsers = await this.userRepo.find({
        where: { id: In(createTripDto.passengerData.selectedGroupUsers) }
      });
    }

    // Create trip
    const trip = this.tripRepo.create({
      ...createTripDto.scheduleData,
      location: savedLocation,
      passengerType: createTripDto.passengerData.passengerType,
      passengerCount,
      selectedIndividual,
      selectedGroupUsers,
      selectedOthers: createTripDto.passengerData.selectedOthers,
      includeMeInGroup: createTripDto.passengerData.includeMeInGroup ?? true,
      purpose: createTripDto.purpose,
      specialRemarks: createTripDto.specialRemarks,
      vehicle,
      requester,
      status: createTripDto.status || TripStatus.PENDING,
    });

    const savedTrip = await this.tripRepo.save(trip);

    // Reload the trip with vehicle relations to get driver information
    const tripWithRelations = await this.tripRepo.findOne({
      where: { id: savedTrip.id },
      relations: ['vehicle', 'vehicle.assignedDriverPrimary', 'vehicle.assignedDriverSecondary']
    });

    // Create approval record if submitted directly
    if (createTripDto.status === TripStatus.PENDING) {
      await this.createApprovalRecord(savedTrip.id, requester, createTripDto);
    }

    // Return the trip directly (not nested in data property) for frontend compatibility
    return {
      success: true,
      message: createTripDto.status === TripStatus.PENDING 
        ? 'Trip submitted for approval' 
        : 'Trip saved as draft',
      trip: new TripResponseDto(tripWithRelations),
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  private async createApprovalRecord(tripId: number, requester: User, createTripDto: CreateTripDto) {
    const approval = this.approvalRepo.create({
      trip: { id: tripId } as Trip,
      statusApproval: StatusApproval.PENDING,
      comments: createTripDto.specialRemarks,
    });

    await this.approvalRepo.save(approval);
  }

  async getTripStatus(tripId: number) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['vehicle', 'vehicle.assignedDriverPrimary', 'vehicle.assignedDriverSecondary']
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    return {
      success: true,
      data: {
        status: trip.status,
        driverName: trip.vehicle?.assignedDriverPrimary?.displayname,
        vehicleRegNo: trip.vehicle?.regNo,
        vehicleModel: trip.vehicle?.model,
        driverPhone: trip.vehicle?.assignedDriverPrimary?.phone,
        // Add other fields as needed
      }
    };
  }

}