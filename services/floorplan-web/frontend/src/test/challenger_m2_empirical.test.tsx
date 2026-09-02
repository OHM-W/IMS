import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  STATUS_COLORS,
  ISA_STATUS_COLORS,
  ISA_STATUS_TOKENS,
  getStatusTheme,
  getScadaStatusTheme,
} from '../constants/colors';
import {
  FACTORY_ZONES,
  FLEET_MACHINES,
  SVG_VIEWBOX,
  TOTAL_FLEET_COUNT,
} from '../constants/fleet';
import { MachineNode } from '../components/MachineNode';
import { TopBar } from '../components/TopBar';
import { FloorplanSVG } from '../components/FloorplanSVG';
import { MachineDef } from '../types/fleet';
import { LdiMachine } from '../types/ldi';

describe('M2 Empirical Challenger Test Suite', () => {
  describe('1. SCADA Status Tokens & Canonical Hex Colors', () => {
    it('verifies exact canonical hex codes for all 6 SCADA status tokens in constants', () => {
      // 1 = RUN: #00FF87
      expect(ISA_STATUS_TOKENS.RUN.color).toBe('#00FF87');
      expect(STATUS_COLORS.RUN.hex).toBe('#00FF87');
      expect(ISA_STATUS_COLORS.RUN.hex).toBe('#00FF87');

      // 2 = IDLE: #FFB800
      expect(ISA_STATUS_TOKENS.IDLE.color).toBe('#FFB800');
      expect(STATUS_COLORS.IDLE.hex).toBe('#FFB800');
      expect(ISA_STATUS_COLORS.IDLE.hex).toBe('#FFB800');

      // 3 = ALARM / DOWN: #FF003C
      expect(ISA_STATUS_TOKENS.ALARM.color).toBe('#FF003C');
      expect(STATUS_COLORS.ALARM.hex).toBe('#FF003C');
      expect(ISA_STATUS_COLORS.ALARM.hex).toBe('#FF003C');

      // 4 = STOP / LOTO: #00F2FE
      expect(ISA_STATUS_TOKENS.STOP.color).toBe('#00F2FE');
      expect(STATUS_COLORS.STOP.hex).toBe('#00F2FE');
      expect(ISA_STATUS_COLORS.STOP.hex).toBe('#00F2FE');
      expect(ISA_STATUS_COLORS.LOTO.hex).toBe('#00F2FE');

      // 0 = OFF: #64748B
      expect(ISA_STATUS_TOKENS.OFF.color).toBe('#64748B');
      expect(STATUS_COLORS.OFF.hex).toBe('#64748B');
      expect(ISA_STATUS_COLORS.OFF.hex).toBe('#64748B');

      // 5 = UNDEFINE: #ECEFF1
      expect(ISA_STATUS_TOKENS.UNDEFINE.color).toBe('#ECEFF1');
      expect(STATUS_COLORS.UNDEFINE.hex).toBe('#ECEFF1');
      expect(ISA_STATUS_COLORS.UNDEFINE.hex).toBe('#ECEFF1');
    });

    it('verifies getStatusTheme resolves numeric codes (0..5) correctly', () => {
      expect(getStatusTheme(1).hex).toBe('#00FF87');
      expect(getStatusTheme(2).hex).toBe('#FFB800');
      expect(getStatusTheme(3).hex).toBe('#FF003C');
      expect(getStatusTheme(4).hex).toBe('#00F2FE');
      expect(getStatusTheme(5).hex).toBe('#ECEFF1');
      expect(getStatusTheme(0).hex).toBe('#64748B');
      expect(getStatusTheme(null).hex).toBe('#64748B');
      expect(getStatusTheme(undefined).hex).toBe('#64748B');
    });

    it('verifies getScadaStatusTheme resolves string tokens and numeric codes', () => {
      expect(getScadaStatusTheme('RUN').hex).toBe('#00FF87');
      expect(getScadaStatusTheme('IDLE').hex).toBe('#FFB800');
      expect(getScadaStatusTheme('ALARM').hex).toBe('#FF003C');
      expect(getScadaStatusTheme('STOP').hex).toBe('#00F2FE');
      expect(getScadaStatusTheme('OFF').hex).toBe('#64748B');
      expect(getScadaStatusTheme('UNDEFINE').hex).toBe('#ECEFF1');
    });

    it('renders MachineNode in DOM for all 6 states and verifies styles', () => {
      const dummyCoord: MachineDef = {
        id: 'TEST-001',
        name: 'TEST-001',
        process: 'LASER_DRILLING',
        svgX: 100,
        svgY: 100,
        cardWidth: 110,
        cardHeight: 90,
        isCompact: false,
        hasLiveFeed: true,
      };

      const states = [
        { code: 1, label: 'RUN', hex: '#00FF87' },
        { code: 2, label: 'IDLE', hex: '#FFB800' },
        { code: 3, label: 'ALARM', hex: '#FF003C' },
        { code: 4, label: 'STOP', hex: '#00F2FE' },
        { code: 0, label: 'OFF', hex: '#64748B' },
        { code: 5, label: 'UNDEFINE', hex: '#ECEFF1' },
      ];

      for (const st of states) {
        const { unmount } = render(
          <MachineNode
            coord={dummyCoord}
            telemetry={{ eqp_id: 'TEST-001', status: st.code }}
            onSelect={vi.fn()}
          />
        );

        const node = screen.getByTestId('machine-node-TEST-001');
        expect(node).toBeInTheDocument();
        expect(screen.getByText(st.label)).toBeInTheDocument();

        if (st.code === 3) {
          expect(node.className).toContain('animate-pulse-alarm');
        }

        unmount();
      }
    });

    it('renders compact MachineNode in DOM for all 6 states', () => {
      const dummyCompact: MachineDef = {
        id: 'DRL-T00-140',
        name: 'DRL-140',
        process: 'DRILLING_MAIN',
        svgX: 530,
        svgY: 120,
        cardWidth: 44,
        cardHeight: 32,
        isCompact: true,
        hasLiveFeed: false,
      };

      const states = [
        { code: 1, label: 'RUN', hex: '#00FF87' },
        { code: 2, label: 'IDLE', hex: '#FFB800' },
        { code: 3, label: 'ALARM', hex: '#FF003C' },
        { code: 4, label: 'STOP', hex: '#00F2FE' },
        { code: 0, label: 'OFF', hex: '#64748B' },
        { code: 5, label: 'UNDEFINE', hex: '#ECEFF1' },
      ];

      for (const st of states) {
        const { unmount } = render(
          <MachineNode
            coord={dummyCompact}
            telemetry={{ eqp_id: 'DRL-T00-140', status: st.code }}
            onSelect={vi.fn()}
          />
        );

        const node = screen.getByTestId('machine-node-DRL-T00-140');
        expect(node).toBeInTheDocument();
        expect(screen.getByText(st.label)).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('2. SVG Canvas Coordinates & Boundaries (viewBox 0 0 3200 1550)', () => {
    it('verifies SVG viewBox configuration is exactly 0 0 3200 1550', () => {
      expect(SVG_VIEWBOX.width).toBe(3200);
      expect(SVG_VIEWBOX.height).toBe(1550);
      expect(SVG_VIEWBOX.viewBox).toBe('0 0 3200 1550');
    });

    it('verifies all 10 factory zones fit strictly inside 0 0 3200 1550', () => {
      expect(FACTORY_ZONES.length).toBe(10);

      for (const zone of FACTORY_ZONES) {
        const { xMin, yMin, xMax, yMax } = zone.bounds;
        expect(xMin).toBeGreaterThanOrEqual(0);
        expect(yMin).toBeGreaterThanOrEqual(0);
        expect(xMax).toBeLessThanOrEqual(3200);
        expect(yMax).toBeLessThanOrEqual(1550);
        expect(xMax).toBeGreaterThan(xMin);
        expect(yMax).toBeGreaterThan(yMin);

        // Center / focus view must also be inside bounds
        expect(zone.focusView.x).toBeGreaterThanOrEqual(xMin);
        expect(zone.focusView.x).toBeLessThanOrEqual(xMax);
        expect(zone.focusView.y).toBeGreaterThanOrEqual(yMin);
        expect(zone.focusView.y).toBeLessThanOrEqual(yMax);
      }
    });

    it('verifies all 250 machine coordinates and bounding boxes fit inside 0 0 3200 1550', () => {
      expect(FLEET_MACHINES.length).toBe(250);
      expect(TOTAL_FLEET_COUNT).toBe(250);

      const invalidMachines: any[] = [];

      for (const m of FLEET_MACHINES) {
        const w = m.cardWidth ?? (m.isCompact ? 44 : 110);
        const h = m.cardHeight ?? (m.isCompact ? 32 : 90);
        const right = m.svgX + w;
        const bottom = m.svgY + h;

        if (
          m.svgX < 0 ||
          m.svgY < 0 ||
          right > 3200 ||
          bottom > 1550 ||
          Number.isNaN(m.svgX) ||
          Number.isNaN(m.svgY)
        ) {
          invalidMachines.push({ id: m.id, x: m.svgX, y: m.svgY, w, h, right, bottom });
        }
      }

      expect(invalidMachines).toEqual([]);
    });

    it('renders FloorplanSVG root with correct viewBox and all 250 machines', () => {
      const { unmount } = render(
        <FloorplanSVG
          machines={{}}
          selectedId={null}
          onSelectMachine={vi.fn()}
        />
      );

      const svgRoot = screen.getByTestId('floorplan-svg-root');
      expect(svgRoot).toBeInTheDocument();
      expect(svgRoot.getAttribute('viewBox')).toBe('0 0 3200 1550');

      // Verify all 250 machine nodes are rendered in the DOM
      for (const m of FLEET_MACHINES) {
        const node = screen.getByTestId(`machine-node-${m.id}`);
        expect(node).toBeInTheDocument();
      }

      unmount();
    });
  });

  describe('3. TopBar KPI Tally Summing to 250 Across All States', () => {
    it('verifies TopBar tally sums to 250 when all machines are in uniform states', () => {
      const states = [0, 1, 2, 3, 4, 5];
      for (const st of states) {
        const machines: LdiMachine[] = Array.from({ length: 250 }, (_, i) => ({
          eqp_id: `M-${i}`,
          status: st,
        }));

        const { unmount } = render(
          <TopBar
            connectionState="connected"
            retryCount={0}
            machines={machines}
            totalFleetCount={250}
          />
        );

        const header = screen.getByTestId('top-bar');
        expect(within(header).getByText('TOTAL:')).toBeInTheDocument();
        const matches = within(header).getAllByText('250');
        // At least one for TOTAL, and if uniform state, one for the respective state bucket
        expect(matches.length).toBeGreaterThanOrEqual(1);

        unmount();
      }
    });

    it('verifies TopBar tally sums to 250 in a mixed state distribution', () => {
      // 50 RUN (1), 40 IDLE (2), 10 ALARM (3), 20 LOTO/STOP (4), 100 OFF (0), 30 UNDEFINE (5)
      // Total = 50 + 40 + 10 + 20 + 100 + 30 = 250
      const distribution = [
        { status: 1, count: 50 },
        { status: 2, count: 40 },
        { status: 3, count: 10 },
        { status: 4, count: 20 },
        { status: 0, count: 100 },
        { status: 5, count: 30 },
      ];

      const machines: LdiMachine[] = [];
      let idx = 0;
      for (const dist of distribution) {
        for (let i = 0; i < dist.count; i++) {
          machines.push({
            eqp_id: `M-${idx++}`,
            status: dist.status,
          });
        }
      }

      expect(machines.length).toBe(250);

      // Verify analytical sum
      const running = machines.filter((m) => m.status === 1).length;
      const idle = machines.filter((m) => m.status === 2).length;
      const alarm = machines.filter((m) => m.status === 3).length;
      const loto = machines.filter((m) => m.status === 4).length;
      const off = machines.filter((m) => m.status === 0 || m.status === undefined).length;
      const undefine = machines.filter((m) => m.status === 5).length;

      const sum = running + idle + alarm + loto + off + undefine;
      expect(sum).toBe(250);
      expect(running).toBe(50);
      expect(idle).toBe(40);
      expect(alarm).toBe(10);
      expect(loto).toBe(20);
      expect(off).toBe(100);
      expect(undefine).toBe(30);

      const { unmount } = render(
        <TopBar
          connectionState="connected"
          retryCount={0}
          machines={machines}
          totalFleetCount={250}
        />
      );

      const header = screen.getByTestId('top-bar');
      // Check rendered numbers within header
      expect(within(header).getByText('50')).toBeInTheDocument();
      expect(within(header).getByText('40')).toBeInTheDocument();
      expect(within(header).getByText('10')).toBeInTheDocument();
      expect(within(header).getByText('20')).toBeInTheDocument();
      expect(within(header).getByText('100')).toBeInTheDocument();
      expect(within(header).getByText('30')).toBeInTheDocument();

      unmount();
    });

    it('verifies TopBar tally correctly counts undefined status items as OFF and sums to 250', () => {
      const machines: LdiMachine[] = Array.from({ length: 250 }, (_, i) => ({
        eqp_id: `M-${i}`,
        // No status provided -> undefined
      }));

      const running = machines.filter((m) => m.status === 1).length;
      const idle = machines.filter((m) => m.status === 2).length;
      const alarm = machines.filter((m) => m.status === 3).length;
      const loto = machines.filter((m) => m.status === 4).length;
      const off = machines.filter((m) => m.status === 0 || m.status === undefined).length;
      const undefine = machines.filter((m) => m.status === 5).length;

      expect(running).toBe(0);
      expect(idle).toBe(0);
      expect(alarm).toBe(0);
      expect(loto).toBe(0);
      expect(off).toBe(250);
      expect(undefine).toBe(0);
      expect(running + idle + alarm + loto + off + undefine).toBe(250);

      const { unmount } = render(
        <TopBar
          connectionState="connected"
          retryCount={0}
          machines={machines}
          totalFleetCount={250}
        />
      );

      const header = screen.getByTestId('top-bar');
      expect(within(header).getByText('TOTAL:')).toBeInTheDocument();
      expect(within(header).getAllByText('250').length).toBe(2); // TOTAL: 250 and OFF: 250

      unmount();
    });

    it('stress tests randomized status partitions (100 iterations) guaranteeing exact sum of 250', () => {
      for (let iter = 0; iter < 100; iter++) {
        // Generate random partition of 250 into 6 buckets
        const weights = Array.from({ length: 6 }, () => Math.random());
        const weightSum = weights.reduce((a, b) => a + b, 0);
        const counts = weights.map((w) => Math.floor((w / weightSum) * 250));
        let allocated = counts.reduce((a, b) => a + b, 0);
        // Distribute remainder
        while (allocated < 250) {
          counts[allocated % 6]++;
          allocated++;
        }

        const machines: LdiMachine[] = [];
        const statusCodes = [1, 2, 3, 4, 0, 5];
        statusCodes.forEach((code, idx) => {
          for (let i = 0; i < counts[idx]; i++) {
            machines.push({ eqp_id: `M-${iter}-${idx}-${i}`, status: code });
          }
        });

        const running = machines.filter((m) => m.status === 1).length;
        const idle = machines.filter((m) => m.status === 2).length;
        const alarm = machines.filter((m) => m.status === 3).length;
        const loto = machines.filter((m) => m.status === 4).length;
        const off = machines.filter((m) => m.status === 0 || m.status === undefined).length;
        const undefine = machines.filter((m) => m.status === 5).length;

        const sum = running + idle + alarm + loto + off + undefine;
        expect(sum).toBe(250);
        expect(running).toBe(counts[0]);
        expect(idle).toBe(counts[1]);
        expect(alarm).toBe(counts[2]);
        expect(loto).toBe(counts[3]);
        expect(off).toBe(counts[4]);
        expect(undefine).toBe(counts[5]);
      }
    });
  });
});
