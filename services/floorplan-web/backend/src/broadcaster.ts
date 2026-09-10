import { WebSocket } from 'ws';
import { db } from './db.js';
import { multiDb } from './multiDb.js';
import { config } from './config.js';
import { LdiMachine, WsPayload } from './types.js';



export class Broadcaster {
  private clients: Set<WebSocket> = new Set();
  private intervalTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastSnapshot: LdiMachine[] = [];

  public start() {
    if (this.intervalTimer) return;
    console.log(`[floorplan.broadcaster] Starting multi-db telemetry broadcaster loop (${config.BROADCAST_INTERVAL_MS}ms interval)...`);
    
    this.pollAndBroadcast();

    this.intervalTimer = setInterval(() => {
      this.pollAndBroadcast();
    }, config.BROADCAST_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[floorplan.broadcaster] Telemetry broadcaster loop stopped.');
    }
  }

  public addClient(ws: WebSocket) {
    this.clients.add(ws);
    console.log(`[floorplan.broadcaster] WebSocket client connected. Active clients: ${this.clients.size}`);

    if (this.lastSnapshot.length > 0) {
      const payload = this.buildPayload(this.lastSnapshot);
      try {
        ws.send(JSON.stringify(payload));
      } catch (err: any) {
        console.warn('[floorplan.broadcaster] Failed to send initial snapshot to new client:', err.message);
      }
    }

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`[floorplan.broadcaster] WebSocket client disconnected. Remaining clients: ${this.clients.size}`);
    });

    ws.on('error', (err) => {
      console.warn('[floorplan.broadcaster] WebSocket client error:', err.message);
      this.clients.delete(ws);
    });
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getLastSnapshot(): LdiMachine[] {
    return this.lastSnapshot;
  }

  public async fetchTelemetry(): Promise<LdiMachine[]> {
    const allMachines: LdiMachine[] = [];

    // 1. Fetch Primary TimescaleDB Telemetry (LDI)
    try {
      const primaryQuery = multiDb.getQuery('timescale', {
        ALARM_WINDOW_MINUTES: config.ALARM_WINDOW_MINUTES,
        STALENESS_THRESHOLD_MINUTES: config.STALENESS_THRESHOLD_MINUTES,
      });

      if (primaryQuery) {
        const res = await db.query(primaryQuery);
        allMachines.push(...res.rows.map((r) => this.formatRow(r, 'timescale')));
      }
    } catch (err: any) {
      console.warn('[floorplan.broadcaster] Primary TimescaleDB query failed:', err.message);
    }

    // 2. Fetch all external registered databases dynamically
    const configuredPools = multiDb.getAllConfiguredPools();
    for (const { key, pool, spec } of configuredPools) {
      if (key === 'timescale' || spec.enabled === false) continue;

      const query = multiDb.getQuery(key);
      if (!query) continue;

      try {
        const res = await pool.query(query);
        allMachines.push(...res.rows.map((r) => this.formatRow(r, key, spec.process_type)));
      } catch (err: any) {
        // Warning logged without crashing other DB streams
      }
    }

    return allMachines;
  }

  private formatRow(row: any, dbKey = 'timescale', defaultProcessType?: string): LdiMachine {
    if (!row || typeof row !== 'object') {
      return {} as any;
    }

    const { eqp_id, status, process_type, last_seen, db_key, ...rest } = row;
    const dynamicMetrics: Record<string, any> = { ...rest };

    // Dynamic numeric parsing: converts numeric strings from PostgreSQL into native numbers
    for (const [key, val] of Object.entries(dynamicMetrics)) {
      if (val !== null && typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
        dynamicMetrics[key] = Number(val);
      }
    }

    return {
      ...dynamicMetrics,
      eqp_id: String(eqp_id ?? ''),
      status: Number(status ?? 0),
      process_type: process_type || defaultProcessType || (dbKey === 'drill_db' ? 'DRILLING' : 'LASER'),
      last_seen: last_seen ? new Date(last_seen).toISOString() : null,
      db_key: dbKey,
    } as any;
  }

  public buildPayload(machines: LdiMachine[]): WsPayload {
    const machineMap: Record<string, LdiMachine> = {};
    const activeAlarms: string[] = [];

    for (const m of machines) {
      // Strict 1:1 Exact Match: Only exact equipment ID and explicit db_key:eqp_id
      machineMap[m.eqp_id] = m;
      if ((m as any).db_key) {
        machineMap[`${(m as any).db_key}:${m.eqp_id}`] = m;
      }

      if (m.status === 3) {
        activeAlarms.push(m.eqp_id);
      }
    }

    return {
      type: 'telemetry_update',
      timestamp: new Date().toISOString(),
      count: machines.length,
      machines: machineMap,
      list: machines,
      active_alarms: activeAlarms,
    };
  }

  private async pollAndBroadcast() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const machines = await this.fetchTelemetry();
      this.lastSnapshot = machines;

      if (this.clients.size > 0 && machines.length > 0) {
        const payload = this.buildPayload(machines);
        const jsonStr = JSON.stringify(payload);

        for (const client of this.clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonStr);
          }
        }
      }
    } catch (err: any) {
      console.error('[floorplan.broadcaster] Poll error:', err.message);
    } finally {
      this.isPolling = false;
    }
  }
}

export const broadcaster = new Broadcaster();
