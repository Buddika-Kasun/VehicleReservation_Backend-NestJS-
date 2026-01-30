import { IsEnum, IsNumber, IsString, IsOptional, IsBoolean, IsDateString, IsArray, ValidateNested, IsObject, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { PassengerType, RepetitionType, TripStatus, TripType } from 'src/infra/database/entities/trip.entity';
import { ApiProperty } from '@nestjs/swagger';

export class SelectedGroupUserDto {
  @IsNumber()
  id: number;

  @IsString()
  displayName: string;

  @IsString()
  contactNo: string;
}

export class SelectedOtherDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  displayName: string;

  @IsString()
  contactNo: string;

  @IsOptional()
  @IsBoolean()
  isOther?: boolean;
}

export class LocationDataDto {
  @IsObject()
  startLocation: {
    address: string;
    coordinates: {
      coordinates: number[];
    };
  };

  @IsObject()
  endLocation: {
    address: string;
    coordinates: {
      coordinates: number[];
    };
  };

  @IsNumber()
  totalDistance: number;

  @IsNumber()
  totalDuration: number;

  /*
  @IsObject()
  @IsOptional()
  routeData?: {
    routeSegments: Array<{
      color?: number;
      points: [number, number][]; // Array of [longitude, latitude] pairs
      strokeWidth?: number;
      [key: string]: any; // For any other properties
    }>;
  };
  */
  @IsOptional()
  routeData?: any;

  //@IsArray()
  //@IsOptional()
  //intermediateStops: any[];

  //@IsArray()
  @IsOptional()
  intermediateStops?: any;


  @IsNumber()
  totalStops: number;
}

export class ScheduleDataDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  validTillDate?: string;

  @IsString()
  startTime: string;

  @IsEnum(RepetitionType)
  repetition: RepetitionType;

  @IsBoolean()
  @IsOptional()
  includeWeekends?: boolean;

  @IsNumber()
  @IsOptional()
  repeatAfterDays?: number;
}

export class PassengerDataDto {
  @IsEnum(PassengerType)
  passengerType: PassengerType;

  @IsObject()
  @IsOptional()
  selectedIndividual?: {
    id: number;
    displayName: string;
    contactNo: string;
  };

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SelectedGroupUserDto)
  selectedGroupUsers?: SelectedGroupUserDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SelectedOtherDto)
  selectedOthers?: SelectedOtherDto[];

  @IsBoolean()
  @IsOptional()
  includeMeInGroup?: boolean;

  @IsObject()
  @IsOptional()
  currentUser?: {
    id: number;
    displayName: string;
    contactNo: string;
  };
}

export class TripTypeDataDto {
  @IsEnum(TripType)
  tripType: TripType;

  @IsString()
  @IsOptional()
  fixedRate?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsNumber()
  departmentId?: number;
}

export class CreateTripDto {
  @ValidateNested()
  @Type(() => LocationDataDto)
  locationData: LocationDataDto;

  @ValidateNested()
  @Type(() => ScheduleDataDto)
  scheduleData: ScheduleDataDto;

  @ValidateNested()
  @Type(() => PassengerDataDto)
  passengerData: PassengerDataDto;

  @ValidateNested()
  @Type(() => TripTypeDataDto)
  tripTypeData: TripTypeDataDto;

  @IsNumber()
  @IsOptional()
  vehicleId?: number;

  @IsNumber()
  @IsOptional()
  conflictingTripId?: number;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsString()
  @IsOptional()
  specialRemarks?: string;

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus = TripStatus.PENDING;
}

export class AvailableVehiclesRequestDto {
  @ValidateNested()
  @Type(() => LocationDataDto)
  locationData: LocationDataDto;

  @ValidateNested()
  @Type(() => ScheduleDataDto)
  scheduleData: ScheduleDataDto;

  @ValidateNested()
  @Type(() => PassengerDataDto)
  passengerData: PassengerDataDto;

  @ValidateNested()
  @Type(() => TripTypeDataDto)
  @IsOptional()
  tripTypeData?: TripTypeDataDto; // Optional for vehicle availability check
}

export class ReviewAvailableVehiclesRequest {
  @Type(() => String)
  tripId: string;

  @Type(() => Number)
  page: number;

  @Type(() => Number)
  pageSize: number;

  @Type(() => String)
  search?: string;
}

export class AssignVehicleToTripDto {
  @ApiProperty({ 
    description: 'ID of the trip to assign vehicle to',
    example: 188 
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  tripId: number;

  @ApiProperty({ 
    description: 'ID of the vehicle to assign',
    example: 9 
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  vehicleId: number;
}