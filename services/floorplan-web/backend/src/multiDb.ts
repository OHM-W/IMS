import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { config } from './config.js';

// Ensure root .env is loaded if present and not already loaded
try {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
  }
} catch {
  // ignore
}

const { Pool } = pg;

export interface DbConnectionSpec {
  key: string;
  type?: 'postgres' | 'timescaledb' | 'mysql' | 'mssql' | 'oracle';
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  password_env?: string;
  isPrimary?: boolean;
  process_type?: string;
  query?: string;
  query_file?: string;
  enabled?: boolean;
}

export interface RouteTarget {
  dbKey: string;
  targetId: string;
}

export class MultiDbManager {
  private pools: Map<string, pg.Pool> = new Map();
  private specs: Map<string, DbConnectionSpec> = new Map();
  private queryCache: Map<string, string> = new Map();
  private dbConfigFile: string;

  constructor() {
    this.dbConfigFile = path.join(config.DATA_DIR, 'databases.json');

    // 1. Register Default Primary TimescaleDB
    this.registerPool({
      key: 'timescale',
      type: 'timescaledb',
      host: config.PGHOST,
      port: config.PGPORT,
      database: config.PGDATABASE,
      user: config.PGUSER,
      password: config.PGPASSWORD,
      query_file: 'queries/ldi_telemetry.sql',
      isPrimary: true,
    });

    // 2. Load external databases from databases.json
    this.loadFromConfigFile();
  }

  private resolveHost(host: string): string {
    // If running in Docker and host is 127.0.0.1 / localhost, redirect to host.docker.internal
    if (host === '127.0.0.1' || host === 'localhost') {
      const isDocker = fs.existsSync('/.dockerenv') || process.env.IS_DOCKER === 'true';
      if (isDocker) {
        return 'host.docker.internal';
      }
    }
    return host;
  }

  public registerPool(spec: DbConnectionSpec) {
    const key = spec.key.toLowerCase();
    this.specs.set(key, spec);

    const resolvedHost = this.resolveHost(spec.host);
    const resolvedPassword = (spec.password_env ? process.env[spec.password_env] : undefined) ?? spec.password;

    if (spec.type === 'postgres' || spec.type === 'timescaledb' || !spec.type) {
      try {
        const oldPool = this.pools.get(key);
        if (oldPool) {
          oldPool.end().catch((err) => {
            console.warn(`[multiDb:${key}] Failed to cleanly end previous pool:`, err.message);
          });
        }

        const pool = new Pool({
          host: resolvedHost,
          port: spec.port,
          database: spec.database,
          user: spec.user,
          password: resolvedPassword,
          min: 1,
          max: 5,
          connectionTimeoutMillis: config.DB_TIMEOUT_MS,
          idleTimeoutMillis: 30000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });

        pool.on('error', (err) => {
          console.warn(`[multiDb:${key}] Database client warning:`, err.message);
        });

        this.pools.set(key, pool);
        console.log(`[multiDb] Registered database pool "${key}" -> ${resolvedHost}:${spec.port}/${spec.database}`);
      } catch (err: any) {
        console.error(`[multiDb] Failed to initialize pool for "${key}":`, err.message);
      }
    }
  }

  public loadFromConfigFile() {
    try {
      if (fs.existsSync(this.dbConfigFile)) {
        const raw = fs.readFileSync(this.dbConfigFile, 'utf-8');
        const dbConfigs = JSON.parse(raw);
        for (const [key, spec] of Object.entries(dbConfigs)) {
          if (key !== 'timescale' && typeof spec === 'object' && spec !== null) {
            this.registerPool({ key, ...(spec as any) });
          }
        }
      }
    } catch (err: any) {
      console.warn('[multiDb] Notice: could not load databases.json:', err.message);
    }
  }

  public getPool(key: string): pg.Pool | undefined {
    return this.pools.get(key.toLowerCase());
  }

  public getSpec(key: string): DbConnectionSpec | undefined {
    return this.specs.get(key.toLowerCase());
  }

  public getQuery(key: string, vars?: Record<string, string | number>): string | null {
    const lowerKey = key.toLowerCase();
    const spec = this.specs.get(lowerKey);
    if (!spec || spec.enabled === false) return null;

    let rawQuery: string | null = null;
    if (spec.query && spec.query.trim().length > 0) {
      rawQuery = spec.query.trim();
    } else if (spec.query_file) {
      if (this.queryCache.has(lowerKey)) {
        rawQuery = this.queryCache.get(lowerKey)!;
      } else {
        try {
          const candidatePaths = [
            path.resolve(config.DATA_DIR, spec.query_file),
            path.resolve(process.cwd(), spec.query_file),
            path.resolve(spec.query_file),
          ];
          for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
              rawQuery = fs.readFileSync(p, 'utf-8').trim();
              this.queryCache.set(lowerKey, rawQuery);
              break;
            }
          }
          if (!rawQuery) {
            console.warn(`[multiDb:${key}] query_file not found: ${spec.query_file}`);
          }
        } catch (err: any) {
          console.warn(`[multiDb:${key}] Failed to load query_file:`, err.message);
        }
      }
    }

    if (!rawQuery) return null;

    if (vars) {
      let interpolated = rawQuery;
      for (const [k, v] of Object.entries(vars)) {
        interpolated = interpolated.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        interpolated = interpolated.replace(new RegExp(`\\$\\{config\\.${k}\\}`, 'g'), String(v));
      }
      return interpolated;
    }

    return rawQuery;
  }

  public getAllConfiguredPools(): Array<{ key: string; pool: pg.Pool; spec: DbConnectionSpec }> {
    const list: Array<{ key: string; pool: pg.Pool; spec: DbConnectionSpec }> = [];
    for (const [key, pool] of this.pools.entries()) {
      const spec = this.specs.get(key);
      if (spec) {
        list.push({ key, pool, spec });
      }
    }
    return list;
  }

  public getAllActivePools(): Array<{ key: string; pool: pg.Pool }> {
    const list: Array<{ key: string; pool: pg.Pool }> = [];
    for (const [key, pool] of this.pools.entries()) {
      list.push({ key, pool });
    }
    return list;
  }

  public getRegisteredKeys(): string[] {
    return Array.from(this.specs.keys());
  }

  public resolveTarget(machine: {
    id: string;
    name?: string;
    process?: string;
    telemetryId?: string;
  }): RouteTarget {
    const rawTelemetry = (machine.telemetryId || '').trim();

    if (rawTelemetry.includes(':')) {
      const parts = rawTelemetry.split(':');
      const dbKey = parts[0].trim().toLowerCase();
      const targetId = parts.slice(1).join(':').trim();
      return { dbKey, targetId };
    }

    if (rawTelemetry) {
      if (rawTelemetry.startsWith('LDI-') || rawTelemetry.startsWith('LSR-')) {
        return { dbKey: 'timescale', targetId: rawTelemetry };
      }
      if (rawTelemetry.startsWith('DRL') || rawTelemetry.startsWith('DRL-')) {
        return { dbKey: 'drill_db', targetId: rawTelemetry };
      }
      if (rawTelemetry.startsWith('BWN-') || rawTelemetry.startsWith('DEO-')) {
        return { dbKey: 'chem_db', targetId: rawTelemetry };
      }
      return { dbKey: 'timescale', targetId: rawTelemetry };
    }

    const proc = (machine.process || '').toUpperCase();
    const fallbackId = machine.name || machine.id;

    switch (proc) {
      case 'DRILLING_MAIN':
      case 'DRILLING_HOLD':
        return { dbKey: 'drill_db', targetId: fallbackId };

      case 'OXIDE':
      case 'DE_OXIDE':
        return { dbKey: 'chem_db', targetId: fallbackId };

      case 'AUTO_LAY_UP':
      case 'BONDING':
        return { dbKey: 'press_db', targetId: fallbackId };

      case 'CUTTING':
        return { dbKey: 'cut_db', targetId: fallbackId };

      case 'LASER_DRILLING':
      default:
        return { dbKey: 'timescale', targetId: fallbackId };
    }
  }
}

export const multiDb = new MultiDbManager();
