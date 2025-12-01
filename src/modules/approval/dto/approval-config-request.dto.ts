import { IsInt, IsOptional, IsBoolean, IsString } from 'class-validator';

export class CreateApprovalConfigDto {
  @IsOptional()
  @IsInt()
  distanceLimit?: number;

  @IsOptional()
  @IsInt()
  secondaryUserId?: number;

  @IsOptional()
  @IsInt()
  safetyUserId?: number;

  @IsOptional()
  @IsString()
  restrictedFrom?: string;

  @IsOptional()
  @IsString()
  restrictedTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateApprovalConfigDto {
  @IsOptional()
  @IsInt()
  distanceLimit?: number;

  @IsOptional()
  @IsInt()
  secondaryUserId?: number;

  @IsOptional()
  @IsInt()
  safetyUserId?: number;

  @IsOptional()
  @IsString()
  restrictedFrom?: string;

  @IsOptional()
  @IsString()
  restrictedTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
