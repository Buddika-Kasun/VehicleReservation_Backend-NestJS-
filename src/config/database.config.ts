import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

export const databaseConfig = (): TypeOrmModuleOptions & DataSourceOptions => {
  // Get DATABASE_URL from Railway (or individual vars as fallback)
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    // Use DATABASE_URL (Railway provides this)
    return {
      type: 'postgres',
      url: databaseUrl,
      ssl: {
        rejectUnauthorized: false, // Required for Railway PostgreSQL
      },
      entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
      migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
      migrationsTableName: 'migrations',
      synchronize: false, // NEVER true in production
      logging: process.env.NODE_ENV === 'development',
      extra: {
        max: 20,
        connectionTimeoutMillis: 10000,
      },
    };
  } else {
    // Fallback to individual variables (for local development)
    return {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'vrapp_db',
      entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
      migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
      migrationsTableName: 'migrations',
      synchronize: process.env.NODE_ENV === 'development', // Only in dev
      logging: process.env.NODE_ENV === 'development',
      extra: {
        max: 20,
        connectionTimeoutMillis: 10000,
      },
    };
  }
};

export const AppDataSource = new DataSource(databaseConfig());