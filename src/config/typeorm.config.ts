// src/config/typeorm.config.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

// Check if we're in production (compiled JS) or development (TypeScript)
const isCompiled = __filename.endsWith('.js');
const fileExtension = isCompiled ? 'js' : 'ts';
const baseDir = isCompiled ? 'dist' : 'src';

const dataSource = new DataSource({
  type: 'postgres',
  
  // Use DATABASE_URL for Railway, individual vars for local
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
  
  // Dynamic paths based on environment
  entities: [`${baseDir}/**/*.entity.${fileExtension}`],
  migrations: [`${baseDir}/database/migrations/*.${fileExtension}`],
  migrationsTableName: 'migrations',
  
  // NEVER synchronize in production
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
});

export default dataSource;