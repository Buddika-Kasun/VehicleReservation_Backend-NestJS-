// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { Request, Response } from 'express';

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
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Get Express instance
  const server = app.getHttpAdapter().getInstance();

  // Root endpoint
  server.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'success',
      message: '🚀 Vehicle Reservation API',
      environment,
      timestamp: new Date().toISOString(),
      docs: '/api/docs',
      api: '/api/v1',
    });
  });

  // Health endpoint
  server.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'vehicle-reservation-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Vehicle Reservation API')
    .setDescription('API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // For Vercel serverless
  if (process.env.VERCEL) {
    console.log('🚀 Starting serverless mode for Vercel');
    await app.init();
    return app;
  }

  // Local development
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}

// Export for Vercel
export default bootstrap().then(app => app.getHttpAdapter().getInstance());