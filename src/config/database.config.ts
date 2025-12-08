// src/database/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

export const databaseConfig = (): TypeOrmModuleOptions & DataSourceOptions => {
  // Check if we're running compiled code
  const isCompiled = __filename.endsWith('.js');
  const fileExtension = isCompiled ? 'js' : 'ts';
  const baseDir = isCompiled ? 'dist' : 'src';

  const config: TypeOrmModuleOptions & DataSourceOptions = {
    type: 'postgres',
    
    // Railway provides DATABASE_URL
    ...(process.env.DATABASE_URL 
      ? {
          url: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASS || 'postgres',
          database: process.env.DB_NAME || 'vrapp_db',
        }
    ),

    // Use correct file extensions
    entities: [`${baseDir}/**/*.entity.${fileExtension}`],
    migrations: [`${baseDir}/database/migrations/*.${fileExtension}`],
    migrationsTableName: 'migrations',
    
    // Safety: never synchronize in production
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
    
    extra: {
      max: 20,
      connectionTimeoutMillis: 10000,
    },
  };

  return config;
};

// For TypeORM CLI
export const AppDataSource = new DataSource(databaseConfig());