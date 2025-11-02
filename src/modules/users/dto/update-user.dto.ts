import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends CreateUserDto {
  @ApiPropertyOptional({ description: 'Whether user is approved' })
  @IsBoolean()
  @IsOptional()
  isApproved?: boolean; 

  @ApiPropertyOptional({ description: 'Whether user is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
