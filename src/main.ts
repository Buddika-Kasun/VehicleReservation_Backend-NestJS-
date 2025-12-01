import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  
  const port = process.env.PORT || 3000;
  const environment = process.env.NODE_ENV || 'development';

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
  app.useGlobalFilters(new AllExceptionsFilter());

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Get Express instance
  const server = app.getHttpAdapter().getInstance();

  // Root endpoint (before any other middleware)
  server.get('/', (req, res) => {
    res.json({
      status: 'success',
      message: '🚀 Vehicle Reservation API is running',
      environment: environment,
      timestamp: new Date().toISOString(),
      docs: '/api/docs',
      api: '/api/v1',
      health: '/health',
    });
  });

  // Health endpoint
  server.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'vehicle-reservation-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
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

  // Enable CORS for Vercel
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  // For Vercel serverless deployment
  if (process.env.VERCEL) {
    console.log('Running on Vercel environment');
    await app.init();
    return app;
  } else {
    // Local development
    await app.listen(port);
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }
}

// Export for Vercel serverless
const promise = bootstrap();
export default promise.then((app) => app.getHttpAdapter().getInstance());