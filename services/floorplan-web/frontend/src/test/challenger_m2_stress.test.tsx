/**
 * M2 SCADA UI Challenger 1 — Empirical Adversarial Stress Test Suite
 * Path: services/floorplan-web/frontend/src/test/challenger_m2_stress.test.tsx
 *
 * Target Verifications:
 * 1. Rapid cycling through all process filters (100+ cycles, state consistency, machine dimming, zone highlighting, camera targets).
 * 2. Exhaustive selection of all 250 machines to verify inspection drawer opens without crashing or null property errors.
 * 3. Compact vs Standard card dimensions in SVG foreignObjects, grid geometry, and viewBox containment.
 * 4. Alarm animation styling, ISA-101 token conformance, and alarm panel navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React, { createRef } from 'react';
import App from '../App';
import { FloorplanSVG, FloorplanPanzoomControls } from '../components/FloorplanSVG';
import { MachineNode } from '../components/MachineNode';
import { MachineDetailPopup } from '../components/MachineDetailPopup';
import { AlarmPanel } from '../components/AlarmPanel';
import { TopBar } from '../components/TopBar';
import { ProcessFilterBar, PROCESS_FILTER_OPTIONS } from '../components/ProcessFilterBar';
import {
  FLEET_MACHINES,
  FLEET_MACHINE_MAP,
  FACTORY_ZONES,
  CAMERA_FOCUS_PRESETS,
  TOTAL_FLEET_COUNT,
  SVG_VIEWBOX,
} from '../constants/fleet';
import { ISA_STATUS_TOKENS, ISA_STATUS_COLORS, getStatusTheme } from '../constants/colors';
import { FleetFilterOption, MachineDef } from '../types/fleet';
import { LdiMachine } from '../types/ldi';

describe('M2 SCADA UI Adversarial Stress Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          eqp_id: 'LDI-01',
          status: 1,
          temperature: 22.0,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 80.0,
          thickness: 0.1,
          board_no: 5,
          total_board: 20,
          total_time: 15.0,
          mo: 'MO-TEST-001',
          fpn: 'FPN-TEST-001',
          layer_name: 'L1-TOP',
          last_seen: '2026-09-01T12:00:00Z',
        },
      ],
    }) as any;
  });

  // ==========================================================================
  // SUITE 1: RAPID CYCLING THROUGH ALL PROCESS FILTERS
  // ==========================================================================
  describe('Suite 1: Rapid Cycling Through All Process Filters', () => {
    it('handles 100 consecutive rapid filter transitions without state corruption', () => {
      const { unmount } = render(<App />);

      const filters: FleetFilterOption[] = [
        'ALL',
        'DRILLING',
        'AUTO_LAY_UP',
        'OXIDE',
        'CUTTING',
        'LASER_DRILLING',
        'XRY',
      ];

      // Perform 100 rapid filter changes
      for (let i = 0; i < 100; i++) {
        const targetFilter = filters[i % filters.length];
        const btn = screen.getByTestId(`filter-btn-${targetFilter}`);

        act(() => {
          fireEvent.click(btn);
        });

        // Verify button active state has border highlight
        expect(btn.className).toContain('border-[#00F2FE]');
      }

      // Final state check: switch back to ALL
      const allBtn = screen.getByTestId('filter-btn-ALL');
      act(() => {
        fireEvent.click(allBtn);
      });
      expect(allBtn.className).toContain('border-[#00F2FE]');

      unmount();
    });

    it('verifies exact machine dimming matrix across all 7 process filters', () => {
      const mockSelect = vi.fn();
      const mockMachines: Record<string, LdiMachine> = {};

      const testCases: {
        filter: FleetFilterOption;
        expectedNonDimmedCount: number;
        expectedDimmedCount: number;
        isMatch: (m: MachineDef) => boolean;
      }[] = [
        {
          filter: 'ALL',
          expectedNonDimmedCount: 250,
          expectedDimmedCount: 0,
          isMatch: () => true,
        },
        {
          filter: 'DRILLING',
          expectedNonDimmedCount: 203, // 5 hold + 198 main
          expectedDimmedCount: 47,
          isMatch: (m) => m.process === 'DRILLING_MAIN' || m.process === 'DRILLING_HOLD',
        },
        {
          filter: 'AUTO_LAY_UP',
          expectedNonDimmedCount: 8,
          expectedDimmedCount: 242,
          isMatch: (m) => m.process === 'AUTO_LAY_UP',
        },
        {
          filter: 'OXIDE',
          expectedNonDimmedCount: 12,
          expectedDimmedCount: 238,
          isMatch: (m) => m.process === 'OXIDE',
        },
        {
          filter: 'CUTTING',
          expectedNonDimmedCount: 11,
          expectedDimmedCount: 239,
          isMatch: (m) => m.process === 'CUTTING',
        },
        {
          filter: 'LASER_DRILLING',
          expectedNonDimmedCount: 5,
          expectedDimmedCount: 245,
          isMatch: (m) => m.process === 'LASER_DRILLING',
        },
        {
          filter: 'XRY',
          expectedNonDimmedCount: 3,
          expectedDimmedCount: 247,
          isMatch: (m) => m.process === 'XRY',
        },
      ];

      for (const tc of testCases) {
        const { unmount } = render(
          <FloorplanSVG
            machines={mockMachines}
            selectedId={null}
            activeFilter={tc.filter}
            fleetMachines={FLEET_MACHINES}
            onSelectMachine={mockSelect}
          />
        );

        let nonDimmed = 0;
        let dimmed = 0;

        for (const machine of FLEET_MACHINES) {
          const node = screen.getByTestId(`machine-node-${machine.id}`);
          const isNodeDimmed = node.className.includes('opacity-30');

          if (isNodeDimmed) {
            dimmed++;
          } else {
            nonDimmed++;
          }

          const shouldBeActive = tc.isMatch(machine);
          if (shouldBeActive) {
            expect(node.className).toContain('opacity-100');
            expect(node.className).not.toContain('opacity-30');
          } else {
            expect(node.className).toContain('opacity-30');
          }
        }

        expect(nonDimmed).toBe(tc.expectedNonDimmedCount);
        expect(dimmed).toBe(tc.expectedDimmedCount);

        unmount();
      }
    });

    it('verifies all camera focus presets map to valid coordinates within SVG viewBox', () => {
      const filterOptions: FleetFilterOption[] = [
        'ALL',
        'DRILLING',
        'AUTO_LAY_UP',
        'OXIDE',
        'CUTTING',
        'LASER_DRILLING',
        'XRY',
      ];

      for (const opt of filterOptions) {
        const preset = CAMERA_FOCUS_PRESETS[opt];
        expect(preset).toBeDefined();
        expect(preset.x).toBeGreaterThanOrEqual(0);
        expect(preset.x).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(preset.y).toBeGreaterThanOrEqual(0);
        expect(preset.y).toBeLessThanOrEqual(SVG_VIEWBOX.height);
        expect(preset.zoom).toBeGreaterThanOrEqual(0.35);
        expect(preset.zoom).toBeLessThanOrEqual(6.0);
      }
    });
  });

  // ==========================================================================
  // SUITE 2: SELECTING EVERY SINGLE ONE OF THE 250 MACHINES
  // ==========================================================================
  describe('Suite 2: Exhaustive 250 Machine Selection & Inspection Drawer Stress Test', () => {
    it('opens detail drawer for all 250 machines without throwing null property errors', () => {
      expect(FLEET_MACHINES.length).toBe(TOTAL_FLEET_COUNT);

      for (let i = 0; i < FLEET_MACHINES.length; i++) {
        const machine = FLEET_MACHINES[i];
        const handleClose = vi.fn();
        const handleFocus = vi.fn();

        // Case A: Drawer opened with unmonitored / null live telemetry
        const { unmount } = render(
          <MachineDetailPopup
            machine={null}
            machineDef={machine}
            onClose={handleClose}
            onFocusMachine={handleFocus}
          />
        );

        // Drawer must render
        const drawer = screen.getByTestId('machine-detail-drawer');
        expect(drawer).toBeInTheDocument();

        // Header must contain machine ID
        expect(screen.getByText(machine.id)).toBeInTheDocument();

        // Process title or bay must render
        const processLabel = machine.process ? machine.process.replace(/_/g, ' ') : '';
        if (processLabel) {
          expect(screen.getByText(new RegExp(processLabel, 'i'))).toBeInTheDocument();
        }

        // Digital twin baseline message must render for unmonitored machines
        expect(
          screen.getByText('Digital Twin Operational Baseline')
        ).toBeInTheDocument();

        // Test focus camera button
        const focusBtn = screen.getByText('Focus Camera');
        act(() => {
          fireEvent.click(focusBtn);
        });
        expect(handleFocus).toHaveBeenCalledWith(machine.svgX, machine.svgY, machine.id);

        // Test Grafana drill-down link presence and URL
        const grafanaLink = screen.getByText('Grafana Drill-Down').closest('a');
        expect(grafanaLink).toHaveAttribute(
          'href',
          `/d/ims-engineering/ims-engineering-drill-down?var-machine_id=${encodeURIComponent(
            machine.id
          )}`
        );

        // Test close button
        const closeBtn = screen.getByTitle('Close Drawer');
        act(() => {
          fireEvent.click(closeBtn);
        });
        expect(handleClose).toHaveBeenCalled();

        unmount();
      }
    });

    it('survives corrupted, extreme, and edge-case telemetry payloads without crashing', () => {
      const sampleMachines = [
        FLEET_MACHINES[0], // DH-ULD
        FLEET_MACHINES[5], // DRL-T00-140 (compact drilling)
        FLEET_MACHINES[150], // DRL-M02-026
        FLEET_MACHINES[205], // ALU-1-H1
        FLEET_MACHINES[220], // BWN001-BWN
        FLEET_MACHINES[245], // LSR-001
      ];

      const edgeCaseTelemetries: (Partial<LdiMachine> & { testLabel: string })[] = [
        {
          testLabel: 'All fields null / undefined',
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
        },
        {
          testLabel: 'Extreme negative & positive telemetry',
          status: 3,
          temperature: -273.15,
          humidity: 9999.9,
          resist_dosage: -50.0,
          scan_speed: 100000.0,
          air_vacuum: -999.0,
          thickness: 999.999,
          board_no: 500,
          total_board: 100, // board_no > total_board (over 100% progress)
          total_time: 99999.9,
          mo: 'MO-EXTREME',
          fpn: 'FPN-EXTREME',
          layer_name: 'LAYER-EXTREME',
          last_seen: 'invalid-iso-date-string',
        },
        {
          testLabel: 'Zero total board (division by zero safeguard)',
          status: 2,
          temperature: 22.0,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 80.0,
          thickness: 0.1,
          board_no: 10,
          total_board: 0, // should not result in NaN% or Infinity%
          total_time: 0,
          mo: 'MO-ZERO-BOARD',
          fpn: 'FPN-ZERO-BOARD',
          layer_name: 'L1',
          last_seen: new Date().toISOString(),
        },
        {
          testLabel: '6-State SCADA Status: ALARM (3)',
          status: 3,
          temperature: 28.5, // crit temp
          humidity: 62.0, // crit hum
          board_no: 80,
          total_board: 100,
          mo: 'MO-ALARM',
          fpn: 'FPN-ALARM',
          layer_name: 'L2',
        },
        {
          testLabel: '6-State SCADA Status: STOP / LOTO (4)',
          status: 4,
          mo: 'MO-STOP',
          fpn: 'FPN-STOP',
        },
        {
          testLabel: '6-State SCADA Status: UNDEFINE (5)',
          status: 5,
        },
      ];

      for (const m of sampleMachines) {
        for (const telem of edgeCaseTelemetries) {
          const ldiTelem: LdiMachine = {
            eqp_id: m.id,
            status: telem.status ?? 0,
            temperature: telem.temperature ?? null,
            humidity: telem.humidity ?? null,
            resist_dosage: telem.resist_dosage ?? null,
            scan_speed: telem.scan_speed ?? null,
            air_vacuum: telem.air_vacuum ?? null,
            thickness: telem.thickness ?? null,
            board_no: telem.board_no ?? null,
            total_board: telem.total_board ?? null,
            total_time: telem.total_time ?? null,
            mo: telem.mo ?? null,
            fpn: telem.fpn ?? null,
            layer_name: telem.layer_name ?? null,
            last_seen: telem.last_seen ?? null,
          };

          const { unmount } = render(
            <MachineDetailPopup
              machine={ldiTelem}
              machineDef={m}
              onClose={() => {}}
              onFocusMachine={() => {}}
            />
          );

          expect(screen.getByTestId('machine-detail-drawer')).toBeInTheDocument();
          expect(screen.getByText(m.id)).toBeInTheDocument();

          unmount();
        }
      }
    });
  });

  // ==========================================================================
  // SUITE 3: COMPACT VS STANDARD CARD DIMENSIONS IN SVG FOREIGNOBJECTS
  // ==========================================================================
  describe('Suite 3: ForeignObject & Card Sizing Geometric Stress Test', () => {
    it('verifies exact compact (44x32) vs standard dimensions across all 250 foreignObjects', () => {
      const { container, unmount } = render(
        <FloorplanSVG
          machines={{}}
          selectedId={null}
          activeFilter="ALL"
          fleetMachines={FLEET_MACHINES}
          onSelectMachine={() => {}}
        />
      );

      const foreignObjects = container.querySelectorAll('foreignObject');
      expect(foreignObjects.length).toBe(TOTAL_FLEET_COUNT);

      let compactCount = 0;
      let standardCount = 0;

      for (let i = 0; i < FLEET_MACHINES.length; i++) {
        const machine = FLEET_MACHINES[i];
        const fo = foreignObjects[i];

        const width = parseFloat(fo.getAttribute('width') || '0');
        const height = parseFloat(fo.getAttribute('height') || '0');
        const x = parseFloat(fo.getAttribute('x') || '0');
        const y = parseFloat(fo.getAttribute('y') || '0');

        // Dimension sanity
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(Number.isNaN(width)).toBe(false);
        expect(Number.isNaN(height)).toBe(false);
        expect(Number.isNaN(x)).toBe(false);
        expect(Number.isNaN(y)).toBe(false);

        // Bounding box containment within 3200 x 1550
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(SVG_VIEWBOX.width);
        expect(y + height).toBeLessThanOrEqual(SVG_VIEWBOX.height);

        // Verify compact classification
        if (machine.isCompact) {
          compactCount++;
          expect(width).toBe(44);
          expect(height).toBe(32);
          expect(machine.process).toBe('DRILLING_MAIN');
        } else {
          standardCount++;
          expect(width).toBeGreaterThanOrEqual(70);
          expect(height).toBeGreaterThanOrEqual(44);
        }
      }

      // Exactly 198 compact drilling nodes and 52 standard peripheral nodes
      expect(compactCount).toBe(198);
      expect(standardCount).toBe(52);

      unmount();
    });

    it('verifies non-overlapping vertical alignment within high-density drilling columns', () => {
      // Group drilling machines by columnGroup
      const drillingCols = new Map<string, MachineDef[]>();
      for (const m of FLEET_MACHINES) {
        if (m.process === 'DRILLING_MAIN' && m.columnGroup) {
          const key = `${m.processGroup}-${m.columnGroup}`;
          const list = drillingCols.get(key) || [];
          list.push(m);
          drillingCols.set(key, list);
        }
      }

      for (const [colName, units] of drillingCols.entries()) {
        // Sort units by svgY
        const sorted = [...units].sort((a, b) => a.svgY - b.svgY);

        for (let j = 0; j < sorted.length - 1; j++) {
          const current = sorted[j];
          const next = sorted[j + 1];

          const currentBottom = current.svgY + (current.cardHeight || 32);
          const nextTop = next.svgY;

          // Next unit must start at or after current bottom (no negative spacing or overlap)
          expect(
            nextTop,
            `Overlap detected in column ${colName} between ${current.id} and ${next.id}`
          ).toBeGreaterThanOrEqual(currentBottom);
        }
      }
    });
  });

  // ==========================================================================
  // SUITE 4: ALARM ANIMATION & ISA-101 TOKEN STYLING STRESS TEST
  // ==========================================================================
  describe('Suite 4: Alarm Animation Styling & ISA-101 Token Conformance', () => {
    it('applies pulse-alarm animation, red border, and red glow in ALARM state (Compact Mode)', () => {
      const compactMachine = FLEET_MACHINES.find((m) => m.isCompact)!;

      const alarmTelemetry: LdiMachine = {
        eqp_id: compactMachine.id,
        status: 3, // ALARM
      };

      const { unmount } = render(
        <MachineNode
          coord={compactMachine}
          telemetry={alarmTelemetry}
          onSelect={() => {}}
        />
      );

      const node = screen.getByTestId(`machine-node-${compactMachine.id}`);
      expect(node.className).toContain('animate-pulse-alarm');
      expect(node.className).toContain('border-[#FF003C]');
      expect(node.className).toContain('bg-red-950');
      expect(node.className).toContain('shadow-[0_0_12px_rgba(255,0,60,0.8)]');

      unmount();
    });

    it('applies pulse-alarm animation, red border, and red progress bar in ALARM state (Standard Mode)', () => {
      const standardMachine = FLEET_MACHINES.find((m) => !m.isCompact)!;

      const alarmTelemetry: LdiMachine = {
        eqp_id: standardMachine.id,
        status: 3, // ALARM
        board_no: 15,
        total_board: 50,
        temperature: 26.5,
        humidity: 60.0,
      };

      const { container, unmount } = render(
        <MachineNode
          coord={standardMachine}
          telemetry={alarmTelemetry}
          onSelect={() => {}}
        />
      );

      const node = screen.getByTestId(`machine-node-${standardMachine.id}`);
      expect(node.className).toContain('animate-pulse-alarm');
      expect(node.className).toContain('border-[#FF003C]');
      expect(node.className).toContain('bg-red-950');
      expect(node.className).toContain('shadow-[0_0_20px_rgba(255,0,60,0.7)]');

      // Progress bar should be red #FF003C
      const progressBar = container.querySelector('.bg-\\[\\#FF003C\\]');
      expect(progressBar).toBeInTheDocument();

      unmount();
    });

    it('verifies AlarmPanel renders active critical alarms and navigates camera on click', () => {
      const alarms: LdiMachine[] = [
        { eqp_id: 'LDI-01', status: 3, mo: 'MO-ALARM-1' },
        { eqp_id: 'LDI-02', status: 3, mo: 'MO-ALARM-2' },
        { eqp_id: 'LDI-03', status: 3, mo: 'MO-ALARM-3' },
      ];

      const handleFocus = vi.fn();

      const { unmount } = render(
        <AlarmPanel alarms={alarms} onFocusMachine={handleFocus} />
      );

      // Verify header banner
      expect(screen.getByTestId('alarm-panel')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE ALARMS (3)')).toBeInTheDocument();

      // Verify items render critical badges
      expect(screen.getByText('LDI-01')).toBeInTheDocument();
      expect(screen.getByText('LDI-02')).toBeInTheDocument();
      expect(screen.getByText('LDI-03')).toBeInTheDocument();
      expect(screen.getAllByText('CRITICAL').length).toBe(3);

      // Click alarm item
      const item1 = screen.getByText('LDI-01').closest('div');
      if (item1) {
        act(() => {
          fireEvent.click(item1);
        });
        expect(handleFocus).toHaveBeenCalledWith(2210, 560, 'LDI-01');
      }

      unmount();
    });

    it('verifies TopBar ALARM KPI badge pulses red when alarm count > 0', () => {
      const alarmMachines: LdiMachine[] = [
        { eqp_id: 'LDI-01', status: 3 },
        { eqp_id: 'LDI-02', status: 1 },
      ];

      const { unmount } = render(
        <TopBar
          connectionState="connected"
          retryCount={0}
          machines={alarmMachines}
          totalFleetCount={250}
        />
      );

      const alarmKpi = screen.getByText('ALARM:').closest('div');
      expect(alarmKpi?.className).toContain('animate-pulse');
      expect(alarmKpi?.className).toContain('border-[#FF003C]');

      unmount();
    });

    it('verifies all 6 ISA-101 canonical SCADA status tokens have exact hex colors', () => {
      expect(ISA_STATUS_TOKENS.RUN.color).toBe('#00FF87');
      expect(ISA_STATUS_TOKENS.IDLE.color).toBe('#FFB800');
      expect(ISA_STATUS_TOKENS.ALARM.color).toBe('#FF003C');
      expect(ISA_STATUS_TOKENS.STOP.color).toBe('#00F2FE');
      expect(ISA_STATUS_TOKENS.OFF.color).toBe('#64748B');
      expect(ISA_STATUS_TOKENS.UNDEFINE.color).toBe('#ECEFF1');

      // Check StatusTheme resolution
      expect(getStatusTheme(1).hex).toBe('#00FF87');
      expect(getStatusTheme(2).hex).toBe('#FFB800');
      expect(getStatusTheme(3).hex).toBe('#FF003C');
      expect(getStatusTheme(4).hex).toBe('#00F2FE');
      expect(getStatusTheme(0).hex).toBe('#64748B');
      expect(getStatusTheme(5).hex).toBe('#ECEFF1');
    });
  });
});
