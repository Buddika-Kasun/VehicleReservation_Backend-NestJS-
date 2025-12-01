import { IsArray, IsNotEmpty, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class CoordinateDto {
  @IsNotEmpty()
  latitude: number;

  @IsNotEmpty()
  longitude: number;
}

export enum VehicleType {
  CAR = 'car',
  TRUCK = 'truck',
  BIKE = 'bike',
}

export class CalculateRouteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinateDto)
  points: CoordinateDto[];

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType = VehicleType.CAR;
}