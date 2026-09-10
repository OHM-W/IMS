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
    it('contains machines in the master fleet array', () => {
      expect(FLEET_MACHINES.length).toBeGreaterThan(100);
      expect(FLEET_MACHINES.length).toBe(FLEET_MACHINE_MAP.size);
    });

    it('has unique machine IDs for all units', () => {
      const idSet = new Set<string>();
      FLEET_MACHINES.forEach((machine) => {
        expect(idSet.has(machine.id)).toBe(false);
        idSet.add(machine.id);
      });
      expect(idSet.size).toBe(FLEET_MACHINES.length);
      expect(FLEET_MACHINE_MAP.size).toBe(FLEET_MACHINES.length);
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
      expectedZones.forEach((zoneId) => {
        expect(ZONE_MAP[zoneId]).toBeDefined();
      });
    });

    it('ensures each zone has machines allocated', () => {
      FACTORY_ZONES.forEach((zone) => {
        const matchingMachines = FLEET_MACHINES.filter((m) => m.process === zone.id);
        expect(matchingMachines.length).toBeGreaterThan(0);
      });
    });
  });

  describe('2. Mechanical Drilling Matrix Specifications', () => {
    it('mechanical drilling matrix has units defined', () => {
      const allDrilling = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_MAIN');
      expect(allDrilling.length).toBeGreaterThan(50);
    });
  });

  describe('3. Peripheral Process Fleet Counts', () => {
    it('DRILLING HOLD has units with correct roles', () => {
      const holdUnits = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_HOLD');
      expect(holdUnits.length).toBeGreaterThan(0);
      const names = holdUnits.map((m) => m.name);
      expect(names).toEqual(expect.arrayContaining(['ULD', 'HOL', 'GRD', 'LDG']));
    });

    it('AUTO LAY UP has units', () => {
      const aluUnits = FLEET_MACHINES.filter((m) => m.process === 'AUTO_LAY_UP');
      expect(aluUnits.length).toBeGreaterThan(0);
    });

    it('BONDING has exactly 1 unit', () => {
      const bonding = FLEET_MACHINES.filter((m) => m.process === 'BONDING');
      expect(bonding).toHaveLength(1);
      expect(bonding[0].name).toBe('001');
    });

    it('OXIDE has units defined across lines', () => {
      const oxide = FLEET_MACHINES.filter((m) => m.process === 'OXIDE');
      expect(oxide.length).toBeGreaterThan(0);
    });

    it('PP STORAGE has bays defined', () => {
      const pp = FLEET_MACHINES.filter((m) => m.process === 'PP_STORAGE');
      expect(pp.length).toBeGreaterThan(0);
    });

    it('CUTTING has machines defined', () => {
      const cutting = FLEET_MACHINES.filter((m) => m.process === 'CUTTING');
      expect(cutting.length).toBeGreaterThan(0);
    });

    it('DE-OXIDE has units defined', () => {
      const deOxide = FLEET_MACHINES.filter((m) => m.process === 'DE_OXIDE');
      expect(deOxide.length).toBeGreaterThan(0);
      const names = deOxide.map((m) => m.name);
      expect(names).toEqual(expect.arrayContaining(['LDG', 'DEO', 'ULD']));
    });

    it('LASER DRILLING has exactly 5 units mapped to LDI-01..LDI-05', () => {
      const laser = FLEET_MACHINES.filter((m) => m.process === 'LASER_DRILLING');
      expect(laser).toHaveLength(5);
      const telemetryIds = laser.map((m) => m.telemetryId);
      expect(telemetryIds).toEqual(
        expect.arrayContaining(['LDI-01', 'LDI-02', 'LDI-03', 'LDI-04', 'LDI-05'])
      );
      expect(TELEMETRY_ID_MAP.size).toBe(102); // 5 LDI + 97 CNC Drilling units
    });

    it('X-RAY has process units defined', () => {
      const xry = FLEET_MACHINES.filter((m) => m.process === 'XRY');
      expect(xry.length).toBeGreaterThan(0);
    });
  });

  describe('4. Spatial Placement & Coordinates', () => {
    it('places all machines within canvas boundaries', () => {
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
    it('defines all 6 ISA-101 states (0..5)', () => {
      const tokens: StatusToken[] = ['RUN', 'IDLE', 'ALARM', 'STOP', 'OFF', 'UNDEFINE'];
      tokens.forEach((token) => {
        expect(ISA_STATUS_TOKENS[token]).toBeDefined();
        expect(STATUS_COLORS[token]).toBeDefined();
        expect(ISA_STATUS_COLORS[token]).toBeDefined();
      });
    });

    it('matches exact canonical hex codes', () => {
      expect(ISA_STATUS_TOKENS.RUN.color).toBe('#10B981');
      expect(ISA_STATUS_TOKENS.IDLE.color).toBe('#F59E0B');
      expect(ISA_STATUS_TOKENS.ALARM.color).toBe('#EF4444');
      expect(ISA_STATUS_TOKENS.STOP.color).toBe('#06B6D4');
      expect(ISA_STATUS_TOKENS.OFF.color).toBe('#64748B');
      expect(ISA_STATUS_TOKENS.UNDEFINE.color).toBe('#475569');
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
      expect(getScadaStatusTheme(1).hex).toBe('#10B981');
      expect(getScadaStatusTheme(2).hex).toBe('#F59E0B');
      expect(getScadaStatusTheme(3).hex).toBe('#EF4444');
      expect(getScadaStatusTheme(4).hex).toBe('#06B6D4');
      expect(getScadaStatusTheme(5).hex).toBe('#475569');
      expect(getScadaStatusTheme(0).hex).toBe('#64748B');

      expect(getScadaStatusTheme('RUN').hex).toBe('#10B981');
      expect(getScadaStatusTheme('IDLE').hex).toBe('#F59E0B');
      expect(getScadaStatusTheme('ALARM').hex).toBe('#EF4444');
      expect(getScadaStatusTheme('STOP').hex).toBe('#06B6D4');
      expect(getScadaStatusTheme('UNDEFINE').hex).toBe('#475569');
      expect(getScadaStatusTheme('OFF').hex).toBe('#64748B');
    });

    it('getStatusTheme provides backwards-compatible resolver for LDI telemetry', () => {
      expect(getStatusTheme(1).hex).toBe('#10B981');
      expect(getStatusTheme(2).hex).toBe('#F59E0B');
      expect(getStatusTheme(3).hex).toBe('#EF4444');
      expect(getStatusTheme(4).hex).toBe('#06B6D4');
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
