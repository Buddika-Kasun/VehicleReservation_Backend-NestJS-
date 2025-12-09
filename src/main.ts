import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {

  const hostDomain = process.env.HOST || 'your-production-domain.com';

  // Ensure uploads directory exists with proper permissions
  const uploadPath = process.env.UPLOAD_PATH || './uploads';
  const fullPath = path.isAbsolute(uploadPath) ? uploadPath : path.join(process.cwd(), uploadPath);

  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true, mode: 0o777 });
      console.log(`Created uploads directory: ${fullPath}`);
    }
    fs.chmodSync(fullPath, 0o777);
  } catch (error) {
    console.warn(`Could not create uploads directory: ${error.message}`);
    console.warn('Using /tmp/uploads instead');
    process.env.UPLOAD_PATH = '/tmp/uploads';
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('port') || 3000;
  const environment = configService.get<string>('environment') || process.env.NODE_ENV || 'development';

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

  // Swagger docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vehicle Reservation API')
    .setDescription('Vehicle Reservation System API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  await app.listen(port);

  // Log URLs in a safe way
  const host = environment === 'production' ? hostDomain : 'localhost';
  console.log(`🚀 Server running in ${environment} mode on http://${host}:${port}`);
  console.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
}

bootstrap();
