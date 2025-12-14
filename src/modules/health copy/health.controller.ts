import { Controller, Get } from "@nestjs/common";
import { Public } from "src/common/decorators/public.decorator";

@Controller()
@Public()
export class HealthController {

  @Get(['','health'])
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'VR App API',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
