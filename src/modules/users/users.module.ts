import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from 'src/database/entities/user.entity';
import { Company } from 'src/database/entities/company.entity';
import { ResponseService } from 'src/common/services/response.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company])],
  providers: [UsersService, ResponseService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
