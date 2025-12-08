import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {

  @Get('/')
  rootHealth() {
    return this.healthCheck();
  }

  @Get('/health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'VR App API',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
