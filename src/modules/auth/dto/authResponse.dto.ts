// src/modules/auth/dto/login-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "src/database/entities/user.entity";

export class UserData {
  @ApiProperty({ 
    example: 6,
    description: 'Unique identifier for the user'
  })
  id: number;

  @ApiProperty({ 
    example: 'john_doe',
    description: 'Unique username for login'
  })
  username: string;

  @ApiProperty({ 
    example: 'john doe',
    description: 'Display name for the user'
  })
  displayname: string;

  @ApiProperty({ 
    example: null,
    nullable: true,
    description: 'URL or path to user profile picture'
  })
  profilePicture: string | null;

  @ApiProperty({ 
    example: 'john@example.com',
    description: 'User email address'
  })
  email: string;

  @ApiProperty({ 
    example: '+1234567890',
    description: 'User phone number'
  })
  phone: string;

  @ApiProperty({ 
    example: 'employee',
    description: 'User role in the system',
    enum: UserRole
  })
  role: string;

  @ApiProperty({ 
    example: 0,
    description: 'Authentication level for security purposes'
  })
  authenticationLevel: number;

  @ApiProperty({ 
    example: true,
    description: 'Whether the user account is active'
  })
  isActive: boolean;

  @ApiProperty({ 
    example: true,
    description: 'Whether the user account is approved by admin'
  })
  isApproved: boolean;

  @ApiProperty({ 
    example: '2025-11-03T10:48:48.598Z',
    description: 'Timestamp when user account was created'
  })
  createdAt: string;

  @ApiProperty({ 
    example: '2025-11-03T10:48:48.598Z',
    description: 'Timestamp when user account was last updated'
  })
  updatedAt: string;
}

export class LoginData {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYsImVtYWlsIjoiYnVkZGlrYUBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsInVzZXJuYW1lIjoiYnVkZGlrYSIsImlhdCI6MTc2MjE2NzIyMSwiZXhwIjoxNzYyMjUzNjIxfQ.R_GqgxsWEnUDjtshBnYp0gdZu1s4rxFOpszSjMWbB88',
    description: 'JWT access token for authenticating API requests'
  })
  accessToken: string;

  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYsImVtYWlsIjoiYnVkZGlrYUBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsInVzZXJuYW1lIjoiYnVkZGlrYSIsImlhdCI6MTc2MjE2NzIyMSwiZXhwIjoxNzYyNzcyMDIxfQ.sW3xuC4TJ0ly7vf6I79mG7VxFNYydv-Vv8hUn4mD9m8',
    description: 'JWT refresh token for obtaining new access tokens'
  })
  refreshToken: string;

  @ApiProperty({ 
    type: UserData,
    description: 'Authenticated user information'
  })
  user: UserData;
}

export class LoginResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates if the request was successful'
  })
  success: boolean;

  @ApiProperty({ 
    example: 'Login successful',
    description: 'Human-readable message describing the result'
  })
  message: string;

  @ApiProperty({ 
    example: 200,
    description: 'HTTP status code of the response'
  })
  statusCode: number;

  @ApiProperty({ 
    example: '2025-11-03T10:53:41.944Z',
    description: 'Timestamp when the response was generated'
  })
  timestamp: string;

  @ApiProperty({ 
    type: LoginData,
    description: 'Login response data containing tokens and user information'
  })
  data?: LoginData;
}


export class RegisterUserData {
  @ApiProperty({ 
    type: UserData,
    description: 'Registered user information'
  })
  user: UserData;
}

export class RegisterResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates if the registration request was successful'
  })
  success: boolean;

  @ApiProperty({ 
    example: 'User registered successfully. Please wait for admin approval.',
    description: 'Human-readable message describing the registration result'
  })
  message: string;

  @ApiProperty({ 
    example: 201,
    description: 'HTTP status code of the response'
  })
  statusCode: number;

  @ApiProperty({ 
    example: '2025-11-03T10:48:48.608Z',
    description: 'Timestamp when the response was generated'
  })
  timestamp: string;

  @ApiProperty({ 
    type: RegisterUserData,
    description: 'Registration response data containing user information'
  })
  data?: RegisterUserData;
}


export class LogoutResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates if the request was successful'
  })
  success: boolean;

  @ApiProperty({ 
    example: 'Logged out successfully.',
    description: 'Human-readable message describing the result'
  })
  message: string;

  @ApiProperty({ 
    example: 200,
    description: 'HTTP status code of the response'
  })
  statusCode: number;

  @ApiProperty({ 
    example: '2025-11-03T10:53:41.944Z',
    description: 'Timestamp when the response was generated'
  })
  timestamp: string;
}