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

  @Get('database')
  @ApiOperation({ 
    summary: 'Database health check',
    description: 'Checks the database connection and performance'
  })
  @ApiOkResponse({ 
    description: 'Database is healthy'
  })
  @ApiServiceUnavailableResponse({ 
    description: 'Database connection failed'
  })
  databaseHealth() {
    return this.healthService.checkDatabase();
  }

  @Get('redis')
  @ApiOperation({ 
    summary: 'Redis health check',
    description: 'Checks the Redis connection and performance'
  })
  @ApiOkResponse({ 
    description: 'Redis is healthy'
  })
  @ApiServiceUnavailableResponse({ 
    description: 'Redis connection failed'
  })
  redisHealth() {
    return this.healthService.checkRedis();
  }

  @Get('memory')
  @ApiOperation({ 
    summary: 'Memory health check',
    description: 'Checks system memory usage'
  })
  @ApiOkResponse({ 
    description: 'Memory status'
  })
  memoryHealth() {
    return this.healthService.checkMemory();
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