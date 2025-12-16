import { webcrypto } from 'crypto';

if (typeof (global as any).crypto === 'undefined') {
    (global as any).crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
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

// ASCII Art Logo - Big "API" with VEHICLE RESERVATION API SERVICE below
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

// Cleaned up icons - only essential ones
const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  DEBUG: '🐛',
  DATABASE: '🗄️',
  REDIS: '🔴',
  SERVER: '🚀',
  SECURITY: '🛡️',
  DOCS: '📚',
  HEALTH: '❤️',
  CLOCK: '⏱️',
  FOLDER: '📁',
  ENV: '🌍',
  PORT: '🔌',
  COMPRESSION: '🗜️',
  VALIDATION: '✓',
  LOGGING: '📝',
  MONITORING: '📊',
  SHUTDOWN: '🛑',
  UPLOAD: '📤',
  CORS: '🔄',
  SWAGGER: '📋',
  SETTINGS: '⚙️',
  STARTUP: '🎬',
  UPTIME: '⏳',
  MEMORY: '🧠',
  CPU: '⚡',
  DISK: '💾',
  NETWORK: '🌐',
  AUTH: '🔑',
  CACHE: '💿',
  CHECK: '✔️',
  CROSS: '✖️',
  MAGNIFYING_GLASS: '🔍',
  TOOLBOX: '🧰',
  WRENCH: '🔧',
  CHECKERED_FLAG: '🏁',
  THUMBS_UP: '👍',
  GEAR: '⚙️',
  ROCKET: '🚀',
  LOCK: '🔒',
  UNLOCK: '🔓',
  BELL: '🔔',
  HAMMER: '🔨',
  LIGHTBULB: '💡',
  NO_ENTRY: '⛔',
  CONSTRUCTION: '🚧',
  TRAFFIC_LIGHT: '🚥',
  TROPHY: '🏆',
  MEDAL: '🏅',
  FIRE: '🔥',
  SUN: '☀️',
  CLOUD: '☁️',
  CAR: '🚗',
  BUS: '🚌',
  TRAIN: '🚂',
  BIKE: '🚲',
  AIRPLANE: '✈️',
  SHIP: '🚢',
  COFFEE: '☕',
  PIZZA: '🍕',
  HAMBURGER: '🍔',
  CAKE: '🎂',
  BEER: '🍺',
  WINE: '🍷',
  FOOTBALL: '⚽',
  BASKETBALL: '🏀',
  TENNIS: '🎾',
  MUSIC: '🎵',
  CAMERA: '🎥',
  TV: '📺',
  PHONE: '📞',
  COMPUTER: '💻',
  PRINTER: '🖨️',
  FLOPPY_DISK: '💾',
  CD: '💿',
  USB: '💻',
  PLUG: '🔌',
  BATTERY: '🔋',
  COMPASS: '🧭',
  MAP: '🗺️',
  GLOBE: '🌐',
  FLAG: '🚩',
  ANCHOR: '⚓',
  TREE: '🌲',
  FLOWER: '🌸',
  SPARKLES: '✨',
  CONFETTI: '🎉',
  BALLOON: '🎈',
  GIFT: '🎁',
};

async function bootstrap() {
  // ==================== ENVIRONMENT SETUP ====================
  console.log(cyan(bold(APP_LOGO)));
  
  const host = process.env.HOST || 'your-production-domain.com';
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  
  console.log(yellow(`${ICONS.STARTUP} ${bold('BOOTSTRAP PROCESS STARTED')}`));
  console.log(gray('─'.repeat(60)));

  // ==================== LOGGER SETUP ====================
  console.log(blue(`${ICONS.LOGGING} ${bold('Configuring Logger...')}`));
  
  const winstonLogger = WinstonModule.createLogger({
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
            
            const icon = {
              error: ICONS.ERROR,
              warn: ICONS.WARNING,
              info: ICONS.INFO,
              debug: ICONS.DEBUG,
              verbose: ICONS.INFO,
              silly: ICONS.DEBUG,
            }[level] || ICONS.INFO;
            
            const color = {
              error: red,
              warn: yellow,
              info: blue,
              debug: magenta,
              verbose: cyan,
              silly: gray,
            }[level] || white;
            
            const timestampStr = timestamp as string;
            const levelStr = level as string;
            const messageStr = message as string;
            const contextStr = (context || 'App') as string;
            
            return `${gray(timestampStr)} ${icon} ${color(`[${contextStr}]`)} ${color(levelStr)}: ${color(messageStr)}${trace ? red(`\n${trace}`) : ''}`;
          }),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 10,
      }),
    ],
  });

  console.log(green(`${ICONS.CHECK} Logger configured successfully`));

  // ==================== FILE SYSTEM SETUP ====================
  console.log(blue(`${ICONS.FOLDER} ${bold('Setting up file system...')}`));
  
  try {
    const directories = ['./uploads', './logs', './temp'];
    
    directories.forEach(dir => {
      const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true, mode: 0o755 });
        console.log(green(`${ICONS.CHECK} Created directory: ${cyan(fullPath)}`));
      }
    });

    process.env.UPLOAD_PATH = path.join(process.cwd(), 'uploads');
    console.log(green(`${ICONS.CHECK} Upload path set: ${cyan(process.env.UPLOAD_PATH)}`));
  } catch (error: any) {
    console.log(red(`${ICONS.ERROR} Failed to create directories: ${error.message}`));
    process.env.UPLOAD_PATH = '/tmp/uploads';
  }

  // ==================== APP CREATION ====================
  console.log(blue(`${ICONS.GEAR} ${bold('Creating NestJS application...')}`));
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger,
    bufferLogs: true,
    abortOnError: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const wsPort = configService.get<number>('notifications.websocket.port');
  const wsPath = configService.get<string>('notifications.websocket.path');

  console.log(green(`${ICONS.CHECK} Application created successfully`));

  // ==================== SECURITY MIDDLEWARE ====================
  console.log(blue(`${ICONS.SECURITY} ${bold('Configuring security middleware...')}`));
  
  if (isProduction) {
    app.use(helmet({
      contentSecurityPolicy: isProduction,
      crossOriginEmbedderPolicy: isProduction,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    const allowedOrigins = configService.get<string>('cors.origins', '');
    app.enableCors({
      origin: allowedOrigins ? allowedOrigins.split(',') : [],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
        'X-Correlation-ID',
      ],
      exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      maxAge: 86400,
    });
    
    console.log(green(`${ICONS.LOCK} Production security enabled`));
    console.log(green(`${ICONS.CORS} CORS configured with allowed origins`));
  } else {
    app.enableCors({
      origin: true,
      credentials: true,
    });
    
    console.log(yellow(`${ICONS.UNLOCK} Development CORS enabled`));
  }

  // ==================== PERFORMANCE MIDDLEWARE ====================
  console.log(blue(`${ICONS.ROCKET} ${bold('Configuring performance middleware...')}`));
  
  app.use(compression());
  console.log(green(`${ICONS.COMPRESSION} Gzip compression enabled`));

  // ==================== LOGGING MIDDLEWARE ====================
  if (!isProduction) {
    app.use(morgan('combined', {
      stream: {
        write: (message: string) => winstonLogger.log(message.trim(), 'HTTP'),
      },
    }));
    
    console.log(green(`${ICONS.LOGGING} Morgan HTTP logging enabled`));
  }

  // ==================== GLOBAL SETTINGS ====================
  console.log(blue(`${ICONS.SETTINGS} ${bold('Applying global settings...')}`));
  
  app.setGlobalPrefix('api/v1');
  console.log(green(`${ICONS.CHECK} Global prefix set to: ${cyan('api/v1')}`));
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
      },
      disableErrorMessages: isProduction,
      validationError: {
        target: !isProduction,
        value: !isProduction,
      },
    }),
  );
  
  console.log(green(`${ICONS.VALIDATION} Validation pipe configured`));
  
  app.useGlobalFilters(new AllExceptionsFilter());
  console.log(green(`${ICONS.WRENCH} Global exception filter applied`));

  const loggingInterceptor = new LoggingInterceptor(winstonLogger);
  const timeoutInterceptor = new TimeoutInterceptor();
  app.useGlobalInterceptors(loggingInterceptor, timeoutInterceptor);
  
  console.log(green(`${ICONS.TOOLBOX} Global interceptors applied`));

  // ==================== SWAGGER DOCUMENTATION ====================
  if (!isProduction) {
    console.log(blue(`${ICONS.SWAGGER} ${bold('Setting up Swagger documentation...')}`));
    
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Vehicle Reservation API')
      .setDescription('Vehicle Reservation System API Documentation')
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      })
      .addApiKey({
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
      }, 'ApiKey')
      .addServer(`http://localhost:${port}`, 'Development')
      .addServer(host, 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Vehicle Reservation API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
    });
    
    console.log(green(`${ICONS.DOCS} Swagger documentation available at: ${cyan(`http://localhost:${port}/api/docs`)}`));
  }

  // ==================== HEALTH CHECK ENDPOINTS ====================
  console.log(blue(`${ICONS.HEALTH} ${bold('Configuring health endpoints...')}`));
  
  const adapter = app.getHttpAdapter();
  
  adapter.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'vehicle-reservation-api',
      version: process.env.npm_package_version || '1.0.0',
      environment,
    });
  });

  adapter.get('/health/detailed', async (req: Request, res: Response) => {
    try {
      const healthService = app.get(HealthService);
      const health = await healthService.checkHealth();

      res.status(200).json({
        ...health,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      });
    } catch (error: any) {
      winstonLogger.error(`Health check failed: ${error.message}`);

      res.status(503).json({
        status: 'DOWN',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  console.log(green(`${ICONS.CHECK} Health endpoints configured`));

  // ==================== STARTUP VALIDATIONS ====================
  console.log(blue(`${ICONS.MAGNIFYING_GLASS} ${bold('Running startup validations...')}`));
  console.log(gray('├───────────────────────────────────────────┤'));
  
  try {
    const healthService = app.get(HealthService);
    
    // Database validation
    console.log(blue(`${ICONS.DATABASE} Checking database connection...`));
    const dbHealth = await healthService.checkDatabase();
    if (!dbHealth.connected) {
      console.log(red(`${ICONS.ERROR} Database connection failed!`));
      process.exit(1);
    }
    console.log(green(`${ICONS.CHECK} Database connection verified ${gray(`(${dbHealth.latency}ms)`)}`));
    
    // Redis validation
    if (configService.get('redis.enabled', false)) {
      console.log(blue(`${ICONS.REDIS} Checking Redis connection...`));
      const redisHealth = await healthService.checkRedis();
      if (!redisHealth.connected) {
        console.log(yellow(`${ICONS.WARNING} Redis connection failed - notifications may not work`));
      } else {
        console.log(green(`${ICONS.CHECK} Redis connection verified ${gray(`(${redisHealth.latency}ms)`)}`));
      }
    }
    
    // Environment variables validation
    console.log(blue(`${ICONS.ENV} Checking environment variables...`));
    const requiredEnvVars = ['JWT_SECRET', 'REDIS_URL'];
    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName] && !configService.get(varName),
    );

    if (missingVars.length > 0) {
      console.log(red(`${ICONS.ERROR} Missing required environment variables: ${missingVars.join(', ')}`));
      process.exit(1);
    }
    
    console.log(green(`${ICONS.CHECK} All environment variables verified`));
    
    console.log(gray('└───────────────────────────────────────────┘'));
    console.log(green(bold(`${ICONS.THUMBS_UP} All startup validations passed!`)));
  } catch (error: any) {
    console.log(red(`${ICONS.ERROR} Startup validation failed: ${error.message}`));
    process.exit(1);
  }

  // ==================== GRACEFUL SHUTDOWN ====================
  setupGracefulShutdown(app, winstonLogger as any);
  console.log(green(`${ICONS.SHUTDOWN} Graceful shutdown handler configured`));

  // ==================== START SERVER ====================
  console.log(gray('─'.repeat(60)));
  console.log(blue(`${ICONS.SERVER} ${bold('Starting server...')}`));
  
  await app.listen(port, '0.0.0.0');

  // ==================== STARTUP COMPLETE ====================
  const url = isProduction ? host : `http://localhost:${port}`;

  const wsProtocol = isProduction ? 'wss' : 'ws';
  const wsUrl =
  wsPort === port
    ? `${wsProtocol}://localhost:${port}${wsPath}`
    : `${wsProtocol}://localhost:${wsPort}${wsPath}`;

    
    console.log(gray('─'.repeat(60)));
    console.log(green(bold(`${ICONS.CHECKERED_FLAG} ${bold('SERVER STARTED SUCCESSFULLY!')}`)));
    console.log(gray('─'.repeat(60)));
    
    console.log(cyan(`${ICONS.ENV}  Environment: ${bold(environment)}`));
    console.log(cyan(`${ICONS.PORT}  Port: ${bold(port.toString())}`));
    console.log(cyan(`${ICONS.NETWORK}  URL: ${underline(bold(url))}`));
    console.log(cyan(`${ICONS.NETWORK}  WebSocket URL: ${underline(bold(wsUrl))}`));
  
  if (!isProduction) {
    console.log(yellow(`${ICONS.DOCS}  API Docs: ${underline(bold(`${url}/api/docs`))}`));
    console.log(yellow(`${ICONS.HEALTH}   Health Check: ${underline(bold(`${url}/health`))}`));
    console.log(yellow(`${ICONS.HEALTH}   Detailed Health: ${underline(bold(`${url}/health/detailed`))}`));
  }
  
  console.log(cyan(`${ICONS.UPTIME}  Uptime: ${bold('0 seconds')}`));
  console.log(cyan(`${ICONS.MEMORY}  PID: ${bold(process.pid.toString())}`));
  
  if (isProduction) {
    console.log(green(`${ICONS.MONITORING} Application monitoring enabled`));
  }
  
  console.log(gray('─'.repeat(60)));
  console.log(gray(`${ICONS.INFO}  Server is ready to accept requests`));
  console.log(gray(`${ICONS.INFO}  Press ${red('Ctrl+C')} to stop the server`));
  console.log(gray('─'.repeat(60)));

  // Display server status every 30 seconds in development
  if (!isProduction) {
    setInterval(() => {
      const memory = process.memoryUsage();
      const memoryUsage = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;
      const uptime = Math.floor(process.uptime());
      
      console.log(gray(`${ICONS.INFO}  Status: ${green('UP')} | Uptime: ${cyan(`${uptime}s`)} | Memory: ${yellow(`${memoryUsage} MB`)}`));
    }, 30000);
  }
}

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (reason, promise) => {
  console.error(red(bold(`${ICONS.ERROR} Unhandled Rejection at:`)), promise, red('reason:'), reason);
});

process.on('uncaughtException', (error) => {
  console.error(red(bold(`${ICONS.ERROR} Uncaught Exception:`)), error);
  process.exit(1);
});

// ==================== ENTRY POINT ====================
bootstrap().catch((error: any) => {
  console.error(red(bold(`${ICONS.ERROR} Failed to bootstrap application:`)), error);
  process.exit(1);
});