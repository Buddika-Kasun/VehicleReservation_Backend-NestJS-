import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ResponseService } from 'src/common/services/response.service';
import { sanitizeUser } from 'src/common/utils/sanitize-user.util';
import { Status, UserRole } from 'src/infra/database/entities/user.entity';
import { UsersService } from 'src/modules/users/users.service';
import { compare, hash } from 'src/common/utils/hash.util';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto, LogoutResponseDto, UserData } from '../dto/authResponse.dto';
import { ApprovalConfigService } from 'src/modules/approval/approvalConfig.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService, 
    private approvalConfigService: ApprovalConfigService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly responseService: ResponseService,
  ) {}

  private refreshTokens = new Map<number, string>(); // In production, use Redis

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findAuthByUsername(username);

    if (!user) {
      throw new UnauthorizedException(
        this.responseService.error(
          'Invalid username or password',
          401
        )
      );
    }

    const isPasswordValid = await compare(pass, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        this.responseService.error(
          'Invalid username or password',
          401
        )
      );
    }    

    if (user.isApproved != Status.APPROVED) {
      throw new UnauthorizedException(
        this.responseService.error(
          'Your account is pending approval, Please contact administrator.',
          401
        )
      );
    }

    const { password, ...result } = user as any;
    return result;

  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {

    const user = await this.validateUser(dto.username, dto.password);

    console.log("user : ", user);

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      username: user.username 
    };

    const accessToken = this.generateAccessToken(payload)

    const refreshToken = this.generateRefreshToken(payload)

    // Update stored refresh token
    this.storeRefreshToken(user.id, refreshToken);

    const sanitizedUser: UserData = sanitizeUser(user);

    const [canUserCreate, canTripApprove] = await Promise.all([
      this.canUserCreate(user),
      this.canTripApprove(user)
    ]);

    const userWithPermissions = {
      ...sanitizedUser,
      permissions: {
        canUserCreate,
        canTripApprove
      }
    };
    
    return this.responseService.success(
      'Login successful',
      {
        accessToken,
        refreshToken,
        user: userWithPermissions
      }
    );

  }

  async verifyPasswordReset(data: any) {
    try {
      const { username, mobile } = data;

      if (!username || !mobile) {
        throw new BadRequestException(
          this.responseService.error(
            'Username and mobile number are required',
            400
          )
        );
      }

      // Find user by username and mobile
      const user = await this.usersService.findByUsernameAndMobile(username, mobile);

      if (!user) {
        throw new BadRequestException(
          this.responseService.error(
            'Username and mobile number do not match any user',
            400
          )
        );
      }

      // Check if user is approved
      if (user.isApproved !== Status.APPROVED) {
        throw new BadRequestException(
          this.responseService.error(
            'Your account is pending approval. Please contact administrator.',
            400
          )
        );
      }

      // Return success without any token
      return this.responseService.success(
        'Verification successful. You can now reset your password.',
        {
          userId: user.id,
          username: user.username,
          mobile: user.phone,
          displayName: user.displayname
        }
      );

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        this.responseService.error(
          'Failed to verify user',
          400
        )
      );
    }
  }

  async resetPassword(data: any) {
    try {
      const { username, mobile, newPassword, confirmPassword } = data;

      if (!username || !mobile || !newPassword || !confirmPassword) {
        throw new BadRequestException(
          this.responseService.error(
            'All fields are required',
            400
          )
        );
      }

      // Find user
      const user = await this.usersService.findByUsernameAndMobile(username, mobile);

      if (!user) {
        throw new BadRequestException(
          this.responseService.error(
            'User not found',
            400
          )
        );
      }

      // Check if passwords match
      if (newPassword !== confirmPassword) {
        throw new BadRequestException(
          this.responseService.error(
            'Passwords do not match',
            400
          )
        );
      }

      // Check password length
      if (newPassword.length < 6) {
        throw new BadRequestException(
          this.responseService.error(
            'Password must be at least 6 characters',
            400
          )
        );
      }

      // Check if new password is same as old password
      const isSamePassword = await compare(newPassword, user.passwordHash);
      if (isSamePassword) {
        throw new BadRequestException(
          this.responseService.error(
            'New password cannot be the same as old password',
            400
          )
        );
      }

      // Hash new password
      const hashedPassword = await hash(newPassword);

      // Update user password
      await this.usersService.updatePassword(user.id, hashedPassword);

      // Revoke all existing refresh tokens for this user
      this.refreshTokens.delete(user.id);

      return this.responseService.success(
        'Password reset successful. You can now login with your new password.'
      );

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        this.responseService.error(
          'Failed to reset password',
          400
        )
      );
    }
  }

  private async canTripApprove(user: any): Promise<boolean> {
  const approvalConfig = await this.approvalConfigService.findMenuApprovalForAuth(user.id);
  return user.role === UserRole.SYSADMIN ||
         approvalConfig?.secondaryUserId === user.id || 
         approvalConfig?.safetyUserId === user.id || 
         approvalConfig?.hodId === user.id;
}

private async canUserCreate(user: any): Promise<boolean> {
  // Your existing logic, make it async if needed
  const allowedRoles = [UserRole.HR, UserRole.SYSADMIN];
  if (allowedRoles.includes(user.role)) return true;
  if (user.role === UserRole.EMPLOYEE && user.authenticationLevel === 3) return true;
  return false;
}

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException(
        this.responseService.error(
          'Refresh token is required',
          401,
        )
      );
    }

    try {
      // Verify the refresh token
      const payload = this.verifyRefreshToken(refreshToken);

      // Check if user still exists
      const res = await this.usersService.findByUsername(payload.username);

      const user = res.data?.user;

      if (!user) {
        throw new UnauthorizedException(
          this.responseService.error(
            'User not found',
            401
          )
        );
      }

      // Generate new tokens
      const newPayload = { 
        sub: user.id, 
        email: user.email, 
        role: user.role, 
        username: user.username 
      };

      const accessToken = this.generateAccessToken(newPayload);

      const newRefreshToken = this.generateRefreshToken(newPayload)

      // Update stored refresh token
      this.storeRefreshToken(user.id, newRefreshToken);

      const sanitizedUser = sanitizeUser(user);

      return this.responseService.success(
        'Returns new access and refresh tokens',
        {
          accessToken,
          refreshToken: newRefreshToken,
          user: sanitizedUser
        }
      );

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          this.responseService.error(
            'Refresh token expired',
            401
          )
        );
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(
          this.responseService.error(
            'Invalid refresh token',
            401
          )
        );
      }
      throw new UnauthorizedException(
        this.responseService.error(
          'Token verification failed',
          401
        )
      );
    }
  }

  private generateAccessToken(payload: any) {
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.expiresIn') || '1d',
    });
  }

  private generateRefreshToken(payload: any) {
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.refreshExpiresIn') || '7d',
    });
  }

  private verifyRefreshToken(refreshToken: string) {
    return this.jwtService.verify(refreshToken, {
      secret: this.configService.get('jwt.refreshSecret') || 'supersecretrefreshkey',
    });
  }
  
  // Method to store refresh token when user logs in
  private storeRefreshToken(userId: number, refreshToken: string) {
    this.refreshTokens.set(userId, refreshToken);
  }

  // Method to revoke refresh token (on logout)
  async revokeRefreshToken(userId: number): Promise<LogoutResponseDto> {
    this.refreshTokens.delete(userId);
    return this.responseService.success(
      'Logged out successfully',
    )
  }

}
