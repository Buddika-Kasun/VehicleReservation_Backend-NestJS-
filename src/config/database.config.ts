import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

export const databaseConfig = (): TypeOrmModuleOptions & DataSourceOptions => {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',

    ...(process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASS || 'postgres',
          database: process.env.DB_NAME || 'vrapp_db',
        }),

    // SAME AS typeorm.config.ts
    entities: [
      path.join(__dirname, '..', '**', '*.entity.{ts,js}'),
      path.join(__dirname, '..', 'modules/notifications/entities/', '*.entity.{ts,js}'),
    ],
    migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],

    migrationsTableName: 'migrations',
    synchronize: false,
    logging: !isProd,

    extra: {
      max: 20,
      connectionTimeoutMillis: 10000,
    },
  };
};

export const AppDataSource = new DataSource(databaseConfig());
