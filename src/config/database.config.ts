/* // working code
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

export const databaseConfig = (): TypeOrmModuleOptions & DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'nestjs_boilerplate',

  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],

  synchronize: process.env.TYPEORM_SYNC === 'true',
  logging: process.env.NODE_ENV === 'development',
});
*/

// src/database/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

export const databaseConfig = (): TypeOrmModuleOptions & DataSourceOptions => {
  // Configuration that works for BOTH local and Supabase
  const config: TypeOrmModuleOptions & DataSourceOptions = {
    type: 'postgres',
    
    // Use DATABASE_URL for Vercel/Supabase, fallback to local for development
    ...(process.env.DATABASE_URL 
      ? {
          url: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASS || 'postgres',
          database: process.env.DB_NAME || 'vrapp_db',
        }
    ),

    entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],

    // Keep your existing logic
    synchronize: process.env.NODE_ENV === 'development' && process.env.TYPEORM_SYNC === 'true',
    logging: process.env.NODE_ENV === 'development',
  
    // Optional: Better performance
    extra: {
      max: 20,
      connectionTimeoutMillis: 10000,
    },
    
  };

  return config;
};

export const AppDataSource = new DataSource(databaseConfig());