import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckUpdateDto {
  @ApiProperty()
  @IsString()
  currentVersion: string;

  @ApiProperty()
  @IsString()
  currentBuild: string;

  @ApiProperty({ enum: ['android', 'ios', 'web'] })
  @IsString()
  platform: 'android' | 'ios' | 'web';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  osVersion?: string;
}