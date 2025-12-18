import { Controller, Get } from "@nestjs/common";
import { Public } from "src/common/decorators/public.decorator";
import { HealthService } from "./health.service";
import { ApiTags, ApiOperation, ApiResponse, ApiOkResponse, ApiServiceUnavailableResponse } from "@nestjs/swagger";
import { HealthCheckResult } from "./health.service";

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Health check endpoint',
    description: 'Performs comprehensive health checks for all system components including database, redis, memory, and disk space.'
  })
  @ApiOkResponse({ 
    description: 'System is healthy and all components are operational',
    type: HealthCheckResult
  })
  @ApiServiceUnavailableResponse({ 
    description: 'One or more system components are unhealthy'
  })
  healthCheck() {
    return this.healthService.checkHealth();
  }

  @Get('disk')
  @ApiOperation({ 
    summary: 'Disk space health check',
    description: 'Checks available disk space'
  })
  @ApiOkResponse({ 
    description: 'Disk space status'
  })
  diskHealth() {
    return this.healthService.checkDiskSpace();
  }
}