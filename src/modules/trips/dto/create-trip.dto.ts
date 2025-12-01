import { IsEnum, IsNumber, IsString, IsOptional, IsBoolean, IsDateString, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { PassengerType, RepetitionType, TripStatus } from 'src/database/entities/trip.entity';

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

  @IsArray()
  @IsOptional()
  intermediateStops: any[];

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

  @IsNumber()
  @IsOptional()
  selectedIndividual?: number;

  @IsArray()
  @IsOptional()
  selectedGroupUsers?: number[];

  @IsArray()
  @IsOptional()
  selectedOthers?: Array<{
    displayName: string;
    contactNo: string;
  }>;

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

  @IsNumber()
  @IsOptional()
  vehicleId?: number;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsString()
  @IsOptional()
  specialRemarks?: string;

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;
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
}