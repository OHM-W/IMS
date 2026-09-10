/**
 * Strict TypeScript Type Definitions for IMS Manufacturing Telemetry
 */

export type MachineStatus = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = OFF (Slate)
// 1 = RUN (Green)
// 2 = IDLE (Amber)
// 3 = ALARM (Red)
// 4 = LOTO / TOOL_CHANGE (Cyan)
// 5 = UNDEFINE (Muted)

export interface LdiMachine {
  eqp_id: string;
  status: number;
  process_type?: string;
  db_key?: string;

  // LDI / Laser Telemetry Fields
  temperature: number | null;
  humidity: number | null;
  resist_dosage: number | null;
  scan_speed: number | null;
  air_vacuum: number | null;
  thickness: number | null;
  board_no: number | null;
  total_board: number | null;
  total_time: number | null;
  mo: string | null;
  fpn: string | null;
  layer_name: string | null;

  // Drilling Specific Telemetry Fields
  event_type?: string | null;
  event_code?: string | null;
  event_message?: string | null;
  program_name?: string | null;
  tool_info?: string | null;
  hits_info?: string | null;
  spindle?: string | null;
  rpm?: string | null;
  feed?: string | null;
  level?: string | null;

  last_seen: string | null;

  // Extensible for future databases / custom equipment fields
  [key: string]: any;
}

export type WsPayload = {
  type: string;
  timestamp: string;
  count: number;
  machines: Record<string, LdiMachine>;
  list: LdiMachine[];
  active_alarms: string[];
} | LdiMachine[];

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface PanzoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  zoomToFit: () => void;
  zoomToMachine: (svgX: number, svgY: number, zoomLevel?: number) => void;
  focusCleanroom: () => void;
}

