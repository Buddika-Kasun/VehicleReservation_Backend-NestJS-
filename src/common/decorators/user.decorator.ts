/*
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
*/

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/database/entities/user.entity';

export const GetUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    if (data && user) {
      return user[data]; // Return specific property if requested
    }
    
    return user; // Return full user object
  },
);
