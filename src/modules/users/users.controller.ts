
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  async register(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Put('approve/:id')
  async approve(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.approveUser(id);
  }

  @Get()
  async getAll() {
    return this.usersService.findAll();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@User() user) {
    return this.usersService.findByUsername(user.username);
  }
}
