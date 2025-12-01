import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  
  // Get configuration values
  const port = configService.get<number>('port') || 3000;
  const environment = configService.get<string>('environment') || 'development';

  // Global settings
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  console.log('✅ Global ValidationPipe enabled');
  app.useGlobalFilters(new AllExceptionsFilter());
  
  if (process.env.NODE_ENV !== 'production') {
    app.useGlobalInterceptors(new TransformInterceptor());
  }

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Get the underlying Express instance to add routes
  const expressInstance = app.getHttpAdapter().getInstance();

  // Add root endpoint for health check (before global prefix)
  expressInstance.get('/', (req, res) => {
    res.json({
      status: 'success',
      message: '🚀 Vehicle Reservation API is running',
      timestamp: new Date().toISOString(),
      environment: environment,
      uptime: process.uptime(),
      docs: '/api/docs',
      api: '/api/v1',
      health: '/health',
    });
  });

  // Add health endpoint (before global prefix)
  expressInstance.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'vehicle-reservation-api',
      timestamp: new Date().toISOString(),
      environment: environment,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      },
    });
  });

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vehicle Reservation API')
    .setDescription('Vehicle Reservation System API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Enable CORS
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(port);
  
  console.log(`🚀 Server running in ${environment} mode on http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`✅ Health Check: http://localhost:${port}/`);
  console.log(`✅ Health Detailed: http://localhost:${port}/health`);
}

bootstrap();