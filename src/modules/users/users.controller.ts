import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body as any);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
