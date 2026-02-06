import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { UpdatesService } from './updates.service';
import { UpdatesController } from './updates.controller';
import { AppUpdate } from 'src/infra/database/entities/update.entity';
import { multerConfig } from 'src/config/multer.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppUpdate]),
    MulterModule.register(multerConfig),
  ],
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}