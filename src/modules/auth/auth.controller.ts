import { Body, Controller, Post, UseGuards, Request, HttpStatus, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { ApiBearerAuth, ApiHeader, ApiInternalServerErrorResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { User } from 'src/infra/database/entities/user.entity';
import { LoginResponseDto, LogoutResponseDto, RegisterResponseDto } from './dto/authResponse.dto';
import { ErrorResponseDto } from 'src/common/dto/errorResponse.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthService } from './services/auth.service';

@Controller('auth')
@ApiTags('Auth API')
@ApiInternalServerErrorResponse({
  description: 'Internal server error.',
  type: ErrorResponseDto,
  example: ErrorResponseDto.example('Internal server error.', HttpStatus.INTERNAL_SERVER_ERROR),
})
export class AuthController {
  constructor(private authService: AuthService, private usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register user' })
  @ApiResponse({
    status: 400,
    description:
      'The following fields are required: {missingFields}. or The following fields are already registered: {Fields}.',
    type: ErrorResponseDto,
    example: ErrorResponseDto.example(
      'The following fields are required: username, password.',
      HttpStatus.BAD_REQUEST,
    ),
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Please wait for admin approval.',
    type: RegisterResponseDto,
  })
  @Public()
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    return await this.usersService.createUser(registerDto as any);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 401,
    description: `
      Your account is pending approval, Please contact administrator.
      Invalid username or password.
    `,
    type: ErrorResponseDto,
    example: ErrorResponseDto.example(
      'Your account is pending approval, Please contact administrator.',
      HttpStatus.UNAUTHORIZED,
    ),
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful.',
    type: LoginResponseDto,
  })
  @Public()
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return await this.authService.login(loginDto);
  }

  // ---------------------------------------------------------------------------
  // Token validation endpoint — used by PCW Eats SSO (/sso) and other
  // downstream apps to verify a PCW Ride access token and retrieve user info.
  //
  // Response shape (used by PCW Eats' /sso handler):
  //   { valid: true, user: { user_id, email, username, displayname, role, ... } }
  //
  // On invalid/expired token → 401 (which PCW Eats treats as "redirect to login")
  // ---------------------------------------------------------------------------
  @Post('validate')
  @Public()
  @ApiOperation({
    summary: 'Validate a PCW Ride access token (SSO for downstream apps)',
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer <access-token>',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid. Returns the authenticated user.',
    schema: {
      example: {
        valid: true,
        user: {
          user_id: 9,
          username: 'john.doe',
          displayname: 'John Doe',
          email: 'john@example.com',
          role: 'EMPLOYEE',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token missing, invalid, or expired.',
    type: ErrorResponseDto,
    example: ErrorResponseDto.example('Invalid or expired token.', HttpStatus.UNAUTHORIZED),
  })
  async validate(@Headers('authorization') authHeader?: string, @Request() req?: any) {
    const token = this.extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException(
        ErrorResponseDto.example(
          'Missing or malformed Authorization header.',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    }

    return this.authService.validateAccessToken(token);
  }

  // GET variant so a browser tab can hit /api/auth/validate?token=... during
  // development (useful for debugging SSO by hand). Prefer POST in production.
  @Get('validate')
  @Public()
  @ApiOperation({
    summary: 'Validate a token via ?token= query (debug helper)',
  })
  async validateViaQuery(@Request() req: any) {
    const token = String(req.query.token || '');
    if (!token) {
      throw new UnauthorizedException(
        ErrorResponseDto.example('Missing token query parameter.', HttpStatus.UNAUTHORIZED),
      );
    }
    return this.authService.validateAccessToken(token);
  }

  private extractBearerToken(header?: string): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (!value || scheme.toLowerCase() !== 'bearer') return null;
    return value.trim() || null;
  }

  @Post('verify-password-reset')
  @Public()
  async verifyPasswordReset(@Body() data: any) {
    return await this.authService.verifyPasswordReset(data);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() data: any) {
    return await this.authService.resetPassword(data);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 401,
    description: `
      Refresh token is required.
      User not found.
      Refresh token expired. 
      Invalid refresh token. 
      Token verification failed. 
    `,
  })
  @ApiResponse({
    status: 200,
    description: `
      Returns new access and refresh tokens.
    `,
  })
  @Public()
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
