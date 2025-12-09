import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

const isProd = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',

  ...(process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: isProd ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres',
        database: process.env.DB_NAME || 'vrapp_db',
      }),

  // *** IMPORTANT: SAME PATHS AS NEST APP ***
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],

  migrationsTableName: 'migrations',
  synchronize: false,
});
