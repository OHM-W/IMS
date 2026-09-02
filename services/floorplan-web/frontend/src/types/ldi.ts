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
  process_type?: 'LASER' | 'DRILLING' | 'OXIDE' | 'CUTTING' | 'GENERAL';

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
  level?: string | null;

  last_seen: string | null;
}

export type WsPayload = LdiMachine[];

export interface MachineCoordinate {
  eqp_id: string;
  name: string;
  svgX: number;
  svgY: number;
  width: number;
  height: number;
  bay: string;
  zone: string;
}

export interface HistoryRecord {
  time: string;
  temperature: number | null;
  humidity: number | null;
  resist_dosage: number | null;
  scan_speed: number | null;
  air_vacuum: number | null;
  thickness: number | null;
  board_no: number | null;
  total_board: number | null;
  state: boolean | null;
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface SystemHealth {
  status: string;
  db_connected: boolean;
  timestamp: string;
  pool_free?: number;
  pool_used?: number;
  ws_clients_count?: number;
}

export interface PanzoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  zoomToFit: () => void;
  zoomToMachine: (svgX: number, svgY: number, zoomLevel?: number) => void;
  focusCleanroom: () => void;
}
