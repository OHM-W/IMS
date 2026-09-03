import { WebSocket } from 'ws';
import { db } from './db.js';
import { multiDb } from './multiDb.js';
import { config } from './config.js';
import { LdiMachine, WsPayload } from './types.js';

const PRIMARY_TELEMETRY_SQL = `
WITH latest_telemetry AS (
  SELECT DISTINCT ON (d.eqp_id)
    d.eqp_id,
    d.state,
    ROUND(d.temperature::NUMERIC, 1) AS temperature,
    ROUND(d.humidity::NUMERIC, 1) AS humidity,
    ROUND(d.resist_dosage::NUMERIC, 2) AS resist_dosage,
    ROUND(d.scan_speed::NUMERIC, 1) AS scan_speed,
    ROUND(d.air_vacuum::NUMERIC, 1) AS air_vacuum,
    ROUND(d.thickness::NUMERIC, 3) AS thickness,
    d.board_no,
    d.total_board,
    ROUND(d.total_time::NUMERIC, 1) AS total_time,
    d.mo,
    d.fpn,
    d.layer_name,
    d."time" AS last_seen
  FROM public.ldi_data d
  ORDER BY d.eqp_id, d."time" DESC
),
active_alarms AS (
  SELECT DISTINCT a.equipmentid
  FROM public.ldi_alarm_log a
  JOIN public.ldi_alarm_ms_code m ON a.errorcode::TEXT = m.alarm_code::TEXT
  WHERE a.logdate > NOW() - INTERVAL '${config.ALARM_WINDOW_MINUTES} minutes'
    AND m.severity IN ('Critical', 'Major')
)
SELECT
  t.eqp_id,
  'LASER' AS process_type,
  CASE
    WHEN t.last_seen < NOW() - INTERVAL '${config.STALENESS_THRESHOLD_MINUTES} minutes' THEN 0
    WHEN a.equipmentid IS NOT NULL THEN 3
    WHEN t.state = true THEN 1
    ELSE 2
  END AS status,
  t.temperature,
  t.humidity,
  t.resist_dosage,
  t.scan_speed,
  t.air_vacuum,
  t.thickness,
  t.board_no,
  t.total_board,
  t.total_time,
  t.mo,
  t.fpn,
  t.layer_name,
  t.last_seen
FROM latest_telemetry t
LEFT JOIN active_alarms a ON a.equipmentid = t.eqp_id
ORDER BY t.eqp_id;
`;

const DRILL_DB_SQL = `
WITH latest_event AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_type,
    event_code,
    event_message,
    level,
    event_time
  FROM public.tbl_dr_event
  ORDER BY equipment_id, event_time DESC
),
latest_program AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_message AS program_name
  FROM public.tbl_dr_event
  WHERE event_type = 'PROGRAM_LOAD'
  ORDER BY equipment_id, event_time DESC
),
latest_tool AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_message AS tool_info
  FROM public.tbl_dr_event
  WHERE event_type = 'TOOL_CHANGE'
  ORDER BY equipment_id, event_time DESC
),
latest_hits AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_message AS hits_info
  FROM public.tbl_dr_event
  WHERE event_message LIKE 'Run Hits:%'
  ORDER BY equipment_id, event_time DESC
)
SELECT
  e.equipment_id AS eqp_id,
  'DRILLING' AS process_type,
  CASE
    WHEN UPPER(e.event_type) = 'RUN' THEN 1
    WHEN UPPER(e.event_type) IN ('STOP', 'IDLE') THEN 2
    WHEN UPPER(e.event_type) IN ('ALARM', 'ERROR') THEN 3
    WHEN UPPER(e.event_type) = 'TOOL_CHANGE' THEN 4
    ELSE 5
  END AS status,
  e.event_type,
  e.event_code,
  e.event_message,
  p.program_name,
  t.tool_info,
  h.hits_info,
  e.level,
  e.event_time AS last_seen
FROM latest_event e
LEFT JOIN latest_program p ON p.equipment_id = e.equipment_id
LEFT JOIN latest_tool t ON t.equipment_id = e.equipment_id
LEFT JOIN latest_hits h ON h.equipment_id = e.equipment_id;
`;

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
      const res = await db.query(PRIMARY_TELEMETRY_SQL);
      allMachines.push(...res.rows.map((r) => this.formatRow(r, 'timescale')));
    } catch (err: any) {
      console.warn('[floorplan.broadcaster] Primary TimescaleDB query failed:', err.message);
    }

    // 2. Fetch all external registered databases dynamically
    const configuredPools = multiDb.getAllConfiguredPools();
    for (const { key, pool, spec } of configuredPools) {
      if (key === 'timescale' || spec.enabled === false) continue;

      const query = multiDb.getQuery(key) || (key === 'drill_db' ? DRILL_DB_SQL : null);
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
    const processType = row.process_type || defaultProcessType || (dbKey === 'drill_db' ? 'DRILLING' : 'LASER');

    if (processType === 'DRILLING') {
      return {
        ...row,
        eqp_id: String(row.eqp_id),
        process_type: 'DRILLING',
        db_key: dbKey,
        status: Number(row.status ?? 0),
        event_type: row.event_type ? String(row.event_type) : null,
        event_code: row.event_code ? String(row.event_code) : null,
        event_message: row.event_message ? String(row.event_message) : null,
        program_name: row.program_name ? String(row.program_name) : null,
        tool_info: row.tool_info ? String(row.tool_info) : null,
        hits_info: row.hits_info ? String(row.hits_info) : null,
        level: row.level ? String(row.level) : null,
        last_seen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
      } as any;
    }

    return {
      ...row,
      eqp_id: String(row.eqp_id),
      process_type: processType,
      db_key: dbKey,
      status: Number(row.status ?? 0),
      temperature: row.temperature != null ? Number(row.temperature) : null,
      humidity: row.humidity != null ? Number(row.humidity) : null,
      resist_dosage: row.resist_dosage != null ? Number(row.resist_dosage) : null,
      scan_speed: row.scan_speed != null ? Number(row.scan_speed) : null,
      air_vacuum: row.air_vacuum != null ? Number(row.air_vacuum) : null,
      thickness: row.thickness != null ? Number(row.thickness) : null,
      board_no: row.board_no != null ? Number(row.board_no) : null,
      total_board: row.total_board != null ? Number(row.total_board) : null,
      total_time: row.total_time != null ? Number(row.total_time) : null,
      mo: row.mo ? String(row.mo) : null,
      fpn: row.fpn ? String(row.fpn) : null,
      layer_name: row.layer_name ? String(row.layer_name) : null,
      last_seen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
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
