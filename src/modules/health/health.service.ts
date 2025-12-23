import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTOs for Swagger documentation
export class DatabaseHealth {
  @ApiProperty({ description: 'Whether the database is connected', example: true })
  connected: boolean;

  @ApiPropertyOptional({ description: 'Connection latency in milliseconds', example: 15 })
  latency?: number;

  @ApiPropertyOptional({ description: 'Error message if connection failed' })
  error?: string;

  @ApiProperty({ description: 'Status of the database connection', enum: ['HEALTHY', 'SLOW', 'WARNING', 'DOWN'], example: 'HEALTHY' })
  status?: string;
}

export class RedisHealth {
  @ApiProperty({ description: 'Whether Redis is connected', example: true })
  connected: boolean;

  @ApiPropertyOptional({ description: 'Connection latency in milliseconds', example: 5 })
  latency?: number;

  @ApiPropertyOptional({ description: 'Error message if connection failed' })
  error?: string;

  @ApiProperty({ description: 'Status of the Redis connection', enum: ['HEALTHY', 'DOWN'], example: 'HEALTHY' })
  status?: string;
}

export class MemoryHealth {
  @ApiProperty({ description: 'Memory usage percentage', example: 45.2 })
  usage: number;

  @ApiProperty({ description: 'Memory status', enum: ['HEALTHY', 'WARNING', 'CRITICAL'], example: 'HEALTHY' })
  status: string;

  @ApiPropertyOptional({
    description: 'Detailed memory information',
    example: {
      heapTotal: '256 MB',
      heapUsed: '115 MB',
      rss: '320 MB'
    }
  })
  details?: {
    heapTotal: string;
    heapUsed: string;
    rss: string;
  };
}

export class DiskHealth {
  @ApiProperty({ description: 'Free disk space', example: '45.2 GB' })
  free: string;

  @ApiPropertyOptional({ description: 'Total disk space', example: '512 GB' })
  total?: string;

  @ApiPropertyOptional({ description: 'Free space percentage', example: 15 })
  percentage?: number;

  @ApiProperty({ description: 'Disk space status', enum: ['HEALTHY', 'WARNING', 'CRITICAL', 'UNKNOWN'], example: 'HEALTHY' })
  status: string;

  @ApiPropertyOptional({ description: 'Error message if check failed' })
  error?: string;
}

export class ApiHealth {
  @ApiProperty({ description: 'API status', enum: ['UP', 'DOWN'], example: 'UP' })
  status: string;
}

export class HealthCheckResult {
  @ApiProperty({ description: 'Overall system status', enum: ['UP', 'DOWN'], example: 'UP' })
  status: string;

  @ApiProperty({
    description: 'Individual health checks',
    type: () => Object,
    example: {
      database: {
        connected: true,
        latency: 15,
        status: 'HEALTHY'
      },
      redis: {
        connected: true,
        latency: 5,
        status: 'HEALTHY'
      },
      memory: {
        usage: 45.2,
        status: 'HEALTHY',
        details: {
          heapTotal: '256 MB',
          heapUsed: '115 MB',
          rss: '320 MB'
        }
      },
      disk: {
        free: '45.2 GB',
        total: '512 GB',
        percentage: 9,
        status: 'HEALTHY'
      },
      api: {
        status: 'UP'
      }
    }
  })
  checks: {
    database: DatabaseHealth;
    //disk: DiskHealth;
    api: ApiHealth;
  };

  @ApiProperty({ description: 'System uptime in seconds', example: 86400 })
  uptime: number;

  @ApiProperty({ description: 'Current environment', example: 'production' })
  environment: string;

  @ApiProperty({ description: 'Application version', example: '1.0.0' })
  version: string;

  @ApiProperty({ description: 'Timestamp of the health check', example: '2024-01-15T10:30:00.000Z' })
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      //disk: await this.checkDiskSpace(),
      api: { status: 'UP' } as ApiHealth,
    };

    const allUp = [
      checks.database.connected !== false,
      //checks.disk.status === 'HEALTHY' || checks.disk.status === 'WARNING',
    ].every(Boolean);

    return {
      status: allUp ? 'UP' : 'DOWN',
      checks,
      uptime: process.uptime(),
      environment: this.configService.get('NODE_ENV', 'development'),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  async checkDatabase(): Promise<DatabaseHealth> {
    try {
      const start = Date.now();
      await this.connection.query('SELECT 1');
      const latency = Date.now() - start;

      let status = 'HEALTHY';
      if (latency > 200) status = 'SLOW';
      if (latency > 500) status = 'WARNING';

      return {
        connected: true,
        latency,
        status,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return {
        connected: false,
        error: error.message,
        status: 'DOWN',
      };
    }
  }


  async checkDiskSpace(): Promise<DiskHealth> {
    try {
      // Use sync version to avoid import issues
      const fs = require('fs');
      const os = require('os');
      
      const platform = os.platform();
      let pathToCheck = '/';
      
      if (platform === 'win32') {
        pathToCheck = process.cwd().split('\\')[0] + '\\';
      }

      const stats = fs.statSync(pathToCheck);
      const freeBytes = stats.size - stats.blocks * 512; // Approximate free space
      const totalBytes = stats.size;

      const freePercentage = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;

      let status = 'HEALTHY';
      if (freePercentage < 10) status = 'CRITICAL';
      else if (freePercentage < 20) status = 'WARNING';

      return {
        free: this.formatBytes(freeBytes),
        total: this.formatBytes(totalBytes),
        percentage: Math.round(freePercentage),
        status,
      };
    } catch (error) {
      return {
        free: 'UNKNOWN',
        status: 'UNKNOWN',
        error: error.message,
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}