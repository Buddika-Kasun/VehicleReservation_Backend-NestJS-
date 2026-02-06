import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFileDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;

  @ApiProperty()
  @IsString()
  version: string;

  @ApiProperty()
  @IsString()
  buildNumber: string;

  @ApiProperty({ enum: ['android', 'ios', 'web', 'both'] })
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  updateTitle: string;

  @ApiProperty()
  @IsString()
  updateDescription: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isSilent?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  redirectToStore?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  minSupportedVersion?: string;
}