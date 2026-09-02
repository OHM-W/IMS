/**
 * Empirical Validation & Adversarial Stress Suite for Challenger M1-2
 * Focus: Mechanical Drilling Matrix & Peripheral Fleets Exact Invariants
 * Path: services/floorplan-web/frontend/src/test/challenger_m1_2_empirical.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TOP_DRILLING_COLUMNS,
  BOTTOM_DRILLING_COLUMNS,
  MIDDLE_DRILLING_COLUMNS,
  FLEET_MACHINES,
  FLEET_MACHINE_MAP,
  TELEMETRY_ID_MAP,
  FACTORY_ZONES,
  SVG_VIEWBOX,
} from '../constants/fleet';

describe('Empirical Verification: Challenger M1-2 - Drilling Matrix & Peripheral Fleets', () => {
  describe('1. Top Drilling Array Exact Column Group Validation (16 Groups)', () => {
    const expectedTopGroups = [
      { label: '140..144', expectedIndices: [140, 141, 142, 143, 144], direction: 'ASC', count: 5 },
      { label: '139..135', expectedIndices: [139, 138, 137, 136, 135], direction: 'DESC', count: 5 },
      { label: '134..131', expectedIndices: [134, 133, 132, 131], direction: 'DESC', count: 4 },
      { label: '128..124', expectedIndices: [128, 127, 126, 125, 124], direction: 'DESC', count: 5 },
      { label: '120..115', expectedIndices: [120, 119, 118, 117, 116, 115], direction: 'DESC', count: 6 },
      { label: '119..114', expectedIndices: [119, 118, 117, 116, 115, 114], direction: 'DESC', count: 6 },
      { label: '110..105', expectedIndices: [110, 109, 108, 107, 106, 105], direction: 'DESC', count: 6 },
      { label: '109..104', expectedIndices: [109, 108, 107, 106, 105, 104], direction: 'DESC', count: 6 },
      { label: '099..095', expectedIndices: [99, 98, 97, 96, 95], direction: 'DESC', count: 5 },
      { label: '098..091', expectedIndices: [98, 97, 96, 95, 94, 93, 92, 91], direction: 'DESC', count: 8 },
      { label: '085..079', expectedIndices: [85, 84, 83, 82, 81, 80, 79], direction: 'DESC', count: 7 },
      { label: '082..076', expectedIndices: [82, 81, 80, 79, 78, 77, 76], direction: 'DESC', count: 7 },
      { label: '066..060', expectedIndices: [66, 65, 64, 63, 62, 61, 60], direction: 'DESC', count: 7 },
      { label: '065..057', expectedIndices: [65, 64, 63, 62, 61, 60, 59, 58, 57], direction: 'DESC', count: 9 },
      { label: '048..042', expectedIndices: [48, 47, 46, 45, 44, 43, 42], direction: 'DESC', count: 7 },
      { label: '047..039', expectedIndices: [47, 46, 45, 44, 43, 42, 41, 40, 39], direction: 'DESC', count: 9 },
    ];

    it('has exactly 16 column groups in Top Array specification', () => {
      expect(TOP_DRILLING_COLUMNS).toHaveLength(16);
    });

    expectedTopGroups.forEach((spec, idx) => {
      it(`verifies Top Group ${idx} [${spec.label}] matches exact indices and count (${spec.count})`, () => {
        const col = TOP_DRILLING_COLUMNS[idx];
        expect(col).toBeDefined();
        expect(col.label).toBe(spec.label);
        expect(col.indices).toEqual(spec.expectedIndices);
        expect(col.indices.length).toBe(spec.count);
        expect(col.array).toBe('TOP');
        expect(col.colIndex).toBe(idx);
      });
    });

    it('verifies total Top Array machines equals exactly 102 units', () => {
      const topCount = TOP_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(topCount).toBe(102);
      const topMachines = FLEET_MACHINES.filter(
        (m) => m.process === 'DRILLING_MAIN' && m.processGroup === 'TOP'
      );
      expect(topMachines).toHaveLength(102);
    });
  });

  describe('2. Bottom Drilling Array Exact Column Group Validation (8 Groups)', () => {
    const expectedBottomGroups = [
      { label: '101..104', expectedIndices: [101, 102, 103, 104], direction: 'ASC', count: 4 },
      { label: '094..091', expectedIndices: [94, 93, 92, 91], direction: 'DESC', count: 4 },
      { label: '087..080', expectedIndices: [87, 86, 85, 84, 83, 82, 81, 80], direction: 'DESC', count: 8 },
      { label: '078..075', expectedIndices: [78, 77, 76, 75], direction: 'DESC', count: 4 },
      { label: '071..067', expectedIndices: [71, 70, 69, 68, 67], direction: 'DESC', count: 5 },
      { label: '062..058', expectedIndices: [62, 61, 60, 59, 58], direction: 'DESC', count: 5 },
      { label: '053..049', expectedIndices: [53, 52, 51, 50, 49], direction: 'DESC', count: 5 },
      { label: '042..038', expectedIndices: [42, 41, 40, 39, 38], direction: 'DESC', count: 5 },
    ];

    it('has exactly 8 column groups in Bottom Array specification', () => {
      expect(BOTTOM_DRILLING_COLUMNS).toHaveLength(8);
    });

    expectedBottomGroups.forEach((spec, idx) => {
      it(`verifies Bottom Group ${idx} [${spec.label}] matches exact indices and count (${spec.count})`, () => {
        const col = BOTTOM_DRILLING_COLUMNS[idx];
        expect(col).toBeDefined();
        expect(col.label).toBe(spec.label);
        expect(col.indices).toEqual(spec.expectedIndices);
        expect(col.indices.length).toBe(spec.count);
        expect(col.array).toBe('BOTTOM');
        expect(col.colIndex).toBe(idx);
      });
    });

    it('verifies total Bottom Array machines equals exactly 40 units', () => {
      const bottomCount = BOTTOM_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(bottomCount).toBe(40);
      const bottomMachines = FLEET_MACHINES.filter(
        (m) => m.process === 'DRILLING_MAIN' && m.processGroup === 'BOTTOM'
      );
      expect(bottomMachines).toHaveLength(40);
    });
  });

  describe('3. Middle Drilling Array Exact Column Group Validation (8 Groups + Standalone)', () => {
    const expectedMiddleGroups = [
      { label: '030..033', expectedIndices: [30, 31, 32, 33], direction: 'ASC', count: 4 },
      { label: '029..032', expectedIndices: [29, 30, 31, 32], direction: 'ASC', count: 4 },
      { label: '026..017', expectedIndices: [26, 25, 24, 23, 22, 21, 20, 19, 18, 17], direction: 'DESC', count: 10 },
      { label: '025..016', expectedIndices: [25, 24, 23, 22, 21, 20, 19, 18, 17, 16], direction: 'DESC', count: 10 },
      { label: '014..015', expectedIndices: [14, 15], direction: 'ASC', count: 2 },
      { label: '009..001', expectedIndices: [9, 8, 7, 6, 5, 4, 3, 2, 1], direction: 'DESC', count: 9 },
      { label: '008..001', expectedIndices: [8, 7, 6, 5, 4, 3, 2, 1], direction: 'DESC', count: 8 },
      { label: '007..001', expectedIndices: [7, 6, 5, 4, 3, 2, 1], direction: 'DESC', count: 7 },
      { label: 'STANDALONE', expectedIndices: [1, 2], direction: 'ASC', count: 2 },
    ];

    it('has exactly 9 column groups (8 groups + standalone) in Middle Array specification', () => {
      expect(MIDDLE_DRILLING_COLUMNS).toHaveLength(9);
    });

    expectedMiddleGroups.forEach((spec, idx) => {
      it(`verifies Middle Group ${idx} [${spec.label}] matches exact indices and count (${spec.count})`, () => {
        const col = MIDDLE_DRILLING_COLUMNS[idx];
        expect(col).toBeDefined();
        expect(col.label).toBe(spec.label);
        expect(col.indices).toEqual(spec.expectedIndices);
        expect(col.indices.length).toBe(spec.count);
      });
    });

    it('verifies total Middle Array machines equals exactly 56 units', () => {
      const middleCount = MIDDLE_DRILLING_COLUMNS.reduce((sum, col) => sum + col.indices.length, 0);
      expect(middleCount).toBe(56);
      const middleMachines = FLEET_MACHINES.filter(
        (m) =>
          m.process === 'DRILLING_MAIN' &&
          (m.processGroup === 'MIDDLE' || m.processGroup === 'STANDALONE')
      );
      expect(middleMachines).toHaveLength(56);
    });

    it('verifies overall mechanical drilling units total exactly 198 machines', () => {
      const totalDrilling = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_MAIN');
      expect(totalDrilling).toHaveLength(198);
      expect(102 + 40 + 56).toBe(198);
    });
  });

  describe('4. Descending & Ascending Sequence Range Assertions', () => {
    it('verifies descending sequence ranges have correct step of -1', () => {
      const descendingCols = [
        ...TOP_DRILLING_COLUMNS.slice(1), // All top except group 0 are descending
        ...BOTTOM_DRILLING_COLUMNS.slice(1), // All bottom except group 0 are descending
        MIDDLE_DRILLING_COLUMNS[2], // 026..017
        MIDDLE_DRILLING_COLUMNS[3], // 025..016
        MIDDLE_DRILLING_COLUMNS[5], // 009..001
        MIDDLE_DRILLING_COLUMNS[6], // 008..001
        MIDDLE_DRILLING_COLUMNS[7], // 007..001
      ];

      descendingCols.forEach((col) => {
        for (let i = 0; i < col.indices.length - 1; i++) {
          expect(col.indices[i] - col.indices[i + 1]).toBe(1);
        }
      });
    });

    it('verifies ascending sequence ranges have correct step of +1', () => {
      const ascendingCols = [
        TOP_DRILLING_COLUMNS[0], // 140..144
        BOTTOM_DRILLING_COLUMNS[0], // 101..104
        MIDDLE_DRILLING_COLUMNS[0], // 030..033
        MIDDLE_DRILLING_COLUMNS[1], // 029..032
        MIDDLE_DRILLING_COLUMNS[4], // 014..015
        MIDDLE_DRILLING_COLUMNS[8], // STANDALONE (001, 002)
      ];

      ascendingCols.forEach((col) => {
        for (let i = 0; i < col.indices.length - 1; i++) {
          expect(col.indices[i + 1] - col.indices[i]).toBe(1);
        }
      });
    });

    it('verifies descending group length assertions from user request', () => {
      // 026..017 = 10 machines
      expect(MIDDLE_DRILLING_COLUMNS[2].indices.length).toBe(10);
      expect(MIDDLE_DRILLING_COLUMNS[2].indices[0]).toBe(26);
      expect(MIDDLE_DRILLING_COLUMNS[2].indices[9]).toBe(17);

      // 025..016 = 10 machines
      expect(MIDDLE_DRILLING_COLUMNS[3].indices.length).toBe(10);
      expect(MIDDLE_DRILLING_COLUMNS[3].indices[0]).toBe(25);
      expect(MIDDLE_DRILLING_COLUMNS[3].indices[9]).toBe(16);

      // 009..001 = 9 machines
      expect(MIDDLE_DRILLING_COLUMNS[5].indices.length).toBe(9);
      expect(MIDDLE_DRILLING_COLUMNS[5].indices[0]).toBe(9);
      expect(MIDDLE_DRILLING_COLUMNS[5].indices[8]).toBe(1);

      // 008..001 = 8 machines
      expect(MIDDLE_DRILLING_COLUMNS[6].indices.length).toBe(8);
      expect(MIDDLE_DRILLING_COLUMNS[6].indices[0]).toBe(8);
      expect(MIDDLE_DRILLING_COLUMNS[6].indices[7]).toBe(1);

      // 007..001 = 7 machines
      expect(MIDDLE_DRILLING_COLUMNS[7].indices.length).toBe(7);
      expect(MIDDLE_DRILLING_COLUMNS[7].indices[0]).toBe(7);
      expect(MIDDLE_DRILLING_COLUMNS[7].indices[6]).toBe(1);

      // Standalone 001, 002 = 2 machines
      expect(MIDDLE_DRILLING_COLUMNS[8].indices.length).toBe(2);
      expect(MIDDLE_DRILLING_COLUMNS[8].indices).toEqual([1, 2]);
    });
  });

  describe('5. Laser Drilling Fleet & Telemetry Mapping', () => {
    it('has exactly 5 Laser Drilling machines with sequential IDs and names 001..005', () => {
      const laserFleet = FLEET_MACHINES.filter((m) => m.process === 'LASER_DRILLING');
      expect(laserFleet).toHaveLength(5);

      const expectedNames = ['001', '002', '003', '004', '005'];
      const actualNames = laserFleet.map((m) => m.name);
      expect(actualNames).toEqual(expectedNames);
    });

    it('verifies telemetryId mapping to LDI-01..05 for all 5 Laser Drilling machines', () => {
      const laserFleet = FLEET_MACHINES.filter((m) => m.process === 'LASER_DRILLING');
      laserFleet.forEach((m, idx) => {
        const expectedTeleId = `LDI-0${idx + 1}`;
        expect(m.telemetryId).toBe(expectedTeleId);
        expect(m.hasLiveFeed).toBe(true);

        // Verify TELEMETRY_ID_MAP lookup
        const lookup = TELEMETRY_ID_MAP.get(expectedTeleId);
        expect(lookup).toBeDefined();
        expect(lookup?.id).toBe(m.id);
        expect(lookup?.name).toBe(m.name);
      });
    });

    it('verifies Laser Drilling positions are inside Cleanroom bounds', () => {
      const cleanroomZone = FACTORY_ZONES.find((z) => z.id === 'LASER_DRILLING');
      expect(cleanroomZone).toBeDefined();

      const laserFleet = FLEET_MACHINES.filter((m) => m.process === 'LASER_DRILLING');
      laserFleet.forEach((m) => {
        expect(m.svgX).toBeGreaterThanOrEqual(cleanroomZone!.bounds.xMin);
        expect(m.svgX).toBeLessThanOrEqual(cleanroomZone!.bounds.xMax);
        expect(m.svgY).toBeGreaterThanOrEqual(cleanroomZone!.bounds.yMin);
        expect(m.svgY).toBeLessThanOrEqual(cleanroomZone!.bounds.yMax);
      });
    });
  });

  describe('6. Full Factory Peripheral Fleets Integrity', () => {
    it('verifies DRILLING_HOLD (5 units)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'DRILLING_HOLD');
      expect(units).toHaveLength(5);
      expect(units.map((u) => u.name)).toEqual(['ULD', 'HOL', 'GRD', 'LDG', 'DH0001']);
    });

    it('verifies AUTO_LAY_UP (8 units)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'AUTO_LAY_UP');
      expect(units).toHaveLength(8);
      expect(units.map((u) => u.name)).toEqual([
        '1-H1', '1-H2', '1-H3', '1-C1', '1-C2', 'PRS', 'DLM', 'LTK'
      ]);
    });

    it('verifies BONDING (1 unit)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'BONDING');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('001');
    });

    it('verifies OXIDE (12 units across 3 lines)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'OXIDE');
      expect(units).toHaveLength(12);
      ['BWN001', 'BWN002', 'BWN003'].forEach((line) => {
        const lineUnits = units.filter((u) => u.processGroup === line);
        expect(lineUnits).toHaveLength(4);
        expect(lineUnits.map((u) => u.name)).toEqual(['ULD', 'BWN', 'PUC', 'LDG']);
      });
    });

    it('verifies PP_STORAGE (4 bays)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'PP_STORAGE');
      expect(units).toHaveLength(4);
      expect(units.map((u) => u.name)).toEqual([
        'PP-BAY-01', 'PP-BAY-02', 'PP-BAY-03', 'PP-BAY-04'
      ]);
    });

    it('verifies CUTTING (11 units)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'CUTTING');
      expect(units).toHaveLength(11);
      expect(units.map((u) => u.name)).toEqual([
        'CCL001', 'CCL002', 'VSC', 'CUT', 'MIL1', 'MIL2', 'MIL3', 'ULD1', 'ULD2', 'ULD3', 'CLD1'
      ]);
    });

    it('verifies DE_OXIDE (3 units)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'DE_OXIDE');
      expect(units).toHaveLength(3);
      expect(units.map((u) => u.name)).toEqual(['DEO-LDG', 'DEO-DEO', 'DEO-ULD']);
    });

    it('verifies XRY (3 units)', () => {
      const units = FLEET_MACHINES.filter((m) => m.process === 'XRY');
      expect(units).toHaveLength(3);
      expect(units.map((u) => u.name)).toEqual(['XRY-001', 'XRY-002', 'XRY-003']);
    });

    it('verifies total machine count across all 10 zones equals 250', () => {
      expect(FLEET_MACHINES).toHaveLength(250);
      expect(FLEET_MACHINE_MAP.size).toBe(250);
    });
  });

  describe('7. Spatial & Rendering Invariants Stress Testing', () => {
    it('verifies no machine coordinates fall outside canvas [0..3200, 0..1550]', () => {
      FLEET_MACHINES.forEach((m) => {
        expect(m.svgX).toBeGreaterThanOrEqual(0);
        expect(m.svgX).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(m.svgY).toBeGreaterThanOrEqual(0);
        expect(m.svgY).toBeLessThanOrEqual(SVG_VIEWBOX.height);
      });
    });

    it('verifies drilling machines in the same column have strictly increasing Y coordinates', () => {
      const checkColumnY = (cols: typeof TOP_DRILLING_COLUMNS) => {
        cols.forEach((col) => {
          const colMachines = FLEET_MACHINES.filter(
            (m) => m.columnGroup === col.label && m.array === col.array
          );
          for (let i = 0; i < colMachines.length - 1; i++) {
            expect(colMachines[i + 1].svgY).toBeGreaterThan(colMachines[i].svgY);
          }
        });
      };

      checkColumnY(TOP_DRILLING_COLUMNS);
      checkColumnY(BOTTOM_DRILLING_COLUMNS);
      checkColumnY(MIDDLE_DRILLING_COLUMNS);
    });
  });
});
