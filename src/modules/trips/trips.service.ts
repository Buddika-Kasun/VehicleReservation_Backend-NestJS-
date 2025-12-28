import { Injectable, NotFoundException, BadRequestException, ForbiddenException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ResponseService } from 'src/common/services/response.service';
import { Approval, StatusApproval } from 'src/infra/database/entities/approval.entity';
import { OdometerLog } from 'src/infra/database/entities/odometer-log.entity';
import { Trip, TripStatus, RepetitionType, PassengerType } from 'src/infra/database/entities/trip.entity';
import { TripLocation } from 'src/infra/database/entities/trip-location.entity';
import { Status, User, UserRole } from 'src/infra/database/entities/user.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';
import { Repository, In, Between, MoreThanOrEqual, LessThanOrEqual, Brackets, Not } from 'typeorm';
import { AvailableVehiclesResponseDto, AvailableVehicleDto, TripResponseDto } from './dto/trip-response.dto';
import { AvailableVehiclesRequestDto, CreateTripDto, ReviewAvailableVehiclesRequest, ScheduleDataDto } from './dto/create-trip.dto';
import { TripListRequestDto } from './dto/trip-list-request.dto';
import { ApproverType } from 'src/infra/database/entities/approval.entity';
import { ApprovalConfig } from 'src/infra/database/entities/approval-configuration.entity';
import { NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';
import { scheduled } from 'rxjs';
import { Schedule } from 'src/infra/database/entities/trip-schedule.entity';

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
    @InjectRepository(ApprovalConfig)
    private readonly approvalConfigRepo: Repository<ApprovalConfig>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
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

  private calculateRouteDistanceWithStops(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number,
    intermediateStops: Array<{latitude: number, longitude: number}>
  ): number {
    let totalDistance = 0;
    let previousLat = startLat;
    let previousLng = startLng;
    
    // Calculate distance from start to first intermediate stop
    if (intermediateStops.length > 0) {
      for (const stop of intermediateStops) {
        const segmentDistance = this.calculateDistance(
          previousLat, previousLng,
          stop.latitude, stop.longitude
        );
        totalDistance += segmentDistance;
        previousLat = stop.latitude;
        previousLng = stop.longitude;
      }
    }
    
    // Calculate distance from last point to end
    const finalSegmentDistance = this.calculateDistance(
      previousLat, previousLng,
      endLat, endLng
    );
    totalDistance += finalSegmentDistance;
    
    return totalDistance;
  }

  private calculateRouteDuration(
    distanceInKM: number, 
    stops: number = 0, 
    mixedRoadsKmph: number = 40
  ): number {
    // More sophisticated duration calculation using mixed roads speed as base
    const distanceInKm = distanceInKM;
    
    // Base time for traffic, stops, etc.
    const baseTime = 5; // minutes for pickup/dropoff
    
    // Calculate other speeds based on mixed roads speed
    const denseTrafficKmph = mixedRoadsKmph * 0.375; // 15/40 = 0.375 of mixed roads
    const cityTrafficKmph = mixedRoadsKmph * 0.625;  // 25/40 = 0.625 of mixed roads
    const highwayKmph = mixedRoadsKmph * 1.5;        // 60/40 = 1.5 of mixed roads
    
    // Calculate travel time
    let travelTime;
    if (distanceInKm <= 2) {
      travelTime = (distanceInKm / denseTrafficKmph) * 60; // Very slow in dense traffic
    } else if (distanceInKm <= 10) {
      travelTime = (distanceInKm / cityTrafficKmph) * 60; // City traffic
    } else if (distanceInKm <= 50) {
      travelTime = (distanceInKm / mixedRoadsKmph) * 60; // Mixed roads
    } else {
      travelTime = (distanceInKm / highwayKmph) * 60; // Highway
    }
    
    // Add time for intermediate stops (5 minutes per stop)
    const stopTime = stops * 5;
    
    return parseFloat((baseTime + travelTime + stopTime).toFixed(2));
  }

  private calculateEstimatedRestingHours(durationInMinutes: number): number {
    // Convert minutes to hours
    const durationInHours = durationInMinutes / 60;
    
    let restingMinutes = 0;
    
    if (durationInHours <= 3) {
        // No resting hours for trips less than or equal to 3 hours
        restingMinutes = 0;
    } else if (durationInHours <= 8) {
        // For trips between 3-8 hours: 15 minutes per 2 hours
        // Calculate how many 2-hour segments
        const twoHourSegments = Math.floor((durationInHours - 3) / 2);
        restingMinutes = twoHourSegments * 15;
    } else {        
        restingMinutes = 4 * 60;
    }
    
    return restingMinutes;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  // Check if point is near existing trip's route
  private isPointNearRoute(pointLat: number, pointLng: number, existingTripLocation: TripLocation): boolean {
    let minDistance = Infinity;

    // Check distance to trip's start location
    const distanceToStart = this.calculateDistance(
      pointLat, pointLng,
      existingTripLocation.startLatitude, existingTripLocation.startLongitude
    );
    minDistance = Math.min(minDistance, distanceToStart);

    // Check distance to trip's end location
    const distanceToEnd = this.calculateDistance(
      pointLat, pointLng,
      existingTripLocation.endLatitude, existingTripLocation.endLongitude
    );
    minDistance = Math.min(minDistance, distanceToEnd);

    // Check intermediate stops if available
    if (existingTripLocation.intermediateStops?.length > 0) {
      for (const stop of existingTripLocation.intermediateStops) {
        const distanceToStop = this.calculateDistance(
          pointLat, pointLng, stop.latitude, stop.longitude
        );
        minDistance = Math.min(minDistance, distanceToStop);
      }
    }

    // Check route points from locationData if available
    if (existingTripLocation.locationData) {
      try {
        const locationData = typeof existingTripLocation.locationData === 'string' 
          ? JSON.parse(existingTripLocation.locationData)
          : existingTripLocation.locationData;
        
        // Check route segments points
        if (locationData.routeData?.routeSegments?.length > 0) {
          for (const segment of locationData.routeData.routeSegments) {
            if (segment.points?.length > 0) {
              // Sample points for performance
              const step = Math.max(1, Math.floor(segment.points.length / 20));
              for (let i = 0; i < segment.points.length; i += step) {
                const [lng, lat] = segment.points[i];
                const distanceToPoint = this.calculateDistance(
                  pointLat, pointLng, lat, lng
                );
                minDistance = Math.min(minDistance, distanceToPoint);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error parsing locationData:', error);
      }
    }

    return minDistance <= this.SEARCH_RADIUS;
  }

  // Check if new trip locations are near existing trip's route
  private areTripLocationsNearby(newStartLat: number, newStartLng: number, newEndLat: number, newEndLng: number, existingTripLocation: TripLocation): boolean {
    // Check if EITHER start OR end location of new trip is near existing trip's route
    const startNearRoute = this.isPointNearRoute(newStartLat, newStartLng, existingTripLocation);
    const endNearRoute = this.isPointNearRoute(newEndLat, newEndLng, existingTripLocation);
    
    return startNearRoute && endNearRoute;
  }

  // Convert date string to database format (YYYY-MM-DD)
  private formatDateForDB(dateString: string): string {
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Parse the date string
    const date = new Date(dateString);
    
    // Extract date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // Convert time to have seconds (HH:MM:SS)
  private formatTimeWithSeconds(time: string): string {
    if (!time) return '00:00:00';
    
    // If already has seconds, return as is
    if (time.split(':').length === 3) {
      return time;
    }
    
    // If has only hours and minutes, add seconds
    if (time.split(':').length === 2) {
      return time + ':00';
    }
    
    // Default
    return '00:00:00';
  }

  private async findAllTripsAtSameTime(
    scheduleData: any
  ): Promise<Map<number, Trip>> {
    // Format date and time for database query
    const dbDate = this.formatDateForDB(scheduleData.startDate);
    const dbTime = this.formatTimeWithSeconds(scheduleData.startTime);

    // Get time in minutes for comparison
    const [hours, minutes] = dbTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Get all active trips at the same time
    const allActiveTrips = await this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('trip.status IN (:...statuses)', { 
        statuses: [TripStatus.APPROVED, TripStatus.PENDING, TripStatus.ONGOING] 
      })
      .getMany();

    console.log(`Found ${allActiveTrips.length} total active trips`);

    const tripsAtSameTime = new Map<number, Trip>();

    for (const trip of allActiveTrips) {
      // Skip if no location or vehicle
      if (!trip.location || !trip.vehicle) {
        continue;
      }

      // Check if dates are the same
      const tripDateStr = this.formatDateForDB(trip.startDate.toString());
      if (tripDateStr !== dbDate) {
        continue;
      }

      // Check time within window
      const tripTimeStr = this.formatTimeWithSeconds(trip.startTime);
      const [tripHours, tripMinutes] = tripTimeStr.split(':').map(Number);
      const tripTotalMinutes = tripHours * 60 + tripMinutes;
      
      // Calculate time difference with wrap-around at midnight
      let timeDiff = Math.abs(tripTotalMinutes - totalMinutes);
      timeDiff = Math.min(timeDiff, 1440 - timeDiff);
      
      if (timeDiff > this.CONFLICT_TIME_WINDOW) {
        continue;
      }

      // Add to map (vehicleId -> trip)
      tripsAtSameTime.set(trip.vehicle.id, trip);
    }

    console.log(`Found ${tripsAtSameTime.size} trips at same time`);
    return tripsAtSameTime;
  }
  

  private async findConflictingTrips(
    locationData: any, 
    scheduleData: any, 
    passengerCount: number
  ): Promise<Trip[]> {
    // Get new trip locations
    const startCoords = locationData.startLocation.coordinates.coordinates; 
    const newStartLat = startCoords[1];
    const newStartLng = startCoords[0];
    
    const endCoords = locationData.endLocation.coordinates.coordinates;
    const newEndLat = endCoords[1];
    const newEndLng = endCoords[0];

    // Get all trips at same time
    const tripsAtSameTime = await this.findAllTripsAtSameTime(scheduleData);

    const conflictingTrips: Trip[] = [];

    for (const [vehicleId, trip] of tripsAtSameTime) {
      /*
      // Skip if vehicle doesn't have enough capacity
      if (trip.vehicle.seatingAvailability < passengerCount) {
        continue;
      }
      */

      // Check if new trip locations are near existing trip's route
      const locationsNearby = this.areTripLocationsNearby(
        newStartLat, newStartLng, newEndLat, newEndLng, trip.location
      );
      
      if (!locationsNearby) {
        console.log(`Vehicle ${vehicleId} trip ${trip.id} skipped: Route not nearby`);
        continue;
      }

      // All checks passed - this is a REAL conflict
      console.log(`Trip ${trip.id} ADDED as REAL conflicting trip`);
      conflictingTrips.push(trip);
    }

    console.log("=== FINAL CONFLICTING TRIPS (with route proximity) ===");
    console.log("Count:", conflictingTrips.length);
    
    return conflictingTrips;
  }

  private async findAllActiveTrips(): Promise<Map<number, Trip[]>> {
    const trips = await this.tripRepo.find({
      where: {
        status: In([
          TripStatus.DRAFT,
          TripStatus.PENDING,
          TripStatus.APPROVED,
          TripStatus.READ,
          TripStatus.ONGOING
        ])
      },
      relations: ['vehicle']
    });

    const map = new Map<number, Trip[]>();

    for (const trip of trips) {
      if (!trip.vehicle) continue;

      if (!map.has(trip.vehicle.id)) {
        map.set(trip.vehicle.id, []);
      }

      map.get(trip.vehicle.id)!.push(trip);
    }

    return map;
  }

  // Get available vehicles with recommendation logic
  /*
  async getAvailableVehicles(requestDto: AvailableVehiclesRequestDto): Promise<AvailableVehiclesResponseDto> {
    const passengerCount = this.calculatePassengerCount(requestDto.passengerData); 
    console.log("=== getAvailableVehicles ===");
    console.log("Passenger count:", passengerCount);
    
    // Get trips at same time (for ALL vehicle availability check)
    const tripsAtSameTime = await this.findAllTripsAtSameTime(requestDto.scheduleData);
    
    // Get REAL conflicting trips (same time AND route proximity)
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

    console.log(`Total vehicles: ${allVehicles.length}`);
    console.log(`Vehicles with trips at same time: ${tripsAtSameTime.size}`);
    console.log(`Vehicles with REAL route conflicts: ${conflictingTrips.length}`);

    // Filter vehicles by passenger capacity AND exclude vehicles already booked at same time
    const availableVehicles = allVehicles.filter(vehicle => {
      // Must have enough capacity
      if (vehicle.seatingAvailability < passengerCount) {
        return false;
      }
      
      // Check if vehicle is already booked at this time
      const existingTrip = tripsAtSameTime.get(vehicle.id);
      if (existingTrip) {
        // Vehicle is booked at this time, but check if it's a REAL conflict
        const isRealConflict = conflictingTrips.some(trip => trip.vehicle?.id === vehicle.id);
        
        if (!isRealConflict) {
          console.log(`Vehicle ${vehicle.id} is booked at same time but route is NOT nearby - EXCLUDING from available list`);
          return false; // Exclude from available vehicles
        }
        // If it's a real conflict, we'll include it but mark as conflict
      }
      
      return true;
    });

    console.log(`Available vehicles after filtering: ${availableVehicles.length}`);

    // Get vehicle locations (mock implementation)
    const vehicleLocations = await this.getVehicleLocations();

    // Analyze and recommend vehicles
    const analyzedVehicles = await this.analyzeAndRecommendVehicles(
      availableVehicles,
      vehicleLocations,
      requestDto.locationData,
      requestDto.scheduleData,
      conflictingTrips,
      tripsAtSameTime
    );

    return {
      allVehicles: analyzedVehicles,
    };
  }
  */


  async getAvailableVehicles(requestDto: AvailableVehiclesRequestDto): Promise<AvailableVehiclesResponseDto> {
    const passengerCount = this.calculatePassengerCount(requestDto.passengerData); 
    console.log("=== getAvailableVehicles ===");
    console.log("Passenger count:", passengerCount);
    
    // Get trips at same time (for ALL vehicle availability check)
    const tripsAtSameTime = await this.findAllTripsAtSameTime(requestDto.scheduleData);
    
    // Get REAL conflicting trips (same time AND route proximity)
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

    console.log(`Total vehicles: ${allVehicles.length}`);
    console.log(`Vehicles with trips at same time: ${tripsAtSameTime.size}`);
    console.log(`Vehicles with REAL route conflicts: ${conflictingTrips.length}`);

    const activeTripsByVehicle = await this.findAllActiveTrips();

    const availableVehicles = allVehicles.filter(vehicle => {
 
      /*
      // Rule 1: seating capacity
      if (vehicle.seatingAvailability < passengerCount) {
        return false;
      }
      */

      const tripAtSameTime = tripsAtSameTime.get(vehicle.id);

      const isRealConflict = conflictingTrips.some(
        trip => trip.vehicle?.id === vehicle.id
      );

      // CASE 1: same time + same route conflict
      if (tripAtSameTime) {
        if (!isRealConflict) {
          // Same time but different route
          return false;
        }
        // Same time + same route + enough seats
        return true;
      }

      // CASE 2: not same time
      const activeTrips = activeTripsByVehicle.get(vehicle.id);

      if (activeTrips && activeTrips.length > 0) {
        // Vehicle has an active trip that is not completed
        return false;
      }

      // CASE 3: no trips or only completed/finished trips
      return true;
    });

    console.log(`Available vehicles after filtering: ${availableVehicles.length}`);

    // Get vehicle locations (mock implementation)
    const vehicleLocations = await this.getVehicleLocations();

    // Analyze and recommend vehicles
    const analyzedVehicles = await this.analyzeAndRecommendVehicles(
      availableVehicles,
      vehicleLocations,
      requestDto.locationData,
      requestDto.scheduleData,
      conflictingTrips,
      tripsAtSameTime
    );

    return {
      allVehicles: analyzedVehicles,
    };
  }

  private async analyzeAndRecommendVehicles(
    vehicles: Vehicle[],
    vehicleLocations: Map<number, { lat: number; lng: number; lastUpdated: Date }>,
    locationData: any,
    scheduleData: any,
    conflictingTrips: Trip[], // REAL conflicts (same time + route proximity)
    tripsAtSameTime: Map<number, Trip> // ALL trips at same time
  ): Promise<AvailableVehicleDto[]> {
    const startCoords = locationData.startLocation.coordinates.coordinates;
    const startLat = startCoords[1];
    const startLng = startCoords[0];

    const result: AvailableVehicleDto[] = [];

    // Create a Map of vehicle IDs to REAL conflicting trips
    const conflictingTripsMap = new Map<number, Trip>();
    conflictingTrips.forEach(trip => {
      if (trip.vehicle?.id) {
        conflictingTripsMap.set(trip.vehicle.id, trip);
      }
    });

    for (const vehicle of vehicles) {
      const vehicleLocation = vehicleLocations.get(vehicle.id);
      let distanceFromStart = 0;
      let estimatedArrivalTime = 0;
      let isRecommended = false;
      let recommendationReason = 'Available vehicle';
      let conflictingTripData: any = null;

      if (vehicleLocation) {
        // Calculate distance from start location
        distanceFromStart = this.calculateDistance(
          startLat, startLng,
          vehicleLocation.lat, vehicleLocation.lng
        ) * 1000; // Convert to meters

        // Estimate arrival time (assuming average speed of 30 km/h in city traffic)
        estimatedArrivalTime = (distanceFromStart / 1000) / 30 * 60; // in minutes
      }

      // Check if vehicle is in REAL conflicting trips (same time + route proximity)
      const conflictingTrip = conflictingTripsMap.get(vehicle.id);
      const isInConflict = !!conflictingTrip;
      
      if (isInConflict && conflictingTrip && conflictingTrip.location) {
        // REAL CONFLICT VEHICLE: Already scheduled for nearby route at same time
        isRecommended = true;
        recommendationReason = 'Already scheduled for nearby route';
        
        conflictingTripData = {
          tripId: conflictingTrip.id,
          startTime: conflictingTrip.startTime,
          startLocation: {
            address: conflictingTrip.location.startAddress,
            latitude: conflictingTrip.location.startLatitude,
            longitude: conflictingTrip.location.startLongitude
          },
          endLocation: {
            address: conflictingTrip.location.endAddress,
            latitude: conflictingTrip.location.endLatitude,
            longitude: conflictingTrip.location.endLongitude
          },
        };
        
      } else {
        // Check if vehicle has ANY trip at same time (even if route not nearby)
        const tripAtSameTime = tripsAtSameTime.get(vehicle.id);
        if (tripAtSameTime) {
          // Vehicle is booked at same time but route is NOT nearby
          // We still show it but with different recommendation
          isRecommended = false;
          recommendationReason = 'Booked at same time (different route)';
        } else {
          // Vehicle is completely free - normal recommendation logic
          if (distanceFromStart <= 5000) { // Within 5 km
            isRecommended = true;
            recommendationReason = 'Close to pickup location';
          } else if (this.isVehicleSuitableForTime(vehicle, scheduleData)) {
            isRecommended = true;
            recommendationReason = 'Suitable for scheduled time';
          }
        }
      }

      result.push({
        vehicle,
        isRecommended,
        recommendationReason,
        distanceFromStart,
        estimatedArrivalTime,
        isInConflict,
        conflictingTripData
      });
    }

    // Sort with priority: REAL conflict vehicles first, then recommended, then others
    return result.sort((a, b) => {
      if (a.isInConflict && !b.isInConflict) return -1;
      if (!a.isInConflict && b.isInConflict) return 1;
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return a.distanceFromStart - b.distanceFromStart;
    });
  }

  private isVehicleSuitableForTime(vehicle: Vehicle, scheduleData: any): boolean {
    return true;
  }

  private async getVehicleLocations(): Promise<Map<number, { lat: number; lng: number; lastUpdated: Date }>> {
    const locations = new Map<number, { lat: number; lng: number; lastUpdated: Date }>();
    
    const vehicles = await this.vehicleRepo.find({ where: { isActive: true } });
    
    vehicles.forEach(vehicle => {
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

  //
  async createTrip(createTripDto: CreateTripDto, requesterId: number) { 
    const requester = await this.userRepo.findOne({ 
      where: { id: requesterId },
      relations: ['department', 'department.head'] 
    }); 
    if (!requester) {
      throw new NotFoundException(this.responseService.error('Requester not found', 404));
    }

    // Check if it's a scheduled trip
    const isScheduledTrip = createTripDto.scheduleData.repetition !== RepetitionType.ONCE;
    
    // For scheduled trips, validate schedule
    if (isScheduledTrip) {
      await this.validateScheduleData(createTripDto.scheduleData);
    }

    // Calculate passenger count
    const passengerCount = this.calculatePassengerCount(createTripDto.passengerData);

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

      /*
      // Check vehicle capacity
      if (vehicle.seatingAvailability < passengerCount) {
        throw new BadRequestException(
          this.responseService.error('Vehicle does not have enough seating capacity', 400)
        );
      }
      */
    }

    // Check for conflicting trip if conflictTripId is provided
    let conflictTrip: Trip | null = null;
    if (createTripDto.conflictingTripId) {
      conflictTrip = await this.tripRepo.findOne({
        where: { id: createTripDto.conflictingTripId },
        relations: ['conflictingTrips', 'vehicle', 'location']
      });
      
      if (!conflictTrip) {
        throw new NotFoundException(
          this.responseService.error('Conflicting trip not found', 404)
        );
      }

      // Verify the conflicting trip is for the same vehicle
      if (conflictTrip.vehicle?.id !== createTripDto.vehicleId) {
        throw new BadRequestException(
          this.responseService.error('Conflicting trip is not for the same vehicle', 400)
        );
      }
    }

    // Create trip location
    const startCoords = createTripDto.locationData.startLocation.coordinates.coordinates;
    const endCoords = createTripDto.locationData.endLocation.coordinates.coordinates;

    // Prepare intermediate stops
    const intermediateStops = createTripDto.locationData.intermediateStops?.map((stop, index) => ({
      latitude: stop.coordinates?.coordinates?.[1] ?? 0,
      longitude: stop.coordinates?.coordinates?.[0] ?? 0,
      address: stop.address ?? '',
      order: index + 1
    })) ?? [];

    // Calculate route distance
    const routeDistance = this.calculateRouteDistanceWithStops(
      startCoords[1],
      startCoords[0],
      endCoords[1],
      endCoords[0],
      intermediateStops.map(stop => ({ latitude: stop.latitude, longitude: stop.longitude }))
    );

    // Calculate estimated duration
    const estimatedDuration = this.calculateRouteDuration(routeDistance, intermediateStops.length);

    // Create trip location
    const tripLocation = this.tripLocationRepo.create({
      startLatitude: startCoords[1],
      startLongitude: startCoords[0],
      startAddress: createTripDto.locationData.startLocation.address,
      endLatitude: endCoords[1],
      endLongitude: endCoords[0],
      endAddress: createTripDto.locationData.endLocation.address,
      intermediateStops: intermediateStops,
      totalStops: createTripDto.locationData.totalStops,
      locationData: createTripDto.locationData.routeData,
      distance: parseFloat(routeDistance.toFixed(2)),
      estimatedDuration: estimatedDuration,
    });

    const savedLocation = await this.tripLocationRepo.save(tripLocation);

    // Handle passenger data
    let selectedIndividual: User | undefined;
    const selectedGroupUserIds: number[] = [];

    if (createTripDto.passengerData.selectedIndividual) {
      selectedIndividual = await this.userRepo.findOne({
        where: { id: createTripDto.passengerData.selectedIndividual.id }
      });
    }

    if (createTripDto.passengerData.selectedGroupUsers?.length) {
      createTripDto.passengerData.selectedGroupUsers.forEach(user => {
        selectedGroupUserIds.push(user.id);
      });
      
      if (selectedGroupUserIds.length > 0) {
        const users = await this.userRepo.find({
          where: { id: In(selectedGroupUserIds) }
        });
        
        if (users.length !== selectedGroupUserIds.length) {
          const foundIds = users.map(u => u.id);
          const missingIds = selectedGroupUserIds.filter(id => !foundIds.includes(id));
          
          throw new BadRequestException(
            this.responseService.error(`Users not found: ${missingIds.join(', ')}`, 400)
          );
        }
      }
    }

    // Fix selectedOthers
    const selectedOthers = createTripDto.passengerData.selectedOthers?.map(other => ({
      id: String(other.id),
      displayName: other.displayName,
      contactNo: other.contactNo,
    })) || [];

    // Determine status and if approval is needed
    let tripStatus = createTripDto.status || TripStatus.PENDING;
    let requiresApproval = true;
    
    // Scheduled trips always need approval
    if (isScheduledTrip) {
      requiresApproval = true;
      tripStatus = TripStatus.PENDING;
    } else if (createTripDto.status === TripStatus.DRAFT) {
      // One-time draft doesn't need approval
      requiresApproval = false;
    }

    // Create the master trip
    const trip = this.tripRepo.create({
      ...createTripDto.scheduleData,
      startDate: this.formatDateForDB(createTripDto.scheduleData.startDate),
      startTime: this.formatTimeWithSeconds(createTripDto.scheduleData.startTime),
      validTillDate: createTripDto.scheduleData.validTillDate 
        ? this.formatDateForDB(createTripDto.scheduleData.validTillDate)
        : null,
      location: savedLocation,
      mileage: routeDistance,
      passengerType: createTripDto.passengerData.passengerType,
      passengerCount,
      selectedIndividual,
      selectedOthers,
      includeMeInGroup: createTripDto.passengerData.includeMeInGroup ?? true,
      purpose: createTripDto.purpose,
      specialRemarks: createTripDto.specialRemarks,
      vehicle,
      requester,
      status: tripStatus,
      conflictingTrips: conflictTrip ? [conflictTrip] : [],
      // NEW: Add scheduled trip metadata
      isScheduled: isScheduledTrip,
      isInstance: false,
      masterTripId: null,
      instanceDate: null,
    });

    const savedTrip = await this.tripRepo.save(trip);

    // Add selected group users
    if (selectedGroupUserIds.length > 0) {
      await this.tripRepo
        .createQueryBuilder()
        .relation(Trip, 'selectedGroupUsers')
        .of(savedTrip.id)
        .add(selectedGroupUserIds);
    }

    // Handle conflict trip relationship
    if (conflictTrip) {
      const conflictTripWithRelations = await this.tripRepo.findOne({
        where: { id: conflictTrip.id },
        relations: ['conflictingTrips']
      });

      if (conflictTripWithRelations) {
        if (!conflictTripWithRelations.conflictingTrips) {
          conflictTripWithRelations.conflictingTrips = [];
        }
        
        conflictTripWithRelations.conflictingTrips.push(savedTrip);
        await this.tripRepo.save(conflictTripWithRelations);
      }
    }

    /*
    // Update vehicle seating
    if (vehicle) {
      vehicle.seatingAvailability -= passengerCount;
      if (vehicle.seatingAvailability < 0) {
        throw new BadRequestException(
          this.responseService.error('Not enough seats available', 400)
        );
      }
      await this.vehicleRepo.save(vehicle);
    }
    */

    // Create approval if needed
    let approvalMessage = '';
    let tripInstances: Trip[] = [];
    
    if (requiresApproval) {
      // Create approval for master trip
      //await this.createSingleApproval(savedTrip, requester);
      const approval = await this.createApprovalRecord(savedTrip.id, requester, createTripDto, tripLocation, routeDistance);
      savedTrip.approval = approval;
      await this.tripRepo.save(savedTrip);

      approvalMessage = isScheduledTrip 
        ? 'Scheduled trip submitted for single approval' 
        : 'Trip submitted for single approval';
    } else {
      approvalMessage = 'Trip saved as draft';
    }

    // Generate trip instances for scheduled trips
    if (isScheduledTrip) {
      tripInstances = await this.generateTripInstances(savedTrip, createTripDto.scheduleData);
    }

    // Reload trip with relations
    const tripWithRelations = await this.tripRepo.findOne({
      where: { id: savedTrip.id },
      relations: [
        'vehicle', 
        'vehicle.assignedDriverPrimary', 
        'vehicle.assignedDriverSecondary',
        'conflictingTrips',
        'conflictingTrips.location',
        'conflictingTrips.requester',
        'selectedGroupUsers'
      ]
    });

            // TODO publish event

    return {
      success: true,
      message: approvalMessage,
      trip: new TripResponseDto(tripWithRelations!),
      masterTripId: savedTrip.id,
      isScheduled: isScheduledTrip,
      instanceCount: tripInstances.length,
      instanceIds: tripInstances.map(inst => inst.id),
      requiresApproval: requiresApproval,
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  async assignVehicleToTrip(
    tripId: number,
    vehicleId: number,
    userId: number,
  ): Promise<any> {
    // Get the trip with all necessary relations
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: [
        'location',
        'conflictingTrips',
        'vehicle',
        'requester',
        'selectedGroupUsers',
        'selectedIndividual',
        'approval'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    // Check if trip already has a vehicle assigned
    /*
    if (trip.vehicle) {
      throw new BadRequestException(
        this.responseService.error('Trip already has a vehicle assigned', 400)
      );
    }
    */

    // Get the vehicle with relations
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId, isActive: true },
      relations: ['assignedDriverPrimary', 'assignedDriverSecondary', 'vehicleType']
    });

    if (!vehicle) {
      throw new NotFoundException(this.responseService.error('Vehicle not found or inactive', 404));
    }

    // Check vehicle seating capacity
    /*
    if (vehicle.seatingAvailability < trip.passengerCount) {
      throw new BadRequestException(
        this.responseService.error(
          `Vehicle does not have enough seating capacity. Available: ${vehicle.seatingAvailability}, Required: ${trip.passengerCount}`,
          400
        )
      );
    }
    */

    // Update vehicle seating availability
    //const previousAvailability = vehicle.seatingAvailability;
    //const seatingAvailability = vehicle.seatingAvailability - trip.passengerCount;
    
    /*
    if (seatingAvailability < 0) {
      throw new BadRequestException(
        this.responseService.error('Not enough seats available after assignment', 400)
      );
    }
    */

    // If trip was DRAFT, change status to PENDING (requires approval)
    /*
    if (trip.status === TripStatus.DRAFT) {
      trip.status = TripStatus.PENDING;
      
      // Create approval record if not exists
      if (!trip.approval) {
        await this.createApprovalRecord(trip.id, trip.requester, {
          scheduleData: {
            startDate: trip.startDate.toString(),
            startTime: trip.startTime,
            repetition: trip.repetition
          }
        } as CreateTripDto, trip.location, trip.mileage);
      }
    }
    */

    // Save changes in a transaction
    await this.tripRepo.manager.transaction(async (transactionalEntityManager) => { 
      
      if (trip.status != TripStatus.DRAFT) {
        // 1. Handle vehicle seating availability if trip has a vehicle
        /*
        if (trip.vehicle) {
          // Pass the transactional entity manager to restoreVehicleSeats
          await this.restoreVehicleSeats(trip.vehicle.id, trip.passengerCount, transactionalEntityManager);
        }
        */
        
        // 2. Delete approval record if exists
        if (trip.approval) {
          await transactionalEntityManager.remove(Approval, trip.approval);
        }
      }
      
      trip.status = TripStatus.DRAFT;
        
      // Update trip with vehicle
      trip.vehicle = vehicle;      
      
      // Save trip with vehicle assignment
      await transactionalEntityManager.save(trip); 
    });

    // Send notifications
    try {
      // TODO: Publish event for notifications
      // this.eventEmitter.emit('vehicle.assigned', {
      //   tripId: trip.id,
      //   vehicleId: vehicle.id,
      //   assignedBy: userId,
      //   passengerCount: trip.passengerCount,
      //   vehicleModel: vehicle.model,
      //   vehicleRegNo: vehicle.regNo
      // });
    } catch (e) {
      console.error('Failed to send notification:', e);
    }

    return {
      success: true,
      message: 'Vehicle assigned to trip successfully',
      data: {
        trip: trip.id,
        vehicle: vehicle.model
      },
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  async confirmReviewTrip(tripId: number, userId: number){
    const requester = await this.userRepo.findOne({ 
      where: { id: userId },
      relations: ['department', 'department.head'] 
    }); 
    if (!requester) {
      throw new NotFoundException(this.responseService.error('Requester not found', 404));
    }

    // Get the current trip with necessary relations
    const currentTrip = await this.tripRepo.findOne({ 
      where: { id: tripId },
      relations: [
        'vehicle', 
        'location',
        'schedule',
        'requester',
        'selectedIndividual',
        'selectedGroupUsers'
      ] 
    }); 
    
    if (!currentTrip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    // Check if it's a scheduled trip
    const isScheduledTrip = currentTrip.isScheduled;
    
    // For scheduled trips, validate schedule
    if (isScheduledTrip && currentTrip.schedule) {
      const scheduleData = {
        startDate: currentTrip.schedule.startDate.toString(),
        startTime: currentTrip.schedule.startTime,
        repetition: currentTrip.schedule.repetition,
        validTillDate: currentTrip.schedule.validTillDate?.toString(),
        includeWeekends: currentTrip.schedule.includeWeekends,
        repeatAfterDays: currentTrip.schedule.repeatAfterDays
      };
      await this.validateScheduleData(scheduleData);
    }

    // Get passenger count from existing trip
    const passengerCount = currentTrip.passengerCount;

    // Validate vehicle if provided
    let vehicle: Vehicle | undefined;
    if (currentTrip.vehicle) {
      vehicle = await this.vehicleRepo.findOne({ 
        where: { id: currentTrip.vehicle.id },
        relations: ['assignedDriverPrimary', 'assignedDriverSecondary']
      });
      if (!vehicle) {
        throw new NotFoundException(this.responseService.error('Vehicle not found', 404));
      }

      /*
      // Check vehicle capacity
      if (vehicle.seatingAvailability < passengerCount) {
        throw new BadRequestException(
          this.responseService.error('Vehicle does not have enough seating capacity', 400)
        );
      }
      */
    }

    // Check for conflicting trips based on vehicle
    let conflictingTrips: Trip[] = [];
    if (vehicle) {
      // Check if vehicle has any trips at the same time that could conflict
      conflictingTrips = await this.findVehicleConflictingTrips(
        vehicle.id,
        currentTrip.startDate.toString(),
        currentTrip.startTime,
        currentTrip.location,
        currentTrip.id // Exclude current trip from conflict check
      );
    }

    // Determine status and if approval is needed
    let tripStatus = TripStatus.PENDING;
    let requiresApproval = true;

    // Update trip status
    currentTrip.status = tripStatus;
    const savedTrip = await this.tripRepo.save(currentTrip);

    // Handle conflict trip relationships
    if (conflictingTrips.length > 0) {
      for (const conflictTrip of conflictingTrips) {
        const conflictTripWithRelations = await this.tripRepo.findOne({
          where: { id: conflictTrip.id },
          relations: ['conflictingTrips']
        });

        if (conflictTripWithRelations) {
          if (!conflictTripWithRelations.conflictingTrips) {
            conflictTripWithRelations.conflictingTrips = [];
          }
          
          // Add current trip to conflict trip's conflictingTrips
          if (!conflictTripWithRelations.conflictingTrips.some(t => t.id === savedTrip.id)) {
            conflictTripWithRelations.conflictingTrips.push(savedTrip);
            await this.tripRepo.save(conflictTripWithRelations);
          }

          // Also add conflict trip to current trip's conflictingTrips
          if (!currentTrip.conflictingTrips) {
            currentTrip.conflictingTrips = [];
          }
          
          if (!currentTrip.conflictingTrips.some(t => t.id === conflictTrip.id)) {
            currentTrip.conflictingTrips.push(conflictTrip);
            await this.tripRepo.save(currentTrip);
          }
        }
      }
    }

    /*
    // Update vehicle seating
    if (vehicle) {
      // Only update if the trip wasn't already counted in vehicle seating
      vehicle.seatingAvailability -= passengerCount;
      if (vehicle.seatingAvailability < 0) {
        throw new BadRequestException(
          this.responseService.error('Not enough seats available', 400)
        );
      }
      await this.vehicleRepo.save(vehicle);
    }
    */

    // Create approval 
    let approvalMessage = '';
    let tripInstances: Trip[] = [];
    
    if (requiresApproval) {
      // Create approval record
      const createTripDtoMock = {
        scheduleData: {
          startDate: currentTrip.startDate.toString(),
          startTime: currentTrip.startTime,
          repetition: currentTrip.repetition
        },
        specialRemarks: currentTrip.specialRemarks
      } as CreateTripDto;
      
      const approval = await this.createApprovalRecord(
        savedTrip.id, 
        currentTrip.requester, 
        createTripDtoMock, 
        currentTrip.location!, 
        currentTrip.mileage
      );
      savedTrip.approval = approval;
      await this.tripRepo.save(savedTrip);

      approvalMessage = isScheduledTrip 
        ? 'Scheduled trip submitted for approval' 
        : 'Trip submitted for approval';
    }

    // Generate trip instances for scheduled trips
    if (isScheduledTrip && currentTrip.schedule) {
      const scheduleData = {
        startDate: currentTrip.schedule.startDate.toString(),
        startTime: currentTrip.schedule.startTime,
        repetition: currentTrip.schedule.repetition,
        validTillDate: currentTrip.schedule.validTillDate?.toString(),
        includeWeekends: currentTrip.schedule.includeWeekends,
        repeatAfterDays: currentTrip.schedule.repeatAfterDays
      };
      tripInstances = await this.generateTripInstances(savedTrip, scheduleData);
    }

    // Reload trip with relations
    const tripWithRelations = await this.tripRepo.findOne({
      where: { id: savedTrip.id },
      relations: [
        'vehicle', 
        'vehicle.assignedDriverPrimary', 
        'vehicle.assignedDriverSecondary',
        'conflictingTrips',
        'conflictingTrips.location',
        'conflictingTrips.requester',
        'selectedGroupUsers'
      ]
    });

    // TODO publish event

    return {
      success: true,
      message: approvalMessage || 'Trip confirmed successfully',
      trip: new TripResponseDto(tripWithRelations!),
      masterTripId: savedTrip.id,
      isScheduled: isScheduledTrip,
      instanceCount: tripInstances.length,
      instanceIds: tripInstances.map(inst => inst.id),
      requiresApproval: requiresApproval,
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  // Helper method to find vehicle conflicting trips
  private async findVehicleConflictingTrips(
    vehicleId: number,
    startDate: string,
    startTime: string,
    tripLocation: TripLocation,
    excludeTripId?: number
  ): Promise<Trip[]> {
    const dbDate = this.formatDateForDB(startDate);
    const dbTime = this.formatTimeWithSeconds(startTime);
    
    // Get time in minutes for comparison
    const [hours, minutes] = dbTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Get all trips for this vehicle at same time
    const queryBuilder = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('vehicle.id = :vehicleId', { vehicleId })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [TripStatus.PENDING, TripStatus.APPROVED, TripStatus.READ, TripStatus.ONGOING]
      })
      .andWhere('trip.startDate = :date', { date: dbDate });

    if (excludeTripId) {
      queryBuilder.andWhere('trip.id != :excludeTripId', { excludeTripId });
    }

    const vehicleTrips = await queryBuilder.getMany();
    const conflictingTrips: Trip[] = [];

    // Check each trip for time and route conflicts
    for (const existingTrip of vehicleTrips) {
      if (!existingTrip.location) continue;

      // Check time within window
      const tripTimeStr = this.formatTimeWithSeconds(existingTrip.startTime);
      const [tripHours, tripMinutes] = tripTimeStr.split(':').map(Number);
      const tripTotalMinutes = tripHours * 60 + tripMinutes;
      
      // Calculate time difference
      let timeDiff = Math.abs(tripTotalMinutes - totalMinutes);
      timeDiff = Math.min(timeDiff, 1440 - timeDiff);
      
      if (timeDiff > this.CONFLICT_TIME_WINDOW) {
        continue;
      }

      // Check route proximity
      const isNearby = this.areTripLocationsNearby(
        tripLocation.startLatitude,
        tripLocation.startLongitude,
        tripLocation.endLatitude,
        tripLocation.endLongitude,
        existingTrip.location
      );

      if (isNearby) {
        conflictingTrips.push(existingTrip);
      }
    }

    return conflictingTrips;
  }

  async createTripAsDraft(createTripDto: CreateTripDto, requesterId: number) { 
    const requester = await this.userRepo.findOne({ 
      where: { id: requesterId },
      relations: ['department', 'department.head'] 
    }); 
    if (!requester) {
      throw new NotFoundException(this.responseService.error('Requester not found', 404));
    }

    // Check if it's a scheduled trip
    const isScheduledTrip = createTripDto.scheduleData.repetition !== RepetitionType.ONCE;
    
    let schedule: Schedule | null;
    // For scheduled trips, validate schedule
    if (isScheduledTrip) {
      await this.validateScheduleData(createTripDto.scheduleData);

      schedule = await this.createSchedule(createTripDto.scheduleData);
    }

    // Calculate passenger count
    const passengerCount = this.calculatePassengerCount(createTripDto.passengerData);

    // Create trip location
    const startCoords = createTripDto.locationData.startLocation.coordinates.coordinates;
    const endCoords = createTripDto.locationData.endLocation.coordinates.coordinates;

    // Prepare intermediate stops
    const intermediateStops = createTripDto.locationData.intermediateStops?.map((stop, index) => ({
      latitude: stop.coordinates?.coordinates?.[1] ?? 0,
      longitude: stop.coordinates?.coordinates?.[0] ?? 0,
      address: stop.address ?? '',
      order: index + 1
    })) ?? [];

    // Calculate route distance
    /*
    const routeDistance = this.calculateRouteDistanceWithStops(
      startCoords[1],
      startCoords[0],
      endCoords[1],
      endCoords[0],
      intermediateStops.map(stop => ({ latitude: stop.latitude, longitude: stop.longitude }))
    );
    */
    const routeDistance = createTripDto.locationData.totalDistance;

    // Calculate estimated duration
    //const estimatedDuration = this.calculateRouteDuration(routeDistance, intermediateStops.length);
    //const estimatedDuration = this.calculateRouteDuration(routeDistance);
    const estimatedDuration = createTripDto.locationData.totalDuration;
    
    const estimatedRestingHours = this.calculateEstimatedRestingHours(estimatedDuration * 2);

    //const upNdownDistance = routeDistance * 2;
    //const upNdownDuration = estimatedDuration * 2;

    // Create trip location
    const tripLocation = this.tripLocationRepo.create({
      startLatitude: startCoords[1],
      startLongitude: startCoords[0],
      startAddress: createTripDto.locationData.startLocation.address,
      endLatitude: endCoords[1],
      endLongitude: endCoords[0],
      endAddress: createTripDto.locationData.endLocation.address,
      intermediateStops: intermediateStops,
      totalStops: createTripDto.locationData.totalStops,
      locationData: createTripDto.locationData.routeData,
      distance: parseFloat(routeDistance.toFixed(2)),
      estimatedDuration: estimatedDuration,
      estimatedRestingHours: estimatedRestingHours,
    });

    const savedLocation = await this.tripLocationRepo.save(tripLocation);

    // Handle passenger data
    let selectedIndividual: User | undefined;
    const selectedGroupUserIds: number[] = [];

    if (createTripDto.passengerData.selectedIndividual) {
      selectedIndividual = await this.userRepo.findOne({
        where: { id: createTripDto.passengerData.selectedIndividual.id }
      });
    }

    if (createTripDto.passengerData.selectedGroupUsers?.length) {
      createTripDto.passengerData.selectedGroupUsers.forEach(user => {
        selectedGroupUserIds.push(user.id);
      });
      
      if (selectedGroupUserIds.length > 0) {
        const users = await this.userRepo.find({
          where: { id: In(selectedGroupUserIds) }
        });
        
        if (users.length !== selectedGroupUserIds.length) {
          const foundIds = users.map(u => u.id);
          const missingIds = selectedGroupUserIds.filter(id => !foundIds.includes(id));
          
          throw new BadRequestException(
            this.responseService.error(`Users not found: ${missingIds.join(', ')}`, 400)
          );
        }
      }
    }

    // Fix selectedOthers
    const selectedOthers = createTripDto.passengerData.selectedOthers?.map(other => ({
      id: String(other.id),
      displayName: other.displayName,
      contactNo: other.contactNo,
    })) || [];

    // Determine status and if approval is needed
    let tripStatus = TripStatus.DRAFT;
    let requiresApproval = true;
    
    // Scheduled trips always need approval
    if (isScheduledTrip) {
      requiresApproval = true;
      tripStatus = TripStatus.DRAFT;
    } else if (createTripDto.status === TripStatus.DRAFT) {
      // One-time draft doesn't need approval
      requiresApproval = false;
    }

    // Create the master trip
    const trip = this.tripRepo.create({
      ...createTripDto.scheduleData,
      startDate: this.formatDateForDB(createTripDto.scheduleData.startDate),
      startTime: this.formatTimeWithSeconds(createTripDto.scheduleData.startTime),
      validTillDate: createTripDto.scheduleData.validTillDate 
        ? this.formatDateForDB(createTripDto.scheduleData.validTillDate)
        : null,
      location: savedLocation,
      mileage: routeDistance,
      passengerType: createTripDto.passengerData.passengerType,
      passengerCount,
      selectedIndividual,
      selectedOthers,
      includeMeInGroup: createTripDto.passengerData.includeMeInGroup ?? true,
      purpose: createTripDto.purpose,
      specialRemarks: createTripDto.specialRemarks,
      //vehicle,
      requester,
      status: tripStatus,
      //conflictingTrips: conflictTrip ? [conflictTrip] : [],
      // NEW: Add scheduled trip metadata
      isScheduled: isScheduledTrip,
      schedule: schedule,
      isInstance: false,
      masterTripId: null,
      instanceDate: null,
    });

    const savedTrip = await this.tripRepo.save(trip);

    // Add selected group users
    if (selectedGroupUserIds.length > 0) {
      await this.tripRepo
        .createQueryBuilder()
        .relation(Trip, 'selectedGroupUsers')
        .of(savedTrip.id)
        .add(selectedGroupUserIds);
    }
            // TODO publish event

    return {
      success: true,
      //message: approvalMessage,
      trip: savedTrip,
      masterTripId: savedTrip.id,
      isScheduled: isScheduledTrip,
      //instanceCount: tripInstances.length,
      //instanceIds: tripInstances.map(inst => inst.id),
      requiresApproval: requiresApproval,
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  private async createSchedule(scheduleData: ScheduleDataDto): Promise<Schedule> {
    const schedule = this.scheduleRepo.create({
      startDate: new Date(scheduleData.startDate),
      validTillDate: scheduleData.validTillDate ? new Date(scheduleData.validTillDate) : undefined,
      startTime: scheduleData.startTime,
      repetition: scheduleData.repetition,
      includeWeekends: scheduleData.includeWeekends || false,
      repeatAfterDays: scheduleData.repeatAfterDays,
    });

    return await this.scheduleRepo.save(schedule);
  }

  // NEW HELPER METHODS TO ADD TO YOUR SERVICE:
  private async validateScheduleData(scheduleData: ScheduleDataDto): Promise<void> {
    const startDate = new Date(scheduleData.startDate);
    const today = new Date();

    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      throw new BadRequestException(
        this.responseService.error('Start date cannot be in the past', 400)
      );
    }
    
    if (scheduleData.validTillDate) {
      const validTillDate = new Date(scheduleData.validTillDate);
      if (validTillDate < startDate) {
        throw new BadRequestException(
          this.responseService.error('Valid till date cannot be before start date', 400)
        );
      }
    }
    
    if (scheduleData.repetition === RepetitionType.DAILY && scheduleData.repeatAfterDays) {
      if (scheduleData.repeatAfterDays < 1) {
        throw new BadRequestException(
          this.responseService.error('Repeat after days must be at least 1', 400)
        );
      }
    }
  }

  private async generateTripInstances(masterTrip: Trip, scheduleData: ScheduleDataDto): Promise<Trip[]> {
    const { repetition, startDate, validTillDate, includeWeekends, repeatAfterDays } = scheduleData;
    
    const start = new Date(startDate);
    const end = validTillDate ? new Date(validTillDate) : this.getDefaultEndDate(start, repetition);
    
    const instanceDates = this.calculateInstanceDates(start, end, repetition, includeWeekends, repeatAfterDays);
    
    const instances: Trip[] = [];
    
    for (const instanceDate of instanceDates) {
      // Clone location for each instance
      const locationCopy = await this.cloneTripLocation(masterTrip.location);
      
      // Create instance
      const tripInstance = this.tripRepo.create({
        location: locationCopy,
        mileage: masterTrip.mileage,
        passengerType: masterTrip.passengerType,
        passengerCount: masterTrip.passengerCount,
        selectedIndividual: masterTrip.selectedIndividual,
        selectedOthers: masterTrip.selectedOthers,
        includeMeInGroup: masterTrip.includeMeInGroup,
        purpose: masterTrip.purpose,
        specialRemarks: masterTrip.specialRemarks,
        vehicle: masterTrip.vehicle,
        requester: masterTrip.requester,
        startDate: instanceDate.toISOString().split('T')[0],
        startTime: masterTrip.startTime,
        repetition: RepetitionType.ONCE,
        status: TripStatus.PENDING,
        isScheduled: false,
        isInstance: true,
        masterTripId: masterTrip.id,
        instanceDate: instanceDate,
      });
      
      const savedInstance = await this.tripRepo.save(tripInstance);
      instances.push(savedInstance);
      
      // Copy selected group users
      if (masterTrip.selectedGroupUsers && masterTrip.selectedGroupUsers.length > 0) {
        const groupUserIds = masterTrip.selectedGroupUsers.map(user => user.id);
        await this.tripRepo
          .createQueryBuilder()
          .relation(Trip, 'selectedGroupUsers')
          .of(savedInstance.id)
          .add(groupUserIds);
      }
    }
    
    return instances;
  }

  private getDefaultEndDate(start: Date, repetition: RepetitionType): Date {
    const end = new Date(start);
    
    switch (repetition) {
      case RepetitionType.DAILY:
        end.setDate(end.getDate() + 30);
        break;
      case RepetitionType.WEEKLY:
        end.setDate(end.getDate() + 90);
        break;
      case RepetitionType.MONTHLY:
        end.setMonth(end.getMonth() + 6);
        break;
      default:
        end.setDate(end.getDate() + 30);
    }
    
    return end;
  }

  private calculateInstanceDates(
    start: Date,
    end: Date,
    repetition: RepetitionType,
    includeWeekends?: boolean,
    repeatAfterDays?: number
  ): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);
    
    // Skip the start date - move to next occurrence
    switch (repetition) {
      case RepetitionType.DAILY:
        const interval = repeatAfterDays || 1;
        // Move current to next occurrence
        current.setDate(current.getDate() + interval);
        
        while (current <= end) {
          if (includeWeekends || (current.getDay() !== 0 && current.getDay() !== 6)) {
            dates.push(new Date(current));
          }
          current.setDate(current.getDate() + interval);
        }
        break;
        
      case RepetitionType.WEEKLY:
        // Skip the start week, move to next week
        current.setDate(current.getDate() + 7);
        
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 7);
        }
        break;
        
      case RepetitionType.MONTHLY:
        // Skip the start month, move to next month
        current.setMonth(current.getMonth() + 1);
        
        while (current <= end) {
          dates.push(new Date(current));
          current.setMonth(current.getMonth() + 1);
        }
        break;
    }
    
    return dates;
  }

  private async cloneTripLocation(location: TripLocation): Promise<TripLocation> {
    const locationCopy = this.tripLocationRepo.create({
      startLatitude: location.startLatitude,
      startLongitude: location.startLongitude,
      startAddress: location.startAddress,
      endLatitude: location.endLatitude,
      endLongitude: location.endLongitude,
      endAddress: location.endAddress,
      intermediateStops: location.intermediateStops ? [...location.intermediateStops] : [],
      totalStops: location.totalStops,
      locationData: location.locationData ? { ...location.locationData } : null,
      distance: location.distance,
      estimatedDuration: location.estimatedDuration,
    });
    
    return await this.tripLocationRepo.save(locationCopy);
  }

  // Add to your TripsService

  async approveScheduledTrip(masterTripId: number, approverId: number, remarks?: string): Promise<any> {
    try {
    // Get master trip
    const masterTrip = await this.tripRepo.findOne({
      where: { id: masterTripId, isScheduled: true, isInstance: false },
      relations: [
        'approval', 
        'approval.approver1', 
        'approval.approver2', 
        'approval.safetyApprover', 
        'requester',
        'vehicle'
      ]
    });

    if (!masterTrip) {
      throw new NotFoundException(this.responseService.error('Master scheduled trip not found', 404));
    }

    // Get all instances
    const instances = await this.tripRepo.find({
      where: { 
        masterTripId: masterTripId,
        isInstance: true 
      }
    });

    // Get user making the request
    const user = await this.userRepo.findOne({ where: { id: approverId } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    const approval = masterTrip.approval;
    const isSysAdmin = user.role === UserRole.SYSADMIN;

    // Check if already approved
    if (approval?.overallStatus === StatusApproval.APPROVED) {
      throw new BadRequestException(this.responseService.error('Master scheduled trip is already approved', 400));
    }

    // Check if rejected
    if (approval?.overallStatus === StatusApproval.REJECTED) {
      throw new BadRequestException(this.responseService.error('Master scheduled trip is already rejected', 400));
    }

    // Check authorization (SAME AS NORMAL APPROVAL)
    let isAuthorized = false;
    let approverType: ApproverType | null = null;

    if (isSysAdmin) {
      isAuthorized = true;
    } else {
      if (approval?.approver1?.id === approverId) {
        isAuthorized = true;
        approverType = ApproverType.HOD;
      } else if (approval?.approver2?.id === approverId) {
        isAuthorized = true;
        approverType = ApproverType.SECONDARY;
      } else if (approval?.safetyApprover?.id === approverId) {
        isAuthorized = true;
        approverType = ApproverType.SAFETY;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException(
        this.responseService.error('You are not authorized to approve this scheduled trip', 403)
      );
    }

    // Process approval (SAME AS NORMAL APPROVAL)
    const now = new Date();
    
    // Update approval based on approver type
    if (approverType === ApproverType.HOD) {
      approval.approver1Status = StatusApproval.APPROVED;
      approval.approver1ApprovedAt = now;
      approval.approver1Comments = remarks;
    } else if (approverType === ApproverType.SECONDARY && approval.approver2) {
      approval.approver2Status = StatusApproval.APPROVED;
      approval.approver2ApprovedAt = now;
      approval.approver2Comments = remarks;
    } else if (approverType === ApproverType.SAFETY && approval.safetyApprover) {
      approval.safetyApproverStatus = StatusApproval.APPROVED;
      approval.safetyApproverApprovedAt = now;
      approval.safetyApproverComments = remarks;
    } else if (isSysAdmin) {
      approval.approver1Status = StatusApproval.APPROVED;
      approval.approver1ApprovedAt = now;
      approval.approver1Comments = `Approved by SYSADMIN: ${remarks || 'No comment'}`;

      approval.approver2Status = StatusApproval.APPROVED;
      approval.approver2ApprovedAt = now;
      approval.approver2Comments = `Approved by SYSADMIN: ${remarks || 'No comment'}`;

      approval.safetyApproverStatus = StatusApproval.APPROVED;
      approval.safetyApproverApprovedAt = now;
      approval.safetyApproverComments = `Approved by SYSADMIN: ${remarks || 'No comment'}`;
    }

    // Update overall status and move to next step
    approval.updateOverallStatus();
    
    // If no rejection, move to next step
    if (!approval.hasAnyRejection()) {
      approval.moveToNextStep();
    }

    // If fully approved, update master trip status and create approvals for instances
    if (approval.overallStatus.toString() === 'approved') {
      masterTrip.status = TripStatus.APPROVED;
      
      // Create approvals for all instances (same as master)
      for (const instance of instances) {
        // Check if instance already has approval
        const existingApproval = await this.approvalRepo.findOne({
          where: { trip: { id: instance.id } }
        });

        if (!existingApproval) {
          // Create new approval for instance (copy from master)
          const instanceApproval = this.approvalRepo.create({
            trip: instance,
            approver1: approval.approver1 || null,
            approver1Status: approval.approver1Status || StatusApproval.APPROVED,
            approver1ApprovedAt: approval.approver1ApprovedAt || now,
            approver1Comments: approval.approver1Comments || `Approved as part of scheduled trip #${masterTripId}`,
            approver2: approval.approver2 || null,
            approver2Status: approval.approver2Status || StatusApproval.APPROVED,
            approver2ApprovedAt: approval.approver2ApprovedAt || now,
            approver2Comments: approval.approver2Comments || `Approved as part of scheduled trip #${masterTripId}`,
            safetyApprover: approval.safetyApprover || null,
            safetyApproverStatus: approval.safetyApproverStatus || StatusApproval.APPROVED,
            safetyApproverApprovedAt: approval.safetyApproverApprovedAt || now,
            safetyApproverComments: approval.safetyApproverComments || `Approved as part of scheduled trip #${masterTripId}`,
            overallStatus: StatusApproval.APPROVED,
            currentStep: ApproverType.COMPLETED,
            requireApprover1: approval.requireApprover1 || true,
            requireApprover2: approval.requireApprover2 || false,
            requireSafetyApprover: approval.requireSafetyApprover || false,
          });

          await this.approvalRepo.save(instanceApproval);
        } else {
          // If instance already has approval, update it
          existingApproval.overallStatus = StatusApproval.APPROVED;
          existingApproval.currentStep = ApproverType.COMPLETED;
          await this.approvalRepo.save(existingApproval);
        }

        // Update instance status
        instance.status = TripStatus.APPROVED;
        await this.tripRepo.save(instance);
      }
    }

    // Save master changes
    await this.approvalRepo.save(approval);
    await this.tripRepo.save(masterTrip);

          // TODO publish event
      
      return {
        success: true,
        message: `Scheduled trip ${approverType} approval submitted successfully`,
        data: {
          masterTripId: masterTrip.id,
          approvalStatus: approval.overallStatus,
          currentStep: approval.currentStep,
          approvedBy: user.displayname,
          approvedAt: now,
          nextStep: approval.currentStep ? `Waiting for ${approval.currentStep} approval` : 'Fully approved',
          instanceCount: instances.length
        },
        timestamp: now.toISOString(),
        statusCode: 200
      };
    } catch (error) {
      console.error('Error in approveScheduledTrip:', error);
      throw new InternalServerErrorException(
        this.responseService.error('Failed to approve scheduled trip', 500)
      );
    }
  }

  // Add to your TripsService

  async getTripWithInstances(tripId: number): Promise<any> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: [
        'location',
        'vehicle',
        'requester',
        'selectedGroupUsers'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    let instances: Trip[] = [];
    
    // If this is a master scheduled trip, get its instances
    if (trip.isScheduled && !trip.isInstance) {
      instances = await this.tripRepo.find({
        where: { 
          masterTripId: tripId,
          isInstance: true 
        },
        relations: ['location', 'vehicle', 'requester'],
        order: { instanceDate: 'ASC' }
      });
    }
    
    // If this is an instance, get its master and sibling instances
    if (trip.isInstance && trip.masterTripId) {
      const masterTrip = await this.tripRepo.findOne({
        where: { id: trip.masterTripId },
        relations: ['location', 'vehicle', 'requester']
      });
      
      instances = await this.tripRepo.find({
        where: { 
          masterTripId: trip.masterTripId,
          isInstance: true,
          id: Not(tripId) // Exclude current instance
        },
        relations: ['location', 'vehicle', 'requester'],
        order: { instanceDate: 'ASC' }
      });
      
      return {
        masterTrip: masterTrip ? new TripResponseDto(masterTrip) : null,
        currentInstance: new TripResponseDto(trip),
        siblingInstances: instances.map(inst => new TripResponseDto(inst)),
        isInstance: true
      };
    }

    return {
      masterTrip: new TripResponseDto(trip),
      instances: instances.map(inst => new TripResponseDto(inst)),
      instanceCount: instances.length,
      isScheduled: trip.isScheduled,
      isInstance: false
    };
  }
  //

  async getCombinedTripForDriver(tripId: number) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: [
        'location',
        'conflictingTrips',
        'conflictingTrips.location',
        'conflictingTrips.requester',
        'vehicle'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    const allTrips = [trip, ...(trip.conflictingTrips || [])];
    
    allTrips.sort((a, b) => {
      const timeA = new Date(`${a.startDate}T${a.startTime}`).getTime();
      const timeB = new Date(`${b.startDate}T${b.startTime}`).getTime();
      return timeA - timeB;
    });

    const combinedStops = [];
    
    for (const t of allTrips) {
      combinedStops.push({
        tripId: t.id,
        type: 'start',
        location: {
          address: t.location.startAddress,
          coordinates: [t.location.startLongitude, t.location.startLatitude],
          time: t.startTime,
          date: t.startDate,
          passengerCount: t.passengerCount,
          requesterName: t.requester.displayname
        }
      });

      combinedStops.push({
        tripId: t.id,
        type: 'end',
        location: {
          address: t.location.endAddress,
          coordinates: [t.location.endLongitude, t.location.endLatitude],
          time: this.calculateEndTime(t),
          passengerCount: t.passengerCount,
          requesterName: t.requester.displayname
        }
      });

      if (t.location.intermediateStops?.length) {
        t.location.intermediateStops.forEach((stop, index) => {
          combinedStops.push({
            tripId: t.id,
            type: 'intermediate',
            location: {
              address: stop.address,
              coordinates: [stop.longitude, stop.latitude],
              sequence: index + 1
            }
          });
        });
      }
    }

    return {
      success: true,
      data: {
        mainTrip: new TripResponseDto(trip),
        combinedTrips: allTrips.map(t => new TripResponseDto(t)),
        combinedStops,
        vehicle: trip.vehicle,
        driverInstructions: this.generateDriverInstructions(allTrips)
      },
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  private calculateEndTime(trip: Trip): string {
    const startDateTime = new Date(`${trip.startDate}T${trip.startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
    return endDateTime.toTimeString().split(' ')[0];
  }

  private generateDriverInstructions(trips: Trip[]): string[] {
    const instructions = [];
    
    if (trips.length > 1) {
      instructions.push(`You have ${trips.length} trips scheduled together.`);
      
      trips.forEach((trip, index) => {
        instructions.push(
          `Trip ${index + 1}: Pick up ${trip.passengerCount} passenger(s) from ${trip.location.startAddress} at ${trip.startTime}`
        );
      });
      
      instructions.push('Please follow the combined route for optimal efficiency.');
    }
    
    return instructions;
  }

  private async createApprovalRecord(tripId: number, requester: User, createTripDto: CreateTripDto, tripLocation: TripLocation, tripDistance: number): Promise<Approval> {
    
    // Get requester's department HOD (approver1)
    const requesterHOD = await this.getRequesterHOD(requester);
    
    // Get approval configuration
    const approvalConfig = await this.approvalConfigRepo.findOne({
      where: { isActive: true },
      relations: ['secondaryUser', 'safetyUser']
    });

    // Calculate trip distance
    //const tripDistance = await this.calculateTripDistance(tripLocation);

    // Check if secondary approval is required (based on distance)
    const requireApprover2 = approvalConfig?.distanceLimit 
      ? tripDistance > approvalConfig.distanceLimit 
      : false;
    
    // Check if safety approval is required (based on restricted hours)
    const requireSafetyApprover = await this.isDuringRestrictedHours(
      createTripDto.scheduleData.startTime,
      approvalConfig
    );

    // Get approver2 from config if required
    let approver2: User | undefined;
    if (requireApprover2 && approvalConfig?.secondaryUser) {
      approver2 = approvalConfig.secondaryUser;
    }

    // Get safety approver from config if required
    let safetyApprover: User | undefined;
    if (requireSafetyApprover && approvalConfig?.safetyUser) {
      safetyApprover = approvalConfig.safetyUser;
    }

    // Create approval record
    const approval = this.approvalRepo.create({
      trip: { id: tripId } as Trip,
      approver1: requesterHOD,
      approver1Status: StatusApproval.PENDING,
      approver2: approver2,
      approver2Status: requireApprover2 ? StatusApproval.PENDING : undefined,
      safetyApprover: safetyApprover,
      safetyApproverStatus: requireSafetyApprover ? StatusApproval.PENDING : undefined,
      overallStatus: StatusApproval.PENDING,
      currentStep: ApproverType.HOD,
      requireApprover1: true, // Always require HOD approval
      requireApprover2,
      requireSafetyApprover,
      comments: createTripDto.specialRemarks,
    });

    const savedApproval = await this.approvalRepo.save(approval);

    // Send notifications to approvers
    await this.sendApprovalNotifications(savedApproval);

    return savedApproval;
  }

  private async getRequesterHOD(requester: User): Promise<User | undefined> {
    // Implement logic to get requester's department HOD
    // This depends on your user structure
    const user = await this.userRepo.findOne({ 
      where: { id: requester.id },
      relations: ['department', 'department.head'] 
    }); 

    if (user.department?.head) {
      return user.department.head;
    }

    return undefined;
  }

  private async isDuringRestrictedHours(startTime: string, approvalConfig?: ApprovalConfig): Promise<boolean> {
    if (!approvalConfig?.restrictedFrom || !approvalConfig?.restrictedTo) {
      return false;
    }

    const tripTime = this.formatTimeWithSeconds(startTime);
    
    // Parse times
    const tripTimeParts = tripTime.split(':').map(Number);
    const restrictedFromParts = approvalConfig.restrictedFrom.split(':').map(Number);
    const restrictedToParts = approvalConfig.restrictedTo.split(':').map(Number);
    
    // Create Date objects for comparison (using same date)
    const baseDate = new Date('2000-01-01');
    
    const tripDateTime = new Date(baseDate);
    tripDateTime.setHours(tripTimeParts[0], tripTimeParts[1], tripTimeParts[2] || 0);
    
    const restrictedFromDateTime = new Date(baseDate);
    restrictedFromDateTime.setHours(restrictedFromParts[0], restrictedFromParts[1], restrictedFromParts[2] || 0);
    
    const restrictedToDateTime = new Date(baseDate);
    restrictedToDateTime.setHours(restrictedToParts[0], restrictedToParts[1], restrictedToParts[2] || 0);
    
    console.log("Trip time:", tripDateTime.toTimeString().split(' ')[0]);
    console.log("Restricted from:", restrictedFromDateTime.toTimeString().split(' ')[0]);
    console.log("Restricted to:", restrictedToDateTime.toTimeString().split(' ')[0]);

    // Check if restricted time crosses midnight
    if (restrictedFromDateTime < restrictedToDateTime) {
      // Normal range: from < to (doesn't cross midnight)
      console.log("Normal range (doesn't cross midnight)");
      return tripDateTime >= restrictedFromDateTime && tripDateTime <= restrictedToDateTime;
    } else {
      // Range crosses midnight: from > to
      console.log("Range crosses midnight");
      return tripDateTime >= restrictedFromDateTime || tripDateTime <= restrictedToDateTime;
    }
  }

  private async sendApprovalNotifications(approval: Approval) {
    // Send notification to approver1 (HOD)
    if (approval.approver1) {
      // Implement notification logic (email, push, etc.)
      console.log(`Notification sent to HOD: ${approval.approver1.displayname}`);
    }
    
    // Send notification to approver2 if required
    if (approval.requireApprover2 && approval.approver2) {
      console.log(`Notification sent to secondary approver: ${approval.approver2.displayname}`);
    }
    
    // Send notification to safety approver if required
    if (approval.requireSafetyApprover && approval.safetyApprover) {
      console.log(`Notification sent to safety approver: ${approval.safetyApprover.displayname}`);
    }
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
      }
    };
  }

  async cancelTrip(tripId: number, user: any, cancellationReason?: string) {
    if (user === null || user === undefined) {
      throw new ForbiddenException('User not authenticated');
    }

    // Find the trip with all necessary relations
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: [
        'vehicle',
        'conflictingTrips',
        'linkedTrips',
        'conflictingTrips.vehicle',
        'conflictingTrips.linkedTrips',
        'approval',
        'requester'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }
    
    // Check if requester is the trip owner
    if (trip.requester.id !== user.userId && user.role == 'supervisor') { 
      throw new ForbiddenException(
        this.responseService.error('You are not authorized to cancel this trip', 403)
      );
    }

    /*
    if (trip.approval?.approver1Status === StatusApproval.APPROVED ||
        trip.approval?.approver2Status === StatusApproval.APPROVED ||
        trip.approval?.safetyApproverStatus === StatusApproval.APPROVED) {
      throw new BadRequestException(
        this.responseService.error(
          `Cannot cancel trip. Only trips with zero approval can be cancelled.`,
          400
        )
      );
    }

    // Check if trip has approval record and it's still pending
    if (trip.approval && trip.approval.overallStatus !== StatusApproval.PENDING) {
      throw new BadRequestException(
        this.responseService.error(
          `Cannot cancel trip that has already been ${trip.approval.overallStatus}`,
          400
        )
      );
    }
    */

    if (
      trip.status == TripStatus.READ ||
      trip.status == TripStatus.ONGOING ||
      trip.status == TripStatus.COMPLETED ||
      trip.status == TripStatus.FINISHED
    ) {
        throw new BadRequestException(
        this.responseService.error(
          `Cannot cancel trip.`,
          400
        )
      );
    }

    // Store passenger count before transaction
    const passengerCount = trip.passengerCount;
    const vehicleId = trip.vehicle?.id;

    // Start transaction to ensure data consistency
    return await this.tripRepo.manager.transaction(async (transactionalEntityManager) => {
      /*
      // 1. Handle vehicle seating availability if trip has a vehicle
      if (trip.vehicle) {
        // Pass the transactional entity manager to restoreVehicleSeats
        await this.restoreVehicleSeats(vehicleId, passengerCount, transactionalEntityManager);
      }
      */

      // 2. Handle conflict trips
      await this.handleConflictTrips(trip, transactionalEntityManager);

      // 3. Delete approval record if exists
      if (trip.approval) {
        await transactionalEntityManager.remove(Approval, trip.approval);
      }
      
      // 4. Update trip status to CANCELED
      await transactionalEntityManager.update(
        Trip,
        { id: tripId },
        { 
          status: TripStatus.CANCELED,
          // Add any other fields you want to update
          updatedAt: new Date()
        }
      );

      try {
        // TODO publish event
      } catch (e) {
        console.error('Failed to send cancellation notification', e);
      }

      return {
        success: true,
        message: 'Trip canceled successfully',
        data: {
          tripId: tripId, // Return the original ID
          status: TripStatus.CANCELED,
          timestamp: new Date().toISOString()
        },
        statusCode: 200
      };
    });
  }

  /*
  private async restoreVehicleSeats(vehicleId: number, passengerCount: number, transactionalEntityManager) {
    if (!vehicleId) return;
    
    const vehicle = await transactionalEntityManager.findOne(
      Vehicle,
      { where: { id: vehicleId } }
    );

    if (vehicle) {
      console.log(`Restoring ${passengerCount} seats to vehicle ${vehicleId}`);
      console.log(`Before: ${vehicle.seatingAvailability} seats available`);
      
      // Restore seats that were allocated for this trip
      vehicle.seatingAvailability += passengerCount;
      
      // Ensure seating availability doesn't exceed max capacity
      const maxAvailable = vehicle.seatingCapacity - 1; // Assuming driver takes 1 seat
      if (vehicle.seatingAvailability > maxAvailable) {
        vehicle.seatingAvailability = maxAvailable;
      }
      
      console.log(`After: ${vehicle.seatingAvailability} seats available`);
      
      await transactionalEntityManager.save(Vehicle, vehicle);
    } else {
      console.warn(`Vehicle ${vehicleId} not found when trying to restore seats`);
    }
  }
  */

  private async handleConflictTrips(trip: Trip, transactionalEntityManager) {
    // Remove this trip from all conflicting trips' linkedTrips
    if (trip.linkedTrips && trip.linkedTrips.length > 0) {
      for (const linkedTrip of trip.linkedTrips) {
        // Load the linked trip with its conflictingTrips relation
        const fullLinkedTrip = await transactionalEntityManager.findOne(
          Trip,
          {
            where: { id: linkedTrip.id },
            relations: ['conflictingTrips']
          }
        );

        if (fullLinkedTrip && fullLinkedTrip.conflictingTrips) {
          // Remove the canceled trip from conflictingTrips
          fullLinkedTrip.conflictingTrips = fullLinkedTrip.conflictingTrips.filter(
            conflictTrip => conflictTrip.id !== trip.id
          );
          
          await transactionalEntityManager.save(fullLinkedTrip);
        }
      }
    }

    // Handle trips that are conflicting with this trip
    if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
      for (const conflictTrip of trip.conflictingTrips) {
        // Load the conflict trip with its linkedTrips relation
        const fullConflictTrip = await transactionalEntityManager.findOne(
          Trip,
          {
            where: { id: conflictTrip.id },
            relations: ['linkedTrips']
          }
        );

        if (fullConflictTrip && fullConflictTrip.linkedTrips) {
          // Remove this trip from the conflict trip's linkedTrips
          fullConflictTrip.linkedTrips = fullConflictTrip.linkedTrips.filter(
            linkedTrip => linkedTrip.id !== trip.id
          );
          
          await transactionalEntityManager.save(fullConflictTrip);

          /*
          // Restore vehicle seats for the conflict trip if it's still active
          if (fullConflictTrip.vehicle && 
              [TripStatus.PENDING, TripStatus.APPROVED].includes(fullConflictTrip.status)) {
            const conflictVehicle = await transactionalEntityManager.findOne(
              Vehicle,
              { where: { id: fullConflictTrip.vehicle.id } }
            );

            if (conflictVehicle) {
              conflictVehicle.seatingAvailability += trip.passengerCount;
              
              // Ensure seating availability doesn't exceed max capacity
              if (conflictVehicle.seatingAvailability > conflictVehicle.seatingCapacity) {
                conflictVehicle.seatingAvailability = conflictVehicle.seatingCapacity;
              }

              await transactionalEntityManager.save(conflictVehicle);
            }
          }
          */
        }
      }

      // Clear this trip's conflictingTrips
      trip.conflictingTrips = [];
    }
  }

  // Additional method to get cancelable trips for a user
  async getCancelableTrips(userId: number) {
    const trips = await this.tripRepo.find({
      where: {
        requester: { id: userId },
        status: In([TripStatus.PENDING, TripStatus.DRAFT])
      },
      relations: [
        'vehicle',
        'conflictingTrips',
        'approval'
      ],
      order: { startDate: 'ASC', startTime: 'ASC' }
    });

    // Filter trips that have PENDING approval or are DRAFT
    const cancelableTrips = trips.filter(trip => 
      trip.status === TripStatus.DRAFT || 
      (trip.approval && trip.approval.overallStatus === StatusApproval.PENDING)
    );

    return {
      success: true,
      data: {
        trips: cancelableTrips.map(trip => ({
          id: trip.id,
          startDate: trip.startDate,
          startTime: trip.startTime,
          status: trip.status,
          vehicle: trip.vehicle ? {
            id: trip.vehicle.id,
            regNo: trip.vehicle.regNo,
            model: trip.vehicle.model
          } : null,
          hasConflicts: trip.conflictingTrips && trip.conflictingTrips.length > 0,
          conflictCount: trip.conflictingTrips ? trip.conflictingTrips.length : 0,
          purpose: trip.purpose
        })),
        count: cancelableTrips.length
      },
      statusCode: 200
    };
  }

  async getUserTrips(user: any, requestDto: TripListRequestDto) {

    // Create base query builder
    const queryBuilder = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.requester', 'requester')
      .leftJoinAndSelect('trip.conflictingTrips', 'conflictingTrips')
      .leftJoinAndSelect('trip.linkedTrips', 'linkedTrips')
      .leftJoinAndSelect('trip.selectedGroupUsers', 'selectedGroupUsers');

    if(user.role != 'sysadmin' 
      //&& user.role != 'supervisor'
    ) {
      queryBuilder.andWhere('trip.requester.id = :id', { id: user.userId });
    }


    // Apply time filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1); // Next day

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (requestDto.timeFilter) {
      case 'today':
        //queryBuilder.andWhere('trip.createdAt = :date', { date: this.formatDateForDB(startOfToday.toISOString()) });
        queryBuilder.andWhere('DATE(trip.startDate) = DATE(:today)', { 
          today: this.formatDateForDB(now.toISOString()) 
        });
        break;
      case 'week':
        queryBuilder.andWhere('trip.startDate >= :startDate', { startDate: this.formatDateForDB(startOfWeek.toISOString()) });
        break;
      case 'month':
        queryBuilder.andWhere('trip.startDate >= :startDate', { startDate: this.formatDateForDB(startOfMonth.toISOString()) });
        break;
      case 'all':
      default:
        // No date filter
        break;
    }

    // Apply status filter if provided
    if (requestDto.statusFilter) {
      queryBuilder.andWhere('trip.status = :status', { status: requestDto.statusFilter });
    }

    // Calculate pagination
    const skip = (requestDto.page - 1) * requestDto.limit;
    
    // Get total count
    const total = await queryBuilder.getCount();
    
    // Get paginated results
    const trips = await queryBuilder
      .orderBy('trip.startDate', 'DESC')
      .addOrderBy('trip.startTime', 'DESC')
      .skip(skip)
      .take(requestDto.limit)
      .getMany();

    // Transform trips to TripCardDto format
    const tripCards = await Promise.all(
      trips.map(async (trip) => {
        const tripType = await this.determineTripType(trip, user.userId);
        

        let instanceCount = 0;
      let instanceIds: number[] | null = null;

      // If this is a master scheduled trip (not an instance itself), fetch its instances
      if (trip.isScheduled && !trip.isInstance) {
        // Fetch all instances for this master trip
        const instances = await this.tripRepo.find({
          where: {
            masterTripId: trip.id,
            isInstance: true
          },
          select: ['id'] // Only need IDs
        });
        
        instanceCount = instances.length;
        instanceIds = instances.map(instance => instance.id);
      } 
      // If this is an instance trip, we might want to find its master and other instances
      else if (trip.isInstance && trip.masterTripId) {
        // Get the master trip and all its instances
        const masterTripId = trip.masterTripId;
        
        // Get all instances including this one
        const allInstances = await this.tripRepo.find({
          where: {
            masterTripId: masterTripId,
            isInstance: true
          },
          select: ['id']
        });
        
        instanceCount = allInstances.length;
        instanceIds = allInstances.map(instance => instance.id);
        
        // Also get the master trip ID for reference
        const masterTrip = await this.tripRepo.findOne({
          where: { id: masterTripId },
          select: ['id', 'isScheduled']
        });
      }

      
        return {
          id: trip.id,
          vehicleModel: trip.vehicle?.model || 'Unknown',
          vehicleRegNo: trip.vehicle?.regNo || 'Unknown',
          status: trip.status,
          date: this.formatDateForDB(trip.startDate.toString()),
          time: trip.startTime.substring(0, 5), // Format to HH:MM
          tripType,
          driverName: trip.vehicle?.assignedDriverPrimary?.displayname,
          startLocation: trip.location?.startAddress,
          endLocation: trip.location?.endAddress,

          // Scheduled trip fields from entity
        isScheduled: trip.isScheduled ?? false,
        isInstance: trip.isInstance ?? false,
        masterTripId: trip.masterTripId,
        instanceDate: trip.instanceDate,
        
        // Calculated instance data
        instanceCount: instanceCount,
        instanceIds: instanceIds,
        
        // Other schedule fields
        repetition: trip.repetition,
        validTillDate: trip.validTillDate,
        includeWeekends: trip.includeWeekends ?? false,
        repeatAfterDays: trip.repeatAfterDays
        };
      })
    );

    const hasMore = skip + trips.length < total;

    return {
      success: true,
      data: {
        trips: tripCards,
        total,
        page: requestDto.page,
        limit: requestDto.limit,
        hasMore,
      },
      statusCode: 200,
    };
  }

  async getSupervisorTrips(user: any, requestDto: TripListRequestDto) {

    // Create base query builder
    const queryBuilder = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.requester', 'requester')
      .leftJoinAndSelect('trip.conflictingTrips', 'conflictingTrips')
      .leftJoinAndSelect('trip.linkedTrips', 'linkedTrips')
      .leftJoinAndSelect('trip.selectedGroupUsers', 'selectedGroupUsers');

    /*
    if(user.role != 'sysadmin' && user.role != 'supervisor'
    ) {
      queryBuilder.andWhere('trip.requester.id = :id', { id: user.userId });
    }
    */

    // Apply time filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1); // Next day

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (requestDto.timeFilter) {
      case 'today':
        //queryBuilder.andWhere('trip.createdAt = :date', { date: this.formatDateForDB(startOfToday.toISOString()) });
        queryBuilder.andWhere('DATE(trip.createdAt) = DATE(:today)', { 
          today: this.formatDateForDB(now.toISOString()) 
        });
        break;
      case 'week':
        queryBuilder.andWhere('trip.createdAt >= :startDate', { startDate: this.formatDateForDB(startOfWeek.toISOString()) });
        break;
      case 'month':
        queryBuilder.andWhere('trip.createdAt >= :startDate', { startDate: this.formatDateForDB(startOfMonth.toISOString()) });
        break;
      case 'all':
      default:
        // No date filter
        break;
    }

    // Apply status filter if provided
    if (requestDto.statusFilter) {
      queryBuilder.andWhere('trip.status = :status', { status: requestDto.statusFilter });
    }

    // Calculate pagination
    const skip = (requestDto.page - 1) * requestDto.limit;
    
    // Get total count
    const total = await queryBuilder.getCount();
    
    // Get paginated results
    const trips = await queryBuilder
      .orderBy('trip.startDate', 'DESC')
      .addOrderBy('trip.startTime', 'DESC')
      .skip(skip)
      .take(requestDto.limit)
      .getMany();

    // Transform trips to TripCardDto format
    const tripCards = await Promise.all(
      trips.map(async (trip) => {
        const tripType = await this.determineTripType(trip, user.userId);
        
        return {
          id: trip.id,
          vehicleModel: trip.vehicle?.model || 'Unknown',
          vehicleRegNo: trip.vehicle?.regNo || 'Unknown',
          status: trip.status,
          date: this.formatDateForDB(trip.startDate.toString()),
          time: trip.startTime.substring(0, 5), // Format to HH:MM
          tripType,
          driverName: trip.vehicle?.assignedDriverPrimary?.displayname,
          startLocation: trip.location?.startAddress,
          endLocation: trip.location?.endAddress,
        };
      })
    );

    const hasMore = skip + trips.length < total;

    return {
      success: true,
      data: {
        trips: tripCards,
        total,
        page: requestDto.page,
        limit: requestDto.limit,
        hasMore,
      },
      statusCode: 200,
    };
  }

  private async determineTripType(trip: Trip, userId: number): Promise<string> {
    // R - Created and going
    if (trip.requester.id === userId) {
      if (trip.passengerType === PassengerType.OWN) {
        return 'R'; // Created and going
      } else if (trip.passengerType === PassengerType.OTHER_INDIVIDUAL || 
                trip.passengerType === PassengerType.GROUP) {
        // Check if user is included in the trip
        const isUserIncluded = await this.isUserIncludedInTrip(trip, userId);
        return isUserIncluded ? 'R' : 'RO'; // RO - Created for others
      }
    }
    
    // P - Passenger in trip (user is in selectedGroupUsers)
    if (trip.selectedGroupUsers?.some(user => user.id === userId)) {
      return 'P';
    }
    
    // J - Conflicted trip joined
    if (trip.linkedTrips?.some(linkedTrip => linkedTrip.requester?.id === userId) ||
        trip.conflictingTrips?.some(conflictTrip => conflictTrip.requester?.id === userId)) {
      return 'J';
    }
    
    // Default to R
    return 'R';
  }

  private async isUserIncludedInTrip(trip: Trip, userId: number): Promise<boolean> {
    // Check if user is the selected individual
    if (trip.selectedIndividual?.id === userId) {
      return true;
    }
    
    // Check if user is in selected group users
    if (trip.selectedGroupUsers?.some(user => user.id === userId)) {
      return true;
    }
    
    // Check if user is in selected others
    if (trip.selectedOthers?.some(other => parseInt(other.id) === userId)) {
      return true;
    }
    
    // Check if includeMeInGroup is true for the requester
    if (trip.includeMeInGroup && trip.requester.id === userId) {
      return true;
    }
    
    return false;
  }

  async getTripApprovalStatus(tripId: number) {
    const approval = await this.approvalRepo.findOne({
      where: { trip: { id: tripId } },
      relations: [
        'approver1',
        'approver2',
        'safetyApprover',
        'trip',
        'trip.requester'
      ]
    });

    if (!approval) {
      throw new NotFoundException(this.responseService.error('Approval not found for trip', 404));
    }

    return {
      success: true,
      data: {
        approval: {
          id: approval.id,
          approver1: approval.approver1 ? {
            id: approval.approver1.id,
            name: approval.approver1.displayname,
            status: approval.approver1Status,
            approvedAt: approval.approver1ApprovedAt,
            comments: approval.approver1Comments
          } : null,
          approver2: approval.approver2 ? {
            id: approval.approver2.id,
            name: approval.approver2.displayname,
            status: approval.approver2Status,
            approvedAt: approval.approver2ApprovedAt,
            comments: approval.approver2Comments
          } : null,
          safetyApprover: approval.safetyApprover ? {
            id: approval.safetyApprover.id,
            name: approval.safetyApprover.displayname,
            status: approval.safetyApproverStatus,
            approvedAt: approval.safetyApproverApprovedAt,
            comments: approval.safetyApproverComments
          } : null,
          overallStatus: approval.overallStatus,
          currentStep: approval.currentStep,
          requireApprover1: approval.requireApprover1,
          requireApprover2: approval.requireApprover2,
          requireSafetyApprover: approval.requireSafetyApprover,
          comments: approval.comments,
          rejectionReason: approval.rejectionReason,
          createdAt: approval.createdAt,
          updatedAt: approval.updatedAt
        }
      },
      statusCode: 200
    };
  }

  async updateApprovalStatus(
    tripId: number, 
    userId: number, 
    approverType: ApproverType, 
    status: StatusApproval,
    comments?: string
  ) {
    const approval = await this.approvalRepo.findOne({
      where: { trip: { id: tripId } },
      relations: ['trip', 'approver1', 'approver2', 'safetyApprover']
    });

    if (!approval) {
      throw new NotFoundException(this.responseService.error('Approval not found', 404));
    }

    // Verify user is authorized to approve
    let isAuthorized = false;
    let approverUser: User | undefined;

    switch (approverType) {
      case ApproverType.HOD:
        isAuthorized = approval.approver1?.id === userId;
        approverUser = approval.approver1;
        break;
      case ApproverType.SECONDARY:
        isAuthorized = approval.approver2?.id === userId;
        approverUser = approval.approver2;
        break;
      case ApproverType.SAFETY:
        isAuthorized = approval.safetyApprover?.id === userId;
        approverUser = approval.safetyApprover;
        break;
    }

    if (!isAuthorized || !approverUser) {
      throw new ForbiddenException(this.responseService.error('You are not authorized to approve this trip', 403));
    }

    // Update approval status
    const now = new Date();
    
    switch (approverType) {
      case ApproverType.HOD:
        approval.approver1Status = status;
        approval.approver1ApprovedAt = status === StatusApproval.APPROVED ? now : undefined;
        approval.approver1Comments = comments;
        break;
      case ApproverType.SECONDARY:
        approval.approver2Status = status;
        approval.approver2ApprovedAt = status === StatusApproval.APPROVED ? now : undefined;
        approval.approver2Comments = comments;
        break;
      case ApproverType.SAFETY:
        approval.safetyApproverStatus = status;
        approval.safetyApproverApprovedAt = status === StatusApproval.APPROVED ? now : undefined;
        approval.safetyApproverComments = comments;
        break;
    }

    // Update overall status
    approval.updateOverallStatus();

    // Move to next step if approved
    if (status === StatusApproval.APPROVED && !approval.hasAnyRejection()) {
      approval.moveToNextStep();
    }

    // If rejected, set overall status to rejected
    if (status === StatusApproval.REJECTED) {
      approval.overallStatus = StatusApproval.REJECTED;
      approval.rejectionReason = comments || 'Rejected by approver';
    }

    // Update trip status if fully approved or rejected
    if (approval.overallStatus === StatusApproval.APPROVED) {
      approval.trip.status = TripStatus.APPROVED;
    } else if (approval.overallStatus === StatusApproval.REJECTED) {
      approval.trip.status = TripStatus.REJECTED;
    }

    // Save approval and trip
    await this.approvalRepo.save(approval);
    await this.tripRepo.save(approval.trip);

    // TODO publish event

    return {
      success: true,
      message: `Approval ${status} successfully`,
      data: {
        approvalId: approval.id,
        overallStatus: approval.overallStatus,
        currentStep: approval.currentStep
      },
      statusCode: 200
    };
  }

  async getPendingApprovalsForUser(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    const approvals = await this.approvalRepo.find({
      where: [
        { approver1: { id: userId }, approver1Status: StatusApproval.PENDING },
        { approver2: { id: userId }, approver2Status: StatusApproval.PENDING },
        { safetyApprover: { id: userId }, safetyApproverStatus: StatusApproval.PENDING }
      ],
      relations: [
        'trip',
        'trip.requester',
        'trip.location',
        'trip.vehicle',
        'approver1',
        'approver2',
        'safetyApprover'
      ],
      order: { createdAt: 'DESC' }
    });

    // Filter to only include approvals where user is the current step approver
    const pendingApprovals = approvals.filter(approval => {
      if (approval.currentStep === ApproverType.HOD && approval.approver1?.id === userId) {
        return true;
      }
      if (approval.currentStep === ApproverType.SECONDARY && approval.approver2?.id === userId) {
        return true;
      }
      if (approval.currentStep === ApproverType.SAFETY && approval.safetyApprover?.id === userId) {
        return true;
      }
      return false;
    });

    return {
      success: true,
      data: {
        approvals: pendingApprovals.map(approval => ({
          id: approval.id,
          tripId: approval.trip.id,
          tripPurpose: approval.trip.purpose,
          requesterName: approval.trip.requester.displayname,
          startDate: approval.trip.startDate,
          startTime: approval.trip.startTime,
          startLocation: approval.trip.location?.startAddress,
          endLocation: approval.trip.location?.endAddress,
          vehicle: approval.trip.vehicle ? {
            model: approval.trip.vehicle.model,
            regNo: approval.trip.vehicle.regNo
          } : null,
          currentStep: approval.currentStep,
          overallStatus: approval.overallStatus,
          createdAt: approval.createdAt
        })),
        count: pendingApprovals.length
      },
      statusCode: 200
    };
  }

  /*
  async getPendingApprovalTrips(userId: number, filterDto: any) {
    const user = await this.userRepo.findOne({ 
      where: { id: userId }
    });
    
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Get pagination parameters
    const page = parseInt(filterDto.page) || 1;
    const limit = parseInt(filterDto.limit) || 5;
    const skip = (page - 1) * limit;
    const status = filterDto.status || 'pending';

    // Check if user is SYSADMIN
    const isSysAdmin = user.role === UserRole.SYSADMIN;

    // Create query builder - SYSADMIN sees ALL approvals, not just where they are approvers
    const queryBuilder = this.approvalRepo
      .createQueryBuilder('approval')
      .leftJoinAndSelect('approval.trip', 'trip')
      .leftJoinAndSelect('trip.requester', 'requester')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('approval.approver1', 'approver1')
      .leftJoinAndSelect('approval.approver2', 'approver2')
      .leftJoinAndSelect('approval.safetyApprover', 'safetyApprover');

    // For SYSADMIN: No approver restriction, see ALL approvals
    // For regular users: Only see approvals where they are approver
    if (!isSysAdmin) {
      queryBuilder.where(new Brackets(qb => {
        qb.where('approval.approver1 = :userId', { userId })
          .orWhere('approval.approver2 = :userId', { userId })
          .orWhere('approval.safetyApprover = :userId', { userId });
      }));
    }

    // Apply status filter based on parameter
    switch (status) {
      case 'pending':
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.PENDING });
        break;
      case 'approved':
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.APPROVED });
        break;
      case 'rejected':
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.REJECTED });
        break;
      case 'all':
        // No status filter for 'all'
        break;
      default:
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.PENDING });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const approvals = await queryBuilder
      .orderBy('approval.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    //console.log("Total approvals found:", total);
    //console.log("Approvals:", approvals);

    // For regular users: Filter to only include approvals where user is the current step approver
    // For SYSADMIN: Show all approvals
    let filteredApprovals = approvals;
    
    if (!isSysAdmin) {
      filteredApprovals = approvals.filter(approval => {
        //if (approval.currentStep === ApproverType.HOD && approval.approver1?.id === userId) {
        if (approval.approver1?.id === userId) {
          return true;
        }
        //if (approval.currentStep === ApproverType.SECONDARY && approval.approver2?.id === userId) {
        if (approval.approver2?.id === userId) {
          return true;
        }
        //if (approval.currentStep === ApproverType.SAFETY && approval.safetyApprover?.id === userId) {
        if (approval.safetyApprover?.id === userId) {
          return true;
        }
        return false;
      });
    }

    // Map to the required format
    const trips = filteredApprovals.map(approval => {
      const trip = approval.trip;
      
      return {
        id: trip.id,
        requesterName: trip.requester?.displayname || 'Unknown',
        startLocation: trip.location?.startAddress || '',
        endLocation: trip.location?.endAddress || '',
        startDate: trip.startDate,
        startTime: trip.startTime,
        vehicleRegNo: trip.vehicle?.regNo || 'Unknown',
        //status: approval.overallStatus,
        status: trip.status,
        requestedAt: trip.createdAt,
        approvalStep: approval.currentStep.toLowerCase(),
        // For SYSADMIN, show approver details
        //...(isSysAdmin && {
          assignedApprover: this.getAssignedApproverInfo(approval),
          approver1Name: approval.approver1?.displayname,
          approver2Name: approval.approver2?.displayname,
          safetyApproverName: approval.safetyApprover?.displayname,
        //})
      };
    });

    //console.log("Final trips:", trips);

    return {
      success: true,
      message: isSysAdmin ? 'All approval requests retrieved successfully' : 'Pending approvals retrieved successfully',
      data: {
        trips: trips,
        total: total,
        page: page,
        limit: limit,
        hasMore: skip + filteredApprovals.length < total,
      },
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }
  */

  async getPendingApprovalTrips(userId: number, filterDto: any) {
    const user = await this.userRepo.findOne({ 
      where: { id: userId }
    });
    
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Get pagination parameters
    const page = parseInt(filterDto.page) || 1;
    const limit = parseInt(filterDto.limit) || 5;
    const skip = (page - 1) * limit;
    const status = filterDto.status || 'pending';

    // Check if user is SYSADMIN
    const isSysAdmin = user.role === UserRole.SYSADMIN;

    // Create query builder - SYSADMIN sees ALL approvals, not just where they are approvers
    const queryBuilder = this.approvalRepo
      .createQueryBuilder('approval')
      .leftJoinAndSelect('approval.trip', 'trip')
      .leftJoinAndSelect('trip.requester', 'requester')
      .leftJoinAndSelect('trip.location', 'location')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('approval.approver1', 'approver1')
      .leftJoinAndSelect('approval.approver2', 'approver2')
      .leftJoinAndSelect('approval.safetyApprover', 'safetyApprover');

    // For SYSADMIN: No approver restriction, see ALL approvals
    // For regular users: Only see approvals where they are approver
    if (!isSysAdmin) {
      queryBuilder.where(new Brackets(qb => {
        qb.where('approval.approver1 = :userId', { userId })
          .orWhere('approval.approver2 = :userId', { userId })
          .orWhere('approval.safetyApprover = :userId', { userId });
      }));
    }

    // Apply status filter based on parameter
    switch (status) {
      case 'pending':
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.PENDING });
        break;
      case 'approved':
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.APPROVED });
        break;
      case 'rejected':
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.REJECTED });
        break;
      case 'all':
        // No status filter for 'all'
        break;
      default:
        queryBuilder.andWhere('approval.overallStatus = :status', { status: StatusApproval.PENDING });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const approvals = await queryBuilder
      .orderBy('approval.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    // For regular users: Filter to only include approvals where user is the current step approver
    // For SYSADMIN: Show all approvals
    let filteredApprovals = approvals;
    
    if (!isSysAdmin) {
      filteredApprovals = approvals.filter(approval => {
        if (approval.approver1?.id === userId) {
          return true;
        }
        if (approval.approver2?.id === userId) {
          return true;
        }
        if (approval.safetyApprover?.id === userId) {
          return true;
        }
        return false;
      });
    }

    // Create an array to hold trip data with instance information
    const tripsWithInstances = [];

    // Process each approval to get instance data
    for (const approval of filteredApprovals) {
      const trip = approval.trip;
      
      let instanceCount = 0;
      let instanceIds: number[] | null = null;

      // If this is a master scheduled trip (not an instance itself), fetch its instances
      if (trip.isScheduled && !trip.isInstance) {
        // Fetch all instances for this master trip
        const instances = await this.tripRepo.find({
          where: {
            masterTripId: trip.id,
            isInstance: true
          },
          select: ['id'] // Only need IDs
        });
        
        instanceCount = instances.length;
        instanceIds = instances.map(instance => instance.id);
      } 
      // If this is an instance trip, we might want to find its master and other instances
      else if (trip.isInstance && trip.masterTripId) {
        // Get the master trip and all its instances
        const masterTripId = trip.masterTripId;
        
        // Get all instances including this one
        const allInstances = await this.tripRepo.find({
          where: {
            masterTripId: masterTripId,
            isInstance: true
          },
          select: ['id']
        });
        
        instanceCount = allInstances.length;
        instanceIds = allInstances.map(instance => instance.id);
        
        // Also get the master trip ID for reference
        const masterTrip = await this.tripRepo.findOne({
          where: { id: masterTripId },
          select: ['id', 'isScheduled']
        });
      }

      tripsWithInstances.push({
        id: trip.id,
        requesterName: trip.requester?.displayname || 'Unknown',
        startLocation: trip.location?.startAddress || '',
        endLocation: trip.location?.endAddress || '',
        startDate: trip.startDate,
        startTime: trip.startTime,
        vehicleRegNo: trip.vehicle?.regNo || 'Unknown',
        status: trip.status,
        requestedAt: trip.createdAt,
        approvalStep: approval.currentStep.toLowerCase(),
        assignedApprover: this.getAssignedApproverInfo(approval),
        approver1Name: approval.approver1?.displayname,
        approver2Name: approval.approver2?.displayname,
        safetyApproverName: approval.safetyApprover?.displayname,
        
        // Scheduled trip fields from entity
        isScheduled: trip.isScheduled ?? false,
        isInstance: trip.isInstance ?? false,
        masterTripId: trip.masterTripId,
        instanceDate: trip.instanceDate,
        
        // Calculated instance data
        instanceCount: instanceCount,
        instanceIds: instanceIds,
        
        // Other schedule fields
        repetition: trip.repetition,
        validTillDate: trip.validTillDate,
        includeWeekends: trip.includeWeekends ?? false,
        repeatAfterDays: trip.repeatAfterDays
      });
    }

    return {
      success: true,
      message: isSysAdmin ? 'All approval requests retrieved successfully' : 'Pending approvals retrieved successfully',
      data: {
        trips: tripsWithInstances,
        total: total,
        page: page,
        limit: limit,
        hasMore: skip + filteredApprovals.length < total,
      },
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  private getAssignedApproverInfo(approval: Approval): string {
    if (!approval.currentStep) return 'No approver assigned';
    
    switch (approval.currentStep) {
      case ApproverType.HOD:
        return approval.approver1?.displayname || 'HOD (Unassigned)';
      case ApproverType.SECONDARY:
        return approval.approver2?.displayname || 'Secondary (Unassigned)';
      case ApproverType.SAFETY:
        return approval.safetyApprover?.displayname || 'Safety (Unassigned)';
      default:
        return 'Unknown';
    }
  }


  /*
  async getTripById(id: number) {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: [
        'requester',
        'requester.department',
        'vehicle',
        'vehicle.vehicleType',
        'vehicle.assignedDriverPrimary',
        'vehicle.assignedDriverSecondary',
        'location',
        'approval',
        'approval.approver1',
        'approval.approver1.department',
        'approval.approver2',
        'approval.approver2.department',
        'approval.safetyApprover',
        'approval.safetyApprover.department',
        'selectedGroupUsers',
        'selectedIndividual',
        'conflictingTrips',
        'conflictingTrips.requester',
        'conflictingTrips.location',
        'conflictingTrips.vehicle',
        'linkedTrips',
        'linkedTrips.requester',
        'linkedTrips.location',
        'linkedTrips.vehicle'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    // Build the response data structure
    const responseData = {
      // Basic trip info (no duplicates)
      id: trip.id,
      status: trip.status,
      purpose: trip.purpose,
      specialRemarks: trip.specialRemarks,
      startDate: trip.startDate,
      startTime: trip.startTime,
      repetition: trip.repetition,
      passengerType: trip.passengerType,
      passengerCount: trip.passengerCount,
      includeMeInGroup: trip.includeMeInGroup,
      cost: trip.cost,
      mileage: trip.mileage,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      
      // Requester info (simplified)
      requester: {
        id: trip.requester?.id,
        name: trip.requester?.displayname,
        email: trip.requester?.email,
        phone: trip.requester?.phone,
        department: trip.requester?.department?.name
      },
      
      // Vehicle info (without driver details in main object)
      vehicle: trip.vehicle ? {
        id: trip.vehicle.id,
        model: trip.vehicle.model,
        regNo: trip.vehicle.regNo,
        vehicleType: trip.vehicle.vehicleType?.vehicleType,
        seatingCapacity: trip.vehicle.seatingCapacity,
        seatingAvailability: trip.vehicle.seatingAvailability
      } : null,
      
      // Location info (basic)
      location: trip.location ? {
        startAddress: trip.location.startAddress,
        endAddress: trip.location.endAddress,
        totalStops: trip.location.totalStops
      } : null,
      
      // Detailed sections
      details: {
        // Passenger details
        passengers: await this.getPassengerDetails(trip),
        
        // Approval details
        approval: await this.getApprovalDetails(trip),
        
        // Driver details (separate from vehicle)
        drivers: await this.getDriverDetails(trip),
        
        // Route details
        route: await this.getRouteDetails(trip),
        
        // Vehicle details (complete)
        vehicleDetails: await this.getVehicleDetails(trip),
        
        // Conflict details
        conflicts: await this.getConflictDetails(trip)
      }
    };

    return {
      success: true,
      message: 'Trip retrieved successfully',
      data: responseData,
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }
  */

  async getTripById(id: number) {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: [
        'requester',
        'requester.department',
        'vehicle',
        'vehicle.vehicleType',
        'vehicle.assignedDriverPrimary',
        'vehicle.assignedDriverSecondary',
        'location',
        'approval',
        'approval.approver1',
        'approval.approver1.department',
        'approval.approver2',
        'approval.approver2.department',
        'approval.safetyApprover',
        'approval.safetyApprover.department',
        'selectedGroupUsers',
        'selectedIndividual',
        'conflictingTrips',
        'conflictingTrips.requester',
        'conflictingTrips.location',
        'conflictingTrips.vehicle',
        'linkedTrips',
        'linkedTrips.requester',
        'linkedTrips.location',
        'linkedTrips.vehicle',
        'odometerLog'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    // Get instance data for scheduled trips
    let instanceCount = 0;
    let instanceIds: { id: number, startDate: Date }[] = [];
    
    if (trip.isScheduled) {
      if (!trip.isInstance) {
        // This is a master trip, get its instances
        const instances = await this.tripRepo.find({
          where: {
            masterTripId: trip.id,
            isInstance: true
          },
          select: ['id', 'startDate']
        });
        instanceCount = instances.length;
        instanceIds = instances.map(inst => (
          {
            id: inst.id,
            startDate: inst.startDate
          }
        ));
      } else if (trip.masterTripId) {
        // This is an instance, get all instances from the same master
        const allInstances = await this.tripRepo.find({
          where: {
            masterTripId: trip.masterTripId,
            isInstance: true
          },
          select: ['id', 'startDate']
        });
        instanceCount = allInstances.length;
        instanceIds = allInstances.map(inst => (
          {
            id: inst.id,
            startDate: inst.startDate
          }
        ));
      }
    }

    // Build the response data structure
    const responseData = {
      // Basic trip info (no duplicates)
      id: trip.id,
      status: trip.status,
      purpose: trip.purpose,
      specialRemarks: trip.specialRemarks,
      startDate: trip.startDate,
      startTime: trip.startTime,
      repetition: trip.repetition,
      passengerType: trip.passengerType,
      passengerCount: trip.passengerCount,
      includeMeInGroup: trip.includeMeInGroup,
      cost: trip.cost,
      mileage: trip.mileage,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      
      // Schedule details
      schedule: {
        isScheduled: trip.isScheduled,
        isInstance: trip.isInstance,
        masterTripId: trip.masterTripId,
        instanceDate: trip.instanceDate,
        validTillDate: trip.validTillDate,
        includeWeekends: trip.includeWeekends,
        repeatAfterDays: trip.repeatAfterDays,
        instanceCount: instanceCount,
        instanceIds: instanceIds
      },
      
      // Requester info (simplified)
      requester: {
        id: trip.requester?.id,
        name: trip.requester?.displayname,
        email: trip.requester?.email,
        phone: trip.requester?.phone,
        department: trip.requester?.department?.name
      },
      
      // Vehicle info (without driver details in main object)
      vehicle: trip.vehicle ? {
        id: trip.vehicle.id,
        model: trip.vehicle.model,
        regNo: trip.vehicle.regNo,
        vehicleType: trip.vehicle.vehicleType?.vehicleType,
        costPerKm: trip.vehicle.vehicleType?.costPerKm,
        seatingCapacity: trip.vehicle.seatingCapacity,
        seatingAvailability: trip.vehicle.seatingAvailability
      } : null,
      
      // Location info (basic)
      location: trip.location ? {
        startAddress: trip.location.startAddress,
        endAddress: trip.location.endAddress,
        totalStops: trip.location.totalStops
      } : null,
      
      // Detailed sections
      details: {
        // Passenger details
        passengers: await this.getPassengerDetails(trip),
        
        // Approval details
        approval: await this.getApprovalDetails(trip),
        
        // Driver details (separate from vehicle)
        drivers: await this.getDriverDetails(trip),
        
        // Route details
        route: await this.getRouteDetails(trip),
        
        // Vehicle details (complete)
        vehicleDetails: await this.getVehicleDetails(trip),
        
        // Conflict details
        conflicts: await this.getConflictDetails(trip)
      }
    };

    return {
      success: true,
      message: 'Trip retrieved successfully',
      data: responseData,
      timestamp: new Date().toISOString(),
      statusCode: 200
    };
  }

  async approveTrip(tripId: number, userId: number, comment?: string) {
    // Find trip with approval details
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: [
        'approval', 
        'approval.approver1', 
        'approval.approver2', 
        'approval.safetyApprover', 
        'requester',
        'vehicle'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    if (!trip.approval) {
      throw new BadRequestException(this.responseService.error('No approval process found for this trip', 400));
    }

    // Get user making the request
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    const approval = trip.approval;
    const isSysAdmin = user.role === UserRole.SYSADMIN;

    // Check if already approved
    if (approval.overallStatus === StatusApproval.APPROVED) {
      throw new BadRequestException(this.responseService.error('Trip is already approved', 400));
    }

    // Check if rejected
    if (approval.overallStatus === StatusApproval.REJECTED) {
      throw new BadRequestException(this.responseService.error('Trip is already rejected', 400));
    }

    // Check authorization
    let isAuthorized = false;
    let approverType: ApproverType | null = null;

    if (isSysAdmin) {
      // SYSADMIN can approve any trip regardless of current step
      isAuthorized = true;
      //approverType = this.determineCurrentApproverType(approval);
    } else {
      // Regular users can only approve on their assigned step
      //if (approval.currentStep === ApproverType.HOD && approval.approver1?.id === userId) {
      if (approval.approver1?.id === userId) {
        isAuthorized = true;
        approverType = ApproverType.HOD;
      //} else if (approval.currentStep === ApproverType.SECONDARY && approval.approver2?.id === userId) {
      } else if (approval.approver2?.id === userId) {
        isAuthorized = true;
        approverType = ApproverType.SECONDARY;
      //} else if (approval.currentStep === ApproverType.SAFETY && approval.safetyApprover?.id === userId) {
      } else if (approval.safetyApprover?.id === userId) {
        isAuthorized = true;
        approverType = ApproverType.SAFETY;
      }
    }
    // todo change

    if (!isAuthorized) {
      throw new ForbiddenException(
        this.responseService.error('You are not authorized to approve this trip', 403)
      );
    }

    // Process approval
    const now = new Date();
    
    // Update approval based on approver type
    if (approverType === ApproverType.HOD) {
      approval.approver1Status = StatusApproval.APPROVED;
      approval.approver1ApprovedAt = now;
      approval.approver1Comments = comment;
    } else if (approverType === ApproverType.SECONDARY && approval.approver2) {
      approval.approver2Status = StatusApproval.APPROVED;
      approval.approver2ApprovedAt = now;
      approval.approver2Comments = comment;
    } else if (approverType === ApproverType.SAFETY && approval.safetyApprover) {
      approval.safetyApproverStatus = StatusApproval.APPROVED;
      approval.safetyApproverApprovedAt = now;
      approval.safetyApproverComments = comment;
    }
    else if (isSysAdmin) {
      approval.approver1Status = StatusApproval.APPROVED;
      approval.approver1ApprovedAt = now;
      approval.approver1Comments = `Approved by SYSADMIN: ${comment || 'No comment'}`;

      approval.approver2Status = StatusApproval.APPROVED;
      approval.approver2ApprovedAt = now;
      approval.approver2Comments = `Approved by SYSADMIN: ${comment || 'No comment'}`;

      approval.safetyApproverStatus = StatusApproval.APPROVED;
      approval.safetyApproverApprovedAt = now;
      approval.safetyApproverComments = `Approved by SYSADMIN: ${comment || 'No comment'}`;
    }

    // Update overall status and move to next step
    approval.updateOverallStatus();
    
    // If no rejection, move to next step
    if (!approval.hasAnyRejection()) {
      approval.moveToNextStep();
    }

    // If fully approved, update trip status
    if (approval.overallStatus.toString() === 'approved') {
      trip.status = TripStatus.APPROVED;
    }

    // Save changes
    await this.approvalRepo.save(approval);
    await this.tripRepo.save(trip);

            // TODO publish event


    return {
      success: true,
      message: `Trip ${approverType} approval submitted successfully`,
      data: {
        tripId: trip.id,
        approvalStatus: approval.overallStatus,
        currentStep: approval.currentStep,
        approvedBy: user.displayname,
        approvedAt: now,
        nextStep: approval.currentStep ? `Waiting for ${approval.currentStep} approval` : 'Fully approved'
      },
      timestamp: now.toISOString(),
      statusCode: 200
    };
  }

  async rejectTrip(tripId: number, userId: number, rejectionReason: string) {
    // Find trip with approval details
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: [
        'approval', 
        'approval.approver1', 
        'approval.approver2', 
        'approval.safetyApprover', 
        'requester',
        'vehicle'
      ]
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    if (!trip.approval) {
      throw new BadRequestException(this.responseService.error('No approval process found for this trip', 400));
    }

    // Get user making the request
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    const approval = trip.approval;
    const isSysAdmin = user.role === UserRole.SYSADMIN;

    // Check if already rejected
    if (approval.overallStatus === StatusApproval.REJECTED) {
      throw new BadRequestException(this.responseService.error('Trip is already rejected', 400));
    }

    // Check if already approved
    if (approval.overallStatus === StatusApproval.APPROVED) {
      throw new BadRequestException(this.responseService.error('Trip is already approved', 400));
    }

    // Check authorization
    let isAuthorized = false;
    let approverType: ApproverType | null = null;

    if (isSysAdmin) {
      // SYSADMIN can reject any trip regardless of current step
      isAuthorized = true;
      //approverType = this.determineCurrentApproverType(approval);
    } else {
      // Regular users can only reject on their assigned step
      if (approval.approver1?.id === userId) {
        isAuthorized = true;
        approverType = ApproverType.HOD;
      } else if (approval.approver2?.id === userId) {
        isAuthorized = true;
        approverType = ApproverType.SECONDARY;
      } else if (approval.safetyApprover?.id === userId) {
        isAuthorized = true;
        approverType = ApproverType.SAFETY;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException(
        this.responseService.error('You are not authorized to reject this trip', 403)
      );
    }

    // Process rejection
    const now = new Date();
    
    // Update rejection based on approver type
    if (approverType === ApproverType.HOD) {
      approval.approver1Status = StatusApproval.REJECTED;
      approval.approver1Comments = isSysAdmin ? `Rejected by SYSADMIN: ${rejectionReason}` : rejectionReason;
    } else if (approverType === ApproverType.SECONDARY && approval.approver2) {
      approval.approver2Status = StatusApproval.REJECTED;
      approval.approver2Comments = isSysAdmin ? `Rejected by SYSADMIN: ${rejectionReason}` : rejectionReason;
    } else if (approverType === ApproverType.SAFETY && approval.safetyApprover) {
      approval.safetyApproverStatus = StatusApproval.REJECTED;
      approval.safetyApproverComments = isSysAdmin ? `Rejected by SYSADMIN: ${rejectionReason}` : rejectionReason;
    } else if (isSysAdmin) {
      approval.approver1Status = StatusApproval.REJECTED;
      approval.approver1Comments = `Rejected by SYSADMIN: ${rejectionReason}`;
      approval.approver2Status = StatusApproval.REJECTED;
      approval.approver2Comments = `Rejected by SYSADMIN: ${rejectionReason}`;
      approval.safetyApproverStatus = StatusApproval.REJECTED;
      approval.safetyApproverComments = `Rejected by SYSADMIN: ${rejectionReason}`;
    }

    // Set overall status to REJECTED immediately
    approval.overallStatus = StatusApproval.REJECTED;
    approval.rejectionReason = rejectionReason;
    approval.currentStep = ApproverType.COMPLETED; // Mark as completed
    
    // Update trip status to REJECTED
    trip.status = TripStatus.REJECTED;

    // Save changes
    await this.approvalRepo.save(approval);
    await this.tripRepo.save(trip);

    /*
    // Restore vehicle seats if vehicle was assigned
    if (trip.vehicle) {
      await this.restoreVehicleSeatsForRejection(trip);
    }
    */
        // TODO publish event

    return {
      success: true,
      message: `Trip rejected successfully`,
      data: {
        tripId: trip.id,
        approvalStatus: approval.overallStatus,
        rejectedBy: user.displayname,
        rejectedAt: now,
        rejectionReason: rejectionReason
      },
      timestamp: now.toISOString(),
      statusCode: 200
    };
  }

  /*
  private async restoreVehicleSeatsForRejection(trip: Trip) {
    // Restore seats that were allocated for this rejected trip
    const vehicle = await this.vehicleRepo.findOne({ 
      where: { id: trip.vehicle.id } 
    });

    if (vehicle) {
      // Restore seats that were allocated for this trip
      vehicle.seatingAvailability += trip.passengerCount;
      
      // Ensure seating availability doesn't exceed max capacity
      const maxAvailable = vehicle.seatingCapacity - 1; // Assuming driver takes 1 seat
      if (vehicle.seatingAvailability > maxAvailable) {
        vehicle.seatingAvailability = maxAvailable;
      }
      
      await this.vehicleRepo.save(vehicle);

    }
  }
  */

  private async getPassengerDetails(trip: Trip) {
    const passengers = [];

    // Add requester
    if ( trip.includeMeInGroup || trip.requester && trip.passengerType == PassengerType.OWN) {
      passengers.push({
        id: trip.requester.id,
        name: trip.requester.displayname,
        email: trip.requester.email,
        phone: trip.requester.phone,
        department: trip.requester.department.name,
        type: 'requester'
      });
    }

    // Add selected individual
    if (trip.selectedIndividual) {
      passengers.push({
        id: trip.selectedIndividual.id,
        name: trip.selectedIndividual.displayname,
        email: trip.selectedIndividual.email,
        phone: trip.selectedIndividual.phone,
        department: trip.requester.department.name,
        type: 'individual'
      });
    }

    // Add selected group users
    if (trip.selectedGroupUsers && trip.selectedGroupUsers.length > 0) {
      trip.selectedGroupUsers.forEach(user => {
        passengers.push({
          id: user.id,
          name: user.displayname,
          email: user.email,
          phone: user.phone,
          department: trip.requester.department.name,
          type: 'group'
        });
      });
    }

    // Add selected others
    if (trip.selectedOthers && trip.selectedOthers.length > 0) {
      trip.selectedOthers.forEach(other => {
        passengers.push({
          id: other.id,
          name: other.displayName,
          contactNo: other.contactNo,
          type: 'guest'
        });
      });
    }

    return {
      total: trip.passengerCount,
      list: passengers,
      passengerType: trip.passengerType,
      includeMeInGroup: trip.includeMeInGroup
    };
  }

  private async getApprovalDetails(trip: Trip) {
    if (!trip.approval) {
      return {
        hasApproval: false,
        message: 'No approval process started'
      };
    }

    const approval = trip.approval;

    return {
      hasApproval: true,
      overallStatus: approval.overallStatus,
      currentStep: approval.currentStep,
      approvers: {
        hod: approval.approver1 ? {
          id: approval.approver1.id,
          name: approval.approver1.displayname,
          department: approval.approver1.department.name,
          status: approval.approver1Status,
          approvedAt: approval.approver1ApprovedAt,
          comments: approval.approver1Comments
        } : null,
        secondary: approval.approver2 ? {
          id: approval.approver2.id,
          name: approval.approver2.displayname,
          department: approval.approver2.department.name,
          status: approval.approver2Status,
          approvedAt: approval.approver2ApprovedAt,
          comments: approval.approver2Comments
        } : null,
        safety: approval.safetyApprover ? {
          id: approval.safetyApprover.id,
          name: approval.safetyApprover.displayname,
          department: approval.safetyApprover.department.name,
          status: approval.safetyApproverStatus,
          approvedAt: approval.safetyApproverApprovedAt,
          comments: approval.safetyApproverComments
        } : null
      },
      requirements: {
        requireApprover1: approval.requireApprover1,
        requireApprover2: approval.requireApprover2,
        requireSafetyApprover: approval.requireSafetyApprover
      },
      comments: approval.comments,
      rejectionReason: approval.rejectionReason,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt
    };
  }

  private async getDriverDetails(trip: Trip) {
    if (!trip.vehicle) {
      return {
        hasDrivers: false,
        message: 'No vehicle assigned'
      };
    }

    return {
      hasDrivers: true,
      primary: trip.vehicle.assignedDriverPrimary ? {
        id: trip.vehicle.assignedDriverPrimary.id,
        name: trip.vehicle.assignedDriverPrimary.displayname,
        phone: trip.vehicle.assignedDriverPrimary.phone,
        role: trip.vehicle.assignedDriverPrimary.role
      } : null,
      secondary: trip.vehicle.assignedDriverSecondary ? {
        id: trip.vehicle.assignedDriverSecondary.id,
        name: trip.vehicle.assignedDriverSecondary.displayname,
        phone: trip.vehicle.assignedDriverSecondary.phone,
        role: trip.vehicle.assignedDriverSecondary.role
      } : null
    };
  }

  private async getRouteDetails(trip: Trip) {
    if (!trip.location) {
      return {
        hasRoute: false,
        message: 'No route information available'
      };
    }

    let actualDistance = null;
    let actualDuration = null;
    if (trip.status == TripStatus.COMPLETED) {
      actualDistance = (trip.odometerLog?.endReading - trip.odometerLog?.startReading).toString();
      actualDuration = this.calculateDurationMinutes(trip.odometerLog.endRecordedAt, trip.odometerLog.startRecordedAt).toString();
    }

    return {
      hasRoute: true,
      coordinates: {
        start: {
          latitude: trip.location.startLatitude,
          longitude: trip.location.startLongitude,
          address: trip.location.startAddress
        },
        end: {
          latitude: trip.location.endLatitude,
          longitude: trip.location.endLongitude,
          address: trip.location.endAddress
        }
      },
      stops: {
        intermediate: trip.location.intermediateStops || [],
        total: trip.location.totalStops || 0
      },
      metrics: {
        distance: trip.location.distance,
        actualDistance: actualDistance,
        estimatedDuration: Math.round(trip.location.estimatedDuration),
        actualDuration: actualDuration,
        estimatedRestingMinutes: trip.location.estimatedRestingHours,
      },
      rawData: trip.location.locationData
    };
  }

  private calculateDurationMinutes(endTime: Date, startTime: Date): number {
    const durationMs = endTime.getTime() - startTime.getTime();
    return Math.round(durationMs / (1000 * 60)); // Convert ms to minutes
  }

  private async getVehicleDetails(trip: Trip) {
    if (!trip.vehicle) {
      return {
        hasVehicle: false,
        message: 'No vehicle assigned'
      };
    }

    return {
      id: trip.vehicle.id,
      specifications: {
        model: trip.vehicle.model,
        regNo: trip.vehicle.regNo,
        fuelType: trip.vehicle.fuelType,
        vehicleType: trip.vehicle.vehicleType?.vehicleType
      },
      capacity: {
        seating: trip.vehicle.seatingCapacity,
        available: trip.vehicle.seatingAvailability
      },
      status: {
        isActive: trip.vehicle.isActive,
        odometerLastReading: trip.vehicle.odometerLastReading
      },
      images: trip.vehicle.vehicleImage,
      //qrCode: trip.vehicle.qrCode
      createdAt: trip.vehicle.createdAt,
      updatedAt: trip.vehicle.updatedAt
    };
  }

  private async getConflictDetails(trip: Trip) {
    if (!trip.conflictingTrips || trip.conflictingTrips.length === 0) {
      return {
        hasConflicts: false,
        message: 'No conflicting trips'
      };
    }

    const conflicts = trip.conflictingTrips.map(conflict => ({
      id: conflict.id,
      /*
      purpose: conflict.purpose,
      schedule: {
        date: conflict.startDate,
        time: conflict.startTime
      },
      requester: {
        id: conflict.requester?.id,
        name: conflict.requester?.displayname
      },
      location: conflict.location ? {
        start: conflict.location.startAddress,
        end: conflict.location.endAddress
      } : null,
      vehicle: conflict.vehicle ? {
        model: conflict.vehicle.model,
        regNo: conflict.vehicle.regNo
      } : null
      */
    }));

    return {
      hasConflicts: true,
      count: conflicts.length,
      trips: conflicts,
      reason: 'Potential schedule overlap'
    };
  }

  async getTripsForMeterReading(filterDto: any): Promise<any> {
    // Get pagination parameters
    const page = parseInt(filterDto.page) || 1;
    const limit = parseInt(filterDto.limit) || 10;
    const skip = (page - 1) * limit;
    const timeFilter = filterDto.timeFilter || 'today';

    // Calculate date ranges based on time filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // First, get all approved trips that need reading in the time range
    const baseQueryBuilder = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.assignedDriverPrimary', 'assignedDriverPrimary')
      .leftJoinAndSelect('trip.odometerLog', 'odometerLog')
      .leftJoinAndSelect('odometerLog.startRecordedBy', 'startRecordedBy')
      .leftJoinAndSelect('odometerLog.endRecordedBy', 'endRecordedBy')
      .leftJoinAndSelect('trip.conflictingTrips', 'conflictingTrips')
      .leftJoinAndSelect('conflictingTrips.vehicle', 'conflictVehicle')
      .leftJoinAndSelect('conflictVehicle.assignedDriverPrimary', 'conflictDriver')
      .leftJoinAndSelect('conflictingTrips.odometerLog', 'conflictOdometerLog')
      .where('trip.status IN (:...statuses)', { 
        statuses: [TripStatus.APPROVED, TripStatus.READ, TripStatus.COMPLETED, TripStatus.FINISHED] 
      })
      //.andWhere('(odometerLog IS NULL OR odometerLog.startReading IS NULL OR odometerLog.endReading IS NULL)');

    // Apply time filter
    switch (timeFilter) {
      case 'today':
        baseQueryBuilder.andWhere('DATE(trip.startDate) = DATE(:date)', { 
          date: this.formatDateForDB(startOfToday.toISOString()) 
        });
        break;
      case 'week':
        baseQueryBuilder.andWhere('DATE(trip.startDate) >= DATE(:startDate)', { 
          startDate: this.formatDateForDB(startOfWeek.toISOString()) 
        });
        break;
      case 'month':
        baseQueryBuilder.andWhere('DATE(trip.startDate) >= DATE(:startDate)', { 
          startDate: this.formatDateForDB(startOfMonth.toISOString()) 
        });
        break;
      case 'all':
        // No date filter for 'all'
        break;
      default:
        baseQueryBuilder.andWhere('DATE(trip.startDate) = DATE(:date)', { 
          date: this.formatDateForDB(now.toISOString()) 
        });
    }

    // Get all trips first
    const allTrips = await baseQueryBuilder
      .orderBy('trip.startDate', 'ASC')
      .addOrderBy('trip.startTime', 'ASC')
      .getMany();

    // Filter to get only main trips (earliest in each connected group)
    const mainTrips = await this.filterMainTrips(allTrips);

    // Apply pagination manually
    const paginatedTrips = mainTrips.slice(skip, skip + limit);
    const total = mainTrips.length;

    // Format the trips
    const formattedTrips = await this.formatTripsForMeterReading(paginatedTrips);

    const hasMore = skip + paginatedTrips.length < total;

    return {
      success: true,
      data: {
        trips: formattedTrips,
        total,
        page,
        limit,
        hasMore,
      },
      statusCode: 200,
    };
  }

  private async filterMainTrips(trips: Trip[]): Promise<Trip[]> {
    const mainTrips: Trip[] = [];
    const processedTripIds = new Set<number>();
    const tripMap = new Map<number, Trip>();

    // Create a map for quick lookup
    trips.forEach(trip => {
      tripMap.set(trip.id, trip);
    });

    for (const trip of trips) {
      // Skip if already processed
      if (processedTripIds.has(trip.id)) {
        continue;
      }

      // Get all connected trips for this trip
      const allConnectedTrips = await this.getAllConnectedTrips(trip);
      
      // Filter to only include trips that exist in our original list
      const existingConnectedTrips = allConnectedTrips.filter(t => tripMap.has(t.id));
      
      // Sort by start date and time to find the earliest
      existingConnectedTrips.sort((a, b) => {
        const dateA = new Date(`${a.startDate}T${a.startTime}`);
        const dateB = new Date(`${b.startDate}T${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });

      if (existingConnectedTrips.length > 0) {
        // The earliest trip is the main trip
        const mainTrip = existingConnectedTrips[0];
        
        // Check if mainTrip exists in our original list
        const mainTripFromMap = tripMap.get(mainTrip.id);
        
        if (mainTripFromMap && !processedTripIds.has(mainTripFromMap.id)) {
          // Add all connected trip IDs to the main trip's conflictingTrips
          // but exclude the main trip itself
          const connectedTripIds = existingConnectedTrips
            .filter(t => t.id !== mainTripFromMap.id)
            .map(t => t.id);
          
          // Update the main trip's conflictingTrips array
          if (!mainTripFromMap.conflictingTrips) {
            mainTripFromMap.conflictingTrips = [];
          }
          
          // Add only unique connected trips
          const existingConflictIds = mainTripFromMap.conflictingTrips.map(t => t.id);
          existingConnectedTrips.forEach(connectedTrip => {
            if (connectedTrip.id !== mainTripFromMap.id && 
                !existingConflictIds.includes(connectedTrip.id)) {
              mainTripFromMap.conflictingTrips.push(connectedTrip);
            }
          });
          
          mainTrips.push(mainTripFromMap);
          
          // Mark all trips in the group as processed
          existingConnectedTrips.forEach(t => processedTripIds.add(t.id));
        }
      } else {
        // Trip has no connections, add it as main trip
        mainTrips.push(trip);
        processedTripIds.add(trip.id);
      }
    }

    return mainTrips;
  }

  private async formatTripsForMeterReading(trips: Trip[]): Promise<any[]> {
    const formattedTrips = [];

    for (const trip of trips) {
      // Get all approved connected trips (including conflicting and linked)
      const allConnectedTrips = await this.getAllConnectedTrips(trip);
      
      // Filter out the main trip itself and get only approved ones
      const approvedConnectedTrips = allConnectedTrips.filter(
        connectedTrip => connectedTrip.id !== trip.id && (connectedTrip.status === TripStatus.APPROVED || connectedTrip.status === TripStatus.READ || connectedTrip.status === TripStatus.COMPLETED)
      );

      // Remove duplicate trip IDs
      const uniqueConnectedTrips = Array.from(
        new Map(approvedConnectedTrips.map(t => [t.id, t])).values()
      );

      // Get conflicting trip IDs
      const conflictingTripIds = uniqueConnectedTrips.map(t => t.id);

      // Check if trip needs reading based on odometerLog
      const needsStartReading = !trip.odometerLog?.startReading;
      const needsEndReading = trip.odometerLog?.startReading && !trip.odometerLog?.endReading;

      // Get driver info
      let driverName = 'Not Assigned';
      let driverPhone = '';
      let driverId: number | undefined;

      if (trip.vehicle?.assignedDriverPrimary) {
        driverName = trip.vehicle.assignedDriverPrimary.displayname || 'Driver';
        driverPhone = trip.vehicle.assignedDriverPrimary.phone || '';
        driverId = trip.vehicle.assignedDriverPrimary.id;
      }

      formattedTrips.push({
        id: trip.id,
        status: trip.status,
        startDate: trip.startDate,
        startTime: trip.startTime,
        vehicle: trip.vehicle ? {
          model: trip.vehicle.model,
          registrationNumber: trip.vehicle.regNo,
        } : null,
        conflictingTripIds: conflictingTripIds.length > 0 ? conflictingTripIds : undefined,
        odometerReading: trip.odometerLog ? {
          startReading: trip.odometerLog.startReading,
          endReading: trip.odometerLog.endReading,
          startRecordedBy: trip.odometerLog.startRecordedBy?.displayname,
          endRecordedBy: trip.odometerLog.endRecordedBy?.displayname,
          startRecordedAt: trip.odometerLog.startRecordedAt,
          endRecordedAt: trip.odometerLog.endRecordedAt,
        } : null,
        readingTypeNeeded: needsStartReading ? 'start' : (needsEndReading ? 'end' : null),
        driver: {
          id: driverId,
          name: driverName,
          phone: driverPhone,
        },
        _connectedTripsCount: uniqueConnectedTrips.length,
        _isMainTrip: true,
      });
    }

    return formattedTrips;
  }

  private async getAllConnectedTrips(trip: Trip): Promise<Trip[]> {
    const connectedTrips = new Map<number, Trip>();
    
    // Add the trip itself
    connectedTrips.set(trip.id, trip);
    
    // Add conflicting trips (trips this trip conflicts with)
    if (trip.conflictingTrips) {
      trip.conflictingTrips.forEach(t => {
        if (!connectedTrips.has(t.id)) {
          connectedTrips.set(t.id, t);
        }
      });
    }
    
    // Add linked trips (trips that have this trip as a conflict)
    // We need to query for trips that have this trip in their conflictingTrips
    const tripsWithThisAsConflict = await this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.conflictingTrips', 'conflictingTrips')
      .where('conflictingTrips.id = :tripId', { tripId: trip.id })
      .andWhere('trip.id != :tripId', { tripId: trip.id }) // Exclude itself
      .getMany();
    
    tripsWithThisAsConflict.forEach(t => {
      if (!connectedTrips.has(t.id)) {
        connectedTrips.set(t.id, t);
      }
    });
    
    return Array.from(connectedTrips.values());
  }

  async handleMidTripApproval(tripId: number, userId: number): Promise<any> {
    // Find the trip with relations
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['conflictingTrips', 'vehicle', 'odometerLog']
    });

    if (!trip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Check user authorization
    const allowedRoles = [UserRole.SYSADMIN, UserRole.ADMIN, UserRole.HR];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        this.responseService.error('You are not authorized to handle mid-trip approval', 403)
      );
    }

    const now = new Date();
    const tripDateTime = new Date(`${trip.startDate}T${trip.startTime}`);

    // Check if trip is in the past (mid-trip scenario)
    if (tripDateTime >= now) {
      throw new BadRequestException(
        this.responseService.error('Cannot handle mid-trip approval for future trips', 400)
      );
    }

    // Check for conflicting trips that are before current time and not approved
    if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
      for (const conflictTrip of trip.conflictingTrips) {
        const conflictDateTime = new Date(`${conflictTrip.startDate}T${conflictTrip.startTime}`);
        
        // If conflict trip is before current time and not approved, cancel it
        if (conflictDateTime < now && conflictTrip.status === TripStatus.PENDING) {
          conflictTrip.status = TripStatus.CANCELED;
          // Add remark about expired trip
          conflictTrip.specialRemarks = `Auto-cancelled due to mid-trip approval of trip #${trip.id}. Trip time has expired.`;
          
          await this.tripRepo.save(conflictTrip);
        }
      }
    }

    // Approve the current trip
    trip.status = TripStatus.APPROVED;
    await this.tripRepo.save(trip);

    return {
      success: true,
      message: 'Mid-trip approval handled successfully',
      data: {
        tripId: trip.id,
        status: trip.status,
        handledBy: user.displayname,
        handledAt: new Date().toISOString(),
        conflictingTripsUpdated: trip.conflictingTrips?.filter(
          t => t.status === TripStatus.CANCELED
        ).length || 0,
      },
      statusCode: 200,
    };
  }

  async getAlreadyReadTrips(filterDto: any): Promise<any> {
    // Get pagination parameters
    const page = parseInt(filterDto.page) || 1;
    const limit = parseInt(filterDto.limit) || 10;
    const skip = (page - 1) * limit;
    const timeFilter = filterDto.timeFilter || 'today';

    // Calculate date ranges based on time filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // First, get all read trips in the time range
    const baseQueryBuilder = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.assignedDriverPrimary', 'assignedDriverPrimary')
      .leftJoinAndSelect('trip.odometerLog', 'odometerLog')
      .leftJoinAndSelect('trip.conflictingTrips', 'conflictingTrips')
      .leftJoinAndSelect('conflictingTrips.vehicle', 'conflictVehicle')
      .leftJoinAndSelect('conflictVehicle.assignedDriverPrimary', 'conflictDriver')
      .leftJoinAndSelect('conflictingTrips.odometerLog', 'conflictOdometerLog')
      .where('(odometerLog.startReading IS NOT NULL OR odometerLog.endReading IS NOT NULL)');

    // Apply time filter
    switch (timeFilter) {
      case 'today':
        baseQueryBuilder.andWhere('DATE(trip.startDate) = DATE(:date)', { 
          date: this.formatDateForDB(startOfToday.toISOString()) 
        });
        break;
      case 'week':
        baseQueryBuilder.andWhere('DATE(trip.startDate) >= DATE(:startDate)', { 
          startDate: this.formatDateForDB(startOfWeek.toISOString()) 
        });
        break;
      case 'month':
        baseQueryBuilder.andWhere('DATE(trip.startDate) >= DATE(:startDate)', { 
          startDate: this.formatDateForDB(startOfMonth.toISOString()) 
        });
        break;
      case 'all':
        // No date filter for 'all'
        break;
      default:
        baseQueryBuilder.andWhere('DATE(trip.startDate) = DATE(:date)', { 
          date: this.formatDateForDB(now.toISOString()) 
        });
    }

    // Get all trips first
    const allTrips = await baseQueryBuilder
      .orderBy('trip.startDate', 'DESC')
      .addOrderBy('trip.startTime', 'DESC')
      .getMany();

    // Filter to get only main trips (earliest in each connected group)
    const mainTrips = await this.filterMainTrips(allTrips);

    // Apply pagination manually
    const paginatedTrips = mainTrips.slice(skip, skip + limit);
    const total = mainTrips.length;

    // Format trips
    const formattedTrips = paginatedTrips.map(trip => {
      // Get all approved connected trips
      const approvedConnectedTrips = trip.conflictingTrips?.filter(
        t => t.status === TripStatus.APPROVED || t.status === TripStatus.READ
      ) || [];

      // Get conflicting trip IDs
      const conflictingTripIds = approvedConnectedTrips.map(t => t.id);

      // Get driver info
      let driverName = 'Not Assigned';
      let driverPhone = '';
      let driverId: number | undefined;

      if (trip.vehicle?.assignedDriverPrimary) {
        driverName = trip.vehicle.assignedDriverPrimary.displayname || 'Driver';
        driverPhone = trip.vehicle.assignedDriverPrimary.phone || '';
        driverId = trip.vehicle.assignedDriverPrimary.id;
      }

      return {
        id: trip.id,
        status: trip.status,
        startDate: trip.startDate,
        startTime: trip.startTime,
        vehicle: trip.vehicle ? {
          model: trip.vehicle.model,
          registrationNumber: trip.vehicle.regNo,
        } : null,
        conflictingTripIds: conflictingTripIds.length > 0 ? conflictingTripIds : undefined,
        odometerReading: {
          startReading: trip.odometerLog?.startReading,
          endReading: trip.odometerLog?.endReading,
          startRecordedBy: trip.odometerLog?.startRecordedBy ? {
            id: trip.odometerLog.startRecordedBy.id,
            name: trip.odometerLog.startRecordedBy.displayname,
            role: trip.odometerLog.startRecordedBy.role,
          } : null,
          endRecordedBy: trip.odometerLog?.endRecordedBy ? {
            id: trip.odometerLog.endRecordedBy.id,
            name: trip.odometerLog.endRecordedBy.displayname,
            role: trip.odometerLog.endRecordedBy.role,
          } : null,
          startRecordedAt: trip.odometerLog?.startRecordedAt,
          endRecordedAt: trip.odometerLog?.endRecordedAt,
        },
        driver: {
          id: driverId,
          name: driverName,
          phone: driverPhone,
        },
        isFullyRead: trip.odometerLog?.startReading && trip.odometerLog?.endReading,
        isPartiallyRead: (trip.odometerLog?.startReading && !trip.odometerLog?.endReading) || 
                        (!trip.odometerLog?.startReading && trip.odometerLog?.endReading),
      };
    });

    const hasMore = skip + paginatedTrips.length < total;

    return {
      success: true,
      data: {
        trips: formattedTrips,
        total,
        page,
        limit,
        hasMore,
      },
      statusCode: 200,
    };
  }

  /*
  async recordOdometerReading(
    tripId: number,
    userId: number,
    reading: number,
    readingType: 'start' | 'end'
  ): Promise<any> {
    // Find the trip with relations
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['vehicle', 'odometerLog', 'conflictingTrips']
    });

    if (!trip) {
      return new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    // Check if trip is approved or read
    if (trip.status !== TripStatus.APPROVED && trip.status !== TripStatus.FINISHED) {
      return new BadRequestException(
        this.responseService.error('Cannot record odometer for non-approved trip or ongoing trips', 400)
      );
    }

    // Get user recording the reading
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return new NotFoundException(this.responseService.error('User not found', 404));
    }

    // Check user authorization (only SYSADMIN, SECURITY can record)
    const allowedRoles = [UserRole.SYSADMIN, UserRole.SECURITY];
    if (!allowedRoles.includes(user.role)) {
      return new ForbiddenException(
        this.responseService.error('You are not authorized to record odometer readings', 403)
      );
    }

    // Get vehicle's last odometer reading
    let vehicleLastReading = 0;
    if (trip.vehicle?.odometerLastReading) {
      vehicleLastReading = trip.vehicle.odometerLastReading;
    }

    const now = new Date();

    // Create or get odometer log
    let odometerLog = trip.odometerLog;
    if (!odometerLog) {
      odometerLog = this.odometerLogRepo.create({
        vehicle: trip.vehicle,
        trip,
      });
    }

    // Calculate passenger count for this trip
    const passengerCount = this.calculateTripPassengerCount(trip);

    // Validate reading based on type
    if (readingType === 'start') {
      // Check if start reading already exists
      if (odometerLog.startReading) {
        return new BadRequestException(
          this.responseService.error('Start odometer reading already recorded', 400)
        );
      }

      // Validate start reading cannot be less than vehicle's last odometer reading
      if (reading < vehicleLastReading) {
        return new BadRequestException(
          this.responseService.error(
            `Start odometer reading (${reading}) cannot be less than vehicle's last recorded reading`,// (${vehicleLastReading})`,
            400
          )
        );
      }

      // Update start reading fields
      odometerLog.startReading = reading;
      odometerLog.startRecordedBy = user;
      odometerLog.startRecordedAt = now;

      // Check if trip is start read and update status
      if (odometerLog.startReading) {
        trip.status = TripStatus.READ;
      }
      
      // Check if there are approved conflicting trips and update their start odometer to 0
      if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
        await this.updateConflictingTripsOdometer(trip.conflictingTrips, 'start', 0, user, now);
      }
    } else if (readingType === 'end') {
      // Check if start reading exists
      if (!odometerLog.startReading) {
        return new BadRequestException(
          this.responseService.error('Start odometer reading must be recorded first', 400)
        );
      }

      // Check if end reading already exists
      if (odometerLog.endReading) {
        return new BadRequestException(
          this.responseService.error('End odometer reading already recorded', 400)
        );
      }

      // Validate end reading is greater than start reading
      if (reading <= odometerLog.startReading) {
        return new BadRequestException(
          this.responseService.error('End odometer reading must be greater than start reading', 400)
        );
      }

      // Validate end reading cannot be less than vehicle's last odometer reading
      // (This check might be redundant if start reading already passed this check,
      // but we keep it for safety)
      if (reading < vehicleLastReading) {
        return new BadRequestException(
          this.responseService.error(
            `End odometer reading (${reading}) cannot be less than vehicle's last recorded reading`,// (${vehicleLastReading})`,
            400
          )
        );
      }

      // Update end reading fields
      odometerLog.endReading = reading;
      odometerLog.endRecordedBy = user;
      odometerLog.endRecordedAt = now;
      
      // Check if trip is fully read and update status
      if (odometerLog.startReading && odometerLog.endReading) {
        trip.status = TripStatus.COMPLETED;
        console.log('=================================================================     run  1   =======================================')
        trip.cost = this.calculateCost(trip.vehicle.vehicleType.costPerKm, odometerLog.startReading, odometerLog.endReading);
        console.log('=================================================================     run   2    =======================================')
      }

      // Check if there are approved conflicting trips and update their end odometer to 0
      if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
        await this.updateConflictingTripsOdometer(trip.conflictingTrips, 'end', 0, user, now);
      }
    }

    // Save all changes in a transaction
    await this.tripRepo.manager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(trip);
      await transactionalEntityManager.save(odometerLog);
      
      // Also save to the trip relation
      trip.odometerLog = odometerLog;
      await transactionalEntityManager.save(trip);

      // RESTORE VEHICLE SEATS when end reading is recorded
      if (readingType === 'end' && trip.vehicle && passengerCount > 0) {
        const vehicle = await transactionalEntityManager.findOne(
          Vehicle, 
          { where: { id: trip.vehicle.id } }
        );
        
        if (vehicle) {
          // Restore seats that were allocated for this trip
          vehicle.seatingAvailability += passengerCount;
          
          // Ensure seating availability doesn't exceed max capacity
          if (vehicle.seatingAvailability > vehicle.seatingCapacity) {
            vehicle.seatingAvailability = vehicle.seatingCapacity - 1;
          }
          
          await transactionalEntityManager.save(vehicle);
        }
      }

      try {
                // TODO publish event
      } catch (e) {
        console.error('Failed to send odometer notification', e);
      }
    });

    // Update vehicle's last odometer reading
    if (trip.vehicle) {
      await this.updateVehicleOdometer(trip.vehicle.id, reading);
    }

    return {
      success: true,
      message: `${readingType} odometer reading recorded successfully`,
      data: {
        tripId: trip.id,
        readingType,
        reading,
        recordedBy: {
          id: user.id,
          name: user.displayname,
          role: user.role,
        },
        recordedAt: now.toISOString(),
        tripStatus: trip.status,
        startRecordedBy: odometerLog.startRecordedBy?.displayname,
        endRecordedBy: odometerLog.endRecordedBy?.displayname,
        vehicleLastReading: vehicleLastReading, // Include for reference
      },
      statusCode: 200,
    };
  }
  */

  async recordOdometerReading(
  tripId: number,
  userId: number,
  reading: number,
  readingType: 'start' | 'end'
): Promise<any> {
  // Find the trip with relations
  const trip = await this.tripRepo.findOne({
    where: { id: tripId },
    relations: ['vehicle', 'vehicle.vehicleType', 'odometerLog', 'conflictingTrips']
  });

  if (!trip) {
    return new NotFoundException(this.responseService.error('Trip not found', 404));
  }

  // Check if trip is approved or read
  /*
  if (trip.status !== TripStatus.APPROVED && trip.status !== TripStatus.FINISHED) {
    return new BadRequestException(
      this.responseService.error('Cannot record odometer for non-approved trip or ongoing trip', 400)
    );
  }
  */

  // Get user recording the reading
  const user = await this.userRepo.findOne({ where: { id: userId } });
  if (!user) {
    return new NotFoundException(this.responseService.error('User not found', 404));
  }

  // Check user authorization (only SYSADMIN, SECURITY can record)
  const allowedRoles = [UserRole.SYSADMIN, UserRole.SECURITY];
  if (!allowedRoles.includes(user.role)) {
    return new ForbiddenException(
      this.responseService.error('You are not authorized to record odometer readings', 403)
    );
  }

  // Get vehicle's last odometer reading
  let vehicleLastReading = 0;
  if (trip.vehicle?.odometerLastReading) {
    vehicleLastReading = trip.vehicle.odometerLastReading;
  }

  const now = new Date();

  // Create or get odometer log
  let odometerLog = trip.odometerLog;
  if (!odometerLog) {
    odometerLog = this.odometerLogRepo.create({
      vehicle: trip.vehicle,
      trip,
    });
  }

  // Calculate passenger count for this trip
  const passengerCount = this.calculateTripPassengerCount(trip);

  // Validate reading based on type
  if (readingType === 'start') {
    if (trip.status !== TripStatus.APPROVED) {
      return new BadRequestException(
        this.responseService.error('Cannot record odometer for non-approved trip', 400)
      );
    }

    // Check if start reading already exists
    if (odometerLog.startReading) {
      return new BadRequestException(
        this.responseService.error('Start odometer reading already recorded', 400)
      );
    }

    // Validate start reading cannot be less than vehicle's last odometer reading
    if (reading < vehicleLastReading) {
      return new BadRequestException(
        this.responseService.error(
          `Start odometer reading (${reading}) cannot be less than vehicle's last recorded reading (${vehicleLastReading})`,
          400
        )
      );
    }

    // Update start reading fields
    odometerLog.startReading = reading;
    odometerLog.startRecordedBy = user;
    odometerLog.startRecordedAt = now;

    // Update trip status to READ if start reading is recorded
    trip.status = TripStatus.READ;
    
    // Check if there are approved conflicting trips and update their start odometer to 0
    if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
      await this.updateConflictingTripsOdometer(trip.conflictingTrips, 'start', 0, user, now);
    }
  } else if (readingType === 'end') {
    // Check if trip is in READ status (must have start reading recorded)
    if (trip.status !== TripStatus.FINISHED) {
      return new BadRequestException(
        this.responseService.error('Cannot record end odometer for incomplete trip', 400)
      );
    }

    // Check if start reading exists
    if (!odometerLog.startReading) {
      return new BadRequestException(
        this.responseService.error('Start odometer reading must be recorded first', 400)
      );
    }

    // Check if end reading already exists
    if (odometerLog.endReading) {
      return new BadRequestException(
        this.responseService.error('End odometer reading already recorded', 400)
      );
    }

    // Validate end reading is greater than start reading
    if (reading <= odometerLog.startReading) {
      return new BadRequestException(
        this.responseService.error('End odometer reading must be greater than start reading', 400)
      );
    }

    // Validate end reading cannot be less than vehicle's last odometer reading
    if (reading < vehicleLastReading) {
      return new BadRequestException(
        this.responseService.error(
          `End odometer reading (${reading}) cannot be less than vehicle's last recorded reading (${vehicleLastReading})`,
          400
        )
      );
    }

    // Update end reading fields
    odometerLog.endReading = reading;
    odometerLog.endRecordedBy = user;
    odometerLog.endRecordedAt = now;
    
    // Update trip status to COMPLETED
    trip.status = TripStatus.COMPLETED; 
    trip.cost = (odometerLog.endReading - odometerLog.startReading) * trip.vehicle.vehicleType.costPerKm;
    
    // Calculate cost if vehicle type has cost per km
    if (trip.vehicle?.vehicleType?.costPerKm && odometerLog.startReading && odometerLog.endReading) {
      const distance = odometerLog.endReading - odometerLog.startReading;
      trip.cost = distance * trip.vehicle.vehicleType.costPerKm;
      console.log(`Calculated cost: ${trip.cost} = ${distance}km * ${trip.vehicle.vehicleType.costPerKm}/km`);
    }

    // Check if there are approved conflicting trips and update their end odometer to 0
    if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
      await this.updateConflictingTripsOdometer(trip.conflictingTrips, 'end', 0, user, now);
    }
  } else {
    return new BadRequestException(
      this.responseService.error('Invalid reading type. Must be "start" or "end"', 400)
    );
  }

  try {
    // Save all changes in a transaction
    await this.tripRepo.manager.transaction(async (transactionalEntityManager) => {
      // Save odometer log first
      await transactionalEntityManager.save(OdometerLog, odometerLog);
      
      // Update trip with reference to odometer log
      trip.odometerLog = odometerLog;
      await transactionalEntityManager.save(Trip, trip);
      
      // Update vehicle's last odometer reading
      if (trip.vehicle) {
        await transactionalEntityManager.update(
          Vehicle, 
          { id: trip.vehicle.id },
          { odometerLastReading: reading, updatedAt: now }
        );
        
        /*
        // RESTORE VEHICLE SEATS when end reading is recorded
        if (readingType === 'end' && passengerCount > 0) {
          const vehicle = await transactionalEntityManager.findOne(
            Vehicle, 
            { where: { id: trip.vehicle.id } }
          );
          
          if (vehicle) {
            // Restore seats that were allocated for this trip
            // Make sure seatingAvailability doesn't exceed seatingCapacity
            const newAvailability = Math.min(
              vehicle.seatingCapacity,
              vehicle.seatingAvailability + passengerCount
            );
            
            vehicle.seatingAvailability = newAvailability;
            await transactionalEntityManager.save(Vehicle, vehicle);
          }
        }
        */
      }

      
    });

    return this.responseService.success(
      `${readingType} odometer reading recorded successfully`,
      {
        tripId: trip.id,
        readingType,
        reading,
        recordedBy: {
          id: user.id,
          name: user.displayname,
          role: user.role,
        },
        recordedAt: now.toISOString(),
        tripStatus: trip.status,
        startReading: odometerLog.startReading,
        endReading: odometerLog.endReading,
        startRecordedAt: odometerLog.startRecordedAt?.toISOString(),
        endRecordedAt: odometerLog.endRecordedAt?.toISOString(),
        startRecordedBy: odometerLog.startRecordedBy?.displayname,
        endRecordedBy: odometerLog.endRecordedBy?.displayname,
        vehicleLastReading: vehicleLastReading,
        cost: trip.cost,
        distance: odometerLog.endReading && odometerLog.startReading 
          ? odometerLog.endReading - odometerLog.startReading 
          : null,
      },
      200
    );
  } catch (error) {
    // Log the actual error for debugging
    console.error('Error recording odometer reading:', error);
    console.error('Transaction error:', error);
    
    if (error instanceof HttpException) {
      return error;
    }
    
    return new InternalServerErrorException(
      this.responseService.error('Failed to record odometer reading', 500)
    );
  }
}

  // Helper method to calculate passenger count from Trip entity
  private calculateCost(costPerKm: number, startReading: number, endReading: number): number {
    // Validate inputs
    if (!costPerKm || costPerKm <= 0) {
      console.warn('Invalid cost per km:', costPerKm);
      return 0;
    }
    
    if (!startReading || !endReading || endReading <= startReading) {
      console.warn('Invalid odometer readings:', { startReading, endReading });
      return 0;
    }
    
    // Calculate distance traveled
    const distance = endReading - startReading;
    
    // Calculate cost
    const cost = distance * costPerKm;
    
    // Return with 2 decimal places
    return parseFloat(cost.toFixed(2));
  }

  private calculateTripPassengerCount(trip: Trip): number {
    let passengerCount = 0;

    switch (trip.passengerType) {
      case PassengerType.OWN:
        passengerCount = 1;
        break;
      case PassengerType.OTHER_INDIVIDUAL:
        passengerCount = 1;
        break;
      case PassengerType.GROUP:
        // Count the requester if includeMeInGroup is true
        passengerCount = trip.includeMeInGroup ? 1 : 0;
        
        // Count selected group users
        if (trip.selectedGroupUsers && trip.selectedGroupUsers.length > 0) {
          passengerCount += trip.selectedGroupUsers.length;
        }
        
        // Count selected others
        if (trip.selectedOthers && trip.selectedOthers.length > 0) {
          passengerCount += trip.selectedOthers.length;
        }
        
        // Count selected individual
        if (trip.selectedIndividual) {
          passengerCount += 1;
        }
        break;
      default:
        passengerCount = 1;
    }

    return passengerCount;
  }

  private async updateConflictingTripsOdometer(
    conflictingTrips: Trip[],
    readingType: 'start' | 'end',
    reading: number,
    user: User,
    timestamp: Date
  ): Promise<void> {
    for (const conflictTrip of conflictingTrips) {
      // Only update if trip is approved or read
      if (conflictTrip.status === TripStatus.APPROVED || conflictTrip.status === TripStatus.READ) {
        // Load full trip with relations
        const fullConflictTrip = await this.tripRepo.findOne({
          where: { id: conflictTrip.id },
          relations: ['odometerLog', 'vehicle']
        });

        if (fullConflictTrip) {
          // Calculate passenger count for conflict trip
          const conflictPassengerCount = this.calculateTripPassengerCount(fullConflictTrip);

          // Create or get odometer log for conflict trip
          let conflictOdometerLog = fullConflictTrip.odometerLog;
          if (!conflictOdometerLog) {
            conflictOdometerLog = this.odometerLogRepo.create({
              vehicle: fullConflictTrip.vehicle,
              trip: fullConflictTrip,
            });
          }

          if (readingType === 'start') {
            // Update conflict trip's start reading
            if (!conflictOdometerLog.startReading) {
              conflictOdometerLog.startReading = reading;
              conflictOdometerLog.startRecordedBy = user;
              conflictOdometerLog.startRecordedAt = timestamp;
              // Update trip's start odometer (optional)
              //fullConflictTrip.startOdometer = reading;
              // Check if conflict trip is fully read
              if (conflictOdometerLog.startReading !== null) {
                fullConflictTrip.status = TripStatus.READ;
              }
            }
          } else {
            // Update conflict trip's end reading
            if (!conflictOdometerLog.endReading && conflictOdometerLog.startReading !== null) {
              conflictOdometerLog.endReading = reading;
              conflictOdometerLog.endRecordedBy = user;
              conflictOdometerLog.endRecordedAt = timestamp;
              // Update trip's end odometer (optional)
              //fullConflictTrip.endOdometer = reading;
              
              // Check if conflict trip is fully read
              if (conflictOdometerLog.startReading !== null && conflictOdometerLog.endReading !== null) {
                fullConflictTrip.status = TripStatus.COMPLETED;
                fullConflictTrip.cost = 0;
              }

              /*
              // RESTORE VEHICLE SEATS for conflict trip when end reading is recorded
              if (fullConflictTrip.vehicle && conflictPassengerCount > 0) {
                const conflictVehicle = await this.vehicleRepo.findOne({
                  where: { id: fullConflictTrip.vehicle.id }
                });
                
                if (conflictVehicle) {
                  // Restore seats that were allocated for this conflict trip
                  conflictVehicle.seatingAvailability += conflictPassengerCount;
                  
                  // Ensure seating availability doesn't exceed max capacity
                  if (conflictVehicle.seatingAvailability > conflictVehicle.seatingCapacity) {
                    conflictVehicle.seatingAvailability = conflictVehicle.seatingCapacity;
                  }
                  
                  await this.vehicleRepo.save(conflictVehicle);
                }
              } 
              */       
            }
          }

          // Save conflict trip and odometer log
          await this.tripRepo.save(fullConflictTrip);
          await this.odometerLogRepo.save(conflictOdometerLog);
          
          // Update the relation
          fullConflictTrip.odometerLog = conflictOdometerLog;
          await this.tripRepo.save(fullConflictTrip);
        }
      }
    }
  }

  private async updateVehicleOdometer(vehicleId: number, odometerReading: number): Promise<void> {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: vehicleId } });
    
    if (vehicle) {
      vehicle.odometerLastReading = odometerReading;
      vehicle.updatedAt = new Date();
      await this.vehicleRepo.save(vehicle);
    }
  }


// Add these methods to your existing TripsService class
async getDriverAssignedTrips(driverId: number, requestDto: any): Promise<any> {
  // Get the requesting user to check their role
  const requestingUser = await this.userRepo.findOne({ 
    where: { 
      id: driverId,
      isActive: true,
      isApproved: Status.APPROVED
    }
  });
  
  if (!requestingUser) {
    throw new NotFoundException(
      this.responseService.error('User not found or not approved', 404)
    );
  }

  const isSysAdmin = requestingUser.role === UserRole.SYSADMIN;
  const isDriver = requestingUser.role === UserRole.DRIVER;
  const isSupervisor = requestingUser.role === UserRole.SUPERVISOR;

  // If user is not SYSADMIN and not DRIVER, they can't access this endpoint
  if (!isSysAdmin && !isDriver && !isSupervisor) {
    throw new ForbiddenException(
      this.responseService.error('Only drivers or Supervisor or sysadmins can access assigned trips', 403)
    );
  }

  // Create base query builder
  const queryBuilder = this.tripRepo
    .createQueryBuilder('trip')
    .leftJoinAndSelect('trip.vehicle', 'vehicle')
    .leftJoinAndSelect('vehicle.assignedDriverPrimary', 'assignedDriverPrimary')
    .leftJoinAndSelect('vehicle.assignedDriverSecondary', 'assignedDriverSecondary')
    .leftJoinAndSelect('trip.location', 'location')
    .leftJoinAndSelect('trip.requester', 'requester')
    .leftJoinAndSelect('trip.conflictingTrips', 'conflictingTrips')
    .leftJoinAndSelect('conflictingTrips.vehicle', 'conflictVehicle')
    .leftJoinAndSelect('conflictingTrips.location', 'conflictLocation')
    .leftJoinAndSelect('trip.odometerLog', 'odometerLog');

  // Apply driver filter only if user is a DRIVER (not SYSADMIN)
  if (isDriver || isSupervisor) {
    queryBuilder.where(new Brackets(qb => {
      qb.where('vehicle.assignedDriverPrimary.id = :driverId', { driverId })
        .orWhere('vehicle.assignedDriverSecondary.id = :driverId', { driverId });
    }));
  } else if (isSysAdmin) {
    // SYSADMIN can see all trips for all drivers
    // Apply driver filter if a specific driverId is requested (optional)
    if (requestDto.driverId) {
      queryBuilder.where(new Brackets(qb => {
        qb.where('vehicle.assignedDriverPrimary.id = :specificDriverId', { 
          specificDriverId: requestDto.driverId 
        })
        .orWhere('vehicle.assignedDriverSecondary.id = :specificDriverId', { 
          specificDriverId: requestDto.driverId 
        });
      }));
    }
    // If no specific driverId, SYSADMIN sees all driver trips
  }

  // Apply time filter
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (requestDto.timeFilter) {
    case 'today':
      queryBuilder.andWhere('DATE(trip.startDate) = DATE(:date)', { 
        date: this.formatDateForDB(startOfToday.toISOString()) 
      });
      break;
    case 'week':
      queryBuilder.andWhere('DATE(trip.startDate) >= DATE(:startDate)', { 
        startDate: this.formatDateForDB(startOfWeek.toISOString()) 
      });
      break;
    case 'month':
      queryBuilder.andWhere('DATE(trip.startDate) >= DATE(:startDate)', { 
        startDate: this.formatDateForDB(startOfMonth.toISOString()) 
      });
      break;
    case 'all':
    default:
      // No date filter for 'all'
      break;
  }

  // Apply status filter if provided
  if (requestDto.statusFilter && requestDto.statusFilter !== 'all') {
    if (requestDto.statusFilter === 'pending') {
      // For driver: PENDING and APPROVED trips (not started yet)
      queryBuilder.andWhere('trip.status = :pendingStatuses', {
        pendingStatuses: TripStatus.PENDING
      });
    } else if (requestDto.statusFilter === 'approved') {
      // For driver: READ status means approved and ready to go
      queryBuilder.andWhere('trip.status IN (:...status)', { 
        status: [TripStatus.READ, TripStatus.APPROVED]
      });
    } else if (requestDto.statusFilter === 'finished') {
      // For driver: READ status means approved and ready to go
      queryBuilder.andWhere('trip.status IN (:...status)', { 
        status: [TripStatus.COMPLETED, TripStatus.FINISHED]
      });
    } else if (requestDto.statusFilter === 'completed') {
      // Completed trips
      queryBuilder.andWhere('trip.status = :status', { 
        status: TripStatus.COMPLETED 
      });
    } else if (requestDto.statusFilter === 'ongoing') {
      // Ongoing trips (currently being driven)
      queryBuilder.andWhere('trip.status = :status', { 
        status: TripStatus.ONGOING 
      });
    } else {
      queryBuilder.andWhere('trip.status = :status', { 
        status: requestDto.statusFilter 
      });
    }
  } else {
    console.log('==================RUN============')
    // Default: exclude DRAFT and CANCELED trips for drivers
    queryBuilder.andWhere('trip.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [TripStatus.DRAFT, TripStatus.CANCELED, TripStatus.REJECTED]
    });
  }

  // Calculate pagination
  const page = requestDto.page || 1;
  const limit = requestDto.limit || 10;
  const skip = (page - 1) * limit;

  // Get total count
  const total = await queryBuilder.getCount();

  // Get paginated results
  const trips = await queryBuilder
    .orderBy('trip.startDate', 'ASC')
    .addOrderBy('trip.startTime', 'ASC')
    .skip(skip)
    .take(limit)
    .getMany();

  // Filter to get only main trips (earliest in each connected group)
  const mainTrips = await this.filterMainTripsForDriver(trips);

  // Format the trips for response
  const formattedTrips = await this.formatDriverTrips(mainTrips, driverId);

  const hasMore = skip + formattedTrips.length < total;

  // For SYSADMIN, include additional driver information
  let driverInfo = null;
  if (isSysAdmin && requestDto.driverId) {
    const specificDriver = await this.userRepo.findOne({
      where: { id: requestDto.driverId },
      select: ['id', 'displayname', 'phone', 'role']
    });
    if (specificDriver) {
      driverInfo = {
        id: specificDriver.id,
        name: specificDriver.displayname,
        phone: specificDriver.phone,
        role: specificDriver.role
      };
    }
  }

  return {
    success: true,
    data: {
      trips: formattedTrips,
      total,
      page,
      limit,
      hasMore,
      ...(driverInfo && { driver: driverInfo }),
      ...(isSysAdmin && !requestDto.driverId && { viewType: 'all_drivers' }),
      ...(isSysAdmin && requestDto.driverId && { viewType: 'specific_driver' }),
      ...(isDriver && { viewType: 'my_trips' })
    },
    statusCode: 200,
  };
}

private async filterMainTripsForDriver(trips: Trip[]): Promise<Trip[]> {
  const mainTrips: Trip[] = [];
  const processedTripIds = new Set<number>();
  const tripMap = new Map<number, Trip>();

  // Create a map for quick lookup
  trips.forEach(trip => {
    tripMap.set(trip.id, trip);
  });

  for (const trip of trips) {
    // Skip if already processed
    if (processedTripIds.has(trip.id)) {
      continue;
    }

    // Get all connected trips for this trip
    const allConnectedTrips = await this.getAllConnectedTrips(trip);
    
    // Filter to only include trips that exist in our original list
    const existingConnectedTrips = allConnectedTrips.filter(t => tripMap.has(t.id));
    
    if (existingConnectedTrips.length > 0) {
      // Sort by start date and time to find the earliest
      existingConnectedTrips.sort((a, b) => {
        const dateA = new Date(`${a.startDate}T${a.startTime}`);
        const dateB = new Date(`${b.startDate}T${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });

      // The earliest trip is the main trip
      const mainTrip = existingConnectedTrips[0];
      
      // Check if mainTrip exists in our original list
      const mainTripFromMap = tripMap.get(mainTrip.id);
      
      if (mainTripFromMap && !processedTripIds.has(mainTripFromMap.id)) {
        // Add all connected trip IDs to the main trip's conflictingTrips
        const connectedTripIds = existingConnectedTrips
          .filter(t => t.id !== mainTripFromMap.id)
          .map(t => t.id);
        
        // Update the main trip's conflictingTrips array
        if (!mainTripFromMap.conflictingTrips) {
          mainTripFromMap.conflictingTrips = [];
        }
        
        // Add only unique connected trips
        const existingConflictIds = mainTripFromMap.conflictingTrips.map(t => t.id);
        existingConnectedTrips.forEach(connectedTrip => {
          if (connectedTrip.id !== mainTripFromMap.id && 
              !existingConflictIds.includes(connectedTrip.id)) {
            mainTripFromMap.conflictingTrips.push(connectedTrip);
          }
        });
        
        mainTrips.push(mainTripFromMap);
        
        // Mark all trips in the group as processed
        existingConnectedTrips.forEach(t => processedTripIds.add(t.id));
      }
    } else {
      // Trip has no connections, add it as main trip
      mainTrips.push(trip);
      processedTripIds.add(trip.id);
    }
  }

  return mainTrips;
}

private async formatDriverTrips(trips: Trip[], driverId: number): Promise<any[]> {
  const formattedTrips = [];

  for (const trip of trips) {
    // Get all connected trips
    const allConnectedTrips = await this.getAllConnectedTrips(trip);
    
    // Filter out the main trip itself
    const connectedTrips = allConnectedTrips.filter(
      connectedTrip => connectedTrip.id !== trip.id
    );

    // Get only approved/read/completed/ongoing connected trips
    const activeConnectedTrips = connectedTrips.filter(
      t => [TripStatus.APPROVED, TripStatus.READ, TripStatus.COMPLETED, TripStatus.ONGOING].includes(t.status)
    );

    // Get conflicting trip IDs
    const conflictingTripIds = activeConnectedTrips.map(t => t.id);

    // Determine driver assignment type
    let driverAssignment = 'none';
    let isPrimaryDriver = false;
    
    if (trip.vehicle) {
      if (trip.vehicle.assignedDriverPrimary?.id === driverId) {
        driverAssignment = 'primary';
        isPrimaryDriver = true;
      } else if (trip.vehicle.assignedDriverSecondary?.id === driverId) {
        driverAssignment = 'secondary';
        isPrimaryDriver = false;
      }
    }

    // Get passenger count for this trip
    const passengerCount = this.calculateTripPassengerCount(trip);

    // Check if odometer readings are complete
    const hasStartReading = trip.odometerLog?.startReading != null;
    const hasEndReading = trip.odometerLog?.endReading != null;
    const readingStatus = hasStartReading && hasEndReading 
      ? 'complete' 
      : hasStartReading 
        ? 'start_only' 
        : 'none';

    formattedTrips.push({
      id: trip.id,
      status: trip.status,
      startDate: trip.startDate,
      startTime: trip.startTime.substring(0, 5), // Format to HH:MM
      vehicleModel: trip.vehicle?.model || 'Unknown',
      vehicleRegNo: trip.vehicle?.regNo || 'Unknown',
      startLocation: trip.location?.startAddress,
      endLocation: trip.location?.endAddress,
      conflictingTripIds: conflictingTripIds.length > 0 ? conflictingTripIds : undefined,
      passengerCount,
      purpose: trip.purpose,
      driverAssignment,
      isPrimaryDriver,
      odometerStatus: readingStatus,
      odometerLog: trip.odometerLog ? {
        startReading: trip.odometerLog.startReading,
        endReading: trip.odometerLog.endReading,
        startRecordedAt: trip.odometerLog.startRecordedAt,
        endRecordedAt: trip.odometerLog.endRecordedAt,
      } : null,
      _connectedTripsCount: connectedTrips.length,
      _isMainTrip: true,
    });
  }

  return formattedTrips;
}

async startTrip(tripId: number, userId: number): Promise<any> {
  // Get trip with all necessary relations
  const trip = await this.tripRepo.findOne({
    where: { id: tripId },
    relations: [
      'vehicle',
      'vehicle.assignedDriverPrimary',
      'vehicle.assignedDriverSecondary',
      'odometerLog',
      'conflictingTrips',
      'conflictingTrips.vehicle',
      'conflictingTrips.odometerLog',
    ]
  });

  if (!trip) {
    throw new NotFoundException(this.responseService.error('Trip not found', 404));
  }

  // Get user making the request
  const user = await this.userRepo.findOne({ 
    where: { id: userId },
    select: ['id', 'role', 'displayname']
  });
  
  if (!user) {
    throw new NotFoundException(this.responseService.error('User not found', 404));
  }

  const isSysAdmin = user.role === UserRole.SYSADMIN;
  
  // Check if user is assigned driver
  const isPrimaryDriver = trip.vehicle?.assignedDriverPrimary?.id === userId;
  const isSecondaryDriver = trip.vehicle?.assignedDriverSecondary?.id === userId;
  const isAssignedDriver = isPrimaryDriver || isSecondaryDriver;

  if (!isSysAdmin && !isAssignedDriver) {
    throw new ForbiddenException(
      this.responseService.error('You are not authorized to start this trip', 403)
    );
  }

  // Check current trip status
  if (trip.status !== TripStatus.READ) {
    throw new BadRequestException(
      this.responseService.error(
        `Cannot start trip with status: ${trip.status}. Trip must be READ.`,
        400
      )
    );
  }

  // Check if odometer start reading is done
  if (!trip.odometerLog?.startReading) {
    throw new BadRequestException(
      this.responseService.error(
        'Cannot start trip without odometer start reading. Please complete meter reading first.',
        400
      )
    );
  }

  const now = new Date();

  // Start the main trip
  trip.status = TripStatus.ONGOING;
  trip.updatedAt = now;

  // Also start all connected trips that have odometer start reading
  if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
    const connectedTripsStarted = [];
    
    for (const connectedTrip of trip.conflictingTrips) {
      // Check if connected trip meets criteria for starting
      if ((connectedTrip.status === TripStatus.READ) &&
          connectedTrip.odometerLog?.startReading) {
        
        connectedTrip.status = TripStatus.ONGOING;
        connectedTrip.updatedAt = now;
        await this.tripRepo.save(connectedTrip);
        
        connectedTripsStarted.push({
          id: connectedTrip.id,
          status: connectedTrip.status,
        });
      }
    }

    // Save all connected trips
    if (connectedTripsStarted.length > 0) {
      console.log(`Started ${connectedTripsStarted.length} connected trips`);
    }
  }

  // Save the main trip
  await this.tripRepo.save(trip);

  // Notify relevant users
  try {
    // TODO publish event
  } catch (e) {
    console.error('Failed to send trip start notification', e);
  }

  return {
    success: true,
    message: 'Trip started successfully',
    data: {
      tripId: trip.id,
    },
    timestamp: now.toISOString(),
    statusCode: 200,
  };
}

async endTrip(tripId: number, userId: number, endPassengerCount: number): Promise<any> {
  if (!endPassengerCount || endPassengerCount <= 0) {
    throw new BadRequestException(
      this.responseService.error('Passenger count must be greater than 0', 400)
    );
  }

  if (endPassengerCount > 50) { // Adjust max limit as needed
    throw new BadRequestException(
      this.responseService.error('Passenger count is too high', 400)
    );
  }

  // Get trip with all necessary relations
  const trip = await this.tripRepo.findOne({
    where: { id: tripId },
    relations: [
      'vehicle',
      'vehicle.assignedDriverPrimary',
      'vehicle.assignedDriverSecondary',
      'odometerLog',
      'conflictingTrips',
      'conflictingTrips.vehicle',
      'conflictingTrips.odometerLog',
    ]
  });

  if (!trip) {
    throw new NotFoundException(this.responseService.error('Trip not found', 404));
  }

  // Get user making the request
  const user = await this.userRepo.findOne({ 
    where: { id: userId },
    select: ['id', 'role', 'displayname']
  });
  
  if (!user) {
    throw new NotFoundException(this.responseService.error('User not found', 404));
  }

  const isSysAdmin = user.role === UserRole.SYSADMIN;
  
  // Check if user is assigned driver
  const isPrimaryDriver = trip.vehicle?.assignedDriverPrimary?.id === userId;
  const isSecondaryDriver = trip.vehicle?.assignedDriverSecondary?.id === userId;
  const isAssignedDriver = isPrimaryDriver || isSecondaryDriver;

  if (!isSysAdmin && !isAssignedDriver) {
    throw new ForbiddenException(
      this.responseService.error('You are not authorized to end this trip', 403)
    );
  }

  // Check current trip status
  if (trip.status !== TripStatus.ONGOING) {
    throw new BadRequestException(
      this.responseService.error(
        `Cannot end trip with status: ${trip.status}. Trip must be ONGOING.`,
        400
      )
    );
  }

  const now = new Date();

  // End the main trip
  trip.status = TripStatus.FINISHED;
  trip.endPassengerCount = endPassengerCount;
  trip.updatedAt = now;

  // Also end all connected trips that are ongoing
  if (trip.conflictingTrips && trip.conflictingTrips.length > 0) {
    const connectedTripsEnded = [];
    
    for (const connectedTrip of trip.conflictingTrips) {
      // Check if connected trip is ongoing
      if (connectedTrip.status === TripStatus.ONGOING) {
        connectedTrip.status = TripStatus.FINISHED;
        connectedTrip.updatedAt = now;
        await this.tripRepo.save(connectedTrip);
        
        connectedTripsEnded.push({
          id: connectedTrip.id,
          status: connectedTrip.status,
        });
      }
    }

    // Save all connected trips
    if (connectedTripsEnded.length > 0) {
      console.log(`Ended ${connectedTripsEnded.length} connected trips`);
    }
  }

  // Save the main trip
  await this.tripRepo.save(trip);

  // Notify relevant users
  try {
    // TODO publish event
  } catch (e) {
    console.error('Failed to send trip end notification', e);
  }

  return {
    success: true,
    message: 'Trip ended successfully',
    data: {
      tripId: trip.id
    },
    timestamp: now.toISOString(),
    statusCode: 200,
  };
}


}