/**
 * Comprehensive Unit Tests for IMS 1F Fleet Model & SCADA Constants
 * Milestone 1 Verification Test Suite
 * Path: services/floorplan-web/frontend/src/test/fleet_constants.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  FACTORY_ZONES,
  ZONE_MAP,
  FLEET_MACHINES,
  FLEET_MACHINE_MAP,
  TELEMETRY_ID_MAP,
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
import { ProcessCategory, StatusToken } from '../types/fleet';

describe('Milestone 1: Fleet Model & Factory Machine Constants', () => {
  describe('1. Fleet Count & Zone Integrity', () => {
    it('contains exactly 250 machines in the master fleet array', () => {
      expect(FLEET_MACHINES).toHaveLength(250);
      expect(FLEET_MACHINES.length).toBe(TOTAL_FLEET_COUNT);
    });

    it('has unique machine IDs for all 250 units', () => {
      const idSet = new Set<string>();
      FLEET_MACHINES.forEach((machine) => {
        expect(idSet.has(machine.id)).toBe(false);
        idSet.add(machine.id);
      });
      expect(idSet.size).toBe(250);
      expect(FLEET_MACHINE_MAP.size).toBe(250);
    });

    it('defines exactly 10 factory zones', () => {
      expect(FACTORY_ZONES).toHaveLength(10);
      const expectedZones: ProcessCategory[] = [
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
      const zoneIds = FACTORY_ZONES.map((z) => z.id);
      expect(zoneIds).toEqual(expect.arrayContaining(expectedZones));
    });

    it('ensures each zone has valid positive spatial bounds within canvas extents', () => {
      FACTORY_ZONES.forEach((zone) => {
        expect(zone.bounds.xMin).toBeGreaterThanOrEqual(0);
        expect(zone.bounds.yMin).toBeGreaterThanOrEqual(0);
        expect(zone.bounds.xMax).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(zone.bounds.yMax).toBeLessThanOrEqual(SVG_VIEWBOX.height);
        expect(zone.bounds.xMax).toBeGreaterThan(zone.bounds.xMin);
        expect(zone.bounds.yMax).toBeGreaterThan(zone.bounds.yMin);
      });
    });

    it('ensures zone machine counts match actual machine allocations', () => {
      let totalAssigned = 0;
      FACTORY_ZONES.forEach((zone) => {
        const matchingMachines = FLEET_MACHINES.filter((m) => m.process === zone.id);
        expect(matchingMachines.length).toBe(zone.machineCount);
        expect(matchingMachines.length).toBeGreaterThan(0);
        totalAssigned += zone.machineCount;
      });
      expect(totalAssigned).toBe(250);
    });

    it('ensures ZONE_MAP contains all 10 zones with matching IDs', () => {
      FACTORY_ZONES.forEach((zone) => {
        expect(ZONE_MAP[zone.id]).toBeDefined();
        expect(ZONE_MAP[zone.id].name).toBe(zone.name);
      });
    });
  });

  describe('2. Mechanical Drilling Matrix Specifications', () => {
    it('top array matches 16 column groups and exactly 102 units', () => {
      expect(TOP_DRILLING_COLUMNS).toHaveLength(16);
      const topCount = TOP_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(topCount).toBe(102);

      const topUnits = FLEET_MACHINES.filter(
        (m) => m.process === 'DRILLING_MAIN' && m.array === 'TOP'
      );
      expect(topUnits).toHaveLength(102);
    });

    it('bottom array matches 8 column groups and exactly 40 units', () => {
      expect(BOTTOM_DRILLING_COLUMNS).toHaveLength(8);
      const bottomCount = BOTTOM_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(bottomCount).toBe(40);

      const bottomUnits = FLEET_MACHINES.filter(
        (m) => m.process === 'DRILLING_MAIN' && m.array === 'BOTTOM'
      );
      expect(bottomUnits).toHaveLength(40);
    });

    it('middle array matches 8 column groups + standalone (9 groups) and exactly 56 units', () => {
      expect(MIDDLE_DRILLING_COLUMNS).toHaveLength(9);
      const middleCount = MIDDLE_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(middleCount).toBe(56);

      const middleUnits = FLEET_MACHINES.filter(
        (m) =>
          m.process === 'DRILLING_MAIN' &&
          (m.array === 'MIDDLE' || m.array === 'STANDALONE')
      );
      expect(middleUnits).toHaveLength(56);
    });

    it('mechanical drilling matrix totals exactly 198 units', () => {
      const allDrilling = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_MAIN');
      expect(allDrilling).toHaveLength(198);
      expect(102 + 40 + 56).toBe(198);
    });
  });

  describe('3. Peripheral Process Fleet Counts', () => {
    it('DRILLING HOLD has exactly 5 units with correct names', () => {
      const holdUnits = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_HOLD');
      expect(holdUnits).toHaveLength(5);
      const names = holdUnits.map((m) => m.name);
      expect(names).toEqual(expect.arrayContaining(['ULD', 'HOL', 'GRD', 'LDG', 'DH0001']));
    });

    it('AUTO LAY UP has exactly 8 units', () => {
      const aluUnits = FLEET_MACHINES.filter((m) => m.process === 'AUTO_LAY_UP');
      expect(aluUnits).toHaveLength(8);
      const names = aluUnits.map((m) => m.name);
      expect(names).toEqual(
        expect.arrayContaining(['1-H1', '1-H2', '1-H3', '1-C1', '1-C2', 'PRS', 'DLM', 'LTK'])
      );
    });

    it('BONDING has exactly 1 unit', () => {
      const bonding = FLEET_MACHINES.filter((m) => m.process === 'BONDING');
      expect(bonding).toHaveLength(1);
      expect(bonding[0].name).toBe('001');
    });

    it('OXIDE has exactly 12 units across lines BWN001..BWN003', () => {
      const oxide = FLEET_MACHINES.filter((m) => m.process === 'OXIDE');
      expect(oxide).toHaveLength(12);
      ['BWN001', 'BWN002', 'BWN003'].forEach((line) => {
        const lineUnits = oxide.filter((m) => m.processGroup === line);
        expect(lineUnits).toHaveLength(4);
        const roles = lineUnits.map((m) => m.name);
        expect(roles).toEqual(expect.arrayContaining(['ULD', 'BWN', 'PUC', 'LDG']));
      });
    });

    it('PP STORAGE has exactly 4 bays', () => {
      const pp = FLEET_MACHINES.filter((m) => m.process === 'PP_STORAGE');
      expect(pp).toHaveLength(4);
      const names = pp.map((m) => m.name);
      expect(names).toEqual(
        expect.arrayContaining(['PP-BAY-01', 'PP-BAY-02', 'PP-BAY-03', 'PP-BAY-04'])
      );
    });

    it('CUTTING has exactly 11 machines', () => {
      const cutting = FLEET_MACHINES.filter((m) => m.process === 'CUTTING');
      expect(cutting).toHaveLength(11);
      const names = cutting.map((m) => m.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'CCL001',
          'CCL002',
          'VSC',
          'CUT',
          'MIL1',
          'MIL2',
          'MIL3',
          'ULD1',
          'ULD2',
          'ULD3',
          'CLD1',
        ])
      );
    });

    it('DE-OXIDE has exactly 3 units', () => {
      const deOxide = FLEET_MACHINES.filter((m) => m.process === 'DE_OXIDE');
      expect(deOxide).toHaveLength(3);
      const names = deOxide.map((m) => m.name);
      expect(names).toEqual(expect.arrayContaining(['DEO-LDG', 'DEO-DEO', 'DEO-ULD']));
    });

    it('LASER DRILLING has exactly 5 units mapped to LDI-01..LDI-05', () => {
      const laser = FLEET_MACHINES.filter((m) => m.process === 'LASER_DRILLING');
      expect(laser).toHaveLength(5);
      const telemetryIds = laser.map((m) => m.telemetryId);
      expect(telemetryIds).toEqual(
        expect.arrayContaining(['LDI-01', 'LDI-02', 'LDI-03', 'LDI-04', 'LDI-05'])
      );
      expect(TELEMETRY_ID_MAP.size).toBe(5);
    });

    it('X-RAY has exactly 3 units', () => {
      const xry = FLEET_MACHINES.filter((m) => m.process === 'XRY');
      expect(xry).toHaveLength(3);
      const names = xry.map((m) => m.name);
      expect(names).toEqual(expect.arrayContaining(['XRY-001', 'XRY-002', 'XRY-003']));
    });
  });

  describe('4. Spatial Placement & Coordinates', () => {
    it('places all 250 machines within canvas boundaries', () => {
      FLEET_MACHINES.forEach((m) => {
        expect(m.svgX).toBeGreaterThanOrEqual(0);
        expect(m.svgX).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(m.svgY).toBeGreaterThanOrEqual(0);
        expect(m.svgY).toBeLessThanOrEqual(SVG_VIEWBOX.height);
      });
    });

    it('defines camera focus presets for all filter options', () => {
      const expectedPresets = [
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
      expectedPresets.forEach((presetKey) => {
        const preset = CAMERA_FOCUS_PRESETS[presetKey as keyof typeof CAMERA_FOCUS_PRESETS];
        expect(preset).toBeDefined();
        expect(preset.x).toBeGreaterThan(0);
        expect(preset.y).toBeGreaterThan(0);
        expect(preset.zoom).toBeGreaterThan(0);
      });
    });
  });

  describe('5. ISA-101 6-State SCADA Status Tokens & Colors', () => {
    it('strictly defines the 6 standard SCADA tokens', () => {
      const tokens: StatusToken[] = ['RUN', 'IDLE', 'ALARM', 'STOP', 'OFF', 'UNDEFINE'];
      tokens.forEach((token) => {
        expect(ISA_STATUS_TOKENS[token]).toBeDefined();
        expect(STATUS_COLORS[token]).toBeDefined();
        expect(ISA_STATUS_COLORS[token]).toBeDefined();
      });
    });

    it('matches exact canonical hex codes', () => {
      expect(ISA_STATUS_TOKENS.RUN.color).toBe('#00FF87');
      expect(ISA_STATUS_TOKENS.IDLE.color).toBe('#FFB800');
      expect(ISA_STATUS_TOKENS.ALARM.color).toBe('#FF003C');
      expect(ISA_STATUS_TOKENS.STOP.color).toBe('#00F2FE');
      expect(ISA_STATUS_TOKENS.OFF.color).toBe('#64748B');
      expect(ISA_STATUS_TOKENS.UNDEFINE.color).toBe('#ECEFF1');
    });

    it('matches exact numeric status codes', () => {
      expect(ISA_STATUS_TOKENS.RUN.code).toBe(1);
      expect(ISA_STATUS_TOKENS.IDLE.code).toBe(2);
      expect(ISA_STATUS_TOKENS.ALARM.code).toBe(3);
      expect(ISA_STATUS_TOKENS.STOP.code).toBe(4);
      expect(ISA_STATUS_TOKENS.OFF.code).toBe(0);
      expect(ISA_STATUS_TOKENS.UNDEFINE.code).toBe(5);
    });

    it('getScadaStatusTheme maps codes 0..5 and token names correctly', () => {
      expect(getScadaStatusTheme(1).hex).toBe('#00FF87');
      expect(getScadaStatusTheme(2).hex).toBe('#FFB800');
      expect(getScadaStatusTheme(3).hex).toBe('#FF003C');
      expect(getScadaStatusTheme(4).hex).toBe('#00F2FE');
      expect(getScadaStatusTheme(5).hex).toBe('#ECEFF1');
      expect(getScadaStatusTheme(0).hex).toBe('#64748B');

      expect(getScadaStatusTheme('RUN').hex).toBe('#00FF87');
      expect(getScadaStatusTheme('IDLE').hex).toBe('#FFB800');
      expect(getScadaStatusTheme('ALARM').hex).toBe('#FF003C');
      expect(getScadaStatusTheme('STOP').hex).toBe('#00F2FE');
      expect(getScadaStatusTheme('UNDEFINE').hex).toBe('#ECEFF1');
      expect(getScadaStatusTheme('OFF').hex).toBe('#64748B');
    });

    it('getStatusTheme provides backwards-compatible resolver for LDI telemetry', () => {
      expect(getStatusTheme(1).hex).toBe('#00FF87');
      expect(getStatusTheme(2).hex).toBe('#FFB800');
      expect(getStatusTheme(3).hex).toBe('#FF003C');
      expect(getStatusTheme(4).hex).toBe('#00F2FE');
      expect(getStatusTheme(0).hex).toBe('#64748B');
      expect(getStatusTheme(null).hex).toBe('#64748B');
      expect(getStatusTheme(undefined).hex).toBe('#64748B');
    });

    it('evaluates environmental tolerance levels correctly', () => {
      expect(getTemperatureTolerance(22.0)).toBe('ok');
      expect(getTemperatureTolerance(20.5)).toBe('warn');
      expect(getTemperatureTolerance(26.0)).toBe('crit');
      expect(getTemperatureTolerance(null)).toBe('ok');

      expect(getHumidityTolerance(45.0)).toBe('ok');
      expect(getHumidityTolerance(38.0)).toBe('warn');
      expect(getHumidityTolerance(60.0)).toBe('crit');
      expect(getHumidityTolerance(null)).toBe('ok');
    });
  });
});
