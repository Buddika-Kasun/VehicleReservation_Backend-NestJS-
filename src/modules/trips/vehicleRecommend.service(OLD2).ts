import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Trip, TripStatus } from "src/infra/database/entities/trip.entity";
import { Vehicle } from "src/infra/database/entities/vehicle.entity";
import { Repository, In, Brackets } from "typeorm";
import { ReviewAvailableVehiclesRequest } from "./dto/create-trip.dto";
import { AvailableVehicleDto } from "./dto/trip-response.dto";
import { ResponseService } from "src/common/services/response.service";
import { TripLocation } from "src/infra/database/entities/trip-location.entity";
import { User } from "src/infra/database/entities/user.entity";

@Injectable()
export class VehicleRecommendService {
  private readonly SEARCH_RADIUS_KM = 10;
  private readonly TIME_WINDOW_MINUTES = 60; // 1 hour buffer
  private readonly KILOMETERS_PER_HOUR = 30; // Average vehicle speed for ETA calculation

  constructor(
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly driverRepo: Repository<User>,
    private readonly responseService: ResponseService,
  ) {}

  async getReviewAvailableVehicles(
    request: ReviewAvailableVehiclesRequest
  ): Promise<{
    allVehicles: AvailableVehicleDto[];
    pagination: any;
  }> {
    const { tripId, page = 0, pageSize = 10, search } = request;

    // Get the requested trip details
    const requestedTrip = await this.tripRepo.findOne({
      where: { id: Number(tripId) },
      relations: ["location"]
    });

    if (!requestedTrip) {
      throw new NotFoundException(
        this.responseService.error("Trip not found", 404)
      );
    }

    // Calculate the requested trip time window (with buffer)
    const requestedWindow = this.calculateTripWindow(requestedTrip);

    // Get all active vehicles (with pagination and search)
    const vehicles = await this.fetchVehicles(search, page, pageSize);

    // For each vehicle, calculate actual available seats during requested time
    const analyzedVehicles: AvailableVehicleDto[] = [];

    for (const vehicle of vehicles.vehicles) {
      const analysis = await this.analyzeVehicleAvailability(
        vehicle,
        requestedTrip,
        requestedWindow
      );

      if (analysis) {
        analyzedVehicles.push(analysis);
      }
    }

    // Score and select recommended vehicle
    const scoredVehicles = this.scoreAndSelectRecommended(
      analyzedVehicles,
      requestedTrip.passengerCount
    );

    // Sort vehicles
    const sortedVehicles = this.sortVehicles(scoredVehicles);

    return {
      allVehicles: sortedVehicles,
      pagination: {
        total: vehicles.total,
        page,
        pageSize,
        totalPages: Math.ceil(vehicles.total / pageSize),
        hasNext: page < Math.ceil(vehicles.total / pageSize) - 1,
        hasPrevious: page > 0
      }
    };
  }

  /**
   * Core logic to analyze vehicle availability
   */
  private async analyzeVehicleAvailability(
    vehicle: Vehicle,
    requestedTrip: Trip,
    requestedWindow: { start: Date; end: Date }
  ): Promise<AvailableVehicleDto | null> {
    // Step 1: Get all trips for this vehicle that overlap with requested time window
    const overlappingTrips = await this.getOverlappingTrips(
      vehicle.id,
      requestedWindow
    );

    let availableSeats = vehicle.seatingCapacity - 1;
    let isAvailable = true;
    let isInConflict = false;
    let conflictingTripData = null;
    let reason = "Available vehicle";
    
    // Step 2: Check for ongoing trips that would make vehicle unavailable
    const ongoingTrips = overlappingTrips.filter(trip => 
      trip.status === TripStatus.ONGOING ||
      (trip.status === TripStatus.APPROVED && this.isOngoingAtTime(trip, requestedWindow.start))
    );

    if (ongoingTrips.length > 0) {
      // Vehicle is currently on a trip during requested time
      return null;
    }

    // Step 3: Calculate available seats based on overlapping trips
    for (const trip of overlappingTrips) {
      // Subtract passenger count from available seats
      availableSeats -= trip.passengerCount;
      
      // Check if routes are nearby (within 10km)
      if (this.isRouteNearby(requestedTrip.location, trip.location)) {
        isInConflict = true;
        conflictingTripData = this.buildConflictingTripData(trip);
        reason = "Optimal: Already scheduled nearby within time window";
      }
    }

    // Step 4: Check if vehicle has enough seats
    if (availableSeats < requestedTrip.passengerCount) {
      // Not enough seats available
      return null;
    }

    // Step 5: Calculate distance and ETA
    const location = await this.getVehicleLocation(vehicle.id);
    /*
    const distance = location
      ? this.calculateDistance(
          requestedTrip.location.startLatitude,
          requestedTrip.location.startLongitude,
          location.lat,
          location.lng
        ) * 1000 // Convert to meters
      : 0;
    */

    const distance = requestedTrip.location.distance;
    const estimatedArrivalTime = distance > 0 
      ? (distance / 1000) / this.KILOMETERS_PER_HOUR * 60 
      : 0; // In minutes

    return {
      vehicle: {
        ...vehicle,
        // Add calculated available seats to vehicle object
        //seatingAvailability: availableSeats - requestedTrip.passengerCount,
        seatingAvailability: availableSeats,
        seatingCapacity: vehicle.seatingCapacity // Keep original capacity
      },
      isRecommended: false,
      recommendationReason: reason,
      distanceFromStart: distance,
      estimatedArrivalTime,
      isInConflict,
      conflictingTripData,
      // Internal properties for scoring
      _score: 0,
      _capacityDiff: availableSeats - requestedTrip.passengerCount,
      _availableSeats: availableSeats
    } as any;
  }

  /**
   * Get trips that overlap with requested time window for a specific vehicle
   */
  private async getOverlappingTrips(
    vehicleId: number,
    requestedWindow: { start: Date; end: Date }
  ): Promise<Trip[]> {
    return await this.tripRepo
      .createQueryBuilder("trip")
      .innerJoinAndSelect("trip.location", "location")
      .where("trip.vehicleId = :vehicleId", { vehicleId })
      .andWhere(
        `(
          (trip.status IN (:...statuses))
          AND
          (
            (trip.startDate || 'T' || trip.startTime)::timestamp < :windowEnd
            AND
            (trip.startDate || 'T' || trip.startTime)::timestamp + 
            (location.estimatedDuration * INTERVAL '1 minute') > :windowStart
          )
        )`,
        {
          statuses: [TripStatus.PENDING, TripStatus.APPROVED, TripStatus.READ, TripStatus.ONGOING,],
          windowStart: requestedWindow.start,
          windowEnd: requestedWindow.end
        }
      )
      .getMany();
  }

  /**
   * Check if a trip is ongoing at a specific time
   */
  private isOngoingAtTime(trip: Trip, time: Date): boolean {
    const tripStart = new Date(`${trip.startDate}T${trip.startTime}`);
    const tripDuration = (trip.location?.estimatedDuration || 60) * 60000; // Convert to milliseconds
    const tripEnd = new Date(tripStart.getTime() + tripDuration);
    
    return time >= tripStart && time <= tripEnd;
  }

  /**
   * Check if routes are nearby (within 10km of both start and end points)
   */
  private isRouteNearby(a: TripLocation, b: TripLocation): boolean {
    if (!a || !b) return false;
    
    const startDist = this.calculateDistance(
      a.startLatitude,
      a.startLongitude,
      b.startLatitude,
      b.startLongitude
    );

    const endDist = this.calculateDistance(
      a.endLatitude,
      a.endLongitude,
      b.endLatitude,
      b.endLongitude
    );

    return startDist <= this.SEARCH_RADIUS_KM && endDist <= this.SEARCH_RADIUS_KM;
  }

  /**
   * Check if times overlap within the time window
   */
  private isTimeWithinWindow(
    requestedTime: Date,
    existingTime: Date
  ): boolean {
    const diffMinutes = Math.abs(requestedTime.getTime() - existingTime.getTime()) / 60000;
    return diffMinutes <= this.TIME_WINDOW_MINUTES;
  }

  /**
   * Calculate trip window with buffer
   */
  private calculateTripWindow(trip: Trip): { start: Date; end: Date } {
    const start = new Date(`${trip.startDate}T${trip.startTime}`);
    
    // Subtract time window for start buffer
    const startWithBuffer = new Date(
      start.getTime() - this.TIME_WINDOW_MINUTES * 60000
    );
    
    // Calculate trip end time (start + duration + rest)
    const duration = (trip.location?.estimatedDuration || 60) * 60000;
    const rest = (trip.location?.estimatedRestingHours || 0) * 3600000;
    const end = new Date(start.getTime() + duration + rest);
    
    // Add time window for end buffer
    const endWithBuffer = new Date(
      end.getTime() + this.TIME_WINDOW_MINUTES * 60000
    );

    return { start: startWithBuffer, end: endWithBuffer };
  }

  /**
   * Scoring and selection logic (similar to your existing but improved)
   */
  private scoreAndSelectRecommended(
    vehicles: AvailableVehicleDto[],
    passengerCount: number
  ): AvailableVehicleDto[] {
    if (vehicles.length === 0) return vehicles;

    const scoredVehicles = vehicles.map(vehicle => {
      let score = 0;
      const vehicleData = vehicle as any;

      // Priority 1: Route conflicts (optimization opportunity)
      if (vehicle.isInConflict) {
        score += 1000;
        
        // Bonus for time proximity
        if (vehicle.conflictingTripData?.startTime) {
          const timeDiff = this.calculateTimeDiffScore(vehicle.conflictingTripData);
          score += timeDiff;
        }
      }

      // Priority 2: Seating capacity optimization
      // Exact match gets highest score
      if (vehicleData._capacityDiff === 0) {
        score += 500;
      } else if (vehicleData._capacityDiff > 0) {
        // Less waste = higher score
        score += Math.max(100, 300 - (vehicleData._capacityDiff * 10));
      }

      // Priority 3: Proximity (closer = higher score)
      if (vehicle.distanceFromStart <= 10000) { // Within 10km
        score += Math.max(50, 200 - (vehicle.distanceFromStart / 50));
      }

      // Priority 4: More available seats (better utilization)
      score += Math.min(50, vehicleData._availableSeats * 5);

      vehicleData._score = score;
      return vehicle;
    });

    // Find vehicle with highest score
    const recommendedVehicle = scoredVehicles.reduce((best, current) => {
      const bestScore = (best as any)._score || 0;
      const currentScore = (current as any)._score || 0;
      return currentScore > bestScore ? current : best;
    }, scoredVehicles[0]);

    // Mark only one vehicle as recommended
    return scoredVehicles.map(vehicle => ({
      ...vehicle,
      isRecommended: vehicle.vehicle.id === recommendedVehicle?.vehicle.id,
      recommendationReason: vehicle.vehicle.id === recommendedVehicle?.vehicle.id 
        ? this.getFinalRecommendationReason(vehicle, passengerCount)
        : vehicle.recommendationReason
    }));
  }

  /**
   * Sort vehicles (recommended first, then by seating efficiency)
   */
  private sortVehicles(vehicles: AvailableVehicleDto[]): AvailableVehicleDto[] {
    if (vehicles.length === 0) return vehicles;

    const recommendedVehicle = vehicles.find(v => v.isRecommended);
    const otherVehicles = vehicles.filter(v => !v.isRecommended);

    // Sort other vehicles by seating efficiency (least waste first)
    otherVehicles.sort((a, b) => {
      const aWaste = (a as any)._capacityDiff;
      const bWaste = (b as any)._capacityDiff;
      
      // Exact matches first
      if (aWaste === 0 && bWaste !== 0) return -1;
      if (bWaste === 0 && aWaste !== 0) return 1;
      
      // Then by least waste
      return aWaste - bWaste;
    });

    return recommendedVehicle 
      ? [recommendedVehicle, ...otherVehicles]
      : otherVehicles;
  }

  /**
   * Helper methods (keep your existing implementations)
   */

  private calculateTimeDiffScore(conflictingTripData: any): number {
    return Math.max(50, 200 - (this.TIME_WINDOW_MINUTES / 2));
  }

  private getFinalRecommendationReason(
    vehicle: AvailableVehicleDto, 
    passengerCount: number
  ): string {
    if (vehicle.isInConflict) {
      return "Recommended: Optimal schedule utilization (already in area)";
    }
    
    const vehicleData = vehicle as any;
    if (vehicleData._capacityDiff === 0) {
      return "Recommended: Perfect seating capacity match";
    } else if (vehicleData._capacityDiff > 0) {
      return `Recommended: Efficient capacity utilization (+${vehicleData._capacityDiff} seats available)`;
    }
    
    return "Recommended: Best available option";
  }

  private buildConflictingTripData(trip: Trip) {
    if (!trip.location) return null;
    
    return {
      tripId: trip.id,
      hasTimeExceeded: false,
      startTime: trip.startTime,
      startDate: trip.startDate,
      startLocation: {
        address: trip.location.startAddress,
        latitude: trip.location.startLatitude,
        longitude: trip.location.startLongitude
      },
      endLocation: {
        address: trip.location.endAddress,
        latitude: trip.location.endLatitude,
        longitude: trip.location.endLongitude
      },
      passengerCount: trip.passengerCount
    };
  }

  private async fetchVehicles(search?: string, page = 0, pageSize = 10) {
    const qb = this.vehicleRepo
      .createQueryBuilder("vehicle")
      .leftJoinAndSelect("vehicle.vehicleType", "vehicleType")
      .leftJoinAndSelect("vehicle.assignedDriverPrimary", "assignedDriverPrimary")
      .where("vehicle.isActive = true");

    if (search) {
      qb.andWhere(
        new Brackets(query => {
          query.where("vehicle.model ILIKE :search", { search: `%${search}%` })
            .orWhere("vehicle.regNo ILIKE :search", { search: `%${search}%` })
            .orWhere("vehicleType.vehicleType ILIKE :search", { 
              search: `%${search}%` 
            })
            .orWhere("CAST(vehicle.seatingCapacity AS TEXT) ILIKE :search", {
              search: `%${search}%`
            });
        })
      );
    }

    const total = await qb.getCount();
    //const vehicles = await qb.skip(page * pageSize).take(pageSize).getMany();
    const vehicles = await qb.getMany();

    return { vehicles, total };
  }

  private async getVehicleLocation(vehicleId: number): Promise<{ lat: number; lng: number } | null> {
    // TODO: Implement actual location tracking
    // For now, return a mock location
    return {
      lat: 6.9 + Math.random() * 0.05,
      lng: 79.88 + Math.random() * 0.05
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private toRad(value: number): number {
    return value * Math.PI / 180;
  }

}


/*

get all vehicles

for loop vehicles:
  if this vehicle start any trip in current trip start date&time(befor after 1h ok):
    if matching route(10 km near ok):
      cal >> availabale seats = this vehicle seatingCapacity - this date&time perod all tips passenger count of this vehicle
      if available seat enough for current trip passenger count:
        include this vehicle
      else: 
        exclude this vehicle
    else:
      exclude this vehicle
      
  else:
    check any ongoing trip have in this date&time >> isOngoing = current trip start date&time < any trip of this vehicle end date&time(start date&time + trip.location.estimateDuration)
    if isOngoing:
      exclude this vehicle
    else:
      include this vehicle

*/