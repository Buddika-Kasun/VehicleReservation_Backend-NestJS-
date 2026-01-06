import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Trip, TripStatus } from "src/infra/database/entities/trip.entity";
import { Vehicle } from "src/infra/database/entities/vehicle.entity";
import { Brackets, In, Repository } from "typeorm";
import { ReviewAvailableVehiclesRequest } from "./dto/create-trip.dto";
import { AvailableVehicleDto } from "./dto/trip-response.dto";
import { ResponseService } from "src/common/services/response.service";
import { TripLocation } from "src/infra/database/entities/trip-location.entity";

@Injectable()
export class VehicleRecommendService {
  private readonly CONFLICT_TIME_WINDOW = 60; // 1 hour in minutes
  private readonly SEARCH_RADIUS = 10; 

  constructor(
      @InjectRepository(Trip)
      private readonly tripRepo: Repository<Trip>,
      @InjectRepository(Vehicle)
      private readonly vehicleRepo: Repository<Vehicle>,
      private readonly responseService: ResponseService,
  ) {}

  async getReviewAvailableVehicles(request: ReviewAvailableVehiclesRequest): Promise<{
    allVehicles: AvailableVehicleDto[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const { tripId, page = 0, pageSize = 10, search } = request;
    
    // Get the existing trip
    const existingTrip = await this.tripRepo.findOne({
      where: { id: parseInt(tripId) },
      relations: [
        'location',
        'conflictingTrips',
        'conflictingTrips.location',
        'conflictingTrips.vehicle'
      ]
    });

    if (!existingTrip) {
      throw new NotFoundException(this.responseService.error('Trip not found', 404));
    }

    // Calculate passenger count from existing trip
    const passengerCount = existingTrip.passengerCount;

    // Extract schedule data from existing trip
    const scheduleData = {
      startDate: existingTrip.startDate,
      startTime: existingTrip.startTime,
      repetition: existingTrip.repetition,
      validTillDate: existingTrip.validTillDate,
      includeWeekends: existingTrip.includeWeekends,
      repeatAfterDays: existingTrip.repeatAfterDays
    };

    // Extract location data from existing trip
    const locationData = {
      startLocation: {
        address: existingTrip.location.startAddress,
        coordinates: {
          coordinates: [existingTrip.location.startLongitude, existingTrip.location.startLatitude]
        }
      },
      endLocation: {
        address: existingTrip.location.endAddress,
        coordinates: {
          coordinates: [existingTrip.location.endLongitude, existingTrip.location.endLatitude]
        }
      },
      intermediateStops: existingTrip.location.intermediateStops,
      totalStops: existingTrip.location.totalStops,
      routeData: existingTrip.location.locationData
    };

    // Get trips at same time (for ALL vehicle availability check)
    const tripsAtSameTime = await this.findAllTripsAtSameTime(scheduleData);
    
    // Get REAL conflicting trips (same time AND route proximity)
    const conflictingTrips = await this.findConflictingTrips(
      locationData,
      scheduleData,
      passengerCount
    );

    // Build query for all active vehicles with search
    const queryBuilder = this.vehicleRepo
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.vehicleType', 'vehicleType')
      .where('vehicle.isActive = :isActive', { isActive: true });

    // Apply search filter if provided
    if (search) {
      queryBuilder.andWhere(
        new Brackets(qb => {
          qb.where('vehicle.model ILIKE :search', { search: `%${search}%` })
            .orWhere('vehicle.regNo ILIKE :search', { search: `%${search}%` })
            .orWhere('vehicle.vehicleType.vehicleType ILIKE :search', { search: `%${search}%` })
            .orWhere('CAST(vehicle.seatingCapacity AS TEXT) ILIKE :search', { search: `%${search}%` });
        })
      );
    }

    // Get total count for pagination
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = page * pageSize;
    const allVehicles = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getMany();

    console.log(`Total vehicles: ${total}, Current page: ${page}, Page size: ${pageSize}`);
    console.log(`Vehicles with trips at same time: ${tripsAtSameTime.size}`);
    console.log(`Vehicles with REAL route conflicts: ${conflictingTrips.length}`);

    const activeTripsByVehicle = await this.findAllActiveTrips();

    // Filter vehicles based on your new logic
    const availableVehicles = allVehicles.filter(vehicle => {
      // Rule 1: seating capacity
      if (vehicle.seatingAvailability < passengerCount) {
        console.log(`Vehicle ${vehicle.id} excluded: Insufficient capacity (${vehicle.seatingAvailability} < ${passengerCount})`);
        return false;
      }

      const tripAtSameTime = tripsAtSameTime.get(vehicle.id);
      const isRealConflict = conflictingTrips.some(
        trip => trip.vehicle?.id === vehicle.id
      );

      // CASE 1: Vehicle has a trip at same time AND same route (REAL conflict)
      if (tripAtSameTime && isRealConflict) {
        // Check if the conflicting trip's end time has exceeded
        const conflictingTrip = tripAtSameTime;
        const hasTimeExceeded = this.hasTripTimeExceeded(conflictingTrip);
        
        if (hasTimeExceeded) {
          console.log(`Vehicle ${vehicle.id} INCLUDED: Has conflicting trip but time has exceeded`);
          return true;
        } else {
          console.log(`Vehicle ${vehicle.id} INCLUDED (Recommended): Has conflicting trip at same time + same route`);
          return true; // This is the recommended case
        }
      }

      // CASE 2: Vehicle has a trip at same time but DIFFERENT route
      if (tripAtSameTime && !isRealConflict) {
        console.log(`Vehicle ${vehicle.id} EXCLUDED: Has trip at same time but different route`);
        return false;
      }

      // CASE 3: Vehicle has active trips (not completed/finished)
      const activeTrips = activeTripsByVehicle.get(vehicle.id);
      if (activeTrips && activeTrips.length > 0) {
        // Check if any active trip's time has exceeded
        const hasAnyActiveTripTimeExceeded = activeTrips.some(trip => 
          this.hasTripTimeExceeded(trip)
        );
        
        if (!hasAnyActiveTripTimeExceeded) {
          console.log(`Vehicle ${vehicle.id} EXCLUDED: Has active trip that hasn't completed`);
          return false;
        }
        // If all active trips have exceeded time, vehicle is available
        console.log(`Vehicle ${vehicle.id} INCLUDED: All active trips have completed`);
      }

      // CASE 4: Vehicle has no trips or only completed trips
      console.log(`Vehicle ${vehicle.id} INCLUDED: No conflicting/active trips`);
      return true;
    });

    console.log(`Available vehicles after filtering: ${availableVehicles.length}`);

    // Get vehicle locations
    const vehicleLocations = await this.getVehicleLocations();

    // Analyze and recommend vehicles with your specific logic
    const analyzedVehicles = await this.analyzeAndRecommendVehiclesForReview(
      availableVehicles,
      vehicleLocations,
      locationData,
      scheduleData,
      conflictingTrips,
      tripsAtSameTime,
      existingTrip
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages - 1;
    const hasPrevious = page > 0;

    return {
      allVehicles: analyzedVehicles,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrevious
      }
    };
  }

  // Fix the type in analyzeAndRecommendVehiclesForReview method:
  private async analyzeAndRecommendVehiclesForReview(
    vehicles: Vehicle[],
    vehicleLocations: Map<number, { lat: number; lng: number; lastUpdated: Date }>,
    locationData: any,
    scheduleData: any,
    conflictingTrips: Trip[],
    tripsAtSameTime: Map<number, Trip>,
    existingTrip: Trip
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
      
      if (isInConflict && conflictingTrip) {
        // Check if conflicting trip's time has exceeded
        const hasTimeExceeded = this.hasTripTimeExceeded(conflictingTrip);
        
        if (!hasTimeExceeded) {
          // REAL CONFLICT VEHICLE: Already scheduled for nearby route at same time
          isRecommended = true;
          recommendationReason = 'Already scheduled for nearby route at same time';
          
          conflictingTripData = {
            tripId: conflictingTrip.id,
            startTime: conflictingTrip.startTime,
            startDate: conflictingTrip.startDate,
            estimatedEndTime: this.calculateEstimatedEndTime(conflictingTrip),
            hasTimeExceeded: false, // This is important!
            startLocation: {
              address: conflictingTrip.location?.startAddress,
              latitude: conflictingTrip.location?.startLatitude,
              longitude: conflictingTrip.location?.startLongitude
            },
            endLocation: {
              address: conflictingTrip.location?.endAddress,
              latitude: conflictingTrip.location?.endLatitude,
              longitude: conflictingTrip.location?.endLongitude
            },
          };
        } else {
          // Conflict trip has completed, vehicle is available
          isRecommended = false;
          recommendationReason = 'Previously scheduled trip has completed';
          
          conflictingTripData = {
            tripId: conflictingTrip.id,
            startTime: conflictingTrip.startTime,
            startDate: conflictingTrip.startDate,
            estimatedEndTime: this.calculateEstimatedEndTime(conflictingTrip),
            hasTimeExceeded: true, // This is important!
            startLocation: {
              address: conflictingTrip.location?.startAddress,
              latitude: conflictingTrip.location?.startLatitude,
              longitude: conflictingTrip.location?.startLongitude
            },
            endLocation: {
              address: conflictingTrip.location?.endAddress,
              latitude: conflictingTrip.location?.endLatitude,
              longitude: conflictingTrip.location?.endLongitude
            },
          };
        }
      } else {
        // Check if vehicle has ANY trip at same time (even if route not nearby)
        const tripAtSameTime = tripsAtSameTime.get(vehicle.id);
        if (tripAtSameTime) {
          // Vehicle is booked at same time but route is NOT nearby
          // Check if that trip's time has exceeded
          const hasTimeExceeded = this.hasTripTimeExceeded(tripAtSameTime);
          
          if (hasTimeExceeded) {
            isRecommended = false;
            recommendationReason = 'Previous trip at same time has completed';
          } else {
            isRecommended = false;
            recommendationReason = 'Booked at same time (different route)';
          }
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
      } as AvailableVehicleDto);
    }

    // Sort with priority: Recommended vehicles with real conflicts first, then recommended, then others
    return result.sort((a, b) => {
      // Both have real conflicts
      if (a.isInConflict && b.isInConflict) {
        if (a.conflictingTripData?.hasTimeExceeded === false && b.conflictingTripData?.hasTimeExceeded === true) {
          return -1; // a first (active conflict)
        }
        if (a.conflictingTripData?.hasTimeExceeded === true && b.conflictingTripData?.hasTimeExceeded === false) {
          return 1; // b first
        }
      }
      
      // Only a has real conflict
      if (a.isInConflict && !b.isInConflict) {
        return a.conflictingTripData?.hasTimeExceeded === false ? -1 : 1;
      }
      
      // Only b has real conflict
      if (!a.isInConflict && b.isInConflict) {
        return b.conflictingTripData?.hasTimeExceeded === false ? 1 : -1;
      }
      
      // Sort by recommendation status
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      
      // Finally sort by distance
      return a.distanceFromStart - b.distanceFromStart;
    });
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
          // Skip if vehicle doesn't have enough capacity
          if (trip.vehicle.seatingAvailability < passengerCount) {
            continue;
          }
    
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

    private hasTripTimeExceeded(trip: Trip): boolean {
        // Calculate trip end time = start time + (estimated duration * 2 + resting hours)
        const startDateTime = new Date(`${trip.startDate}T${trip.startTime}`);
        
        // Get estimated duration in minutes from location
        const estimatedDuration = trip.location?.estimatedDuration || 60; // Default 60 minutes if not available
        const estimatedRestingHours = trip.location?.estimatedRestingHours || 0;
        
        // Calculate total trip time in minutes (estimatedDuration * 2 + resting hours converted to minutes)
        const totalTripMinutes = (estimatedDuration * 2) + estimatedRestingHours;
        
        // Calculate end time
        const endDateTime = new Date(startDateTime.getTime() + totalTripMinutes * 60000);
        
        // Check if current time is after end time
        const now = new Date();
        return now > endDateTime;
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

  private calculateEstimatedEndTime(trip: Trip): string {
      if (!trip.location) return 'Unknown';
      
      const startDateTime = new Date(`${trip.startDate}T${trip.startTime}`);
      const estimatedDuration = trip.location.estimatedDuration || 60;
      const estimatedRestingHours = trip.location.estimatedRestingHours || 0;
      
      // Calculate total trip time in minutes
      const totalTripMinutes = (estimatedDuration * 2) + estimatedRestingHours;
      
      // Calculate end time
      const endDateTime = new Date(startDateTime.getTime() + totalTripMinutes * 60000);
      
      // Format to HH:MM
      return endDateTime.toTimeString().split(' ')[0].substring(0, 5);
    }

    private isVehicleSuitableForTime(vehicle: Vehicle, scheduleData: any): boolean {
      return true;
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

  // Check if new trip locations are near existing trip's route
    private areTripLocationsNearby(newStartLat: number, newStartLng: number, newEndLat: number, newEndLng: number, existingTripLocation: TripLocation): boolean {
      // Check if EITHER start OR end location of new trip is near existing trip's route
      const startNearRoute = this.isPointNearRoute(newStartLat, newStartLng, existingTripLocation);
      const endNearRoute = this.isPointNearRoute(newEndLat, newEndLng, existingTripLocation);
      
      return startNearRoute && endNearRoute;
    }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
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

}