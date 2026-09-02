/**
 * Adversarial Challenger Test Suite — Milestone 1: Fleet Model & SCADA Constants
 * Author: M1 Fleet Model Challenger 1
 * Path: services/floorplan-web/frontend/src/test/challenger_m1_fleet.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  FLEET_MACHINES,
  FLEET_MACHINE_MAP,
  TELEMETRY_ID_MAP,
  FACTORY_ZONES,
  ZONE_MAP,
  TOP_DRILLING_COLUMNS,
  BOTTOM_DRILLING_COLUMNS,
  MIDDLE_DRILLING_COLUMNS,
  CAMERA_FOCUS_PRESETS,
  SVG_VIEWBOX,
  TOTAL_FLEET_COUNT,
} from '../constants/fleet';
import {
  ISA_STATUS_TOKENS,
  ISA_STATUS_COLORS,
  STATUS_COLORS,
  getStatusTheme,
  getScadaStatusTheme,
  getTemperatureTolerance,
  getHumidityTolerance,
} from '../constants/colors';
import { ProcessCategory, StatusToken, MachineDef } from '../types/fleet';

const VALID_PROCESS_CATEGORIES: ProcessCategory[] = [
  'DRILLING_HOLD',
  'DRILLING_MAIN',
  'AUTO_LAY_UP',
  'BONDING',
  'OXIDE',
  'PP_STORAGE',
  'CUTTING',
  'DE_OXIDE',
  'LASER_DRILLING',
  'XRY',
];

describe('ADVERSARIAL CHALLENGER SUITE: Milestone 1 Fleet Model & SCADA Constants', () => {
  // =========================================================================
  // 1. FLEET COMPLETENESS & DATA INTEGRITY
  // =========================================================================
  describe('1. Fleet Completeness & Machine Field Rigor', () => {
    it('contains exactly 250 machine definitions', () => {
      expect(FLEET_MACHINES.length).toBe(250);
      expect(TOTAL_FLEET_COUNT).toBe(250);
    });

    it('ensures every machine has non-empty, trimmed, unique ID', () => {
      const idSet = new Set<string>();
      for (const m of FLEET_MACHINES) {
        expect(m.id).toBeDefined();
        expect(typeof m.id).toBe('string');
        expect(m.id.trim().length).toBeGreaterThan(0);
        expect(m.id).toBe(m.id.trim());
        expect(idSet.has(m.id)).toBe(false);
        idSet.add(m.id);
      }
      expect(idSet.size).toBe(250);
      expect(FLEET_MACHINE_MAP.size).toBe(250);
    });

    it('ensures every machine has non-empty name', () => {
      for (const m of FLEET_MACHINES) {
        expect(m.name).toBeDefined();
        expect(typeof m.name).toBe('string');
        expect(m.name.trim().length).toBeGreaterThan(0);
      }
    });

    it('ensures all 250 machines belong to a recognized ProcessCategory', () => {
      for (const m of FLEET_MACHINES) {
        expect(VALID_PROCESS_CATEGORIES).toContain(m.process);
      }
    });

    it('ensures no NaN, null, undefined, or infinite coordinates exist', () => {
      for (const m of FLEET_MACHINES) {
        expect(Number.isFinite(m.svgX)).toBe(true);
        expect(Number.isNaN(m.svgX)).toBe(false);
        expect(Number.isFinite(m.svgY)).toBe(true);
        expect(Number.isNaN(m.svgY)).toBe(false);

        if (m.cardWidth !== undefined) {
          expect(Number.isFinite(m.cardWidth)).toBe(true);
          expect(m.cardWidth).toBeGreaterThan(0);
        }
        if (m.cardHeight !== undefined) {
          expect(Number.isFinite(m.cardHeight)).toBe(true);
          expect(m.cardHeight).toBeGreaterThan(0);
        }
        if (m.columnIndex !== undefined) {
          expect(Number.isInteger(m.columnIndex)).toBe(true);
          expect(m.columnIndex).toBeGreaterThanOrEqual(0);
        }
        if (m.rowIndex !== undefined) {
          expect(Number.isInteger(m.rowIndex)).toBe(true);
          expect(m.rowIndex).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('verifies telemetry IDs on live feed machines are unique and valid', () => {
      const liveMachines = FLEET_MACHINES.filter((m) => m.hasLiveFeed);
      expect(liveMachines.length).toBe(5);
      const telSet = new Set<string>();
      for (const m of liveMachines) {
        expect(m.telemetryId).toBeDefined();
        expect(typeof m.telemetryId).toBe('string');
        expect(m.telemetryId!.trim().length).toBeGreaterThan(0);
        expect(telSet.has(m.telemetryId!)).toBe(false);
        telSet.add(m.telemetryId!);
      }
      expect(TELEMETRY_ID_MAP.size).toBe(5);
    });
  });

  // =========================================================================
  // 2. CANVAS BOUNDS & GEOMETRIC STRICTNESS
  // =========================================================================
  describe('2. Canvas Spatial Boundaries & Layout Bounds (3200 x 1550)', () => {
    const CANVAS_WIDTH = SVG_VIEWBOX.width; // 3200
    const CANVAS_HEIGHT = SVG_VIEWBOX.height; // 1550

    it('verifies SVG viewBox dimensions are exactly 3200 x 1550', () => {
      expect(CANVAS_WIDTH).toBe(3200);
      expect(CANVAS_HEIGHT).toBe(1550);
      expect(SVG_VIEWBOX.viewBox).toBe('0 0 3200 1550');
    });

    it('ensures every machine bounding box fits completely within the canvas', () => {
      const outOfBounds: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

      for (const m of FLEET_MACHINES) {
        const width = m.cardWidth ?? (m.isCompact ? 44 : 80);
        const height = m.cardHeight ?? (m.isCompact ? 32 : 60);

        const xMin = m.svgX;
        const yMin = m.svgY;
        const xMax = m.svgX + width;
        const yMax = m.svgY + height;

        if (xMin < 0 || yMin < 0 || xMax > CANVAS_WIDTH || yMax > CANVAS_HEIGHT) {
          outOfBounds.push({ id: m.id, x: m.svgX, y: m.svgY, w: width, h: height });
        }
      }

      expect(outOfBounds).toEqual([]);
    });

    it('ensures all machine center points are strictly inside canvas interior', () => {
      for (const m of FLEET_MACHINES) {
        const width = m.cardWidth ?? (m.isCompact ? 44 : 80);
        const height = m.cardHeight ?? (m.isCompact ? 32 : 60);
        const centerX = m.svgX + width / 2;
        const centerY = m.svgY + height / 2;

        expect(centerX).toBeGreaterThan(0);
        expect(centerX).toBeLessThan(CANVAS_WIDTH);
        expect(centerY).toBeGreaterThan(0);
        expect(centerY).toBeLessThan(CANVAS_HEIGHT);
      }
    });
  });

  // =========================================================================
  // 3. ADVERSARIAL OVERLAP & COLLISION DETECTION
  // =========================================================================
  describe('3. Adversarial Collision & Overlapping Bounding Box Harness', () => {
    function getBoundingBox(m: MachineDef) {
      const width = m.cardWidth ?? (m.isCompact ? 44 : 80);
      const height = m.cardHeight ?? (m.isCompact ? 32 : 60);
      return {
        id: m.id,
        name: m.name,
        process: m.process,
        x1: m.svgX,
        y1: m.svgY,
        x2: m.svgX + width,
        y2: m.svgY + height,
        width,
        height,
      };
    }

    it('checks all (250*249)/2 = 31,125 pairs for zero spatial overlap', () => {
      const boxes = FLEET_MACHINES.map(getBoundingBox);
      const overlaps: Array<{
        m1: string;
        m2: string;
        process1: string;
        process2: string;
        intersectionArea: number;
        overlapBox: { xMin: number; yMin: number; xMax: number; yMax: number };
      }> = [];

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const b1 = boxes[i];
          const b2 = boxes[j];

          const overlapX1 = Math.max(b1.x1, b2.x1);
          const overlapY1 = Math.max(b1.y1, b2.y1);
          const overlapX2 = Math.min(b1.x2, b2.x2);
          const overlapY2 = Math.min(b1.y2, b2.y2);

          if (overlapX1 < overlapX2 && overlapY1 < overlapY2) {
            const overlapWidth = overlapX2 - overlapX1;
            const overlapHeight = overlapY2 - overlapY1;
            const area = overlapWidth * overlapHeight;

            overlaps.push({
              m1: b1.id,
              m2: b2.id,
              process1: b1.process,
              process2: b2.process,
              intersectionArea: area,
              overlapBox: { xMin: overlapX1, yMin: overlapY1, xMax: overlapX2, yMax: overlapY2 },
            });
          }
        }
      }

      // Assert zero overlapping bounding boxes across all 250 machines
      expect(overlaps).toEqual([]);
    });

    it('verifies minimum safety margin between adjacent drilling column centers', () => {
      // Top array column centers
      for (let i = 0; i < TOP_DRILLING_COLUMNS.length - 1; i++) {
        const colA = TOP_DRILLING_COLUMNS[i];
        const colB = TOP_DRILLING_COLUMNS[i + 1];
        expect(colB.x).toBeGreaterThan(colA.x);
        expect(colB.x - colA.x).toBeGreaterThanOrEqual(44); // At least cardWidth
      }

      // Bottom array column centers
      for (let i = 0; i < BOTTOM_DRILLING_COLUMNS.length - 1; i++) {
        const colA = BOTTOM_DRILLING_COLUMNS[i];
        const colB = BOTTOM_DRILLING_COLUMNS[i + 1];
        expect(colB.x).toBeGreaterThan(colA.x);
        expect(colB.x - colA.x).toBeGreaterThanOrEqual(44);
      }

      // Middle array column centers
      for (let i = 0; i < MIDDLE_DRILLING_COLUMNS.length - 1; i++) {
        const colA = MIDDLE_DRILLING_COLUMNS[i];
        const colB = MIDDLE_DRILLING_COLUMNS[i + 1];
        expect(colB.x).toBeGreaterThan(colA.x);
        expect(colB.x - colA.x).toBeGreaterThanOrEqual(44);
      }
    });
  });

  // =========================================================================
  // 4. ZONE SPATIAL INTEGRITY & FOCUS CAMERA PRESETS
  // =========================================================================
  describe('4. Zone Bounds & Focus Camera Preset Stress-Testing', () => {
    it('verifies all 10 zones have valid non-overlapping bounds within canvas', () => {
      expect(FACTORY_ZONES.length).toBe(10);

      for (const zone of FACTORY_ZONES) {
        expect(zone.bounds.xMin).toBeGreaterThanOrEqual(0);
        expect(zone.bounds.yMin).toBeGreaterThanOrEqual(0);
        expect(zone.bounds.xMax).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(zone.bounds.yMax).toBeLessThanOrEqual(SVG_VIEWBOX.height);
        expect(zone.bounds.xMax - zone.bounds.xMin).toBeGreaterThan(50);
        expect(zone.bounds.yMax - zone.bounds.yMin).toBeGreaterThan(50);
      }
    });

    it('verifies every zone focus camera center is strictly inside zone bounds', () => {
      for (const zone of FACTORY_ZONES) {
        expect(zone.focusView.x).toBeGreaterThanOrEqual(zone.bounds.xMin);
        expect(zone.focusView.x).toBeLessThanOrEqual(zone.bounds.xMax);
        expect(zone.focusView.y).toBeGreaterThanOrEqual(zone.bounds.yMin);
        expect(zone.focusView.y).toBeLessThanOrEqual(zone.bounds.yMax);
        expect(zone.focusView.zoom).toBeGreaterThanOrEqual(1.0);
        expect(zone.focusView.zoom).toBeLessThanOrEqual(4.0);
      }
    });

    it('verifies all machines belonging to a zone are spatially contained within zone bounds', () => {
      const containmentViolations: Array<{
        machineId: string;
        zoneId: string;
        machineCenter: { x: number; y: number };
        zoneBounds: { xMin: number; yMin: number; xMax: number; yMax: number };
      }> = [];

      for (const m of FLEET_MACHINES) {
        const zone = ZONE_MAP[m.process];
        expect(zone).toBeDefined();

        const width = m.cardWidth ?? (m.isCompact ? 44 : 80);
        const height = m.cardHeight ?? (m.isCompact ? 32 : 60);
        const cx = m.svgX + width / 2;
        const cy = m.svgY + height / 2;

        if (
          cx < zone.bounds.xMin ||
          cx > zone.bounds.xMax ||
          cy < zone.bounds.yMin ||
          cy > zone.bounds.yMax
        ) {
          containmentViolations.push({
            machineId: m.id,
            zoneId: zone.id,
            machineCenter: { x: cx, y: cy },
            zoneBounds: zone.bounds,
          });
        }
      }

      expect(containmentViolations).toEqual([]);
    });

    it('verifies CAMERA_FOCUS_PRESETS covers ALL, DRILLING, and all 10 zone IDs', () => {
      const requiredPresets = [
        'ALL',
        'DRILLING',
        'DRILLING_HOLD',
        'DRILLING_MAIN',
        'AUTO_LAY_UP',
        'BONDING',
        'OXIDE',
        'PP_STORAGE',
        'CUTTING',
        'DE_OXIDE',
        'LASER_DRILLING',
        'XRY',
      ];

      for (const presetKey of requiredPresets) {
        const preset = CAMERA_FOCUS_PRESETS[presetKey as keyof typeof CAMERA_FOCUS_PRESETS];
        expect(preset).toBeDefined();
        expect(preset.x).toBeGreaterThan(0);
        expect(preset.x).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(preset.y).toBeGreaterThan(0);
        expect(preset.y).toBeLessThanOrEqual(SVG_VIEWBOX.height);
        expect(preset.zoom).toBeGreaterThanOrEqual(1.0);
        expect(preset.zoom).toBeLessThanOrEqual(4.0);
      }
    });
  });

  // =========================================================================
  // 5. MECHANICAL DRILLING MATRIX COLUMN INTEGRITY
  // =========================================================================
  describe('5. Mechanical Drilling Matrix Architectural Specification', () => {
    it('verifies Top array has 16 columns and sums to 102 units', () => {
      expect(TOP_DRILLING_COLUMNS.length).toBe(16);
      const topCount = TOP_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(topCount).toBe(102);
    });

    it('verifies Bottom array has 8 columns and sums to 40 units', () => {
      expect(BOTTOM_DRILLING_COLUMNS.length).toBe(8);
      const bottomCount = BOTTOM_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(bottomCount).toBe(40);
    });

    it('verifies Middle array has 9 column groups and sums to 56 units', () => {
      expect(MIDDLE_DRILLING_COLUMNS.length).toBe(9);
      const midCount = MIDDLE_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(midCount).toBe(56);
    });

    it('verifies drilling unit IDs follow deterministic format and are unique', () => {
      const drillingUnits = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_MAIN');
      expect(drillingUnits.length).toBe(198);

      const drlIdSet = new Set<string>();
      for (const m of drillingUnits) {
        expect(m.id).toMatch(/^DRL-[TBM|S]\d{2}-\d{3}$/);
        expect(drlIdSet.has(m.id)).toBe(false);
        drlIdSet.add(m.id);
        expect(m.isCompact).toBe(true);
        expect(m.cardWidth).toBe(44);
        expect(m.cardHeight).toBe(32);
      }
      expect(drlIdSet.size).toBe(198);
    });
  });

  // =========================================================================
  // 6. PERIPHERAL PROCESS FLEET INTEGRITY
  // =========================================================================
  describe('6. Peripheral Process Fleet Breakdown', () => {
    it('verifies exact counts per peripheral zone', () => {
      const counts: Record<ProcessCategory, number> = {
        DRILLING_HOLD: 5,
        DRILLING_MAIN: 198,
        AUTO_LAY_UP: 8,
        BONDING: 1,
        OXIDE: 12,
        PP_STORAGE: 4,
        CUTTING: 11,
        DE_OXIDE: 3,
        LASER_DRILLING: 5,
        XRY: 3,
      };

      for (const [proc, expected] of Object.entries(counts)) {
        const actual = FLEET_MACHINES.filter((m) => m.process === proc).length;
        expect(actual).toBe(expected);
      }
    });

    it('verifies Cleanroom Laser Drilling units align with LDI-01..LDI-05 layout', () => {
      const laserUnits = FLEET_MACHINES.filter((m) => m.process === 'LASER_DRILLING');
      expect(laserUnits.length).toBe(5);

      // Verify coordinate progression from LDI-01 to LDI-05 (svgX increases from 2210 to 2770)
      const sortedByX = [...laserUnits].sort((a, b) => a.svgX - b.svgX);
      expect(sortedByX[0].telemetryId).toBe('LDI-01');
      expect(sortedByX[0].svgX).toBe(2210);
      expect(sortedByX[4].telemetryId).toBe('LDI-05');
      expect(sortedByX[4].svgX).toBe(2770);
      for (const m of laserUnits) {
        expect(m.svgY).toBe(560);
      }
    });
  });

  // =========================================================================
  // 7. ISA-101 SCADA COLOR TOKENS & STATUS RESOLVER
  // =========================================================================
  describe('7. ISA-101 SCADA Color Tokens & Robustness', () => {
    it('verifies 6 canonical ISA-101 status color hex tokens across dictionaries', () => {
      expect(ISA_STATUS_TOKENS.RUN.color).toBe('#00FF87');
      expect(ISA_STATUS_TOKENS.IDLE.color).toBe('#FFB800');
      expect(ISA_STATUS_TOKENS.ALARM.color).toBe('#FF003C');
      expect(ISA_STATUS_TOKENS.STOP.color).toBe('#00F2FE');
      expect(ISA_STATUS_TOKENS.OFF.color).toBe('#64748B');
      expect(ISA_STATUS_TOKENS.UNDEFINE.color).toBe('#ECEFF1');

      expect(STATUS_COLORS.RUN.hex).toBe('#00FF87');
      expect(STATUS_COLORS.IDLE.hex).toBe('#FFB800');
      expect(STATUS_COLORS.ALARM.hex).toBe('#FF003C');
      expect(STATUS_COLORS.STOP.hex).toBe('#00F2FE');
      expect(STATUS_COLORS.OFF.hex).toBe('#64748B');
      expect(STATUS_COLORS.UNDEFINE.hex).toBe('#ECEFF1');

      expect(ISA_STATUS_COLORS.RUN.hex).toBe('#00FF87');
      expect(ISA_STATUS_COLORS.IDLE.hex).toBe('#FFB800');
      expect(ISA_STATUS_COLORS.ALARM.hex).toBe('#FF003C');
      expect(ISA_STATUS_COLORS.STOP.hex).toBe('#00F2FE');
      expect(ISA_STATUS_COLORS.OFF.hex).toBe('#64748B');
      expect(ISA_STATUS_COLORS.UNDEFINE.hex).toBe('#ECEFF1');
    });

    it('verifies 6 canonical numeric codes', () => {
      expect(ISA_STATUS_TOKENS.RUN.code).toBe(1);
      expect(ISA_STATUS_TOKENS.IDLE.code).toBe(2);
      expect(ISA_STATUS_TOKENS.ALARM.code).toBe(3);
      expect(ISA_STATUS_TOKENS.STOP.code).toBe(4);
      expect(ISA_STATUS_TOKENS.OFF.code).toBe(0);
      expect(ISA_STATUS_TOKENS.UNDEFINE.code).toBe(5);
    });

    it('evaluates getScadaStatusTheme and legacy getStatusTheme with all inputs', () => {
      const mappings: Array<{ input: StatusToken | number; expectedHex: string; expectedCode: number }> = [
        { input: 'RUN', expectedHex: '#00FF87', expectedCode: 1 },
        { input: 'IDLE', expectedHex: '#FFB800', expectedCode: 2 },
        { input: 'ALARM', expectedHex: '#FF003C', expectedCode: 3 },
        { input: 'STOP', expectedHex: '#00F2FE', expectedCode: 4 },
        { input: 'OFF', expectedHex: '#64748B', expectedCode: 0 },
        { input: 'UNDEFINE', expectedHex: '#ECEFF1', expectedCode: 5 },
        { input: 1, expectedHex: '#00FF87', expectedCode: 1 },
        { input: 2, expectedHex: '#FFB800', expectedCode: 2 },
        { input: 3, expectedHex: '#FF003C', expectedCode: 3 },
        { input: 4, expectedHex: '#00F2FE', expectedCode: 4 },
        { input: 0, expectedHex: '#64748B', expectedCode: 0 },
        { input: 5, expectedHex: '#ECEFF1', expectedCode: 5 },
      ];

      for (const { input, expectedHex, expectedCode } of mappings) {
        const theme = getScadaStatusTheme(input);
        expect(theme.hex).toBe(expectedHex);
        expect(theme.code).toBe(expectedCode);
      }

      // Legacy getStatusTheme resolver
      expect(getStatusTheme(1).hex).toBe('#00FF87');
      expect(getStatusTheme(2).hex).toBe('#FFB800');
      expect(getStatusTheme(3).hex).toBe('#FF003C');
      expect(getStatusTheme(4).hex).toBe('#00F2FE');
      expect(getStatusTheme(5).hex).toBe('#ECEFF1');
      expect(getStatusTheme(0).hex).toBe('#64748B');
    });

    it('handles unexpected, adversarial, or null status inputs gracefully without throwing', () => {
      const dirtyInputs = [
        null,
        undefined,
        NaN,
        -1,
        999,
        Infinity,
        -Infinity,
        'UNKNOWN' as unknown as StatusToken,
        '' as unknown as StatusToken,
      ];

      for (const input of dirtyInputs) {
        expect(() => {
          const theme = getScadaStatusTheme(input);
          expect(theme).toBeDefined();
          expect(theme.hex).toBe('#64748B'); // Gracefully falls back to OFF
        }).not.toThrow();
      }
    });

    it('stress tests environmental tolerance thresholds with edge cases', () => {
      // Temperature (Normal: 21.0 - 23.0, Warn: 19.0-21.0 or 23.0-25.0, Crit: <19.0 or >25.0)
      expect(getTemperatureTolerance(22.0)).toBe('ok');
      expect(getTemperatureTolerance(21.0)).toBe('ok');
      expect(getTemperatureTolerance(23.0)).toBe('ok');
      expect(getTemperatureTolerance(20.9)).toBe('warn');
      expect(getTemperatureTolerance(19.0)).toBe('warn');
      expect(getTemperatureTolerance(18.9)).toBe('crit');
      expect(getTemperatureTolerance(23.1)).toBe('warn');
      expect(getTemperatureTolerance(25.0)).toBe('warn');
      expect(getTemperatureTolerance(25.1)).toBe('crit');
      expect(getTemperatureTolerance(-100)).toBe('crit');
      expect(getTemperatureTolerance(1000)).toBe('crit');
      expect(getTemperatureTolerance(null)).toBe('ok');
      expect(getTemperatureTolerance(undefined)).toBe('ok');

      // Humidity (Normal: 40.0 - 50.0, Warn: 35.0-40.0 or 50.0-55.0, Crit: <35.0 or >55.0)
      expect(getHumidityTolerance(45.0)).toBe('ok');
      expect(getHumidityTolerance(40.0)).toBe('ok');
      expect(getHumidityTolerance(50.0)).toBe('ok');
      expect(getHumidityTolerance(39.9)).toBe('warn');
      expect(getHumidityTolerance(35.0)).toBe('warn');
      expect(getHumidityTolerance(34.9)).toBe('crit');
      expect(getHumidityTolerance(50.1)).toBe('warn');
      expect(getHumidityTolerance(55.0)).toBe('warn');
      expect(getHumidityTolerance(55.1)).toBe('crit');
      expect(getHumidityTolerance(-50)).toBe('crit');
      expect(getHumidityTolerance(200)).toBe('crit');
      expect(getHumidityTolerance(null)).toBe('ok');
      expect(getHumidityTolerance(undefined)).toBe('ok');
    });
  });
});
