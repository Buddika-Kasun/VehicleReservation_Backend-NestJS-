import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateUpdateDto {
  @ApiProperty()
  @IsString()
  version: string;

  @ApiProperty()
  @IsString()
  buildNumber: string;

  @ApiProperty({ enum: ['android', 'ios', 'web', 'both'] })
  @IsEnum(['android', 'ios', 'web', 'both'])
  platform: 'android' | 'ios' | 'web' | 'both';

  @ApiProperty()
  @IsString()
  updateTitle: string;

  @ApiProperty()
  @IsString()
  updateDescription: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value);
  })
  @IsBoolean()
  isMandatory?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value);
  })
  @IsBoolean()
  isSilent?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value);
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  redirectToStore?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  minSupportedVersion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  releaseNotes?: string;
}