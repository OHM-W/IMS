/**
 * IMS 1F Factory Floorplan Digital Twin — Fleet Model & Zone Definitions
 * Accurate CAD Layout from Floor1.dxf with Process Machine Positioning from Reference SCADA
 * Path: services/floorplan-web/frontend/src/constants/fleet.ts
 */

import {
  ProcessCategory,
  FleetFilterOption,
  MachineDef,
  ZoneDef,
  DrillingColumnSpec,
} from '../types/fleet';

export const SVG_VIEWBOX = {
  width: 3200,
  height: 1720,
  viewBox: '0 0 3200 1720',
};

export const TOTAL_FLEET_COUNT = 250;

/**
 * 10 Factory Manufacturing Zones strictly matching Floor1.dxf CAD Room Partitions
 */
export const FACTORY_ZONES: ZoneDef[] = [
  {
    id: 'DRILLING_HOLD',
    name: 'Drilling Hold & Tool Bay',
    displayName: 'DRILLING HOLD',
    bounds: { xMin: 410, yMin: 640, xMax: 520, yMax: 1160 },
    focusView: { x: 465, y: 900, zoom: 2.5 },
    machineCount: 5,
    description: 'Drill bit staging racks, automated collet grinding, and buffer.',
    color: '#38BDF8',
    center: { x: 465, y: 900 },
  },
  {
    id: 'DRILLING_MAIN',
    name: 'Mechanical Drilling Matrix',
    displayName: 'DRILLING MAIN (Phase 1-5)',
    bounds: { xMin: 520, yMin: 600, xMax: 1420, yMax: 1180 },
    focusView: { x: 970, y: 890, zoom: 1.5 },
    machineCount: 198,
    description: 'High-density multi-spindle mechanical CNC drilling columns across Phase 1-5 wings.',
    color: '#00FF87',
    center: { x: 970, y: 890 },
  },
  {
    id: 'XRY',
    name: 'Trimming & X-Ray Inspection',
    displayName: 'XRY',
    bounds: { xMin: 1400, yMin: 720, xMax: 1560, yMax: 960 },
    focusView: { x: 1480, y: 840, zoom: 2.8 },
    machineCount: 10,
    description: 'Target hole drilling and multi-layer internal registration X-Ray verification (XRY001, XRY002).',
    color: '#8B5CF6',
    center: { x: 1480, y: 840 },
  },
  {
    id: 'AUTO_LAY_UP',
    name: 'Auto Lay Up & Pressing',
    displayName: 'AUTO LAY UP & PRESS',
    bounds: { xMin: 1650, yMin: 620, xMax: 2150, yMax: 860 },
    focusView: { x: 1900, y: 740, zoom: 2.2 },
    machineCount: 8,
    description: 'Automated multi-opening vacuum hot/cold press systems and layup kitting.',
    color: '#F59E0B',
    center: { x: 1900, y: 740 },
  },
  {
    id: 'BONDING',
    name: 'Pin Lam & Multi-Bonding',
    displayName: 'BONDING',
    bounds: { xMin: 1500, yMin: 880, xMax: 1650, yMax: 1000 },
    focusView: { x: 1575, y: 940, zoom: 3.0 },
    machineCount: 1,
    description: 'Multi-layer pin lamination and induction bonding station.',
    color: '#A855F7',
    center: { x: 1575, y: 940 },
  },
  {
    id: 'OXIDE',
    name: 'Brown Oxide Chemical Lines',
    displayName: 'BROWN OXIDE',
    bounds: { xMin: 1650, yMin: 920, xMax: 2150, yMax: 1180 },
    focusView: { x: 1900, y: 1050, zoom: 2.2 },
    machineCount: 10,
    description: 'Continuous chemical treatment lines BWN001-BWN003 with ultrasonic cleaners.',
    color: '#EC4899',
    center: { x: 1900, y: 1050 },
  },
  {
    id: 'CUTTING',
    name: 'Laminate Cutting & Milling',
    displayName: 'CUTTING & MILLING',
    bounds: { xMin: 1100, yMin: 1200, xMax: 1580, yMax: 1500 },
    focusView: { x: 1340, y: 1350, zoom: 2.2 },
    machineCount: 15,
    description: 'CCL sizing saws, precision edge beveling, sheet cutters, and corner rounding.',
    color: '#EAB308',
    center: { x: 1340, y: 1350 },
  },
  {
    id: 'DE_OXIDE',
    name: 'De-Oxide Chemical Strip Line',
    displayName: 'DE-OXIDE',
    bounds: { xMin: 1650, yMin: 1220, xMax: 1850, yMax: 1480 },
    focusView: { x: 1750, y: 1350, zoom: 2.6 },
    machineCount: 3,
    description: 'De-Oxide acid etching, cascade rinse, and cassette loading/unloading.',
    color: '#14B8A6',
    center: { x: 1750, y: 1350 },
  },
  {
    id: 'LASER_DRILLING',
    name: 'Laser Drilling Cleanroom',
    displayName: 'LASER DRILLING (CLEANROOM)',
    bounds: { xMin: 1500, yMin: 1400, xMax: 1650, yMax: 1550 },
    focusView: { x: 1565, y: 1475, zoom: 2.4 },
    machineCount: 5,
    description: 'Cleanroom photolithography & laser micro-via direct imaging (001-005).',
    color: '#00FF87',
    center: { x: 1565, y: 1475 },
  },
  {
    id: 'PP_STORAGE',
    name: 'PP Storage & Preparation',
    displayName: 'PP STORAGE',
    bounds: { xMin: 2600, yMin: 840, xMax: 3120, yMax: 1200 },
    focusView: { x: 2860, y: 1020, zoom: 2.2 },
    machineCount: 6,
    description: 'Prepreg cleanroom storage bays, copper foil racks, and slitting tables.',
    color: '#06B6D4',
    center: { x: 2860, y: 1020 },
  },
];

export const ZONE_MAP: Record<ProcessCategory, ZoneDef> = FACTORY_ZONES.reduce(
  (acc, zone) => {
    acc[zone.id] = zone;
    return acc;
  },
  {} as Record<ProcessCategory, ZoneDef>
);

export const CAMERA_FOCUS_PRESETS: Record<
  FleetFilterOption,
  { x: number; y: number; zoom: number }
> = {
  ALL: { x: 1600, y: 775, zoom: 1.0 },
  DRILLING: { x: 940, y: 810, zoom: 1.5 },
  DRILLING_HOLD: { x: 430, y: 720, zoom: 2.5 },
  DRILLING_MAIN: { x: 940, y: 810, zoom: 1.5 },
  XRY: { x: 1410, y: 940, zoom: 2.5 },
  AUTO_LAY_UP: { x: 1720, y: 700, zoom: 2.2 },
  BONDING: { x: 1575, y: 940, zoom: 2.8 },
  OXIDE: { x: 1600, y: 1130, zoom: 2.2 },
  PP_STORAGE: { x: 2755, y: 960, zoom: 2.0 },
  CUTTING: { x: 1280, y: 1430, zoom: 2.0 },
  DE_OXIDE: { x: 1440, y: 1410, zoom: 2.5 },
  LASER_DRILLING: { x: 1565, y: 1475, zoom: 2.4 },
};

const pad3 = (n: number) => n.toString().padStart(3, '0');

// ============================================================================
// MECHANICAL DRILLING MATRIX (TOP, BOTTOM, CENTER ARRAYS INSIDE CAD WINGS)
// ============================================================================

/** Top Array: 16 Columns (x: 540 to 1340, y: 640..780) */
export const TOP_DRILLING_COLUMNS: DrillingColumnSpec[] = [
  // Left 8 columns
  { label: '140..144', array: 'TOP', colIndex: 0, x: 540, yStart: 640, yStep: 26, indices: [140, 141, 142, 143, 144], idPrefix: 'DRL-T00' },
  { label: '139..135', array: 'TOP', colIndex: 1, x: 585, yStart: 640, yStep: 26, indices: [139, 138, 137, 136, 135], idPrefix: 'DRL-T01' },
  { label: '130..134', array: 'TOP', colIndex: 2, x: 630, yStart: 640, yStep: 26, indices: [130, 131, 132, 133, 134], idPrefix: 'DRL-T02' },
  { label: '129..125', array: 'TOP', colIndex: 3, x: 675, yStart: 640, yStep: 26, indices: [129, 128, 127, 126, 125], idPrefix: 'DRL-T03' },
  { label: '120..124', array: 'TOP', colIndex: 4, x: 720, yStart: 640, yStep: 26, indices: [120, 121, 122, 123, 124], idPrefix: 'DRL-T04' },
  { label: '119..115', array: 'TOP', colIndex: 5, x: 765, yStart: 640, yStep: 26, indices: [119, 118, 117, 116, 115], idPrefix: 'DRL-T05' },
  { label: '110..114', array: 'TOP', colIndex: 6, x: 810, yStart: 640, yStep: 26, indices: [110, 111, 112, 113, 114], idPrefix: 'DRL-T06' },
  { label: '109..105', array: 'TOP', colIndex: 7, x: 855, yStart: 640, yStep: 26, indices: [109, 108, 107, 106, 105], idPrefix: 'DRL-T07' },

  // Right 8 columns
  { label: '099..095', array: 'TOP', colIndex: 8, x: 980, yStart: 640, yStep: 26, indices: [99, 100, 96, 95], idPrefix: 'DRL-T08' },
  { label: '098..097', array: 'TOP', colIndex: 9, x: 1025, yStart: 640, yStep: 26, indices: [98, 97], idPrefix: 'DRL-T09' },
  { label: '083..086', array: 'TOP', colIndex: 10, x: 1070, yStart: 640, yStep: 26, indices: [83, 84, 85, 86], idPrefix: 'DRL-T10' },
  { label: '082..079', array: 'TOP', colIndex: 11, x: 1115, yStart: 640, yStep: 26, indices: [82, 81, 80, 79], idPrefix: 'DRL-T11' },
  { label: '066..070', array: 'TOP', colIndex: 12, x: 1160, yStart: 640, yStep: 26, indices: [66, 67, 68, 69, 70], idPrefix: 'DRL-T12' },
  { label: '065..061', array: 'TOP', colIndex: 13, x: 1205, yStart: 640, yStep: 26, indices: [65, 64, 63, 62, 61], idPrefix: 'DRL-T13' },
  { label: '048..052', array: 'TOP', colIndex: 14, x: 1250, yStart: 640, yStep: 26, indices: [48, 49, 50, 51, 52], idPrefix: 'DRL-T14' },
  { label: '047..043', array: 'TOP', colIndex: 15, x: 1295, yStart: 640, yStep: 26, indices: [47, 46, 45, 44, 43], idPrefix: 'DRL-T15' },
];

/** Lower Left Array: 8 Columns under Right Top Array (x: 980 to 1295, y: 800..900) */
export const BOTTOM_DRILLING_COLUMNS: DrillingColumnSpec[] = [
  { label: '101..104', array: 'BOTTOM', colIndex: 0, x: 980, yStart: 800, yStep: 26, indices: [101, 102, 103, 104], idPrefix: 'DRL-B00' },
  { label: '094..091', array: 'BOTTOM', colIndex: 1, x: 1025, yStart: 800, yStep: 26, indices: [94, 93, 92, 91], idPrefix: 'DRL-B01' },
  { label: '087..090', array: 'BOTTOM', colIndex: 2, x: 1070, yStart: 800, yStep: 26, indices: [87, 88, 89, 90], idPrefix: 'DRL-B02' },
  { label: '078..075', array: 'BOTTOM', colIndex: 3, x: 1115, yStart: 800, yStep: 26, indices: [78, 77, 76, 75], idPrefix: 'DRL-B03' },
  { label: '071..074', array: 'BOTTOM', colIndex: 4, x: 1160, yStart: 800, yStep: 26, indices: [71, 72, 73, 74], idPrefix: 'DRL-B04' },
  { label: '060..057', array: 'BOTTOM', colIndex: 5, x: 1205, yStart: 800, yStep: 26, indices: [60, 59, 58, 57], idPrefix: 'DRL-B05' },
  { label: '053..056', array: 'BOTTOM', colIndex: 6, x: 1250, yStart: 800, yStep: 26, indices: [53, 54, 55, 56], idPrefix: 'DRL-B06' },
  { label: '042',        array: 'BOTTOM', colIndex: 7, x: 1295, yStart: 800, yStep: 26, indices: [42], idPrefix: 'DRL-B07' },
];

/** Center Drilling Array: 6 Columns + Standalone pair (x: 540 to 860, y: 800..1060) */
export const MIDDLE_DRILLING_COLUMNS: DrillingColumnSpec[] = [
  { label: '039..041', array: 'MIDDLE', colIndex: 0, x: 540, yStart: 800, yStep: 26, indices: [39, 40, 41], idPrefix: 'DRL-M00' },
  { label: '038..032', array: 'MIDDLE', colIndex: 1, x: 585, yStart: 800, yStep: 26, indices: [38, 37, 36, 35, 34, 33, 31, 32], idPrefix: 'DRL-M01' },
  { label: '025..030', array: 'MIDDLE', colIndex: 2, x: 630, yStart: 800, yStep: 26, indices: [25, 26, 27, 28, 29, 30], idPrefix: 'DRL-M02' },
  { label: '024..017', array: 'MIDDLE', colIndex: 3, x: 675, yStart: 800, yStep: 26, indices: [24, 23, 22, 21, 20, 19, 18, 17], idPrefix: 'DRL-M03' },
  { label: '009..001', array: 'MIDDLE', colIndex: 4, x: 720, yStart: 800, yStep: 26, indices: [9, 10, 11, 12, 13, 14, 15, 16], idPrefix: 'DRL-M04' },
  { label: '008..001', array: 'MIDDLE', colIndex: 5, x: 765, yStart: 800, yStep: 26, indices: [8, 7, 6, 5, 4, 3, 2, 1], idPrefix: 'DRL-M05' },
  { label: 'STANDALONE', array: 'STANDALONE', colIndex: 6, x: 820, yStart: 1040, yStep: 26, indices: [1, 2], idPrefix: 'DRL-S00' },
];

export const DRILLING_TELEMETRY_IDS: Record<number, string> = {
  1: 'DRL001-M', 2: 'DRL002-M', 3: 'DRL003-M', 4: 'DRL004-M', 5: 'DRL005-M',
  6: 'DRL006-M', 7: 'DRL007-M', 8: 'DRL008-M', 9: 'DRL009-M', 10: 'DRL010-M',
  11: 'DRL011-M', 12: 'DRL012-M', 13: 'DRL013-M', 14: 'DRL014-M', 15: 'DRL015-M',
  16: 'DRL016-M', 17: 'DRL017-M', 18: 'DRL018-M', 19: 'DRL019-M', 20: 'DRL020-M',
  21: 'DRL021-M', 22: 'DRL022-M', 23: 'DRL023-M', 24: 'DRL024-M', 25: 'DRL025-M',
  26: 'DRL026-M', 27: 'DRL027-M', 28: 'DRL028-M', 29: 'DRL029-M', 30: 'DRL030-M',
  31: 'DRL031-M', 32: 'DRL032-M', 33: 'DRL033-M', 34: 'DRL034-M', 35: 'DRL035-M',
  37: 'DRL037-M', 38: 'DRL038-M', 39: 'DRL039-M', 40: 'DRL040-M', 41: 'DRL041-M',
  42: 'DRL042-M', 43: 'DRL043-M', 44: 'DRL044-M', 45: 'DRL045-M', 46: 'DRL046-M',
  47: 'DRL047-M', 50: 'DRL050-M', 52: 'DRL052-M', 53: 'DRL053-M', 54: 'DRL054-M',
  55: 'DRL055-M', 56: 'DRL056-M', 59: 'DRL059-M', 60: 'DRL060-M', 61: 'DRL061-M',
  62: 'DRL062-M', 63: 'DRL063-M', 64: 'DRL64-M', 65: 'DRL065-M', 66: 'DRL066-M',
  67: 'DRL067-M', 68: 'DRL068-M', 69: 'DRL69-M', 70: 'DRL070-M', 71: 'DRL071-M',
  72: 'DRL072-M', 73: 'DRL073-M', 74: 'DRL074-M', 75: 'DRL075-M', 76: 'DRL076-M',
  77: 'DRL077-M', 78: 'DRL078-M', 79: 'DRL079-M', 80: 'DRL080-M', 81: 'DRL081-M',
  82: 'DRL082-M', 83: 'DRL083-M', 84: 'DRL084-M', 85: 'DRL085-M', 86: 'DRL086-M',
  87: 'DRL087-M', 88: 'DRL088-M', 89: 'DRL089-M', 90: 'DRL090-M', 91: 'DRL091-M',
  92: 'DRL092-M', 93: 'DRL093-M', 94: 'DRL094-M', 95: 'DRL095-M', 96: 'DRL096-M',
  97: 'DRL097-M', 98: 'DRL098-M', 99: 'DRL099-M', 101: 'DRL101-M', 102: 'DRL102-M',
  103: 'DRL103-M', 104: 'DRL104-M',
};

function generateDrillingUnits(columnSpecs: DrillingColumnSpec[]): MachineDef[] {
  const machines: MachineDef[] = [];
  for (const col of columnSpecs) {
    col.indices.forEach((num, rowIndex) => {
      const machineId = `${col.idPrefix}-${pad3(num)}`;
      const telemId = DRILLING_TELEMETRY_IDS[num];
      machines.push({
        id: machineId,
        name: `${pad3(num)}`,
        process: 'DRILLING_MAIN',
        processGroup: col.array,
        columnGroup: col.label,
        array: col.array,
        columnIndex: col.colIndex,
        rowIndex,
        svgX: col.x,
        svgY: col.yStart + rowIndex * col.yStep,
        cardWidth: 38,
        cardHeight: 22,
        isCompact: true,
        hasLiveFeed: Boolean(telemId),
        telemetryId: telemId,
        specs: {
          spindleCount: 6,
          maxSpeedRpm: 200000,
          powerKw: 3.5,
        },
      });
    });
  }
  return machines;
}

const topDrillingUnits = generateDrillingUnits(TOP_DRILLING_COLUMNS);
const bottomDrillingUnits = generateDrillingUnits(BOTTOM_DRILLING_COLUMNS);
const middleDrillingUnits = generateDrillingUnits(MIDDLE_DRILLING_COLUMNS);

// ============================================================================
// PERIPHERAL PROCESS FLEETS (ALL POSITIONED WITHIN CAD WALLS)
// ============================================================================

/** 1. DRILLING HOLD (5 Units in Left Vertical Column) */
const drillingHoldUnits: MachineDef[] = [
  { id: 'DH-ULD', name: 'ULD', process: 'DRILLING_HOLD', processGroup: 'DRILLING_HOLD', svgX: 430, svgY: 720, cardWidth: 40, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'DH-HOL', name: 'HOL', process: 'DRILLING_HOLD', processGroup: 'DRILLING_HOLD', svgX: 430, svgY: 765, cardWidth: 40, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'DH-GRD', name: 'GRD', process: 'DRILLING_HOLD', processGroup: 'DRILLING_HOLD', svgX: 430, svgY: 810, cardWidth: 40, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'DH-LDG', name: 'LDG', process: 'DRILLING_HOLD', processGroup: 'DRILLING_HOLD', svgX: 430, svgY: 855, cardWidth: 40, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'DHC001', name: 'DHC001', process: 'DRILLING_HOLD', processGroup: 'DRILLING_HOLD', svgX: 425, svgY: 900, cardWidth: 65, cardHeight: 36, isCompact: true, hasLiveFeed: false },
];

/** 2. AUTO LAY UP (8 Units in Top-Right CAD Press Hall) */
const autoLayUpUnits: MachineDef[] = [
  { id: 'ALU-1-H3', name: '1-H3', process: 'AUTO_LAY_UP', processGroup: 'HOT_PRESS', svgX: 1880, svgY: 660, cardWidth: 44, cardHeight: 28, isCompact: true, hasLiveFeed: false },
  { id: 'ALU-1-C2', name: '1-C2', process: 'AUTO_LAY_UP', processGroup: 'COLD_PRESS', svgX: 1930, svgY: 660, cardWidth: 44, cardHeight: 28, isCompact: true, hasLiveFeed: false },
  { id: 'ALU-1-H2', name: '1-H2', process: 'AUTO_LAY_UP', processGroup: 'HOT_PRESS', svgX: 1980, svgY: 660, cardWidth: 44, cardHeight: 28, isCompact: true, hasLiveFeed: false },
  { id: 'ALU-1-C1', name: '1-C1', process: 'AUTO_LAY_UP', processGroup: 'COLD_PRESS', svgX: 2030, svgY: 660, cardWidth: 44, cardHeight: 28, isCompact: true, hasLiveFeed: false },
  { id: 'ALU-1-H1', name: '1-H1', process: 'AUTO_LAY_UP', processGroup: 'HOT_PRESS', svgX: 2080, svgY: 660, cardWidth: 44, cardHeight: 28, isCompact: true, hasLiveFeed: false },
  { id: 'ALU-PRS',  name: 'PRS',  process: 'AUTO_LAY_UP', processGroup: 'TRANSFER',   svgX: 1980, svgY: 700, cardWidth: 140, cardHeight: 28, isCompact: false, hasLiveFeed: false },
  { id: 'ALU-DLM',  name: 'DLM',  process: 'AUTO_LAY_UP', processGroup: 'DELAM',      svgX: 1680, svgY: 740, cardWidth: 230, cardHeight: 34, isCompact: false, hasLiveFeed: false },
  { id: 'ALU-LTK',  name: 'LTK',  process: 'AUTO_LAY_UP', processGroup: 'KITTING',    svgX: 1960, svgY: 740, cardWidth: 80, cardHeight: 70, isCompact: false, hasLiveFeed: false },
];

/** 3. BONDING (1 Unit in CAD Pin-Lam Bonding Room) */
const bondingUnits: MachineDef[] = [
  { id: 'BND-001', name: '001', process: 'BONDING', processGroup: 'BONDING', svgX: 1540, svgY: 920, cardWidth: 80, cardHeight: 38, isCompact: false, hasLiveFeed: false },
];

/** 4. OXIDE (10 Units in CAD Brown Oxide Chemical Hall) */
const oxideUnits: MachineDef[] = [
  // Line 1: BWN001
  { id: 'BWN001-ULD', name: 'ULD', process: 'OXIDE', processGroup: 'BWN001', svgX: 1720, svgY: 970, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN001-BWN', name: 'BWN', process: 'OXIDE', processGroup: 'BWN001', svgX: 1720, svgY: 1005, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN001-PUC', name: 'PUC', process: 'OXIDE', processGroup: 'BWN001', svgX: 1720, svgY: 1040, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN001-LDG', name: 'LDG', process: 'OXIDE', processGroup: 'BWN001', svgX: 1720, svgY: 1075, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },

  // Line 2: BWN002
  { id: 'BWN002-ULD', name: 'ULD', process: 'OXIDE', processGroup: 'BWN002', svgX: 1820, svgY: 935, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN002-BWN', name: 'BWN', process: 'OXIDE', processGroup: 'BWN002', svgX: 1820, svgY: 970, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN002-PUC', name: 'PUC', process: 'OXIDE', processGroup: 'BWN002', svgX: 1820, svgY: 1005, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN002-LDG', name: 'LDG', process: 'OXIDE', processGroup: 'BWN002', svgX: 1820, svgY: 1040, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },

  // Line 3: BWN003
  { id: 'BWN003-BWN', name: 'BWN', process: 'OXIDE', processGroup: 'BWN003', svgX: 1920, svgY: 970, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'BWN003-PUC', name: 'PUC', process: 'OXIDE', processGroup: 'BWN003', svgX: 1920, svgY: 1005, cardWidth: 44, cardHeight: 26, isCompact: true, hasLiveFeed: false },
];

/** 5. X-RAY (10 Units in 2 Columns XRY001 & XRY002) */
const xRayUnits: MachineDef[] = [
  // XRY001
  { id: 'XRY1-RAY', name: 'RAY', process: 'XRY', processGroup: 'XRY001', svgX: 1430, svgY: 760, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY1-CUT', name: 'CUT', process: 'XRY', processGroup: 'XRY001', svgX: 1430, svgY: 795, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY1-BDL', name: 'BDL', process: 'XRY', processGroup: 'XRY001', svgX: 1430, svgY: 830, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY1-LTM', name: 'LTM', process: 'XRY', processGroup: 'XRY001', svgX: 1430, svgY: 865, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY1-ULD', name: 'ULD', process: 'XRY', processGroup: 'XRY001', svgX: 1430, svgY: 900, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },

  // XRY002
  { id: 'XRY2-RAY', name: 'RAY', process: 'XRY', processGroup: 'XRY002', svgX: 1480, svgY: 760, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY2-CUT', name: 'CUT', process: 'XRY', processGroup: 'XRY002', svgX: 1480, svgY: 795, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY2-BDL', name: 'BDL', process: 'XRY', processGroup: 'XRY002', svgX: 1480, svgY: 830, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY2-LTM', name: 'LTM', process: 'XRY', processGroup: 'XRY002', svgX: 1480, svgY: 865, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
  { id: 'XRY2-ULD', name: 'ULD', process: 'XRY', processGroup: 'XRY002', svgX: 1480, svgY: 900, cardWidth: 40, cardHeight: 26, isCompact: true, hasLiveFeed: false },
];

/** 6. PP STORAGE (6 Units in Prepreg Storage Area) */
const ppStorageUnits: MachineDef[] = [
  { id: 'PP-BAY-01', name: 'BAY-1', process: 'PP_STORAGE', processGroup: 'PP_STORAGE', bay: 'Bay 1', svgX: 2680, svgY: 890, cardWidth: 70, cardHeight: 36, isCompact: true, hasLiveFeed: false },
  { id: 'PP-BAY-02', name: 'BAY-2', process: 'PP_STORAGE', processGroup: 'PP_STORAGE', bay: 'Bay 2', svgX: 2760, svgY: 890, cardWidth: 70, cardHeight: 36, isCompact: true, hasLiveFeed: false },
  { id: 'PP-BAY-03', name: 'BAY-3', process: 'PP_STORAGE', processGroup: 'PP_STORAGE', bay: 'Bay 3', svgX: 2680, svgY: 940, cardWidth: 70, cardHeight: 36, isCompact: true, hasLiveFeed: false },
  { id: 'PP-BAY-04', name: 'BAY-4', process: 'PP_STORAGE', processGroup: 'PP_STORAGE', bay: 'Bay 4', svgX: 2760, svgY: 940, cardWidth: 70, cardHeight: 36, isCompact: true, hasLiveFeed: false },
  { id: 'PP-BAY-05', name: 'BAY-5', process: 'PP_STORAGE', processGroup: 'PP_STORAGE', bay: 'Bay 5', svgX: 2680, svgY: 990, cardWidth: 70, cardHeight: 36, isCompact: true, hasLiveFeed: false },
  { id: 'PP-BAY-06', name: 'BAY-6', process: 'PP_STORAGE', processGroup: 'PP_STORAGE', bay: 'Bay 6', svgX: 2760, svgY: 990, cardWidth: 70, cardHeight: 36, isCompact: true, hasLiveFeed: false },
];

/** 7. CUTTING (15 Units in Cutting Hall) */
const cuttingUnits: MachineDef[] = [
  // Top Row: CCL002 + VSC + MIL3..1 + ULD3..1
  { id: 'CUT-CCL002', name: 'CCL002', process: 'CUTTING', processGroup: 'SAW',      svgX: 1160, svgY: 1260, cardWidth: 70, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-VSC2',   name: 'VSC',    process: 'CUTTING', processGroup: 'SAW',      svgX: 1240, svgY: 1260, cardWidth: 55, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-MIL3',   name: 'MIL3',   process: 'CUTTING', processGroup: 'MILL',     svgX: 1310, svgY: 1240, cardWidth: 65, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-ULD3',   name: 'ULD3',   process: 'CUTTING', processGroup: 'UNLOADER', svgX: 1385, svgY: 1240, cardWidth: 65, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-MIL2A',  name: 'MIL2',   process: 'CUTTING', processGroup: 'MILL',     svgX: 1310, svgY: 1270, cardWidth: 65, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-ULD2A',  name: 'ULD2',   process: 'CUTTING', processGroup: 'UNLOADER', svgX: 1385, svgY: 1270, cardWidth: 65, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-MIL1A',  name: 'MIL1',   process: 'CUTTING', processGroup: 'MILL',     svgX: 1310, svgY: 1300, cardWidth: 65, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-ULD1A',  name: 'ULD1',   process: 'CUTTING', processGroup: 'UNLOADER', svgX: 1385, svgY: 1300, cardWidth: 65, cardHeight: 24, isCompact: true, hasLiveFeed: false },

  // Bottom Row: CCL001 + VSC + CUT + MIL2..1 + ULD2..1
  { id: 'CUT-CCL001', name: 'CCL001', process: 'CUTTING', processGroup: 'SAW',      svgX: 1160, svgY: 1350, cardWidth: 70, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-VSC1',   name: 'VSC',    process: 'CUTTING', processGroup: 'SAW',      svgX: 1240, svgY: 1350, cardWidth: 55, cardHeight: 32, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-CUT',    name: 'CUT',    process: 'CUTTING', processGroup: 'CUTTER',   svgX: 1310, svgY: 1355, cardWidth: 60, cardHeight: 28, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-MIL2B',  name: 'MIL2',   process: 'CUTTING', processGroup: 'MILL',     svgX: 1380, svgY: 1340, cardWidth: 60, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-ULD2B',  name: 'ULD2',   process: 'CUTTING', processGroup: 'UNLOADER', svgX: 1450, svgY: 1340, cardWidth: 60, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-MIL1B',  name: 'MIL1',   process: 'CUTTING', processGroup: 'MILL',     svgX: 1380, svgY: 1370, cardWidth: 60, cardHeight: 24, isCompact: true, hasLiveFeed: false },
  { id: 'CUT-ULD1B',  name: 'ULD1',   process: 'CUTTING', processGroup: 'UNLOADER', svgX: 1450, svgY: 1370, cardWidth: 60, cardHeight: 24, isCompact: true, hasLiveFeed: false },
];

/** 8. DE-OXIDE (3 Units in Strip) */
const deOxideUnits: MachineDef[] = [
  { id: 'DEO-LDG', name: 'LDG', process: 'DE_OXIDE', processGroup: 'DE_OXIDE', svgX: 1720, svgY: 1280, cardWidth: 55, cardHeight: 34, isCompact: true, hasLiveFeed: false },
  { id: 'DEO-DEO', name: 'DEO', process: 'DE_OXIDE', processGroup: 'DE_OXIDE', svgX: 1720, svgY: 1335, cardWidth: 55, cardHeight: 34, isCompact: true, hasLiveFeed: false },
  { id: 'DEO-ULD', name: 'ULD', process: 'DE_OXIDE', processGroup: 'DE_OXIDE', svgX: 1720, svgY: 1390, cardWidth: 55, cardHeight: 34, isCompact: true, hasLiveFeed: false },
];

/** 9. LASER DRILLING (5 Machines in Cleanroom matching SCADA 001..005) */
const laserDrillingUnits: MachineDef[] = [
  { id: 'LSR-004', name: '004', process: 'LASER_DRILLING', processGroup: 'CLEANROOM', telemetryId: 'LDI-04', hasLiveFeed: true, svgX: 2320, svgY: 570, cardWidth: 80, cardHeight: 50, isCompact: false },
  { id: 'LSR-003', name: '003', process: 'LASER_DRILLING', processGroup: 'CLEANROOM', telemetryId: 'LDI-03', hasLiveFeed: true, svgX: 2480, svgY: 570, cardWidth: 80, cardHeight: 50, isCompact: false },
  { id: 'LSR-005', name: '005', process: 'LASER_DRILLING', processGroup: 'CLEANROOM', telemetryId: 'LDI-05', hasLiveFeed: true, svgX: 2320, svgY: 645, cardWidth: 80, cardHeight: 50, isCompact: false },
  { id: 'LSR-002', name: '002', process: 'LASER_DRILLING', processGroup: 'CLEANROOM', telemetryId: 'LDI-02', hasLiveFeed: true, svgX: 2480, svgY: 645, cardWidth: 80, cardHeight: 50, isCompact: false },
  { id: 'LSR-001', name: '001', process: 'LASER_DRILLING', processGroup: 'CLEANROOM', telemetryId: 'LDI-01', hasLiveFeed: true, svgX: 2480, svgY: 710, cardWidth: 80, cardHeight: 50, isCompact: false },
];

/**
 * COMPLETE MASTER FLEET ARRAY
 */
export const FLEET_MACHINES: MachineDef[] = [
  ...drillingHoldUnits,     // 5
  ...topDrillingUnits,       // 102
  ...bottomDrillingUnits,    // 40
  ...middleDrillingUnits,    // 56
  ...autoLayUpUnits,         // 8
  ...bondingUnits,           // 1
  ...oxideUnits,             // 10
  ...xRayUnits,              // 10
  ...ppStorageUnits,         // 6
  ...cuttingUnits,           // 15
  ...deOxideUnits,           // 3
  ...laserDrillingUnits,     // 5
];

export const FLEET_MACHINE_MAP: Map<string, MachineDef> = new Map(
  FLEET_MACHINES.map((m) => [m.id, m])
);

export const TELEMETRY_ID_MAP: Map<string, MachineDef> = new Map(
  FLEET_MACHINES.filter((m) => m.telemetryId).map((m) => [m.telemetryId!, m])
);
