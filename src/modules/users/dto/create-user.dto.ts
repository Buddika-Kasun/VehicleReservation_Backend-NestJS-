
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from 'src/database/entities/user.entity';

export class CreateUserDto {
  @ApiProperty({
    description: 'Unique username for the user',
    example: 'john_doe'
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Display name for the user',
    example: 'john doe'
  })
  @IsString()
  @IsNotEmpty()
  displayname: string;

  @ApiPropertyOptional({
    description: 'Email address (optional for drivers and security)',
    example: 'john@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890'
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.EMPLOYEE
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    description: 'Password (min 6 characters)',
    minLength: 6,
    example: 'password123'
  })
  @IsString()
  @MinLength(6)
  password: string;
}
