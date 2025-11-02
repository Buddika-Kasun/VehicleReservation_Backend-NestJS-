import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class LoginDto {

  @ApiProperty({
    description: 'Unique username for the user',
    example: 'john_doe'
  })
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Password (min 6 characters)',
    minLength: 6,
    example: 'password123'
  })
  @IsNotEmpty()
  password: string;
  
}
