import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export class Database {
  public pool: pg.Pool | null = null;
  private isConnecting = false;

  constructor() {
    this.initPool();
  }

  private initPool() {
    this.pool = new Pool({
      host: config.PGHOST,
      port: config.PGPORT,
      database: config.PGDATABASE,
      user: config.PGUSER,
      password: config.PGPASSWORD,
      min: config.DB_POOL_MIN_SIZE,
      max: config.DB_POOL_MAX_SIZE,
      connectionTimeoutMillis: config.DB_TIMEOUT_MS,
      idleTimeoutMillis: 30000,
    });

    this.pool.on('error', (err) => {
      console.error('[floorplan.db] Unexpected error on idle database client:', err.message);
    });
  }

  public async connectWithRetry(maxRetries = 5, initialBackoffMs = 1000): Promise<boolean> {
    if (this.isConnecting) return false;
    this.isConnecting = true;

    let backoff = initialBackoffMs;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[floorplan.db] Connecting to PostgreSQL/TimescaleDB at ${config.PGHOST}:${config.PGPORT}/${config.PGDATABASE} (attempt ${attempt}/${maxRetries})...`);
        const client = await this.pool?.connect();
        if (client) {
          const res = await client.query('SELECT 1 as alive');
          client.release();
          if (res.rows[0]?.alive === 1) {
            console.log('[floorplan.db] Database connection pool established successfully.');
            this.isConnecting = false;
            return true;
          }
        }
      } catch (err: any) {
        console.warn(`[floorplan.db] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt === maxRetries) {
          console.error(`[floorplan.db] Exhausted all ${maxRetries} database connection attempts.`);
          this.isConnecting = false;
          return false;
        }
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 16000);
      }
    }

    this.isConnecting = false;
    return false;
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      console.log('[floorplan.db] Closing database connection pool...');
      await this.pool.end();
      this.pool = null;
      console.log('[floorplan.db] Database connection pool closed.');
    }
  }

  public async checkHealth(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const res = await this.pool.query('SELECT 1 as alive');
      return res.rows[0]?.alive === 1;
    } catch {
      return false;
    }
  }

  public getPoolStats() {
    if (!this.pool) return { free: 0, used: 0, total: 0 };
    return {
      free: this.pool.idleCount,
      used: this.pool.totalCount - this.pool.idleCount,
      total: this.pool.totalCount,
    };
  }

  public async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }
    return this.pool.query<T>(text, params);
  }
}

export const db = new Database();
