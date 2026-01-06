import { Type } from 'class-transformer';
import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class ReverseGeocodeDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lon: number;
}