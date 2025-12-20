import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class WsAuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify WebSocket connection token
   */
  async verifyConnection(token: string): Promise<any> {
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Remove 'Bearer ' prefix if present
      const actualToken = token.replace('Bearer ', '');
      
      // Verify the token
      const payload = this.jwtService.verify(actualToken, {
        secret: this.configService.get('jwt.secret'),
      });

      // Check if user exists
      const userResult = await this.usersService.findByUsername(payload.username);
      const user = userResult.data?.user;

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user is approved
      if (user.isApproved !== 'approved') {
        throw new UnauthorizedException('User account not approved');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyId: user.company?.id,
        departmentId: user.department?.id,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Extract token from socket handshake
   */
  extractTokenFromSocket(socket: any): string | null {
    const auth = socket.handshake.auth?.token || 
                 socket.handshake.query?.token ||
                 socket.handshake.headers?.authorization;
    
    return auth || null;
  }

  /**
   * Get all role-based room names for a user
   * This includes the user's primary role and any inherited roles
   */
  getUserRoles(role: string): string[] {
    const roles: string[] = [];
    
    // Add primary role
    roles.push(role.toLowerCase());
    
    // Add role hierarchy
    switch (role.toLowerCase()) {
      case 'sysadmin':
        roles.push('admin', 'hr', 'manager');
        break;
      case 'admin':
        roles.push('hr', 'manager');
        break;
      case 'hr':
        roles.push('manager');
        break;
      case 'manager':
        // Manager is base level for approvers
        break;
    }
    
    return roles;
  }

  /**
   * Check if user can approve other users
   */
  canApproveUsers(role: string, authLevel?: number): boolean {
    const approverRoles = ['admin', 'sysadmin', 'hr', 'supervisor'];
    return approverRoles.includes(role.toLowerCase()) || authLevel === 3;
  }

}