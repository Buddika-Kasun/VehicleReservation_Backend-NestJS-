import { webcrypto } from 'crypto';

// Polyfill for crypto in Node environments where it might be missing
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import * as compression from 'compression';
import helmet from 'helmet';
import * as morgan from 'morgan';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { HealthService } from './modules/health/health.service';
import { setupGracefulShutdown } from './common/utils/graceful-shutdown';
import { Request, Response } from 'express';
import { red, green, yellow, blue, magenta, cyan, white, gray, bold, underline } from 'colorette';

// ==================== CONSTANTS & VISUALS ====================
const APP_LOGO = `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗     ║
║     ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗    ║
║     ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝    ║
║     ╚════██║██╔══╝  ██╔══██╗██║   ██║██╔══╝  ██╔══██╗    ║
║     ███████║███████╗██║  ██║╚██████╔╝███████╗██║  ██║    ║
║     ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝    ║
║                                                          ║
║          V E H I C L E   R E S E R V A T I O N           ║
║                  A P I   S E R V I C E                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`;

const ICONS = {
  SUCCESS: '✅', ERROR: '❌', WARNING: '⚠️', INFO: 'ℹ️', DEBUG: '🐛',
  DATABASE: '🗄️', REDIS: '🔴', SERVER: '🚀', SECURITY: '🛡️', DOCS: '📚',
  HEALTH: '❤️', CLOCK: '⏱️', FOLDER: '📁', ENV: '🌍', PORT: '🔌',
  COMPRESSION: '🗜️', VALIDATION: '✓', LOGGING: '📝', MONITORING: '📊',
  SHUTDOWN: '🛑', UPLOAD: '📤', CORS: '🔄', SWAGGER: '📋', SETTINGS: '⚙️',
  STARTUP: '🎬', UPTIME: '⏳', MEMORY: '🧠', CPU: '⚡', DISK: '💾',
  NETWORK: '🌐', AUTH: '🔑', CACHE: '💿', CHECK: '✔️', CROSS: '✖️',
  MAGNIFYING_GLASS: '🔍', TOOLBOX: '🧰', WRENCH: '🔧', CHECKERED_FLAG: '🏁',
  THUMBS_UP: '👍', FIRE: '🔥', ROCKET: '🚀', LOCK: '🔒', UNLOCK: '🔓',
};

// ==================== BOOTSTRAP LOGIC ====================

async function bootstrap() {
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  
  console.log(cyan(bold(APP_LOGO)));
  console.log(yellow(`${ICONS.STARTUP} ${bold('BOOTSTRAP PROCESS STARTED')}`));
  console.log(gray('─'.repeat(60)));

  // 1. Logger Setup
  const winstonLogger = createWinstonLogger(isProduction);
  console.log(green(`${ICONS.CHECK} Logger configured successfully`));

  // 2. File System Setup
  setupFileSystem();

  // 3. App Creation
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger,
    bufferLogs: true,
    abortOnError: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;

  // 4. Validate Infrastructure & Environment
  await validateInfrastructure(app, configService);

  // 5. Global Middlewares & Settings
  applyGlobalSettings(app, configService, isProduction, winstonLogger);

  // 6. Swagger Documentation
  setupSwagger(app, port, configService, isProduction);

  // 7. Health Endpoints
  setupHealthEndpoints(app, environment, winstonLogger);

  // 8. Graceful Shutdown
  setupGracefulShutdown(app, winstonLogger as any);
  console.log(green(`${ICONS.SHUTDOWN} Graceful shutdown handler configured`));

  // 9. Start Server
  await app.listen(port, '0.0.0.0');

  // 10. Startup Complete Banner
  showFinalBanner(configService, port, environment, isProduction);
}

// ==================== HELPER FUNCTIONS ====================

function createWinstonLogger(isProduction: boolean) {
  return WinstonModule.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf((info) => {
            const { timestamp, level, message, context, trace } = info;
            const icon = { error: ICONS.ERROR, warn: ICONS.WARNING, info: ICONS.INFO, debug: ICONS.DEBUG }[level] || ICONS.INFO;
            const color = { error: red, warn: yellow, info: blue, debug: magenta }[level] || white;
            return `${gray(timestamp as string)} ${icon} ${color(`[${(context || 'App')}]`)} ${color(level as string)}: ${color(message as string)}${trace ? red(`\n${trace}`) : ''}`;
          }),
        ),
      }),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
      new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 10 }),
    ],
  });
}

function setupFileSystem() {
  console.log(blue(`${ICONS.FOLDER} ${bold('Setting up file system...')}`));
  try {
    ['./uploads', './logs', './temp'].forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true, mode: 0o755 });
        console.log(green(`${ICONS.CHECK} Created directory: ${cyan(fullPath)}`));
      }
    });
    process.env.UPLOAD_PATH = path.join(process.cwd(), 'uploads');
  } catch (error: any) {
    console.log(red(`${ICONS.ERROR} Failed to setup directories: ${error.message}`));
  }
}

async function validateInfrastructure(app: INestApplication, configService: ConfigService) {
  console.log(blue(`${ICONS.MAGNIFYING_GLASS} ${bold('Running startup validations...')}`));
  console.log(gray('├───────────────────────────────────────────┤'));

  try {
    const healthService = app.get(HealthService);
    
    // Database Check
    console.log(blue(`${ICONS.DATABASE} Checking database connection...`));
    const dbHealth = await healthService.checkDatabase();
    if (!dbHealth.connected) throw new Error('Database connection failed');
    console.log(green(`${ICONS.CHECK} Database verified ${gray(`(${dbHealth.latency}ms)`)}`));

    // Redis Check
    console.log(blue(`${ICONS.REDIS} Checking redis configuration...`));
    if (!configService.get('redis.url') && !configService.get('redis.host')) {
      throw new Error('Redis configuration missing');
    }
    console.log(green(`${ICONS.CHECK} Redis configuration verified`));

    // Env Check
    const required = ['JWT_SECRET', 'REDIS_URL'];
    const missing = required.filter(v => !process.env[v] && !configService.get(v));
    if (missing.length > 0) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    
    // Firebase Notice
    if (!process.env.FIREBASE_CREDENTIALS_PATH) {
      console.log(yellow(`${ICONS.WARNING} FIREBASE_CREDENTIALS_PATH missing. Push notifications disabled.`));
    }

    console.log(gray('└───────────────────────────────────────────┘'));
    console.log(green(bold(`${ICONS.THUMBS_UP} All startup validations passed!`)));
  } catch (error: any) {
    console.log(red(`${ICONS.ERROR} Startup validation failed: ${error.message}`));
    process.exit(1);
  }
}

function applyGlobalSettings(app: NestExpressApplication, configService: ConfigService, isProduction: boolean, logger: any) {
  app.setGlobalPrefix('api/v1');
  
  // Security
  app.use(helmet());
  app.enableCors({
    //origin: isProduction ? configService.get('cors.origins', '').split(',') : true,
    origin: true,
    credentials: true,
  });

  // Performance
  app.use(compression());
  if (!isProduction) {
    app.use(morgan('dev', { stream: { write: (m) => logger.log(m.trim(), 'HTTP') } }));
  }

  // Interceptors & Pipes
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true, 
    forbidNonWhitelisted: true,
    disableErrorMessages: isProduction 
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(logger), new TimeoutInterceptor());
}

function setupSwagger(app: INestApplication, port: number, configService: ConfigService, isProduction: boolean) {
  if (isProduction) return;

  const config = new DocumentBuilder()
    .setTitle('Vehicle Reservation API')
    .setDescription('Enterprise Vehicle Reservation Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'VRS API Docs',
  });
  console.log(green(`${ICONS.DOCS} Swagger available at: ${cyan(`http://localhost:${port}/api/docs`)}`));
}

function setupHealthEndpoints(app: NestExpressApplication, environment: string, logger: any) {
  const adapter = app.getHttpAdapter();
  
  adapter.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      environment,
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  adapter.get('/health/detailed', async (req: Request, res: Response) => {
    try {
      const healthService = app.get(HealthService);
      const health = await healthService.checkHealth();
      res.status(200).json({
        ...health,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          node: process.version,
          platform: process.platform,
        }
      });
    } catch (error: any) {
      logger.error(`Health check failed: ${error.message}`);
      res.status(503).json({ status: 'DOWN', error: error.message });
    }
  });
}

function showFinalBanner(configService: ConfigService, port: number, environment: string, isProduction: boolean) {
  const host = configService.get('host') || 'localhost';
  const url = `http://${host}:${port}`;
  
  console.log(gray('─'.repeat(60)));
  console.log(green(bold(`${ICONS.CHECKERED_FLAG} SERVER STARTED SUCCESSFULLY!`)));
  console.log(gray('─'.repeat(60)));
  console.log(cyan(`${ICONS.ENV}  Environment: ${bold(environment)}`));
  console.log(cyan(`${ICONS.PORT}  Port: ${bold(port.toString())}`));
  console.log(cyan(`${ICONS.NETWORK}  URL: ${underline(bold(url))}`));
  console.log(cyan(`${ICONS.UPTIME}  PID: ${bold(process.pid.toString())}`));
  console.log(gray('─'.repeat(60)));
  
  if (!isProduction) {
    // Development status monitor
    setInterval(() => {
      const mem = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
      console.log(gray(`${ICONS.INFO}  Status: ${green('UP')} | Uptime: ${cyan(`${Math.floor(process.uptime())}s`)} | Memory: ${yellow(`${mem} MB`)}`));
    }, 60000);
  }
}

// ==================== GLOBAL ERROR HANDLERS ====================

process.on('unhandledRejection', (reason) => {
  console.error(red(bold(`${ICONS.ERROR} Unhandled Rejection:`)), reason);
});

process.on('uncaughtException', (error) => {
  console.error(red(bold(`${ICONS.ERROR} Uncaught Exception:`)), error);
  process.exit(1);
});

// ==================== EXECUTION ====================

bootstrap().catch((err) => {
  console.error(red(bold(`${ICONS.ERROR} Fatal Bootstrap Error:`)), err);
  process.exit(1);
});