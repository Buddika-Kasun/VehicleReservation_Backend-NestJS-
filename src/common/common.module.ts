// src/common/common.module.ts
import { Global, Module } from '@nestjs/common';
import { ResponseService } from './services/response.service';

@Global() // This makes ResponseService available globally
@Module({
  providers: [ResponseService],
  exports: [ResponseService],
})
export class CommonModule {}