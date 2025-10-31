/*
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string;
    if (!auth) return false;
    const token = auth.replace(/^Bearer\s/, '');
    try {
      const payload = this.jwtService.verify(token);
      req.user = payload;
      return true;
    } catch (e) {
      return false;
    }
  }
}
*/

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwtService: JwtService;

  constructor(private configService: ConfigService) {
    // Create JwtService instance manually
    this.jwtService = new JwtService({
      secret: this.configService.get('jwt.secret'),
      signOptions: { expiresIn: this.configService.get('jwt.expiresIn') },
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return false;
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch (error) {
      return false;
    }
  }
}