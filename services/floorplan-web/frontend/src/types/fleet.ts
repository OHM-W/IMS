/**
 * Strict TypeScript Type Definitions for IMS 1F Factory Fleet Model & SCADA Architecture
 * Path: services/floorplan-web/frontend/src/types/fleet.ts
 */

export type ProcessCategory =
  | 'DRILLING_HOLD'
  | 'DRILLING_MAIN'
  | 'AUTO_LAY_UP'
  | 'BONDING'
  | 'OXIDE'
  | 'PP_STORAGE'
  | 'CUTTING'
  | 'DE_OXIDE'
  | 'LASER_DRILLING'
  | 'XRY';

export type FleetFilterOption = 'ALL' | 'DRILLING' | ProcessCategory;

export type StatusToken =
  | 'RUN'
  | 'IDLE'
  | 'ALARM'
  | 'STOP'
  | 'OFF'
  | 'UNDEFINE';

export interface MachineDef {
  id: string;
  name: string;
  process: ProcessCategory;
  processGroup?: string;
  columnGroup?: string;
  array?: 'TOP' | 'MIDDLE' | 'BOTTOM' | 'STANDALONE';
  columnIndex?: number;
  rowIndex?: number;
  svgX: number;
  svgY: number;
  cardWidth?: number;
  cardHeight?: number;
  isCompact?: boolean;
  hasLiveFeed?: boolean;
  telemetryId?: string;
  specs?: Record<string, string | number>;
  zoneId?: string;
  bay?: string;
}

export interface ZoneDef {
  id: ProcessCategory;
  name: string;
  displayName: string;
  bounds: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
  };
  focusView: {
    x: number;
    y: number;
    zoom: number;
  };
  machineCount: number;
  description: string;
  color?: string;
  center?: {
    x: number;
    y: number;
  };
}

export interface DrillingColumnSpec {
  label: string;
  array: 'TOP' | 'MIDDLE' | 'BOTTOM' | 'STANDALONE';
  colIndex: number;
  x: number;
  yStart: number;
  yStep: number;
  indices: number[];
  idPrefix: string;
}
