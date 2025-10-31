import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from '../../common/utils/hash.util';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);

    if (!user.isApproved) throw new UnauthorizedException('Account pending HR approval.');

    if (user && (await compare(pass, user.passwordHash))) {
      const { password, ...result } = user as any;
      return result;
    }
    
    throw new UnauthorizedException('Invalid credentials');

  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role, username: user.username };

    const token = this.jwtService.sign(payload)
    
    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        displayname: user.display,
        email: user.email,
        role: user.role,
      },
    };
  }
}
