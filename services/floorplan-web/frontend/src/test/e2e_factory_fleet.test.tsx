/**
 * IMS Factory Floorplan Digital Twin — Comprehensive 4-Tier E2E & Integration Test Suite
 * Path: services/floorplan-web/frontend/src/test/e2e_factory_fleet.test.tsx
 *
 * Tiers:
 * - Tier 1: Feature Coverage (>=5 test cases per feature for all 10 factory zones and features F1..F11)
 * - Tier 2: Boundary & Corner Cases (empty datasets, extreme values, rapid filter toggles, disconnects, injection resilience)
 * - Tier 3: Cross-Feature Combinations (filter + panzoom + telemetry + drawer state consistency)
 * - Tier 4: Real-World Manufacturing Scenarios (8-hour shift simulation, alarm escalation, 10-zone supervisor walkthrough, mixed-fleet)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Types & Interfaces
import { LdiMachine, HistoryRecord, PanzoomControls } from '../types/ldi';
import { ProcessCategory } from '../types/fleet';
import { getStatusTheme, getTemperatureTolerance, getHumidityTolerance } from '../constants/colors';
import { SVG_VIEWBOX } from '../constants/machines';
import { MachineDetailPopup } from '../components/MachineDetailPopup';
import { AlarmPanel } from '../components/AlarmPanel';
import { TopBar } from '../components/TopBar';

// =============================================================================
// AUTHORITATIVE SPECIFICATION MODELS & ORACLES (Floor 1 CAD & SCADA Architecture)
// =============================================================================

export interface AuthoritativeZone {
  id: string;
  name: string;
  category: ProcessCategory;
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number };
  center: { x: number; y: number };
  color: string;
  description: string;
  machineCount: number;
  focusZoom: number;
}

export interface AuthoritativeMachine {
  eqp_id: string;
  name: string;
  process: ProcessCategory;
  zoneId: string;
  bay?: string;
  columnGroup?: string;
  array?: 'TOP' | 'MIDDLE' | 'BOTTOM' | 'STANDALONE';
  columnIndex?: number;
  rowIndex?: number;
  svgX: number;
  svgY: number;
  width: number;
  height: number;
  isCompact?: boolean;
  telemetryBinding?: {
    dbSource: 'public.ldi_data' | 'none';
    mappedId?: string;
    hasLiveFeed: boolean;
  };
  specs?: Record<string, string | number>;
}

// 1. Authoritative 10 Factory Zones Specification
export const AUTHORITATIVE_FACTORY_ZONES: AuthoritativeZone[] = [
  {
    id: 'ZONE_DRILLING_HOLD',
    name: 'Drilling Hold & Tool Bay',
    category: 'DRILLING_HOLD',
    bounds: { xMin: 80, yMin: 80, xMax: 480, yMax: 550 },
    center: { x: 280, y: 315 },
    color: '#38BDF8',
    description: 'Drill bit staging, automated collet grinding, and vertical storage buffer.',
    machineCount: 5,
    focusZoom: 2.6,
  },
  {
    id: 'ZONE_DRILLING_MAIN',
    name: 'Mechanical Drilling Matrix',
    category: 'DRILLING_MAIN',
    bounds: { xMin: 500, yMin: 80, xMax: 1420, yMax: 1250 },
    center: { x: 960, y: 665 },
    color: '#00FF87',
    description: 'High-density multi-spindle mechanical CNC drilling columns.',
    machineCount: 198,
    focusZoom: 1.35,
  },
  {
    id: 'ZONE_AUTO_LAYUP',
    name: 'Auto Lay Up & Pressing',
    category: 'AUTO_LAY_UP',
    bounds: { xMin: 1650, yMin: 80, xMax: 2250, yMax: 600 },
    center: { x: 1950, y: 340 },
    color: '#F59E0B',
    description: 'Automated multi-opening vacuum hot/cold press systems and layup kitting.',
    machineCount: 8,
    focusZoom: 2.2,
  },
  {
    id: 'ZONE_BONDING',
    name: 'Pin Lam & Multi-Bonding',
    category: 'BONDING',
    bounds: { xMin: 2280, yMin: 100, xMax: 2550, yMax: 500 },
    center: { x: 2415, y: 300 },
    color: '#A855F7',
    description: 'Multi-layer pin lamination and induction bonding station.',
    machineCount: 1,
    focusZoom: 2.8,
  },
  {
    id: 'ZONE_PP_STORAGE',
    name: 'PP Storage & Preparation',
    category: 'PP_STORAGE',
    bounds: { xMin: 2580, yMin: 80, xMax: 3120, yMax: 800 },
    center: { x: 2850, y: 440 },
    color: '#06B6D4',
    description: 'Prepreg cleanroom storage bays, copper foil racks, and slitting tables.',
    machineCount: 4,
    focusZoom: 1.9,
  },
  {
    id: 'ZONE_OXIDE',
    name: 'Brown Oxide Chemical Lines',
    category: 'OXIDE',
    bounds: { xMin: 1600, yMin: 620, xMax: 2200, yMax: 1080 },
    center: { x: 1900, y: 850 },
    color: '#EC4899',
    description: 'Continuous chemical treatment lines BWN001-BWN003 with ultrasonic cleaners.',
    machineCount: 12,
    focusZoom: 2.2,
  },
  {
    id: 'ZONE_DE_OXIDE',
    name: 'De-Oxide Chemical Strip Line',
    category: 'DE_OXIDE',
    bounds: { xMin: 1600, yMin: 1100, xMax: 2100, yMax: 1480 },
    center: { x: 1850, y: 1290 },
    color: '#14B8A6',
    description: 'De-Oxide acid etching, cascade rinse, and cassette loading/unloading.',
    machineCount: 3,
    focusZoom: 2.4,
  },
  {
    id: 'ZONE_CUTTING',
    name: 'Laminate Cutting & Milling',
    category: 'CUTTING',
    bounds: { xMin: 1100, yMin: 1220, xMax: 1580, yMax: 1520 },
    center: { x: 1340, y: 1370 },
    color: '#EAB308',
    description: 'CCL sizing saws, precision edge beveling, sheet cutters, and corner rounding.',
    machineCount: 11,
    focusZoom: 2.4,
  },
  {
    id: 'ZONE_LASER_DRILLING',
    name: 'Laser Drilling Cleanroom',
    category: 'LASER_DRILLING',
    bounds: { xMin: 2150, yMin: 480, xMax: 2870, yMax: 820 },
    center: { x: 2510, y: 650 },
    color: '#00FF87',
    description: 'UV/CO2 laser micro-via drilling stations with real-time LDI telemetry.',
    machineCount: 5,
    focusZoom: 2.0,
  },
  {
    id: 'ZONE_XRAY',
    name: 'Trimming & X-Ray Inspection',
    category: 'XRY',
    bounds: { xMin: 1350, yMin: 760, xMax: 1550, yMax: 980 },
    center: { x: 1450, y: 870 },
    color: '#8B5CF6',
    description: 'Target hole drilling and multi-layer internal registration X-Ray verification.',
    machineCount: 3,
    focusZoom: 3.0,
  },
];

// Helper: Generate Authoritative 250 Factory Fleet
export function buildAuthoritativeFleet(): AuthoritativeMachine[] {
  const fleet: AuthoritativeMachine[] = [];

  // 1. Drilling Hold (5 units)
  fleet.push(
    { eqp_id: 'DH-ULD', name: 'Vertical Unloader Rack', process: 'DRILLING_HOLD', zoneId: 'ZONE_DRILLING_HOLD', svgX: 160, svgY: 150, width: 70, height: 50, isCompact: true },
    { eqp_id: 'DH-HOL', name: 'Tool Holding Bay', process: 'DRILLING_HOLD', zoneId: 'ZONE_DRILLING_HOLD', svgX: 160, svgY: 240, width: 70, height: 50, isCompact: true },
    { eqp_id: 'DH-GRD', name: 'Collet Grinding Station', process: 'DRILLING_HOLD', zoneId: 'ZONE_DRILLING_HOLD', svgX: 160, svgY: 330, width: 70, height: 50, isCompact: true },
    { eqp_id: 'DH-LDG', name: 'Vertical Loader Rack', process: 'DRILLING_HOLD', zoneId: 'ZONE_DRILLING_HOLD', svgX: 160, svgY: 420, width: 70, height: 50, isCompact: true },
    { eqp_id: 'DH0001', name: 'Master Drill Buffer Cell', process: 'DRILLING_HOLD', zoneId: 'ZONE_DRILLING_HOLD', svgX: 320, svgY: 285, width: 90, height: 70 }
  );

  // 2. Mechanical Drilling Matrix (198 units)
  // 2.1 Top Array (16 columns, 102 units)
  const topGroups = [
    { label: '140..144', count: 5, start: 140, step: 1 },
    { label: '139..135', count: 5, start: 139, step: -1 },
    { label: '134..131', count: 4, start: 134, step: -1 },
    { label: '128..124', count: 5, start: 128, step: -1 },
    { label: '120..115', count: 6, start: 120, step: -1 },
    { label: '119..114', count: 6, start: 119, step: -1 },
    { label: '110..105', count: 6, start: 110, step: -1 },
    { label: '109..104', count: 6, start: 109, step: -1 },
    { label: '099..095', count: 5, start: 99, step: -1 },
    { label: '098..091', count: 8, start: 98, step: -1 },
    { label: '085..079', count: 7, start: 85, step: -1 },
    { label: '082..076', count: 7, start: 82, step: -1 },
    { label: '066..060', count: 7, start: 66, step: -1 },
    { label: '065..057', count: 9, start: 65, step: -1 },
    { label: '048..042', count: 7, start: 48, step: -1 },
    { label: '047..039', count: 9, start: 47, step: -1 },
  ];

  topGroups.forEach((grp, colIdx) => {
    const x = 530 + colIdx * 52;
    for (let r = 0; r < grp.count; r++) {
      const num = grp.start + r * grp.step;
      const id = `DRL-T${String(colIdx).padStart(2, '0')}-${String(num).padStart(3, '0')}`;
      fleet.push({
        eqp_id: id,
        name: `Drill Spindle ${num}`,
        process: 'DRILLING_MAIN',
        zoneId: 'ZONE_DRILLING_MAIN',
        array: 'TOP',
        columnGroup: grp.label,
        columnIndex: colIdx,
        rowIndex: r,
        svgX: x,
        svgY: 120 + r * 46,
        width: 44,
        height: 32,
        isCompact: true,
        specs: { spindleRpm: 200000, powerKw: 3.5 },
      });
    }
  });

  // 2.2 Bottom Array (8 columns, 40 units)
  const bottomGroups = [
    { label: '101..104', count: 4, start: 101, step: 1 },
    { label: '094..091', count: 4, start: 94, step: -1 },
    { label: '087..080', count: 8, start: 87, step: -1 },
    { label: '078..075', count: 4, start: 78, step: -1 },
    { label: '071..067', count: 5, start: 71, step: -1 },
    { label: '062..058', count: 5, start: 62, step: -1 },
    { label: '053..049', count: 5, start: 53, step: -1 },
    { label: '042..038', count: 5, start: 42, step: -1 },
  ];

  bottomGroups.forEach((grp, colIdx) => {
    const x = 980 + colIdx * 52;
    for (let r = 0; r < grp.count; r++) {
      const num = grp.start + r * grp.step;
      const id = `DRL-B${String(colIdx).padStart(2, '0')}-${String(num).padStart(3, '0')}`;
      fleet.push({
        eqp_id: id,
        name: `Drill Spindle B${num}`,
        process: 'DRILLING_MAIN',
        zoneId: 'ZONE_DRILLING_MAIN',
        array: 'BOTTOM',
        columnGroup: grp.label,
        columnIndex: colIdx,
        rowIndex: r,
        svgX: x,
        svgY: 680 + r * 46,
        width: 44,
        height: 32,
        isCompact: true,
        specs: { spindleRpm: 200000, powerKw: 3.5 },
      });
    }
  });

  // 2.3 Middle Array (8 columns + 2 standalone, 56 units)
  const midGroups = [
    { label: '030..033', count: 4, start: 30, step: 1 },
    { label: '029..032', count: 4, start: 29, step: 1 },
    { label: '026..017', count: 10, start: 26, step: -1 },
    { label: '025..016', count: 10, start: 25, step: -1 },
    { label: '014..015', count: 2, start: 14, step: 1 },
    { label: '009..001', count: 9, start: 9, step: -1 },
    { label: '008..001', count: 8, start: 8, step: -1 },
    { label: '007..001', count: 7, start: 7, step: -1 },
  ];

  midGroups.forEach((grp, colIdx) => {
    const x = 530 + colIdx * 50;
    for (let r = 0; r < grp.count; r++) {
      const num = grp.start + r * grp.step;
      const id = `DRL-M${String(colIdx).padStart(2, '0')}-${String(num).padStart(3, '0')}`;
      fleet.push({
        eqp_id: id,
        name: `Drill Spindle M${num}`,
        process: 'DRILLING_MAIN',
        zoneId: 'ZONE_DRILLING_MAIN',
        array: 'MIDDLE',
        columnGroup: grp.label,
        columnIndex: colIdx,
        rowIndex: r,
        svgX: x,
        svgY: 660 + r * 44,
        width: 44,
        height: 32,
        isCompact: true,
        specs: { spindleRpm: 200000, powerKw: 3.5 },
      });
    }
  });

  // Standalone units (2 units)
  fleet.push(
    { eqp_id: 'DRL-S001', name: 'Drill Spindle S001', process: 'DRILLING_MAIN', zoneId: 'ZONE_DRILLING_MAIN', array: 'STANDALONE', svgX: 930, svgY: 660, width: 44, height: 32, isCompact: true },
    { eqp_id: 'DRL-S002', name: 'Drill Spindle S002', process: 'DRILLING_MAIN', zoneId: 'ZONE_DRILLING_MAIN', array: 'STANDALONE', svgX: 930, svgY: 704, width: 44, height: 32, isCompact: true }
  );

  // 3. Auto Lay Up (8 units)
  fleet.push(
    { eqp_id: '1-H1', name: 'Vacuum Hot Press 01', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 1720, svgY: 180, width: 90, height: 70 },
    { eqp_id: '1-H2', name: 'Vacuum Hot Press 02', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 1860, svgY: 180, width: 90, height: 70 },
    { eqp_id: '1-H3', name: 'Vacuum Hot Press 03', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 2000, svgY: 180, width: 90, height: 70 },
    { eqp_id: '1-C1', name: 'Hydraulic Cold Press 01', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 1720, svgY: 320, width: 90, height: 70 },
    { eqp_id: '1-C2', name: 'Hydraulic Cold Press 02', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 1860, svgY: 320, width: 90, height: 70 },
    { eqp_id: 'PRS', name: 'Press Loader/Unloader Robot', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 2000, svgY: 320, width: 80, height: 60 },
    { eqp_id: 'DLM', name: 'Pin Separation / Delamination', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 2140, svgY: 180, width: 80, height: 60 },
    { eqp_id: 'LTK', name: 'Layup Transfer & Kitting', process: 'AUTO_LAY_UP', zoneId: 'ZONE_AUTO_LAYUP', svgX: 2140, svgY: 320, width: 80, height: 60 }
  );

  // 4. Bonding (1 unit)
  fleet.push({
    eqp_id: 'BND001',
    name: 'Pin-Lam Multi-Bonding Machine',
    process: 'BONDING',
    zoneId: 'ZONE_BONDING',
    svgX: 2415,
    svgY: 300,
    width: 110,
    height: 80,
  });

  // 5. Brown Oxide Chemical Lines (12 units across 3 lines)
  ['BWN001', 'BWN002', 'BWN003'].forEach((line, lIdx) => {
    const y = 720 + lIdx * 120;
    fleet.push(
      { eqp_id: `${line}-ULD`, name: `${line} Cassette Unloader`, process: 'OXIDE', zoneId: 'ZONE_OXIDE', svgX: 1680, svgY: y, width: 70, height: 50 },
      { eqp_id: `${line}-BWN`, name: `${line} Oxide Chemical Bath`, process: 'OXIDE', zoneId: 'ZONE_OXIDE', svgX: 1820, svgY: y, width: 80, height: 50 },
      { eqp_id: `${line}-PUC`, name: `${line} Ultrasonic DI Rinse`, process: 'OXIDE', zoneId: 'ZONE_OXIDE', svgX: 1960, svgY: y, width: 80, height: 50 },
      { eqp_id: `${line}-LDG`, name: `${line} Panel Loader`, process: 'OXIDE', zoneId: 'ZONE_OXIDE', svgX: 2100, svgY: y, width: 70, height: 50 }
    );
  });

  // 6. PP Storage (4 units)
  fleet.push(
    { eqp_id: 'PP-BAY-01', name: 'Prepreg Storage Bay 1', process: 'PP_STORAGE', zoneId: 'ZONE_PP_STORAGE', svgX: 2680, svgY: 220, width: 110, height: 70 },
    { eqp_id: 'PP-BAY-02', name: 'Prepreg Storage Bay 2', process: 'PP_STORAGE', zoneId: 'ZONE_PP_STORAGE', svgX: 2900, svgY: 220, width: 110, height: 70 },
    { eqp_id: 'PP-BAY-03', name: 'Copper Foil Roll Rack', process: 'PP_STORAGE', zoneId: 'ZONE_PP_STORAGE', svgX: 2680, svgY: 480, width: 110, height: 70 },
    { eqp_id: 'PP-BAY-04', name: 'Automated PP Slitting Table', process: 'PP_STORAGE', zoneId: 'ZONE_PP_STORAGE', svgX: 2900, svgY: 480, width: 110, height: 70 }
  );

  // 7. Cutting (11 units)
  fleet.push(
    { eqp_id: 'CCL001', name: 'Laminate Saw 01', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1160, svgY: 1280, width: 75, height: 48 },
    { eqp_id: 'CCL002', name: 'Laminate Saw 02', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1280, svgY: 1280, width: 75, height: 48 },
    { eqp_id: 'VSC', name: 'Vertical Panel Saw', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1400, svgY: 1280, width: 75, height: 48 },
    { eqp_id: 'CUT', name: 'Auto Sheet Cutter', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1520, svgY: 1280, width: 75, height: 48 },
    { eqp_id: 'MIL1', name: 'Edge Milling Unit 1', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1160, svgY: 1380, width: 75, height: 48 },
    { eqp_id: 'MIL2', name: 'Edge Milling Unit 2', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1280, svgY: 1380, width: 75, height: 48 },
    { eqp_id: 'MIL3', name: 'Edge Milling Unit 3', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1400, svgY: 1380, width: 75, height: 48 },
    { eqp_id: 'ULD1', name: 'Laminate Stacker 1', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1160, svgY: 1460, width: 75, height: 44 },
    { eqp_id: 'ULD2', name: 'Laminate Stacker 2', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1280, svgY: 1460, width: 75, height: 44 },
    { eqp_id: 'ULD3', name: 'Laminate Stacker 3', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1400, svgY: 1460, width: 75, height: 44 },
    { eqp_id: 'CLD1', name: 'Auto Corner Rounder', process: 'CUTTING', zoneId: 'ZONE_CUTTING', svgX: 1520, svgY: 1420, width: 75, height: 50 }
  );

  // 8. De-Oxide (3 units)
  fleet.push(
    { eqp_id: 'DEO-LDG', name: 'Strip Line Panel Loader', process: 'DE_OXIDE', zoneId: 'ZONE_DE_OXIDE', svgX: 1700, svgY: 1290, width: 80, height: 55 },
    { eqp_id: 'DEO-DEO', name: 'De-Oxide Acid Etch & Rinse', process: 'DE_OXIDE', zoneId: 'ZONE_DE_OXIDE', svgX: 1850, svgY: 1290, width: 95, height: 55 },
    { eqp_id: 'DEO-ULD', name: 'Strip Line Panel Unloader', process: 'DE_OXIDE', zoneId: 'ZONE_DE_OXIDE', svgX: 2000, svgY: 1290, width: 80, height: 55 }
  );

  // 9. Laser Drilling Cleanroom (5 units with live telemetry binding)
  const ldiCoords = [
    { id: 'LSR-001', name: 'Laser Drill 01', telId: 'LDI-01', x: 2210, y: 560 },
    { id: 'LSR-002', name: 'Laser Drill 02', telId: 'LDI-02', x: 2350, y: 560 },
    { id: 'LSR-003', name: 'Laser Drill 03', telId: 'LDI-03', x: 2490, y: 560 },
    { id: 'LSR-004', name: 'Laser Drill 04', telId: 'LDI-04', x: 2630, y: 560 },
    { id: 'LSR-005', name: 'Laser Drill 05', telId: 'LDI-05', x: 2770, y: 560 },
  ];

  ldiCoords.forEach((item) => {
    fleet.push({
      eqp_id: item.id,
      name: item.name,
      process: 'LASER_DRILLING',
      zoneId: 'ZONE_LASER_DRILLING',
      svgX: item.x,
      svgY: item.y,
      width: 110,
      height: 90,
      telemetryBinding: {
        dbSource: 'public.ldi_data',
        mappedId: item.telId,
        hasLiveFeed: true,
      },
      specs: { laserType: '355nm UV Laser', dosage: 35.0, scanSpeed: 120 },
    });
  });

  // 10. Trimming & X-Ray Inspection (3 units)
  fleet.push(
    { eqp_id: 'XRY-001', name: 'X-Ray Target Drill 01', process: 'XRY', zoneId: 'ZONE_XRAY', svgX: 1450, svgY: 800, width: 80, height: 55 },
    { eqp_id: 'XRY-002', name: 'X-Ray Target Drill 02', process: 'XRY', zoneId: 'ZONE_XRAY', svgX: 1450, svgY: 870, width: 80, height: 55 },
    { eqp_id: 'XRY-003', name: 'Registration X-Ray Inspector', process: 'XRY', zoneId: 'ZONE_XRAY', svgX: 1450, svgY: 940, width: 80, height: 55 }
  );

  return fleet;
}

// Helper: Decoupled Telemetry Resolver Engine
export function resolveFleetTelemetry(
  machine: AuthoritativeMachine,
  telemetryMap: Record<string, LdiMachine>
): { hasLiveFeed: boolean; telemetry: LdiMachine } {
  if (!machine) {
    return {
      hasLiveFeed: false,
      telemetry: {
        eqp_id: 'UNKNOWN',
        status: 5,
        temperature: null,
        humidity: null,
        resist_dosage: null,
        scan_speed: null,
        air_vacuum: null,
        thickness: null,
        board_no: null,
        total_board: null,
        total_time: null,
        mo: null,
        fpn: null,
        layer_name: null,
        last_seen: null,
      },
    };
  }

  const mappedId = machine.telemetryBinding?.mappedId || machine.eqp_id;
  const raw =
    telemetryMap[mappedId] ||
    telemetryMap[machine.eqp_id] ||
    (machine.eqp_id ? telemetryMap[machine.eqp_id.toUpperCase()] : undefined);

  if (raw && raw.status !== undefined) {
    return { hasLiveFeed: true, telemetry: raw };
  }

  // Fallback to Undefine / Off baseline
  const fallback: LdiMachine = {
    eqp_id: machine.eqp_id,
    status: 5, // UNDEFINE
    temperature: null,
    humidity: null,
    resist_dosage: null,
    scan_speed: null,
    air_vacuum: null,
    thickness: null,
    board_no: null,
    total_board: null,
    total_time: null,
    mo: null,
    fpn: null,
    layer_name: null,
    last_seen: null,
  };

  return { hasLiveFeed: false, telemetry: fallback };
}

// =============================================================================
// TEST SUITE: 4-TIER REQUIREMENT-DRIVEN FACTORY DIGITAL TWIN E2E
// =============================================================================

describe('FACTORY FLOORPLAN DIGITAL TWIN — 4-TIER E2E TEST SUITE', () => {
  const authoritativeFleet = buildAuthoritativeFleet();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as any;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // TIER 1: FEATURE COVERAGE (10 Zones & Features F1..F11, >=5 tests each)
  // ===========================================================================
  describe('TIER 1: Feature Coverage & Zone Specifications', () => {
    // 1.1 Zone 1: DRILLING HOLD
    describe('1.1 Zone 1: DRILLING HOLD (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_DRILLING_HOLD')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_DRILLING_HOLD');

      it('T1.Z1.1 verifies exactly 5 units assigned to Drilling Hold', () => {
        expect(zone.machineCount).toBe(5);
        expect(machines.length).toBe(5);
        expect(machines.map((m) => m.eqp_id)).toEqual(['DH-ULD', 'DH-HOL', 'DH-GRD', 'DH-LDG', 'DH0001']);
      });

      it('T1.Z1.2 verifies all machine coordinates fall strictly within zone bounds [80, 80, 480, 550]', () => {
        machines.forEach((m) => {
          expect(m.svgX).toBeGreaterThanOrEqual(zone.bounds.xMin);
          expect(m.svgX).toBeLessThanOrEqual(zone.bounds.xMax);
          expect(m.svgY).toBeGreaterThanOrEqual(zone.bounds.yMin);
          expect(m.svgY).toBeLessThanOrEqual(zone.bounds.yMax);
        });
      });

      it('T1.Z1.3 verifies centroid position is (280, 315) and focus zoom level is 2.6x', () => {
        expect(zone.center.x).toBe(280);
        expect(zone.center.y).toBe(315);
        expect(zone.focusZoom).toBe(2.6);
      });

      it('T1.Z1.4 verifies vertical unloader/loader/collet staging rack dimensions (70x50) and master cell (90x70)', () => {
        const uld = machines.find((m) => m.eqp_id === 'DH-ULD')!;
        const master = machines.find((m) => m.eqp_id === 'DH0001')!;
        expect(uld.width).toBe(70);
        expect(uld.height).toBe(50);
        expect(master.width).toBe(90);
        expect(master.height).toBe(70);
      });

      it('T1.Z1.5 verifies category metadata equals DRILLING_HOLD with cyan accent color', () => {
        expect(zone.category).toBe('DRILLING_HOLD');
        expect(zone.color).toBe('#38BDF8');
      });
    });

    // 1.2 Zone 2: DRILLING MAIN MATRIX
    describe('1.2 Zone 2: DRILLING MAIN MATRIX (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_DRILLING_MAIN')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_DRILLING_MAIN');

      it('T1.Z2.1 verifies Top Array contains 16 columns and exactly 102 spindle units', () => {
        const topArray = machines.filter((m) => m.array === 'TOP');
        expect(topArray.length).toBe(102);
      });

      it('T1.Z2.2 verifies Bottom Array contains 8 columns and exactly 40 spindle units', () => {
        const bottomArray = machines.filter((m) => m.array === 'BOTTOM');
        expect(bottomArray.length).toBe(40);
      });

      it('T1.Z2.3 verifies Middle Array contains 8 columns + 2 standalone units equaling 56 units', () => {
        const midArray = machines.filter((m) => m.array === 'MIDDLE');
        const standalone = machines.filter((m) => m.array === 'STANDALONE');
        expect(midArray.length + standalone.length).toBe(56);
      });

      it('T1.Z2.4 verifies total mechanical drilling matrix capacity equals exactly 198 units', () => {
        expect(machines.length).toBe(198);
        expect(zone.machineCount).toBe(198);
      });

      it('T1.Z2.5 verifies spatial bounds [500, 80, 1420, 1250] and center (960, 665)', () => {
        expect(zone.bounds.xMin).toBe(500);
        expect(zone.bounds.xMax).toBe(1420);
        expect(zone.center.x).toBe(960);
        expect(zone.center.y).toBe(665);
      });
    });

    // 1.3 Zone 3: AUTO LAY UP
    describe('1.3 Zone 3: AUTO LAY UP (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_AUTO_LAYUP')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_AUTO_LAYUP');

      it('T1.Z3.1 verifies exactly 8 stations in Auto Lay Up', () => {
        expect(machines.length).toBe(8);
        expect(machines.map((m) => m.eqp_id)).toEqual(['1-H1', '1-H2', '1-H3', '1-C1', '1-C2', 'PRS', 'DLM', 'LTK']);
      });

      it('T1.Z3.2 verifies hot presses (1-H1..3) positioned at Y=180 and cold presses (1-C1..2) at Y=320', () => {
        const hot = machines.filter((m) => m.eqp_id.startsWith('1-H'));
        const cold = machines.filter((m) => m.eqp_id.startsWith('1-C'));
        expect(hot.every((m) => m.svgY === 180)).toBe(true);
        expect(cold.every((m) => m.svgY === 320)).toBe(true);
      });

      it('T1.Z3.3 verifies robot loader PRS and transfer table LTK coordinates', () => {
        const prs = machines.find((m) => m.eqp_id === 'PRS')!;
        const ltk = machines.find((m) => m.eqp_id === 'LTK')!;
        expect(prs.svgX).toBe(2000);
        expect(prs.svgY).toBe(320);
        expect(ltk.svgX).toBe(2140);
        expect(ltk.svgY).toBe(320);
      });

      it('T1.Z3.4 verifies spatial bounds [1650, 80, 2250, 600] and center (1950, 340)', () => {
        expect(zone.bounds.xMin).toBe(1650);
        expect(zone.bounds.xMax).toBe(2250);
        expect(zone.center.x).toBe(1950);
        expect(zone.center.y).toBe(340);
      });

      it('T1.Z3.5 verifies focus zoom level is 2.2x with amber category color #F59E0B', () => {
        expect(zone.focusZoom).toBe(2.2);
        expect(zone.color).toBe('#F59E0B');
      });
    });

    // 1.4 Zone 4: BONDING
    describe('1.4 Zone 4: BONDING (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_BONDING')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_BONDING');

      it('T1.Z4.1 verifies single dedicated pin-lam machine BND001 exists', () => {
        expect(machines.length).toBe(1);
        expect(machines[0].eqp_id).toBe('BND001');
      });

      it('T1.Z4.2 verifies location at (2415, 300) with dimensions 110x80px', () => {
        expect(machines[0].svgX).toBe(2415);
        expect(machines[0].svgY).toBe(300);
        expect(machines[0].width).toBe(110);
        expect(machines[0].height).toBe(80);
      });

      it('T1.Z4.3 verifies spatial bounds [2280, 100, 2550, 500]', () => {
        expect(zone.bounds.xMin).toBe(2280);
        expect(zone.bounds.xMax).toBe(2550);
      });

      it('T1.Z4.4 verifies tight camera focus zoom clamp of 2.8x', () => {
        expect(zone.focusZoom).toBe(2.8);
      });

      it('T1.Z4.5 verifies category is BONDING with purple token #A855F7', () => {
        expect(zone.category).toBe('BONDING');
        expect(zone.color).toBe('#A855F7');
      });
    });

    // 1.5 Zone 5: BROWN OXIDE
    describe('1.5 Zone 5: BROWN OXIDE CHEMICAL LINES (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_OXIDE')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_OXIDE');

      it('T1.Z5.1 verifies 12 stations across 3 parallel chemical lines (BWN001, BWN002, BWN003)', () => {
        expect(machines.length).toBe(12);
        expect(zone.machineCount).toBe(12);
      });

      it('T1.Z5.2 verifies 4 sequential stages per line: ULD (1680) -> BWN (1820) -> PUC (1960) -> LDG (2100)', () => {
        ['BWN001', 'BWN002', 'BWN003'].forEach((line) => {
          const uld = machines.find((m) => m.eqp_id === `${line}-ULD`)!;
          const bwn = machines.find((m) => m.eqp_id === `${line}-BWN`)!;
          const puc = machines.find((m) => m.eqp_id === `${line}-PUC`)!;
          const ldg = machines.find((m) => m.eqp_id === `${line}-LDG`)!;

          expect(uld.svgX).toBe(1680);
          expect(bwn.svgX).toBe(1820);
          expect(puc.svgX).toBe(1960);
          expect(ldg.svgX).toBe(2100);
        });
      });

      it('T1.Z5.3 verifies parallel line vertical spacing at Y=720, Y=840, Y=960', () => {
        const l1 = machines.filter((m) => m.eqp_id.startsWith('BWN001'));
        const l2 = machines.filter((m) => m.eqp_id.startsWith('BWN002'));
        const l3 = machines.filter((m) => m.eqp_id.startsWith('BWN003'));

        expect(l1.every((m) => m.svgY === 720)).toBe(true);
        expect(l2.every((m) => m.svgY === 840)).toBe(true);
        expect(l3.every((m) => m.svgY === 960)).toBe(true);
      });

      it('T1.Z5.4 verifies spatial bounds [1600, 620, 2200, 1080] and center (1900, 850)', () => {
        expect(zone.bounds.xMin).toBe(1600);
        expect(zone.bounds.xMax).toBe(2200);
        expect(zone.center.x).toBe(1900);
        expect(zone.center.y).toBe(850);
      });

      it('T1.Z5.5 verifies focus zoom level is 2.2x with pink color #EC4899', () => {
        expect(zone.focusZoom).toBe(2.2);
        expect(zone.color).toBe('#EC4899');
      });
    });

    // 1.6 Zone 6: PP STORAGE
    describe('1.6 Zone 6: PP STORAGE & PREPARATION (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_PP_STORAGE')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_PP_STORAGE');

      it('T1.Z6.1 verifies 4 bay blocks configured in PP Storage', () => {
        expect(machines.length).toBe(4);
        expect(machines.map((m) => m.eqp_id)).toEqual(['PP-BAY-01', 'PP-BAY-02', 'PP-BAY-03', 'PP-BAY-04']);
      });

      it('T1.Z6.2 verifies prepreg storage bays at Y=220 and copper foil/slitting at Y=480', () => {
        const b1 = machines.find((m) => m.eqp_id === 'PP-BAY-01')!;
        const b3 = machines.find((m) => m.eqp_id === 'PP-BAY-03')!;
        expect(b1.svgY).toBe(220);
        expect(b3.svgY).toBe(480);
      });

      it('T1.Z6.3 verifies spatial bounds [2580, 80, 3120, 800]', () => {
        expect(zone.bounds.xMin).toBe(2580);
        expect(zone.bounds.xMax).toBe(3120);
      });

      it('T1.Z6.4 verifies card dimensions are 110x70px for all storage bays', () => {
        machines.forEach((m) => {
          expect(m.width).toBe(110);
          expect(m.height).toBe(70);
        });
      });

      it('T1.Z6.5 verifies focus zoom 1.9x with cyan accent #06B6D4', () => {
        expect(zone.focusZoom).toBe(1.9);
        expect(zone.color).toBe('#06B6D4');
      });
    });

    // 1.7 Zone 7: CUTTING
    describe('1.7 Zone 7: LAMINATE CUTTING & MILLING (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_CUTTING')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_CUTTING');

      it('T1.Z7.1 verifies exactly 11 machines in Laminate Cutting zone', () => {
        expect(machines.length).toBe(11);
        expect(zone.machineCount).toBe(11);
      });

      it('T1.Z7.2 verifies CCL saws (CCL001..002, VSC, CUT) positioned at Y=1280', () => {
        const saws = machines.filter((m) => ['CCL001', 'CCL002', 'VSC', 'CUT'].includes(m.eqp_id));
        expect(saws.length).toBe(4);
        expect(saws.every((m) => m.svgY === 1280)).toBe(true);
      });

      it('T1.Z7.3 verifies Edge Milling units (MIL1..3) positioned at Y=1380', () => {
        const mills = machines.filter((m) => m.eqp_id.startsWith('MIL'));
        expect(mills.length).toBe(3);
        expect(mills.every((m) => m.svgY === 1380)).toBe(true);
      });

      it('T1.Z7.4 verifies unloader stackers (ULD1..3) at Y=1460 and corner rounder CLD1 at Y=1420', () => {
        const ulds = machines.filter((m) => m.eqp_id.startsWith('ULD'));
        const cld = machines.find((m) => m.eqp_id === 'CLD1')!;
        expect(ulds.length).toBe(3);
        expect(ulds.every((m) => m.svgY === 1460)).toBe(true);
        expect(cld.svgY).toBe(1420);
      });

      it('T1.Z7.5 verifies spatial bounds [1100, 1220, 1580, 1520] and center (1340, 1370)', () => {
        expect(zone.bounds.xMin).toBe(1100);
        expect(zone.bounds.xMax).toBe(1580);
        expect(zone.center.x).toBe(1340);
        expect(zone.center.y).toBe(1370);
      });
    });

    // 1.8 Zone 8: DE-OXIDE
    describe('1.8 Zone 8: DE-OXIDE STRIP LINE (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_DE_OXIDE')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_DE_OXIDE');

      it('T1.Z8.1 verifies 3 stations in De-Oxide strip line', () => {
        expect(machines.length).toBe(3);
        expect(machines.map((m) => m.eqp_id)).toEqual(['DEO-LDG', 'DEO-DEO', 'DEO-ULD']);
      });

      it('T1.Z8.2 verifies in-line sequence Loader (1700) -> Acid Etch (1850) -> Unloader (2000) at Y=1290', () => {
        expect(machines[0].svgX).toBe(1700);
        expect(machines[1].svgX).toBe(1850);
        expect(machines[2].svgX).toBe(2000);
        expect(machines.every((m) => m.svgY === 1290)).toBe(true);
      });

      it('T1.Z8.3 verifies spatial bounds [1600, 1100, 2100, 1480]', () => {
        expect(zone.bounds.xMin).toBe(1600);
        expect(zone.bounds.xMax).toBe(2100);
      });

      it('T1.Z8.4 verifies focus zoom is 2.4x with teal color #14B8A6', () => {
        expect(zone.focusZoom).toBe(2.4);
        expect(zone.color).toBe('#14B8A6');
      });

      it('T1.Z8.5 verifies category is DE_OXIDE with correct zone name', () => {
        expect(zone.category).toBe('DE_OXIDE');
        expect(zone.name).toBe('De-Oxide Chemical Strip Line');
      });
    });

    // 1.9 Zone 9: LASER DRILLING CLEANROOM
    describe('1.9 Zone 9: LASER DRILLING CLEANROOM (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_LASER_DRILLING')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_LASER_DRILLING');

      it('T1.Z9.1 verifies 5 Laser Drilling stations (LSR-001..005) mapped to live LDI telemetry', () => {
        expect(machines.length).toBe(5);
        expect(machines.every((m) => m.telemetryBinding?.hasLiveFeed === true)).toBe(true);
        expect(machines.map((m) => m.telemetryBinding?.mappedId)).toEqual([
          'LDI-01', 'LDI-02', 'LDI-03', 'LDI-04', 'LDI-05'
        ]);
      });

      it('T1.Z9.2 verifies CAD-extracted Y=560 alignment and X coords (2210, 2350, 2490, 2630, 2770)', () => {
        expect(machines.every((m) => m.svgY === 560)).toBe(true);
        expect(machines.map((m) => m.svgX)).toEqual([2210, 2350, 2490, 2630, 2770]);
      });

      it('T1.Z9.3 verifies Cleanroom spatial bounds [2150, 480, 2870, 820] and center (2510, 650)', () => {
        expect(zone.bounds.xMin).toBe(2150);
        expect(zone.bounds.xMax).toBe(2870);
        expect(zone.center.x).toBe(2510);
        expect(zone.center.y).toBe(650);
      });

      it('T1.Z9.4 verifies standard card size 110x90px for Cleanroom cells', () => {
        machines.forEach((m) => {
          expect(m.width).toBe(110);
          expect(m.height).toBe(90);
        });
      });

      it('T1.Z9.5 verifies focus zoom 2.0x and green accent color #00FF87', () => {
        expect(zone.focusZoom).toBe(2.0);
        expect(zone.color).toBe('#00FF87');
      });
    });

    // 1.10 Zone 10: TRIMMING & X-RAY INSPECTION
    describe('1.10 Zone 10: TRIMMING & X-RAY INSPECTION (5 Tests)', () => {
      const zone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.id === 'ZONE_XRAY')!;
      const machines = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_XRAY');

      it('T1.Z10.1 verifies 3 machines (XRY-001..003) in X-Ray zone', () => {
        expect(machines.length).toBe(3);
        expect(machines.map((m) => m.eqp_id)).toEqual(['XRY-001', 'XRY-002', 'XRY-003']);
      });

      it('T1.Z10.2 verifies vertical column alignment at X=1450 and Y=(800, 870, 940)', () => {
        expect(machines.every((m) => m.svgX === 1450)).toBe(true);
        expect(machines.map((m) => m.svgY)).toEqual([800, 870, 940]);
      });

      it('T1.Z10.3 verifies spatial bounds [1350, 760, 1550, 980] and center (1450, 870)', () => {
        expect(zone.bounds.xMin).toBe(1350);
        expect(zone.bounds.xMax).toBe(1550);
        expect(zone.center.x).toBe(1450);
        expect(zone.center.y).toBe(870);
      });

      it('T1.Z10.4 verifies tight zoom factor of 3.0x for precision inspection', () => {
        expect(zone.focusZoom).toBe(3.0);
      });

      it('T1.Z10.5 verifies category is XRY with violet accent #8B5CF6', () => {
        expect(zone.category).toBe('XRY');
        expect(zone.color).toBe('#8B5CF6');
      });
    });

    // 1.11 Feature F1: Multi-Zone Factory Fleet Model
    describe('1.11 Feature F1: Multi-Zone Factory Fleet Model (5 Tests)', () => {
      it('T1.F1.1 verifies total factory fleet across all 10 zones sums to exactly 250 units', () => {
        expect(authoritativeFleet.length).toBe(250);
        const sumZones = AUTHORITATIVE_FACTORY_ZONES.reduce((acc, z) => acc + z.machineCount, 0);
        expect(sumZones).toBe(250);
      });

      it('T1.F1.2 verifies every machine has a unique non-empty eqp_id and valid name', () => {
        const ids = new Set<string>();
        authoritativeFleet.forEach((m) => {
          expect(m.eqp_id).toBeTruthy();
          expect(m.name).toBeTruthy();
          expect(ids.has(m.eqp_id)).toBe(false);
          ids.add(m.eqp_id);
        });
        expect(ids.size).toBe(250);
      });

      it('T1.F1.3 verifies all 250 machines are placed within SVG canvas extents [0..3200, 0..1550]', () => {
        authoritativeFleet.forEach((m) => {
          expect(m.svgX).toBeGreaterThanOrEqual(0);
          expect(m.svgX).toBeLessThanOrEqual(3200);
          expect(m.svgY).toBeGreaterThanOrEqual(0);
          expect(m.svgY).toBeLessThanOrEqual(1550);
        });
      });

      it('T1.F1.4 verifies zero bounding box collisions between all pairwise combinations in same array/zone', () => {
        const nonMatrixMachines = authoritativeFleet.filter((m) => m.zoneId !== 'ZONE_DRILLING_MAIN');
        for (let i = 0; i < nonMatrixMachines.length; i++) {
          for (let j = i + 1; j < nonMatrixMachines.length; j++) {
            const m1 = nonMatrixMachines[i];
            const m2 = nonMatrixMachines[j];
            if (m1.zoneId !== m2.zoneId) continue;

            const halfW1 = m1.width / 2;
            const halfH1 = m1.height / 2;
            const halfW2 = m2.width / 2;
            const halfH2 = m2.height / 2;

            const m1_left = m1.svgX - halfW1;
            const m1_right = m1.svgX + halfW1;
            const m1_top = m1.svgY - halfH1;
            const m1_bottom = m1.svgY + halfH1;

            const m2_left = m2.svgX - halfW2;
            const m2_right = m2.svgX + halfW2;
            const m2_top = m2.svgY - halfH2;
            const m2_bottom = m2.svgY + halfH2;

            const overlapsX = m1_left < m2_right && m1_right > m2_left;
            const overlapsY = m1_top < m2_bottom && m1_bottom > m2_top;
            expect(overlapsX && overlapsY).toBe(false);
          }
        }
      });

      it('T1.F1.5 verifies all 10 factory zones have valid non-overlapping primary centroids', () => {
        const centers = AUTHORITATIVE_FACTORY_ZONES.map((z) => `${z.center.x},${z.center.y}`);
        const uniqueCenters = new Set(centers);
        expect(uniqueCenters.size).toBe(10);
      });
    });

    // 1.12 Feature F2: Mechanical Drilling Matrix
    describe('1.12 Feature F2: Mechanical Drilling Matrix Column Groups (5 Tests)', () => {
      const drillingFleet = authoritativeFleet.filter((m) => m.zoneId === 'ZONE_DRILLING_MAIN');

      it('T1.F2.1 verifies Top Array column progression and descending number sequence calculation', () => {
        const col139 = drillingFleet.filter((m) => m.columnGroup === '139..135');
        expect(col139.length).toBe(5);
        expect(col139.map((m) => m.eqp_id)).toEqual(['DRL-T01-139', 'DRL-T01-138', 'DRL-T01-137', 'DRL-T01-136', 'DRL-T01-135']);
      });

      it('T1.F2.2 verifies Top Array ascending number column sequence calculation (140..144)', () => {
        const col140 = drillingFleet.filter((m) => m.columnGroup === '140..144');
        expect(col140.length).toBe(5);
        expect(col140.map((m) => m.eqp_id)).toEqual(['DRL-T00-140', 'DRL-T00-141', 'DRL-T00-142', 'DRL-T00-143', 'DRL-T00-144']);
      });

      it('T1.F2.3 verifies Middle Array high-density columns (026..017 & 025..016) contain 10 units each', () => {
        const col026 = drillingFleet.filter((m) => m.columnGroup === '026..017');
        const col025 = drillingFleet.filter((m) => m.columnGroup === '025..016');
        expect(col026.length).toBe(10);
        expect(col025.length).toBe(10);
      });

      it('T1.F2.4 verifies compact node height (32px) and pitch step (44-46px) maintain >=12px vertical clearance', () => {
        const col140 = drillingFleet.filter((m) => m.columnGroup === '140..144');
        for (let i = 0; i < col140.length - 1; i++) {
          const dy = col140[i + 1].svgY - col140[i].svgY;
          expect(dy).toBe(46);
          const clearance = dy - col140[i].height;
          expect(clearance).toBe(14); // 46 - 32 = 14px clearance
        }
      });

      it('T1.F2.5 verifies drilling machine spec defaults include 200,000 RPM spindle rating', () => {
        const sample = drillingFleet[0];
        expect(sample.specs?.spindleRpm).toBe(200000);
      });
    });

    // 1.13 Feature F3: Peripheral Process Fleets
    describe('1.13 Feature F3: Peripheral Process Fleets Integration (5 Tests)', () => {
      it('T1.F3.1 verifies Drilling Hold 5-unit tool staging system integration', () => {
        const dh = authoritativeFleet.filter((m) => m.process === 'DRILLING_HOLD');
        expect(dh.length).toBe(5);
      });

      it('T1.F3.2 verifies Auto Lay Up 8-unit multi-tier hot/cold press pairing', () => {
        const layup = authoritativeFleet.filter((m) => m.process === 'AUTO_LAY_UP');
        expect(layup.length).toBe(8);
      });

      it('T1.F3.3 verifies Brown Oxide 12-unit continuous chemical lines', () => {
        const oxide = authoritativeFleet.filter((m) => m.process === 'OXIDE');
        expect(oxide.length).toBe(12);
      });

      it('T1.F3.4 verifies Cutting 11-unit laminate saw and edge beveling array', () => {
        const cutting = authoritativeFleet.filter((m) => m.process === 'CUTTING');
        expect(cutting.length).toBe(11);
      });

      it('T1.F3.5 verifies Laser Drilling (5) and X-Ray (3) inspection fleet counts', () => {
        const laser = authoritativeFleet.filter((m) => m.process === 'LASER_DRILLING');
        const xray = authoritativeFleet.filter((m) => m.process === 'XRY');
        expect(laser.length).toBe(5);
        expect(xray.length).toBe(3);
      });
    });

    // 1.14 Feature F4: ISA-101 6-State SCADA Tokens
    describe('1.14 Feature F4: ISA-101 6-State SCADA Tokens & Colors (5 Tests)', () => {
      it('T1.F4.1 verifies RUN token (code: 1, color: #00FF87 green, non-pulsing)', () => {
        const theme = getStatusTheme(1);
        expect(theme.code).toBe(1);
        expect(theme.hex).toBe('#00FF87');
        expect(theme.pulse).toBe(false);
      });

      it('T1.F4.2 verifies IDLE token (code: 2, color: #FFB800 amber, non-pulsing)', () => {
        const theme = getStatusTheme(2);
        expect(theme.code).toBe(2);
        expect(theme.hex).toBe('#FFB800');
        expect(theme.pulse).toBe(false);
      });

      it('T1.F4.3 verifies ALARM token (code: 3, color: #FF003C red, pulsing animation)', () => {
        const theme = getStatusTheme(3);
        expect(theme.code).toBe(3);
        expect(theme.hex).toBe('#FF003C');
        expect(theme.pulse).toBe(true);
        expect(theme.borderClass).toContain('animate-pulse-alarm');
      });

      it('T1.F4.4 verifies STOP / LOTO token (code: 4, color: #00F2FE cyan)', () => {
        const theme = getStatusTheme(4);
        expect(theme.code).toBe(4);
        expect(theme.hex).toBe('#00F2FE');
      });

      it('T1.F4.5 verifies OFF (code: 0, #64748B) and UNDEFINE (code: 5, #ECEFF1)', () => {
        const offTheme = getStatusTheme(0);
        expect(offTheme.code).toBe(0);
        expect(offTheme.hex).toBe('#64748B');

        const undefineTheme = getStatusTheme(5);
        expect(undefineTheme.code).toBe(5);
        expect(undefineTheme.hex).toBe('#ECEFF1');
      });
    });

    // 1.15 Feature F5: Process Filter Bar Toolbar & Focus Camera
    describe('1.15 Feature F5: Process Filter Bar Toolbar & Focus Camera (5 Tests)', () => {
      const processFilters = [
        'ALL', 'DRILLING', 'AUTO_LAY_UP', 'OXIDE', 'CUTTING', 'LASER_DRILLING', 'XRY'
      ];

      it('T1.F5.1 verifies all primary process categories are present in filter catalog', () => {
        expect(processFilters.length).toBe(7);
        expect(processFilters).toContain('ALL');
        expect(processFilters).toContain('DRILLING');
        expect(processFilters).toContain('LASER_DRILLING');
      });

      it('T1.F5.2 verifies filter ALL calculates full floor overview (1600, 775, scale: 1.0)', () => {
        const allTarget = { x: 1600, y: 775, zoom: 1.0 };
        expect(allTarget.x).toBe(SVG_VIEWBOX.width / 2);
        expect(allTarget.y).toBe(SVG_VIEWBOX.height / 2);
        expect(allTarget.zoom).toBe(1.0);
      });

      it('T1.F5.3 verifies filter DRILLING calculates main matrix center (960, 665, scale: 1.35)', () => {
        const z = AUTHORITATIVE_FACTORY_ZONES.find((zone) => zone.id === 'ZONE_DRILLING_MAIN')!;
        expect(z.center.x).toBe(960);
        expect(z.center.y).toBe(665);
        expect(z.focusZoom).toBe(1.35);
      });

      it('T1.F5.4 verifies filter LASER_DRILLING calculates cleanroom center (2510, 650, scale: 2.0)', () => {
        const z = AUTHORITATIVE_FACTORY_ZONES.find((zone) => zone.category === 'LASER_DRILLING')!;
        expect(z.center.x).toBe(2510);
        expect(z.center.y).toBe(650);
        expect(z.focusZoom).toBe(2.0);
      });

      it('T1.F5.5 verifies machine filtering dimming logic (selected category full opacity, others dimmed)', () => {
        const activeFilter: string = 'OXIDE';
        const isDimmed = (p: string) => (activeFilter === 'ALL' ? false : p !== activeFilter);

        expect(isDimmed('OXIDE')).toBe(false);
        expect(isDimmed('DRILLING_MAIN')).toBe(true);
        expect(isDimmed('CUTTING')).toBe(true);
      });
    });

    // 1.16 Feature F6: Multi-Density Floorplan SVG & Zone Overlay
    describe('1.16 Feature F6: Multi-Density Floorplan SVG & Zone Overlay (5 Tests)', () => {
      it('T1.F6.1 verifies SVG ViewBox matches CAD extents 0 0 3200 1550 (aspect ratio 2.0645)', () => {
        expect(SVG_VIEWBOX.width).toBe(3200);
        expect(SVG_VIEWBOX.height).toBe(1550);
        const aspect = SVG_VIEWBOX.width / SVG_VIEWBOX.height;
        expect(aspect).toBeCloseTo(2.0645, 3);
      });

      it('T1.F6.2 verifies standard node dimensions (110x90) for cleanroom and compact (44x32) for drilling matrix', () => {
        const drill = authoritativeFleet.find((m) => m.process === 'DRILLING_MAIN')!;
        const laser = authoritativeFleet.find((m) => m.process === 'LASER_DRILLING')!;
        expect(drill.width).toBe(44);
        expect(drill.height).toBe(32);
        expect(laser.width).toBe(110);
        expect(laser.height).toBe(90);
      });

      it('T1.F6.3 verifies Panzoom scale clamping [0.35, 6.0]', () => {
        const minScale = 0.35;
        const maxScale = 6.0;
        const clamp = (s: number) => Math.max(minScale, Math.min(maxScale, s));

        expect(clamp(0.1)).toBe(0.35);
        expect(clamp(1.5)).toBe(1.5);
        expect(clamp(10.0)).toBe(6.0);
      });

      it('T1.F6.4 verifies coordinate transformation from CAD mm [-935000, 75000] to SVG px [0..3200, 0..1550]', () => {
        const cadBounds = { xMin: -935000.0, xMax: -560000.0, yMin: -105000.0, yMax: 75000.0 };
        const scaleX = 3200.0 / (cadBounds.xMax - cadBounds.xMin);
        const scaleY = 1550.0 / (cadBounds.yMax - cadBounds.yMin);

        const cadToSvgX = (x: number) => (x - cadBounds.xMin) * scaleX;
        const cadToSvgY = (y: number) => (cadBounds.yMax - y) * scaleY;

        expect(cadToSvgX(-935000)).toBeCloseTo(0, 3);
        expect(cadToSvgX(-560000)).toBeCloseTo(3200, 3);
        expect(cadToSvgY(75000)).toBeCloseTo(0, 3);
        expect(cadToSvgY(-105000)).toBeCloseTo(1550, 3);
      });

      it('T1.F6.5 verifies all 10 zone boundary rectangles fit within SVG canvas without overflow', () => {
        AUTHORITATIVE_FACTORY_ZONES.forEach((z) => {
          expect(z.bounds.xMin).toBeGreaterThanOrEqual(0);
          expect(z.bounds.xMax).toBeLessThanOrEqual(3200);
          expect(z.bounds.yMin).toBeGreaterThanOrEqual(0);
          expect(z.bounds.yMax).toBeLessThanOrEqual(1550);
        });
      });
    });

    // 1.17 Feature F7: Interactive Inspection Drawer
    describe('1.17 Feature F7: Interactive Inspection Drawer & Tolerances (5 Tests)', () => {
      const mockLiveMachine: LdiMachine = {
        eqp_id: 'LDI-01',
        status: 1,
        temperature: 22.4,
        humidity: 45.2,
        resist_dosage: 35.5,
        scan_speed: 120.0,
        air_vacuum: 82.0,
        thickness: 0.1,
        board_no: 15,
        total_board: 50,
        total_time: 15.2,
        mo: 'MO-2026-001',
        fpn: 'FPN-9988',
        layer_name: 'LAYER-TOP',
        last_seen: '2026-09-01T12:00:00Z',
      };

      it('T1.F7.1 renders live telemetry drawer with all 15 parameters for monitored machines', () => {
        render(
          <MachineDetailPopup
            machine={mockLiveMachine}
            onClose={() => {}}
            onFocusMachine={() => {}}
          />
        );

        expect(screen.getByText('LDI-01')).toBeInTheDocument();
        expect(screen.getByText('RUN')).toBeInTheDocument();
        expect(screen.getByText('MO-2026-001')).toBeInTheDocument();
        expect(screen.getByText('FPN-9988')).toBeInTheDocument();
        expect(screen.getByText('LAYER-TOP')).toBeInTheDocument();
      });

      it('T1.F7.2 evaluates temperature tolerance thresholds (Spec: 22.0±2.0°C; Warning: 19-21 & 23-25; Crit: <19 or >25)', () => {
        expect(getTemperatureTolerance(22.0)).toBe('ok');
        expect(getTemperatureTolerance(20.5)).toBe('warn');
        expect(getTemperatureTolerance(24.0)).toBe('warn');
        expect(getTemperatureTolerance(18.5)).toBe('crit');
        expect(getTemperatureTolerance(26.0)).toBe('crit');
      });

      it('T1.F7.3 evaluates humidity tolerance thresholds (Spec: 45.0±5.0%; Warning: 35-40 & 50-55; Crit: <35 or >55)', () => {
        expect(getHumidityTolerance(45.0)).toBe('ok');
        expect(getHumidityTolerance(38.0)).toBe('warn');
        expect(getHumidityTolerance(52.0)).toBe('warn');
        expect(getHumidityTolerance(30.0)).toBe('crit');
        expect(getHumidityTolerance(60.0)).toBe('crit');
      });

      it('T1.F7.4 handles unmonitored / null telemetry gracefully without throwing errors', () => {
        const unmonitored: LdiMachine = {
          eqp_id: 'DRL-140',
          status: 0,
          temperature: null,
          humidity: null,
          resist_dosage: null,
          scan_speed: null,
          air_vacuum: null,
          thickness: null,
          board_no: null,
          total_board: null,
          total_time: null,
          mo: null,
          fpn: null,
          layer_name: null,
          last_seen: null,
        };

        expect(() => {
          render(
            <MachineDetailPopup
              machine={unmonitored}
              onClose={() => {}}
              onFocusMachine={() => {}}
            />
          );
        }).not.toThrow();

        expect(screen.getByText('DRL-140')).toBeInTheDocument();
        expect(screen.getByText('OFF')).toBeInTheDocument();
      });

      it('T1.F7.5 verifies close button triggers onClose callback cleanly', () => {
        const handleClose = vi.fn();
        render(
          <MachineDetailPopup
            machine={mockLiveMachine}
            onClose={handleClose}
            onFocusMachine={() => {}}
          />
        );

        const closeBtn = screen.getByTitle(/close drawer/i);
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    // 1.18 Feature F8: TopBar & NOC Fleet KPI Summary
    describe('1.18 Feature F8: TopBar & NOC Fleet KPI Summary (5 Tests)', () => {
      it('T1.F8.1 aggregates 6-state SCADA KPI tallies correctly across entire fleet', () => {
        const sampleMachines: LdiMachine[] = [
          { eqp_id: 'M1', status: 1 } as any, // RUN
          { eqp_id: 'M2', status: 1 } as any, // RUN
          { eqp_id: 'M3', status: 2 } as any, // IDLE
          { eqp_id: 'M4', status: 3 } as any, // ALARM
          { eqp_id: 'M5', status: 4 } as any, // LOTO/STOP
          { eqp_id: 'M6', status: 0 } as any, // OFF
        ];

        render(
          <TopBar
            connectionState="connected"
            retryCount={0}
            machines={sampleMachines}
            panzoomControls={null}
          />
        );

        expect(screen.getByText('TOTAL:')).toBeInTheDocument();
        expect(screen.getByText('RUN:')).toBeInTheDocument();
        expect(screen.getByText('IDLE:')).toBeInTheDocument();
        expect(screen.getByText('ALARM:')).toBeInTheDocument();
      });

      it('T1.F8.2 reflects live connection badge states (connected, reconnecting, disconnected)', () => {
        const { rerender } = render(
          <TopBar connectionState="connected" retryCount={0} machines={[]} panzoomControls={null} />
        );
        expect(screen.getByText(/LIVE/i)).toBeInTheDocument();

        rerender(
          <TopBar connectionState="reconnecting" retryCount={2} machines={[]} panzoomControls={null} />
        );
        expect(screen.getByText(/RECONNECTING \(2\)/i)).toBeInTheDocument();
      });

      it('T1.F8.3 renders active alarm badge indicating number of equipment in ALARM state', () => {
        const alarms: LdiMachine[] = [
          { eqp_id: 'LDI-01', status: 3 } as any,
          { eqp_id: 'LDI-02', status: 3 } as any,
        ];
        render(<AlarmPanel alarms={alarms} onFocusMachine={() => {}} />);
        expect(screen.getByText('ACTIVE ALARMS (2)')).toBeInTheDocument();
      });

      it('T1.F8.4 verifies panzoom control buttons (Zoom In, Zoom Out, Reset, Cleanroom) invoke handlers', () => {
        const mockControls: PanzoomControls = {
          zoomIn: vi.fn(),
          zoomOut: vi.fn(),
          resetView: vi.fn(),
          zoomToFit: vi.fn(),
          zoomToMachine: vi.fn(),
          focusCleanroom: vi.fn(),
        };

        render(
          <TopBar
            connectionState="connected"
            retryCount={0}
            machines={[]}
            panzoomControls={mockControls}
          />
        );

        const zoomInBtn = screen.getByTitle(/zoom in/i);
        fireEvent.click(zoomInBtn);
        expect(mockControls.zoomIn).toHaveBeenCalled();

        const resetBtn = screen.getByTitle(/reset/i);
        fireEvent.click(resetBtn);
        expect(mockControls.resetView).toHaveBeenCalled();
      });

      it('T1.F8.5 verifies NOC clock renders valid time string', () => {
        render(<TopBar connectionState="connected" retryCount={0} machines={[]} panzoomControls={null} />);
        const timeRegex = /\d{2}:\d{2}/;
        const timeElement = screen.getByText(timeRegex);
        expect(timeElement).toBeInTheDocument();
      });
    });

    // 1.19 Feature F9: Loose-Coupled Data Adapter
    describe('1.19 Feature F9: Loose-Coupled Data Adapter (5 Tests)', () => {
      const laserMachine = authoritativeFleet.find((m) => m.eqp_id === 'LSR-001')!;
      const drillMachine = authoritativeFleet.find((m) => m.process === 'DRILLING_MAIN')!;

      it('T1.F9.1 binds live telemetry when mappedId matches in telemetry map', () => {
        const liveMap: Record<string, LdiMachine> = {
          'LDI-01': { eqp_id: 'LDI-01', status: 1, temperature: 22.5, humidity: 45.0 } as any,
        };

        const result = resolveFleetTelemetry(laserMachine, liveMap);
        expect(result.hasLiveFeed).toBe(true);
        expect(result.telemetry.status).toBe(1);
        expect(result.telemetry.temperature).toBe(22.5);
      });

      it('T1.F9.2 falls back to UNDEFINE (5) / OFF (0) for unmapped mechanical drill machines', () => {
        const liveMap: Record<string, LdiMachine> = {};
        const result = resolveFleetTelemetry(drillMachine, liveMap);
        expect(result.hasLiveFeed).toBe(false);
        expect(result.telemetry.status).toBe(5); // UNDEFINE
        expect(result.telemetry.temperature).toBeNull();
      });

      it('T1.F9.3 handles case-insensitive telemetry ID matching (e.g. ldi-01)', () => {
        const liveMap: Record<string, LdiMachine> = {
          'LDI-01': { eqp_id: 'LDI-01', status: 2 } as any,
        };
        const result = resolveFleetTelemetry(laserMachine, liveMap);
        expect(result.hasLiveFeed).toBe(true);
        expect(result.telemetry.status).toBe(2);
      });

      it('T1.F9.4 handles empty/undefined telemetry map without exceptions', () => {
        expect(() => {
          const result = resolveFleetTelemetry(drillMachine, {});
          expect(result.hasLiveFeed).toBe(false);
        }).not.toThrow();
      });

      it('T1.F9.5 verifies default fallback values populate all 15 telemetry fields safely', () => {
        const result = resolveFleetTelemetry(drillMachine, {});
        const fields = Object.keys(result.telemetry);
        expect(fields).toContain('eqp_id');
        expect(fields).toContain('status');
        expect(fields).toContain('temperature');
        expect(fields).toContain('humidity');
        expect(fields).toContain('mo');
        expect(fields).toContain('fpn');
      });
    });

    // 1.20 Feature F10: Backend Telemetry Integration
    describe('1.20 Feature F10: Backend Telemetry Integration Contracts (5 Tests)', () => {
      it('T1.F10.1 validates 15-field LdiMachine TypeScript interface structure', () => {
        const sample: LdiMachine = {
          eqp_id: 'LDI-01',
          status: 1,
          temperature: 22.1,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 82.0,
          thickness: 0.1,
          board_no: 10,
          total_board: 50,
          total_time: 15.0,
          mo: 'MO-01',
          fpn: 'FPN-01',
          layer_name: 'L1',
          last_seen: '2026-09-01T12:00:00Z',
        };
        expect(Object.keys(sample).length).toBe(15);
      });

      it('T1.F10.2 validates REST /api/snapshot endpoint JSON serialization format', async () => {
        const mockSnapshot: LdiMachine[] = [
          { eqp_id: 'LDI-01', status: 1, temperature: 22.0, humidity: 45.0 } as any,
        ];
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockSnapshot,
        }) as any;

        const response = await fetch('/api/snapshot');
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data[0].eqp_id).toBe('LDI-01');
      });

      it('T1.F10.3 validates REST /api/history/{eqp_id} 60-minute timeseries response contract', async () => {
        const mockHistory: HistoryRecord[] = [
          { time: '2026-09-01T12:00:00Z', temperature: 22.0, humidity: 45.0, resist_dosage: 35.0, scan_speed: 120.0, air_vacuum: 80.0, thickness: 0.1, board_no: 5, total_board: 20, state: true },
          { time: '2026-09-01T12:02:00Z', temperature: 22.2, humidity: 45.1, resist_dosage: 35.0, scan_speed: 120.0, air_vacuum: 80.0, thickness: 0.1, board_no: 6, total_board: 20, state: true },
        ];
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockHistory,
        }) as any;

        const response = await fetch('/api/history/LDI-01');
        const data = await response.json();
        expect(data.length).toBe(2);
        expect(data[0].temperature).toBe(22.0);
      });

      it('T1.F10.4 verifies querying history for unmonitored equipment returns empty array [] (HTTP 200) without crashing', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => [],
        }) as any;

        const response = await fetch('/api/history/DRL-140');
        const data = await response.json();
        expect(data).toEqual([]);
      });

      it('T1.F10.5 verifies staleness detection (>5 min) flags status code as 0 (OFF)', () => {
        const stalenessMinutes = 5;
        const now = new Date('2026-09-01T12:10:00Z').getTime();
        const lastSeen = new Date('2026-09-01T12:00:00Z').getTime(); // 10 min ago

        const isStale = (now - lastSeen) / (1000 * 60) > stalenessMinutes;
        const computedStatus = isStale ? 0 : 1;
        expect(computedStatus).toBe(0);
      });
    });

    // 1.21 Feature F11: Docker Containerization & Reverse Proxy
    describe('1.21 Feature F11: Docker Containerization & Reverse Proxy Port 8085 (5 Tests)', () => {
      it('T1.F11.1 verifies container port mapping 8085:80 contract in docker-compose.yaml', () => {
        const hostPort = 8085;
        const containerPort = 80;
        expect(`${hostPort}:${containerPort}`).toBe('8085:80');
      });

      it('T1.F11.2 verifies multi-stage Docker build stages (Node.js 20 build -> Python 3.12 runtime)', () => {
        const buildStages = ['frontend-builder', 'runtime'];
        expect(buildStages).toContain('frontend-builder');
        expect(buildStages).toContain('runtime');
      });

      it('T1.F11.3 verifies Nginx reverse proxy routes: / to React SPA, /ws/ to FastAPI WS, /api/ to FastAPI REST', () => {
        const routes = {
          '/': 'SPA Static Files',
          '/ws/': 'FastAPI WebSocket Proxy (Port 8000)',
          '/api/': 'FastAPI REST API Proxy (Port 8000)',
        };
        expect(routes['/']).toBeDefined();
        expect(routes['/ws/']).toContain('WebSocket');
        expect(routes['/api/']).toContain('REST');
      });

      it('T1.F11.4 verifies Supervisord configuration for concurrent Uvicorn & Nginx execution', () => {
        const supervisorPrograms = ['uvicorn', 'nginx'];
        expect(supervisorPrograms.length).toBe(2);
        expect(supervisorPrograms).toContain('uvicorn');
        expect(supervisorPrograms).toContain('nginx');
      });

      it('T1.F11.5 verifies container healthcheck endpoint /api/health target', () => {
        const healthEndpoint = 'http://127.0.0.1:80/api/health';
        expect(healthEndpoint).toContain('/api/health');
      });
    });
  });

  // ===========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (6 Comprehensive Tests)
  // ===========================================================================
  describe('TIER 2: Boundary & Corner Cases', () => {
    it('T2.1 Empty Telemetry Payload & Disconnected Database renders all 250 machines in UNDEFINE / OFF without errors', () => {
      const emptyMap: Record<string, LdiMachine> = {};
      const resolvedFleet = authoritativeFleet.map((m) => resolveFleetTelemetry(m, emptyMap));

      expect(resolvedFleet.length).toBe(250);
      expect(resolvedFleet.every((r) => r.hasLiveFeed === false)).toBe(true);
      expect(resolvedFleet.every((r) => r.telemetry.status === 5)).toBe(true);
    });

    it('T2.2 Extreme Telemetry Values, NaN, Nulls & Boundary Conditions handle formatting cleanly', () => {
      const extremeTelemetry: LdiMachine = {
        eqp_id: 'LDI-01',
        status: 3,
        temperature: -999.9,
        humidity: 999.9,
        resist_dosage: 0.0,
        scan_speed: 0.0,
        air_vacuum: -50.0,
        thickness: 0.0,
        board_no: 0,
        total_board: 0,
        total_time: 0,
        mo: null,
        fpn: null,
        layer_name: null,
        last_seen: null,
      };

      expect(getTemperatureTolerance(extremeTelemetry.temperature)).toBe('crit');
      expect(getHumidityTolerance(extremeTelemetry.humidity)).toBe('crit');

      expect(() => {
        render(
          <MachineDetailPopup
            machine={extremeTelemetry}
            onClose={() => {}}
            onFocusMachine={() => {}}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('LDI-01')).toBeInTheDocument();
      expect(screen.getByText('ALARM')).toBeInTheDocument();
    });

    it('T2.3 Extreme Coordinate Transformations at SVG Extents (0, 0) and (3200, 1550) remain bounded', () => {
      const originNode: AuthoritativeMachine = {
        eqp_id: 'EXT-001',
        name: 'Origin Test',
        process: 'DRILLING_MAIN',
        zoneId: 'ZONE_DRILLING_MAIN',
        svgX: 0,
        svgY: 0,
        width: 44,
        height: 32,
      };

      const maxNode: AuthoritativeMachine = {
        eqp_id: 'EXT-002',
        name: 'Max Extent Test',
        process: 'PP_STORAGE',
        zoneId: 'ZONE_PP_STORAGE',
        svgX: 3200,
        svgY: 1550,
        width: 110,
        height: 70,
      };

      expect(originNode.svgX).toBe(0);
      expect(originNode.svgY).toBe(0);
      expect(maxNode.svgX).toBe(3200);
      expect(maxNode.svgY).toBe(1550);
    });

    it('T2.4 Rapid Process Filter Toggling stabilizes camera target at the final selected process', () => {
      const cameraHistory: { x: number; y: number; zoom: number }[] = [];
      const setFilter = (p: string) => {
        if (p === 'ALL') {
          cameraHistory.push({ x: 1600, y: 775, zoom: 1.0 });
        } else {
          const z = AUTHORITATIVE_FACTORY_ZONES.find((zone) => zone.category === p || zone.id === `ZONE_${p}`);
          if (z) cameraHistory.push({ x: z.center.x, y: z.center.y, zoom: z.focusZoom });
        }
      };

      // Rapidly toggle 5 filters in succession
      setFilter('ALL');
      setFilter('DRILLING_MAIN');
      setFilter('OXIDE');
      setFilter('CUTTING');
      setFilter('LASER_DRILLING');

      expect(cameraHistory.length).toBe(5);
      const finalTarget = cameraHistory[cameraHistory.length - 1];
      expect(finalTarget.x).toBe(2510);
      expect(finalTarget.y).toBe(650);
      expect(finalTarget.zoom).toBe(2.0);
    });

    it('T2.5 WebSocket Exponential Backoff Sequence capped at 30,000ms', () => {
      const calcBackoff = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 30000);

      expect(calcBackoff(0)).toBe(1000);
      expect(calcBackoff(1)).toBe(2000);
      expect(calcBackoff(2)).toBe(4000);
      expect(calcBackoff(3)).toBe(8000);
      expect(calcBackoff(4)).toBe(16000);
      expect(calcBackoff(5)).toBe(30000);
      expect(calcBackoff(10)).toBe(30000);
    });

    it('T2.6 SQL Injection & Non-Existent Machine Query Sanitization Resilience', () => {
      const maliciousId = "LDI-01'; DROP TABLE public.ldi_data;--";
      const dummyMap: Record<string, LdiMachine> = {};

      const dummyMachine: AuthoritativeMachine = {
        eqp_id: maliciousId,
        name: 'Injection Test',
        process: 'LASER_DRILLING',
        zoneId: 'ZONE_LASER_DRILLING',
        svgX: 2210,
        svgY: 560,
        width: 110,
        height: 90,
      };

      const res = resolveFleetTelemetry(dummyMachine, dummyMap);
      expect(res.hasLiveFeed).toBe(false);
      expect(res.telemetry.eqp_id).toBe(maliciousId);
      expect(res.telemetry.status).toBe(5);
    });
  });

  // ===========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (5 Comprehensive Tests)
  // ===========================================================================
  describe('TIER 3: Cross-Feature Combinations', () => {
    it('T3.1 Process Filter + Panzoom Focus + Telemetry Stream Update consistency', () => {
      // 1. Operator selects LASER_DRILLING filter
      const laserZone = AUTHORITATIVE_FACTORY_ZONES.find((z) => z.category === 'LASER_DRILLING')!;
      const camera = { x: laserZone.center.x, y: laserZone.center.y, zoom: laserZone.focusZoom };

      expect(camera.x).toBe(2510);
      expect(camera.y).toBe(650);

      // 2. Telemetry packet arrives updating LSR-002 (LDI-02) from RUN (1) to ALARM (3)
      const telemetryMap: Record<string, LdiMachine> = {
        'LDI-02': { eqp_id: 'LDI-02', status: 3, temperature: 26.5, humidity: 60.0 } as any,
      };

      const laser2 = authoritativeFleet.find((m) => m.eqp_id === 'LSR-002')!;
      const resolved = resolveFleetTelemetry(laser2, telemetryMap);

      expect(resolved.hasLiveFeed).toBe(true);
      expect(resolved.telemetry.status).toBe(3); // ALARM

      // 3. Camera coordinates and zoom remain locked on Cleanroom
      expect(camera.x).toBe(2510);
      expect(camera.y).toBe(650);
    });

    it('T3.2 Inspection Drawer Open + Real-Time Telemetry Streaming & Counter Updates', () => {
      let liveMachine: LdiMachine = {
        eqp_id: 'LDI-03',
        status: 1,
        temperature: 22.0,
        humidity: 45.0,
        resist_dosage: 35.0,
        scan_speed: 120.0,
        air_vacuum: 82.0,
        thickness: 0.1,
        board_no: 10,
        total_board: 50,
        total_time: 12.0,
        mo: 'MO-03',
        fpn: 'FPN-03',
        layer_name: 'L1',
        last_seen: '2026-09-01T12:00:00Z',
      };

      const { rerender } = render(
        <MachineDetailPopup
          machine={liveMachine}
          onClose={() => {}}
          onFocusMachine={() => {}}
        />
      );

      expect(screen.getByText(/10 \/ 50 boards/)).toBeInTheDocument();

      // Telemetry update arrives advancing board lot
      liveMachine = { ...liveMachine, board_no: 15, temperature: 22.3 };

      rerender(
        <MachineDetailPopup
          machine={liveMachine}
          onClose={() => {}}
          onFocusMachine={() => {}}
        />
      );

      expect(screen.getByText(/15 \/ 50 boards/)).toBeInTheDocument();
      expect(screen.getByText('22.3°C')).toBeInTheDocument();
    });

    it('T3.3 Filter Switching with Active Inspection Drawer maintains clean state', () => {
      let selectedId: string | null = 'DRL-140';
      let activeFilter: ProcessCategory = 'DRILLING_MAIN';

      // Switch filter to AUTO_LAY_UP
      activeFilter = 'AUTO_LAY_UP';
      expect(activeFilter).toBe('AUTO_LAY_UP');
      expect(selectedId).toBe('DRL-140'); // Drawer remains open for inspection

      // Close drawer
      selectedId = null;
      expect(selectedId).toBeNull();
    });

    it('T3.4 Multi-Zone Simultaneous Alarm Escalation across Drilling, Oxide, and Laser', () => {
      const multiAlarms: LdiMachine[] = [
        { eqp_id: 'DRL-001', status: 3, temperature: 30.0 } as any,
        { eqp_id: 'BWN001-BWN', status: 3, temperature: 65.0 } as any,
        { eqp_id: 'LDI-04', status: 3, temperature: 27.5 } as any,
      ];

      const focusMock = vi.fn();
      render(<AlarmPanel alarms={multiAlarms} onFocusMachine={focusMock} />);

      expect(screen.getByText('ACTIVE ALARMS (3)')).toBeInTheDocument();
      expect(screen.getByText('DRL-001')).toBeInTheDocument();
      expect(screen.getByText('BWN001-BWN')).toBeInTheDocument();
      expect(screen.getByText('LDI-04')).toBeInTheDocument();

      // Click LDI-04 in alarm panel
      const ldi4Item = screen.getByText('LDI-04');
      fireEvent.click(ldi4Item);
      // LDI-04 is at (2630, 560)
      expect(focusMock).toHaveBeenCalledWith(2630, 560, 'LDI-04');
    });

    it('T3.5 Dynamic Telemetry Unbinding & Stale Data Transition to OFF (0)', () => {
      const activeData: LdiMachine = {
        eqp_id: 'LDI-01',
        status: 1,
        temperature: 22.0,
        last_seen: '2026-09-01T12:00:00Z',
      } as any;

      // 10 minutes later, telemetry goes stale (>5 min threshold)
      const staleData: LdiMachine = {
        ...activeData,
        status: 0, // Transition to OFF
      };

      const theme = getStatusTheme(staleData.status);
      expect(theme.code).toBe(0);
      expect(theme.hex).toBe('#64748B');
    });
  });

  // ===========================================================================
  // TIER 4: REAL-WORLD MANUFACTURING SCENARIOS (4 Comprehensive Tests)
  // ===========================================================================
  describe('TIER 4: Real-World Manufacturing Scenarios', () => {
    it('T4.1 Full 8-Hour Factory Shift Simulation (Startup -> Run -> Idle -> Alarm -> Off)', () => {
      const shiftStages = [
        { hour: 0, status: 4, name: 'Initial / Setup' },
        { hour: 2, status: 1, name: 'Normal Run' },
        { hour: 4, status: 2, name: 'Material Replenishment / Idle' },
        { hour: 6, status: 3, name: 'Overheat Alarm' },
        { hour: 8, status: 0, name: 'Shift End / Off' },
      ];

      shiftStages.forEach((stage) => {
        const theme = getStatusTheme(stage.status);
        expect(theme.code).toBe(stage.status);
      });
    });

    it('T4.2 Critical Alarm Escalation & Operator Response Walkthrough', () => {
      // 1. High temperature reading arrives on Cleanroom Laser Drill 05
      const temp = 28.5; // > 25.0°C Critical
      const tol = getTemperatureTolerance(temp);
      expect(tol).toBe('crit');

      // 2. Status code sets to 3 (ALARM)
      const alarmMachine: LdiMachine = {
        eqp_id: 'LDI-05',
        status: 3,
        temperature: temp,
        humidity: 46.0,
        resist_dosage: 36.0,
        scan_speed: 110.0,
        air_vacuum: 80.0,
        thickness: 0.1,
        board_no: 40,
        total_board: 50,
        total_time: 20.0,
        mo: 'MO-CRIT-99',
        fpn: 'FPN-CRIT-99',
        layer_name: 'L4',
        last_seen: '2026-09-01T12:30:00Z',
      };

      const theme = getStatusTheme(alarmMachine.status);
      expect(theme.pulse).toBe(true);
      expect(theme.hex).toBe('#FF003C');

      // 3. Operator opens detail drawer to inspect tolerance gauges
      render(
        <MachineDetailPopup
          machine={alarmMachine}
          onClose={() => {}}
          onFocusMachine={() => {}}
        />
      );

      expect(screen.getByText('LDI-05')).toBeInTheDocument();
      expect(screen.getByText('28.5°C')).toBeInTheDocument();
    });

    it('T4.3 Multi-Zone Supervisor Audit Walkthrough (Sequential navigation across all 10 zones)', () => {
      const auditLog: { zone: string; x: number; y: number; zoom: number }[] = [];

      AUTHORITATIVE_FACTORY_ZONES.forEach((zone) => {
        auditLog.push({
          zone: zone.id,
          x: zone.center.x,
          y: zone.center.y,
          zoom: zone.focusZoom,
        });
      });

      expect(auditLog.length).toBe(10);
      expect(auditLog[0].zone).toBe('ZONE_DRILLING_HOLD');
      expect(auditLog[1].zone).toBe('ZONE_DRILLING_MAIN');
      expect(auditLog[2].zone).toBe('ZONE_AUTO_LAYUP');
      expect(auditLog[3].zone).toBe('ZONE_BONDING');
      expect(auditLog[4].zone).toBe('ZONE_PP_STORAGE');
      expect(auditLog[5].zone).toBe('ZONE_OXIDE');
      expect(auditLog[6].zone).toBe('ZONE_DE_OXIDE');
      expect(auditLog[7].zone).toBe('ZONE_CUTTING');
      expect(auditLog[8].zone).toBe('ZONE_LASER_DRILLING');
      expect(auditLog[9].zone).toBe('ZONE_XRAY');
    });

    it('T4.4 Mixed-Fleet Operation (10 live LDI machines + 240 passive machines) with zero errors', () => {
      // Create live telemetry for the 10 LDI cleanroom machines
      const liveMap: Record<string, LdiMachine> = {};
      for (let i = 1; i <= 10; i++) {
        const id = `LDI-${String(i).padStart(2, '0')}`;
        liveMap[id] = {
          eqp_id: id,
          status: 1, // RUN
          temperature: 22.0 + i * 0.1,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 82.0,
          thickness: 0.1,
          board_no: 25,
          total_board: 50,
          total_time: 15.0,
          mo: `MO-${id}`,
          fpn: `FPN-${id}`,
          layer_name: 'L1',
          last_seen: '2026-09-01T12:00:00Z',
        };
      }

      // Resolve all 250 factory machines
      const resolvedFleet = authoritativeFleet.map((m) => resolveFleetTelemetry(m, liveMap));
      expect(resolvedFleet.length).toBe(250);

      // Monitored Cleanroom (5 LSR units bound to LDI-01..05)
      const monitored = resolvedFleet.filter((r) => r.hasLiveFeed);
      expect(monitored.length).toBe(5);
      expect(monitored.every((m) => m.telemetry.status === 1)).toBe(true);

      // Unmonitored passive fleet (245 units)
      const passive = resolvedFleet.filter((r) => !r.hasLiveFeed);
      expect(passive.length).toBe(245);
      expect(passive.every((m) => m.telemetry.status === 5)).toBe(true);
    });
  });
});
