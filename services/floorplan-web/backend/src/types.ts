export interface LdiMachine {
  eqp_id: string;
  status: number; // 0=OFF/STALE, 1=RUN, 2=IDLE, 3=ALARM, 4=LOTO, 5=UNDEFINE
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

export interface WsPayload {
  type: string;
  timestamp: string;
  count: number;
  machines: Record<string, LdiMachine>;
  list: LdiMachine[];
  active_alarms: string[];
}

export interface MachineCustomDef {
  id: string;
  name?: string;
  process?: string;
  processGroup?: string;
  telemetryId?: string;
  svgX: number;
  svgY: number;
  cardWidth?: number;
  cardHeight?: number;
  isCompact?: boolean;
  hasLiveFeed?: boolean;
}

export interface LayoutData {
  custom: boolean;
  machines: MachineCustomDef[];
  deletedIds: string[];
}
