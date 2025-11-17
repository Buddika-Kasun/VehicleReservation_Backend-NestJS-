
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from 'src/database/entities/user.entity';

export class ApproveUserDto {
  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.EMPLOYEE
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    description: 'Department',
    example: 'HR'
  })
  @IsString()
  departmentId: string;
}
