import { Body, Controller, Post, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { ApiBearerAuth, ApiInternalServerErrorResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { User } from 'src/database/entities/user.entity';
import { LoginResponseDto, LogoutResponseDto, RegisterResponseDto } from './dto/authResponse.dto';
import { ErrorResponseDto } from 'src/common/dto/errorResponse.dto';

@Controller('auth')
@ApiTags('Auth API')
@ApiInternalServerErrorResponse({ 
  description: 'Internal server error.',
  type: ErrorResponseDto,
  example: ErrorResponseDto.example('Internal server error.', HttpStatus.INTERNAL_SERVER_ERROR)
})
export class AuthController {
  constructor(private authService: AuthService, private usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register user' })
  @ApiResponse({ 
    status: 400, 
    description: 'The following fields are required: {missingFields}. or The following fields are already registered: {Fields}.',
    type: ErrorResponseDto,
    example: ErrorResponseDto.example('The following fields are required: username, password.', HttpStatus.BAD_REQUEST)
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully. Please wait for admin approval.',
    type: RegisterResponseDto,
  })
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    return await this.usersService.createUser(registerDto as any);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ 
    status: 401, 
    description: 
    `
      Your account is pending approval, Please contact administrator.
      Invalid username or password.
    `, 
    type: ErrorResponseDto,
    example: ErrorResponseDto.example('Your account is pending approval, Please contact administrator.', HttpStatus.UNAUTHORIZED)
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful.',
    type: LoginResponseDto,
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ 
    status: 401, 
    description: 
    `
      Refresh token is required.
      User not found.
      Refresh token expired. 
      Invalid refresh token. 
      Token verification failed. 
    ` 
  })
  @ApiResponse({ 
    status: 200, 
    description: 
    `
      Returns new access and refresh tokens.
    ` 
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and revoke refresh token' })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: 'Logged out successfully.',
    type: LogoutResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  async logout(@GetUser() user: User): Promise<LogoutResponseDto> {
    return await this.authService.revokeRefreshToken(user.id);
  }

}
