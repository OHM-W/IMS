import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  APP_NAME: 'IMS Factory Floorplan Backend',
  PORT: parseInt(process.env.PORT || '8000', 10),
  
  // Database Configuration
  PGHOST: process.env.PGHOST || 'ims-timescaledb',
  PGPORT: parseInt(process.env.PGPORT || '5432', 10),
  PGDATABASE: process.env.PGDATABASE || 'ims',
  PGUSER: process.env.PGUSER || 'postgres',
  PGPASSWORD: process.env.PGPASSWORD || 'postgres',
  
  DB_POOL_MIN_SIZE: parseInt(process.env.DB_POOL_MIN_SIZE || '2', 10),
  DB_POOL_MAX_SIZE: parseInt(process.env.DB_POOL_MAX_SIZE || '10', 10),
  DB_TIMEOUT_MS: parseInt(process.env.DB_TIMEOUT_MS || '5000', 10),

  // Telemetry Broadcasting Parameters
  BROADCAST_INTERVAL_MS: parseInt(process.env.BROADCAST_INTERVAL_MS || '2000', 10),
  STALENESS_THRESHOLD_MINUTES: parseInt(process.env.STALENESS_THRESHOLD_MINUTES || '15', 10),
  ALARM_WINDOW_MINUTES: parseInt(process.env.ALARM_WINDOW_MINUTES || '60', 10),

  // File Paths
  DATA_DIR: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  LAYOUT_FILE: path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'custom_fleet.json'),

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
};
