import { IsString, IsOptional, MinLength } from 'class-validator';

export class LocationSearchDto {
  @IsString()
  @MinLength(2)
  q: string;

  @IsOptional()
  @IsString()
  countrycodes?: string = 'lk'; // Default to Sri Lanka
}