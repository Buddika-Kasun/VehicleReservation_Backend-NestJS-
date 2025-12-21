import { RepetitionType, Trip, TripStatus } from 'src/infra/database/entities/trip.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';

export class TripResponseDto {
  id: number;
  status: TripStatus;
  startDate: Date;
  startTime: string;
  passengerCount: number;
  purpose?: string;
  vehicle?: Vehicle;
  createdAt: Date;
  driverName?: string;
  vehicleRegNo?: string;
  vehicleModel?: string;
  driverPhone?: string;
  cost?: number;
  conflictingTrips?: TripResponseDto[];

  constructor(trip: Trip) {
    this.id = trip.id;
    this.status = trip.status;
    this.startDate = trip.startDate;
    this.startTime = trip.startTime;
    this.passengerCount = trip.passengerCount;
    this.purpose = trip.purpose;
    this.vehicle = trip.vehicle;
    this.createdAt = trip.createdAt;
    
    // Map vehicle properties to top level for frontend compatibility
    if (trip.vehicle) {
      this.driverName = trip.vehicle.assignedDriverPrimary.displayname;
      this.vehicleRegNo = trip.vehicle.regNo;
      this.vehicleModel = trip.vehicle.model;
      this.driverPhone = trip.vehicle.assignedDriverPrimary.phone;
    }
    
    // Add cost if available (you might need to calculate this)
    this.cost = this.calculateTripCost(trip);

    if (trip.conflictingTrips) {
      this.conflictingTrips = trip.conflictingTrips.map(t => new TripResponseDto(t));
    }
  }

  private calculateTripCost(trip: Trip): number {
    // Implement your cost calculation logic here
    // This is just a placeholder - adjust based on your business logic
    return 0; // or calculate based on distance, vehicle type, etc.
  }
}

export class AvailableVehicleDto {
  vehicle: Vehicle;
  isRecommended: boolean;
  recommendationReason: string;
  distanceFromStart: number; // in meters
  estimatedArrivalTime: number; // in minutes
  isInConflict: boolean;
  conflictingTripData?: {
    tripId: number;
    hasTimeExceeded: boolean;
    //status: TripStatus;
    //startDate: Date;
    startTime: string;
    //passengerCount: number;
    //purpose?: string;
    //repetition: RepetitionType;
    
    startLocation: {
      address: string;
      latitude: number;
      longitude: number;
    };
    
    endLocation: {
      address: string;
      latitude: number;
      longitude: number;
    };
    
    /*intermediateStops: Array<{
      latitude: number;
      longitude: number;
      address: string;
      order: number;
    }>;*/
    
    //totalStops: number;
    //estimatedDuration?: number;
    //distance?: number;
    //detailedLocationData?: any; // Optional detailed location data
  };
}

export class AvailableVehiclesResponseDto {
  //recommendedVehicles: AvailableVehicleDto[];
  allVehicles: AvailableVehicleDto[];
  //conflictingTrips: any[];
  //canBookNew: boolean;
}