import { Module } from '@nestjs/common';
import { OdometerController } from './odometer.controller';
import { OdometerService } from './odometer.service';

@Module({
  controllers: [OdometerController],
  providers: [OdometerService]
})
export class OdometerModule {}
