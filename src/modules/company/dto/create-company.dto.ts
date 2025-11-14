
import { IsString, IsOptional, IsBoolean, Length, IsPhoneNumber, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'ABC Corporation',
    maxLength: 200
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Company address',
    example: '123 Main St, City, Country',
    maxLength: 300
  })
  @IsString()
  @IsOptional()
  @Length(0, 300)
  address?: string;

  @ApiPropertyOptional({
    description: 'Email domain for company emails',
    example: 'company.com',
    maxLength: 100
  })
  @IsString()
  @IsOptional()
  @Length(0, 100)
  emailDomain?: string;

  @ApiPropertyOptional({
    description: 'Contact number',
    example: '+1234567890',
    maxLength: 20
  })
  @IsString()
  @IsOptional()
  @Length(0, 20)
  contactNumber?: string;

  /*
  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'contact@company.com'
  })
  @IsEmail()
  @IsOptional()
  contactEmail?: string;
  */

  @ApiPropertyOptional({
    description: 'Is the company active?',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

}