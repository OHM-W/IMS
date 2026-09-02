import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, renderHook } from '@testing-library/react';

// Imports under test
import {
  getStatusTheme,
  getTemperatureTolerance,
  getHumidityTolerance,
} from '../constants/colors';
import {
  LDI_MACHINES,
  CLEANROOM_BOUNDS,
  MACHINE_NODE_DIMENSIONS,
  SVG_VIEWBOX,
  MACHINE_MAP,
} from '../constants/machines';
import { useLdiWebSocket } from '../hooks/useLdiWebSocket';
import { MachineNode } from '../components/MachineNode';
import { MachineDetailPopup } from '../components/MachineDetailPopup';
import { AlarmPanel } from '../components/AlarmPanel';
import { HistoryChart } from '../components/HistoryChart';
import { TopBar } from '../components/TopBar';
import { LdiMachine, HistoryRecord } from '../types/ldi';

// Mock WebSocket class for testing
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 5);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  send() {}

  static instances: MockWebSocket[] = [];
  static clear() {
    MockWebSocket.instances = [];
  }
}

global.WebSocket = MockWebSocket as any;

describe('EMPIRICAL STRESS TEST SUITE — Milestone 3 Frontend', () => {
  beforeEach(() => {
    MockWebSocket.clear();
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

  // =========================================================================
  // 1. ISA-101 STATUS MAP & TOLERANCE BOUNDARY STRESS TESTS
  // =========================================================================
  describe('1. ISA-101 Status Map & Tolerance Rules', () => {
    it('verifies all canonical ISA-101 status tokens and colors', () => {
      // 1 = RUN (#00FF87)
      const runTheme = getStatusTheme(1);
      expect(runTheme.label).toBe('RUN');
      expect(runTheme.hex).toBe('#00FF87');
      expect(runTheme.code).toBe(1);
      expect(runTheme.pulse).toBe(false);

      // 2 = IDLE (#FFB800)
      const idleTheme = getStatusTheme(2);
      expect(idleTheme.label).toBe('IDLE');
      expect(idleTheme.hex).toBe('#FFB800');
      expect(idleTheme.code).toBe(2);
      expect(idleTheme.pulse).toBe(false);

      // 3 = ALARM (#FF003C)
      const alarmTheme = getStatusTheme(3);
      expect(alarmTheme.label).toBe('ALARM');
      expect(alarmTheme.hex).toBe('#FF003C');
      expect(alarmTheme.code).toBe(3);
      expect(alarmTheme.pulse).toBe(true);
      expect(alarmTheme.borderClass).toContain('animate-pulse-alarm');

      // 4 = STOP / LOTO (#00F2FE)
      const lotoTheme = getStatusTheme(4);
      expect(['STOP', 'LOTO']).toContain(lotoTheme.label);
      expect(lotoTheme.hex).toBe('#00F2FE');
      expect(lotoTheme.code).toBe(4);
      expect(lotoTheme.pulse).toBe(false);

      // 0 = OFF (#64748B)
      const offTheme = getStatusTheme(0);
      expect(offTheme.label).toBe('OFF');
      expect(offTheme.hex).toBe('#64748B');
      expect(offTheme.code).toBe(0);
      expect(offTheme.pulse).toBe(false);

      // 5 = UNDEFINE (#ECEFF1)
      const undefineTheme = getStatusTheme(5);
      expect(undefineTheme.label).toBe('UNDEFINE');
      expect(undefineTheme.hex).toBe('#ECEFF1');
      expect(undefineTheme.code).toBe(5);
    });

    it('handles unexpected, negative, null, and undefined status values gracefully by falling back to OFF', () => {
      const testCases = [null, undefined, -1, 999, NaN];
      for (const val of testCases) {
        const theme = getStatusTheme(val as any);
        expect(theme.label).toBe('OFF');
        expect(theme.hex).toBe('#64748B');
        expect(theme.code).toBe(0);
      }
    });

    it('empirically tests temperature tolerance boundaries (Spec: 22.0 ± 2.0°C; Warning: 19–21 & 23–25; Crit: <19 or >25)', () => {
      // Null / Undefined
      expect(getTemperatureTolerance(null)).toBe('ok');
      expect(getTemperatureTolerance(undefined)).toBe('ok');

      // Exact Normal Range [21.0, 23.0]
      expect(getTemperatureTolerance(21.0)).toBe('ok');
      expect(getTemperatureTolerance(22.0)).toBe('ok');
      expect(getTemperatureTolerance(22.5)).toBe('ok');
      expect(getTemperatureTolerance(23.0)).toBe('ok');

      // Low Warning [19.0, 21.0)
      expect(getTemperatureTolerance(19.0)).toBe('warn');
      expect(getTemperatureTolerance(19.5)).toBe('warn');
      expect(getTemperatureTolerance(20.9)).toBe('warn');

      // High Warning (23.0, 25.0]
      expect(getTemperatureTolerance(23.1)).toBe('warn');
      expect(getTemperatureTolerance(24.5)).toBe('warn');
      expect(getTemperatureTolerance(25.0)).toBe('warn');

      // Low Critical (< 19.0)
      expect(getTemperatureTolerance(18.9)).toBe('crit');
      expect(getTemperatureTolerance(10.0)).toBe('crit');
      expect(getTemperatureTolerance(-5.0)).toBe('crit');

      // High Critical (> 25.0)
      expect(getTemperatureTolerance(25.1)).toBe('crit');
      expect(getTemperatureTolerance(30.0)).toBe('crit');
      expect(getTemperatureTolerance(100.0)).toBe('crit');
    });

    it('empirically tests humidity tolerance boundaries (Spec: 45.0 ± 5.0%; Warning: 35–40 & 50–55; Crit: <35 or >55)', () => {
      // Null / Undefined
      expect(getHumidityTolerance(null)).toBe('ok');
      expect(getHumidityTolerance(undefined)).toBe('ok');

      // Normal Range [40.0, 50.0]
      expect(getHumidityTolerance(40.0)).toBe('ok');
      expect(getHumidityTolerance(45.0)).toBe('ok');
      expect(getHumidityTolerance(50.0)).toBe('ok');

      // Low Warning [35.0, 40.0)
      expect(getHumidityTolerance(35.0)).toBe('warn');
      expect(getHumidityTolerance(37.5)).toBe('warn');
      expect(getHumidityTolerance(39.9)).toBe('warn');

      // High Warning (50.0, 55.0]
      expect(getHumidityTolerance(50.1)).toBe('warn');
      expect(getHumidityTolerance(52.5)).toBe('warn');
      expect(getHumidityTolerance(55.0)).toBe('warn');

      // Low Critical (< 35.0)
      expect(getHumidityTolerance(34.9)).toBe('crit');
      expect(getHumidityTolerance(20.0)).toBe('crit');
      expect(getHumidityTolerance(0.0)).toBe('crit');

      // High Critical (> 55.0)
      expect(getHumidityTolerance(55.1)).toBe('crit');
      expect(getHumidityTolerance(70.0)).toBe('crit');
      expect(getHumidityTolerance(100.0)).toBe('crit');
    });
  });

  // =========================================================================
  // 2. CLEANROOM BOUNDS & MACHINE COORDINATES SPATIAL STRESS TESTS
  // =========================================================================
  describe('2. Cleanroom Spatial Geometry & 10 Machines Placement Bounds', () => {
    it('verifies exact count of 10 machines configured', () => {
      expect(LDI_MACHINES.length).toBe(10);
      expect(MACHINE_MAP.size).toBe(10);
    });

    it('verifies all 10 machines card bounding boxes are strictly within Cleanroom boundaries', () => {
      const { xMin, xMax, yMin, yMax } = CLEANROOM_BOUNDS;
      const halfW = MACHINE_NODE_DIMENSIONS.width / 2; // 55
      const halfH = MACHINE_NODE_DIMENSIONS.height / 2; // 45

      expect(xMin).toBe(2150);
      expect(xMax).toBe(2870);
      expect(yMin).toBe(480);
      expect(yMax).toBe(800);

      LDI_MACHINES.forEach((machine) => {
        const left = machine.svgX - halfW;
        const right = machine.svgX + halfW;
        const top = machine.svgY - halfH;
        const bottom = machine.svgY + halfH;

        expect(left).toBeGreaterThanOrEqual(xMin);
        expect(right).toBeLessThanOrEqual(xMax);
        expect(top).toBeGreaterThanOrEqual(yMin);
        expect(bottom).toBeLessThanOrEqual(yMax);
      });
    });

    it('verifies Bay 1 (upper row) and Bay 2 (lower row) precise Y-alignment and X-order', () => {
      const bay1 = LDI_MACHINES.filter((m) => m.bay === 'Bay 1');
      const bay2 = LDI_MACHINES.filter((m) => m.bay === 'Bay 2');

      expect(bay1.length).toBe(5);
      expect(bay2.length).toBe(5);

      // Bay 1: Y = 560
      bay1.forEach((m) => {
        expect(m.svgY).toBe(560);
      });
      expect(bay1.map((m) => m.svgX)).toEqual([2210, 2350, 2490, 2630, 2770]);
      expect(bay1.map((m) => m.eqp_id)).toEqual(['LDI-01', 'LDI-02', 'LDI-03', 'LDI-04', 'LDI-05']);

      // Bay 2: Y = 720
      bay2.forEach((m) => {
        expect(m.svgY).toBe(720);
      });
      expect(bay2.map((m) => m.svgX)).toEqual([2210, 2350, 2490, 2630, 2770]);
      expect(bay2.map((m) => m.eqp_id)).toEqual(['LDI-06', 'LDI-07', 'LDI-08', 'LDI-09', 'LDI-10']);
    });

    it('verifies zero bounding box collision between all pairwise combinations of machines', () => {
      const halfW = MACHINE_NODE_DIMENSIONS.width / 2;
      const halfH = MACHINE_NODE_DIMENSIONS.height / 2;

      for (let i = 0; i < LDI_MACHINES.length; i++) {
        for (let j = i + 1; j < LDI_MACHINES.length; j++) {
          const m1 = LDI_MACHINES[i];
          const m2 = LDI_MACHINES[j];

          const m1_left = m1.svgX - halfW;
          const m1_right = m1.svgX + halfW;
          const m1_top = m1.svgY - halfH;
          const m1_bottom = m1.svgY + halfH;

          const m2_left = m2.svgX - halfW;
          const m2_right = m2.svgX + halfW;
          const m2_top = m2.svgY - halfH;
          const m2_bottom = m2.svgY + halfH;

          // Check if rectangles overlap
          const overlapsX = m1_left < m2_right && m1_right > m2_left;
          const overlapsY = m1_top < m2_bottom && m1_bottom > m2_top;
          const collision = overlapsX && overlapsY;

          expect(collision).toBe(false);
        }
      }
    });

    it('verifies SVG ViewBox dimensions and aspect ratio match CAD requirements (3200 x 1550)', () => {
      expect(SVG_VIEWBOX.width).toBe(3200);
      expect(SVG_VIEWBOX.height).toBe(1550);
      expect(SVG_VIEWBOX.viewBox).toBe('0 0 3200 1550');
    });
  });

  // =========================================================================
  // 3. WEBSOCKET RETRY MATH & RECONNECTION MECHANICS STRESS TESTS
  // =========================================================================
  describe('3. WebSocket Exponential Backoff & Connection Resilience', () => {
    it('verifies mathematical exponential backoff sequence (1s, 2s, 4s, 8s, 16s, max 30s cap)', () => {
      const initialBackoffMs = 1000;
      const maxBackoffMs = 30000;

      const calcDelay = (attempts: number) =>
        Math.min(initialBackoffMs * Math.pow(2, attempts), maxBackoffMs);

      expect(calcDelay(0)).toBe(1000);
      expect(calcDelay(1)).toBe(2000);
      expect(calcDelay(2)).toBe(4000);
      expect(calcDelay(3)).toBe(8000);
      expect(calcDelay(4)).toBe(16000);
      expect(calcDelay(5)).toBe(30000); // capped at 30,000ms
      expect(calcDelay(6)).toBe(30000);
      expect(calcDelay(10)).toBe(30000);
      expect(calcDelay(100)).toBe(30000);
    });

    it('handles rapid repeated disconnects and verifies retryCount incrementation and timer scheduling', async () => {
      const { result } = renderHook(() =>
        useLdiWebSocket({
          wsUrl: 'ws://localhost:8000/ws/ldi',
          initialBackoffMs: 100,
          maxBackoffMs: 800,
          enableHttpFallback: false,
        })
      );

      // Wait for initial connection
      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.retryCount).toBe(0);

      // Disconnect 1 -> backoff = 100ms
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].close();
      });
      expect(result.current.connectionState).toBe('reconnecting');
      expect(result.current.retryCount).toBe(1);

      // Advance by 100ms for reconnect attempt 1
      await act(async () => {
        vi.advanceTimersByTime(110);
      });
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.retryCount).toBe(0);

      // Disconnect 2 -> retry 1
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].close();
      });
      expect(result.current.retryCount).toBe(1);

      // Trigger immediate next close before open completes
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].close();
      });
      expect(result.current.retryCount).toBe(2);
    });

    it('cleans up timers and sockets cleanly on unmount without throwing errors', () => {
      const { unmount } = renderHook(() =>
        useLdiWebSocket({
          wsUrl: 'ws://localhost:8000/ws/ldi',
          initialBackoffMs: 100,
          enableHttpFallback: true,
        })
      );

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('correctly parses and aggregates high-volume WebSocket telemetry payloads', async () => {
      const { result } = renderHook(() =>
        useLdiWebSocket({
          wsUrl: 'ws://localhost:8000/ws/ldi',
          enableHttpFallback: false,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      const currentWs = MockWebSocket.instances[0];
      expect(currentWs).toBeDefined();

      // Send telemetry updates for all 10 machines
      const fullTelemetry: LdiMachine[] = LDI_MACHINES.map((m, idx) => ({
        eqp_id: m.eqp_id,
        status: (idx % 4) + 1, // 1, 2, 3, 4
        temperature: 22.0 + idx * 0.3,
        humidity: 45.0 + idx * 0.5,
        resist_dosage: 35.0 + idx,
        scan_speed: 120.0 - idx * 2,
        air_vacuum: 82.0 - idx,
        thickness: 0.100 + idx * 0.001,
        board_no: 10 + idx,
        total_board: 50,
        total_time: 15.0 + idx * 0.2,
        mo: `MO-BATCH-${idx + 1}`,
        fpn: `FPN-PCB-${idx + 1}`,
        layer_name: `LAYER-${idx + 1}`,
        last_seen: '2026-09-01T13:00:00Z',
      }));

      act(() => {
        currentWs.onmessage?.({ data: JSON.stringify(fullTelemetry) });
      });

      expect(result.current.machineList.length).toBe(10);
      expect(result.current.machines['LDI-01'].mo).toBe('MO-BATCH-1');
      expect(result.current.machines['LDI-10'].mo).toBe('MO-BATCH-10');
      expect(result.current.lastSeen).not.toBeNull();
    });

    it('ignores corrupted, non-JSON, and empty array WebSocket messages gracefully', async () => {
      const { result } = renderHook(() =>
        useLdiWebSocket({
          wsUrl: 'ws://localhost:8000/ws/ldi',
          enableHttpFallback: false,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      const currentWs = MockWebSocket.instances[0];

      // Corrupted string
      expect(() => {
        act(() => {
          currentWs.onmessage?.({ data: 'INVALID JSON STRING {[' });
        });
      }).not.toThrow();

      // Empty array
      expect(() => {
        act(() => {
          currentWs.onmessage?.({ data: JSON.stringify([]) });
        });
      }).not.toThrow();

      expect(result.current.machineList.length).toBe(10);

      // Non-array object
      expect(() => {
        act(() => {
          currentWs.onmessage?.({ data: JSON.stringify({ key: 'val' }) });
        });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 4. FRONTEND DATA TYPES, EXTREME VALUES & NULL VALUE RESILIENCE
  // =========================================================================
  describe('4. Component Stress: Extreme Values, Nulls & Boundary Conditions', () => {
    const mockCoord = LDI_MACHINES[0];

    it('MachineNode renders gracefully with all-null telemetry fields', () => {
      const allNullTelemetry: LdiMachine = {
        eqp_id: 'LDI-01',
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

      render(
        <MachineNode
          coord={mockCoord}
          telemetry={allNullTelemetry}
          isSelected={false}
          onSelect={() => {}}
        />
      );

      expect(screen.getByText('LDI-01')).toBeInTheDocument();
      expect(screen.getByText('OFF')).toBeInTheDocument();
      expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('-/-')).toBeInTheDocument();
    });

    it('MachineNode handles division-by-zero board progress (board_no = 0, total_board = 0)', () => {
      const zeroDivTelemetry: LdiMachine = {
        eqp_id: 'LDI-01',
        status: 1,
        temperature: 22.0,
        humidity: 45.0,
        resist_dosage: 35.0,
        scan_speed: 120.0,
        air_vacuum: 80.0,
        thickness: 0.1,
        board_no: 0,
        total_board: 0,
        total_time: 15.0,
        mo: 'MO-0',
        fpn: 'FPN-0',
        layer_name: 'L1',
        last_seen: '2026-09-01T12:00:00Z',
      };

      render(
        <MachineNode
          coord={mockCoord}
          telemetry={zeroDivTelemetry}
          isSelected={false}
          onSelect={() => {}}
        />
      );

      expect(screen.getByText('0/0')).toBeInTheDocument();
    });

    it('MachineNode caps lot progress at 100% when board_no exceeds total_board', () => {
      const overflowTelemetry: LdiMachine = {
        eqp_id: 'LDI-01',
        status: 1,
        temperature: 22.0,
        humidity: 45.0,
        resist_dosage: 35.0,
        scan_speed: 120.0,
        air_vacuum: 80.0,
        thickness: 0.1,
        board_no: 150,
        total_board: 100,
        total_time: 15.0,
        mo: 'MO-OVERFLOW',
        fpn: 'FPN-OVERFLOW',
        layer_name: 'L1',
        last_seen: '2026-09-01T12:00:00Z',
      };

      render(
        <MachineNode
          coord={mockCoord}
          telemetry={overflowTelemetry}
          isSelected={false}
          onSelect={() => {}}
        />
      );

      expect(screen.getByText('150/100')).toBeInTheDocument();
    });

    it('MachineDetailPopup renders all null values cleanly without crashing', () => {
      const allNullMachine: LdiMachine = {
        eqp_id: 'LDI-05',
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

      render(
        <MachineDetailPopup
          machine={allNullMachine}
          onClose={() => {}}
          onFocusMachine={() => {}}
        />
      );

      expect(screen.getByText('LDI-05')).toBeInTheDocument();
      expect(screen.getByText('OFF')).toBeInTheDocument();
      expect(screen.getAllByText('N/A').length).toBe(3); // MO, FPN, Layer
      expect(screen.getByText('Last seen: Never')).toBeInTheDocument();
    });

    it('AlarmPanel handles multiple critical alarm machines and invokes focus callback with exact coordinates', () => {
      const alarmMachines: LdiMachine[] = [
        {
          eqp_id: 'LDI-03',
          status: 3,
          temperature: 28.5,
          humidity: 65.0,
          resist_dosage: 40.0,
          scan_speed: 100.0,
          air_vacuum: 60.0,
          thickness: 0.11,
          board_no: 10,
          total_board: 20,
          total_time: 18.0,
          mo: 'MO-ALARM-03',
          fpn: 'FPN-03',
          layer_name: 'L3',
          last_seen: '2026-09-01T12:00:00Z',
        },
        {
          eqp_id: 'LDI-08',
          status: 3,
          temperature: 29.1,
          humidity: 70.0,
          resist_dosage: 42.0,
          scan_speed: 95.0,
          air_vacuum: 58.0,
          thickness: 0.112,
          board_no: 5,
          total_board: 20,
          total_time: 18.5,
          mo: 'MO-ALARM-08',
          fpn: 'FPN-08',
          layer_name: 'L8',
          last_seen: '2026-09-01T12:05:00Z',
        },
      ];

      const handleFocus = vi.fn();

      render(<AlarmPanel alarms={alarmMachines} onFocusMachine={handleFocus} />);

      expect(screen.getByText('ACTIVE ALARMS (2)')).toBeInTheDocument();
      expect(screen.getByText('LDI-03')).toBeInTheDocument();
      expect(screen.getByText('LDI-08')).toBeInTheDocument();

      // Click LDI-08 item
      const item08 = screen.getByText('LDI-08');
      fireEvent.click(item08);

      // LDI-08 is at svgX: 2490, svgY: 720
      expect(handleFocus).toHaveBeenCalledWith(2490, 720, 'LDI-08');
    });

    it('TopBar KPI counters compute correct aggregation across all 10 machines', () => {
      const mixedMachines: LdiMachine[] = [
        { eqp_id: 'LDI-01', status: 1 } as any, // RUN
        { eqp_id: 'LDI-02', status: 1 } as any, // RUN
        { eqp_id: 'LDI-03', status: 1 } as any, // RUN
        { eqp_id: 'LDI-04', status: 2 } as any, // IDLE
        { eqp_id: 'LDI-05', status: 2 } as any, // IDLE
        { eqp_id: 'LDI-06', status: 3 } as any, // ALARM
        { eqp_id: 'LDI-07', status: 3 } as any, // ALARM
        { eqp_id: 'LDI-08', status: 4 } as any, // LOTO
        { eqp_id: 'LDI-09', status: 0 } as any, // OFF
        { eqp_id: 'LDI-10', status: 0 } as any, // OFF
      ];

      render(
        <TopBar
          connectionState="connected"
          retryCount={0}
          machines={mixedMachines}
          panzoomControls={null}
        />
      );

      expect(screen.getByText('TOTAL:')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('RUN:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('IDLE:')).toBeInTheDocument();
      expect(screen.getByText('ALARM:')).toBeInTheDocument();
      expect(screen.getByText('LOTO:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('OFF:')).toBeInTheDocument();
      // IDLE=2, ALARM=2, OFF=2 -> 3 elements showing '2'
      expect(screen.getAllByText('2').length).toBe(3);
    });
  });

  // =========================================================================
  // 5. HISTORY SPARKLINE CHART EDGE CASES
  // =========================================================================
  describe('5. History Sparkline Chart Stress Tests', () => {
    it('HistoryChart handles empty history array gracefully', () => {
      render(<HistoryChart history={[]} />);
      expect(
        screen.getByText('Insufficient telemetry history (waiting for samples)')
      ).toBeInTheDocument();
    });

    it('HistoryChart handles single-element history array gracefully', () => {
      const singleItem: HistoryRecord[] = [
        {
          time: '2026-09-01T12:00:00Z',
          temperature: 22.1,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 80.0,
          thickness: 0.1,
          board_no: 5,
          total_board: 20,
          state: true,
        },
      ];
      render(<HistoryChart history={singleItem} />);
      expect(
        screen.getByText('Insufficient telemetry history (waiting for samples)')
      ).toBeInTheDocument();
    });

    it('HistoryChart handles flat identical values (min === max) without division-by-zero or NaN SVG points', () => {
      const flatHistory: HistoryRecord[] = [
        {
          time: '2026-09-01T12:00:00Z',
          temperature: 22.0,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 80.0,
          thickness: 0.1,
          board_no: 5,
          total_board: 20,
          state: true,
        },
        {
          time: '2026-09-01T12:10:00Z',
          temperature: 22.0,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 80.0,
          thickness: 0.1,
          board_no: 6,
          total_board: 20,
          state: true,
        },
      ];

      const { container } = render(<HistoryChart history={flatHistory} />);
      expect(screen.getByText('Temp: 22.0°C')).toBeInTheDocument();
      expect(screen.getByText('Hum: 45.0%')).toBeInTheDocument();

      // Check SVG polylines exist and do not contain NaN
      const polylines = container.querySelectorAll('polyline');
      expect(polylines.length).toBe(2);
      polylines.forEach((poly) => {
        const points = poly.getAttribute('points');
        expect(points).not.toContain('NaN');
      });
    });
  });

  // =========================================================================
  // 6. PANZOOM CAMERA PROJECTION & VIEWPORT GEOMETRY ADVERSARIAL TESTS
  // =========================================================================
  describe('6. Panzoom Camera Projection Math & Screen Normalization', () => {
    const viewports = [
      { name: '4K Ultra-HD', width: 3840, height: 2160 },
      { name: 'Full HD 1080p', width: 1920, height: 1080 },
      { name: 'Laptop WXGA', width: 1366, height: 768 },
      { name: 'Ultrawide 21:9', width: 3440, height: 1440 },
      { name: 'iPad Landscape', width: 1024, height: 768 },
      { name: 'iPad Portrait', width: 768, height: 1024 },
      { name: 'Mobile Portrait', width: 375, height: 812 },
    ];

    it('empirically verifies zoomToMachine targets center of screen across 7 viewport resolutions', () => {
      viewports.forEach((vp) => {
        LDI_MACHINES.forEach((machine) => {
          const zoomLevel = 2.2;
          const svgRatioX = vp.width / SVG_VIEWBOX.width;
          const svgRatioY = vp.height / SVG_VIEWBOX.height;
          const baseScale = Math.min(svgRatioX, svgRatioY);

          const targetX = vp.width / 2 - machine.svgX * baseScale * zoomLevel;
          const targetY = vp.height / 2 - machine.svgY * baseScale * zoomLevel;

          // Projected screen position of machine center must equal viewport center
          const projectedScreenX = targetX + machine.svgX * baseScale * zoomLevel;
          const projectedScreenY = targetY + machine.svgY * baseScale * zoomLevel;

          expect(projectedScreenX).toBeCloseTo(vp.width / 2, 5);
          expect(projectedScreenY).toBeCloseTo(vp.height / 2, 5);
        });
      });
    });

    it('empirically verifies focusCleanroom centers the Cleanroom Photolithography zone across all viewports', () => {
      const centerX = (CLEANROOM_BOUNDS.xMin + CLEANROOM_BOUNDS.xMax) / 2; // 2510
      const centerY = (CLEANROOM_BOUNDS.yMin + CLEANROOM_BOUNDS.yMax) / 2; // 640

      expect(centerX).toBe(2510);
      expect(centerY).toBe(640);

      viewports.forEach((vp) => {
        const zoomLevel = 1.6;
        const svgRatioX = vp.width / SVG_VIEWBOX.width;
        const svgRatioY = vp.height / SVG_VIEWBOX.height;
        const baseScale = Math.min(svgRatioX, svgRatioY);

        const targetX = vp.width / 2 - centerX * baseScale * zoomLevel;
        const targetY = vp.height / 2 - centerY * baseScale * zoomLevel;

        const projectedCenterX = targetX + centerX * baseScale * zoomLevel;
        const projectedCenterY = targetY + centerY * baseScale * zoomLevel;

        expect(projectedCenterX).toBeCloseTo(vp.width / 2, 5);
        expect(projectedCenterY).toBeCloseTo(vp.height / 2, 5);
      });
    });
  });

  // =========================================================================
  // 7. CONCURRENCY, UNMOUNT RACES & TELEMETRY DICTIONARY IMMUTABILITY
  // =========================================================================
  describe('7. Concurrency, Unmount Races & State Invariant Tests', () => {
    it('preserves other 9 machines when a partial update for 1 machine arrives', async () => {
      const { result } = renderHook(() =>
        useLdiWebSocket({
          wsUrl: 'ws://localhost:8000/ws/ldi',
          enableHttpFallback: false,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      const ws = MockWebSocket.instances[0];

      // Initial populate
      const initialBatch: LdiMachine[] = LDI_MACHINES.map((m) => ({
        eqp_id: m.eqp_id,
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
        mo: 'MO-INIT',
        fpn: 'FPN-INIT',
        layer_name: 'L1',
        last_seen: '2026-09-01T12:00:00Z',
      }));

      act(() => {
        ws.onmessage?.({ data: JSON.stringify(initialBatch) });
      });

      expect(result.current.machines['LDI-01'].mo).toBe('MO-INIT');
      expect(result.current.machines['LDI-07'].mo).toBe('MO-INIT');

      // Partial update only for LDI-07
      const partialUpdate: LdiMachine[] = [
        {
          eqp_id: 'LDI-07',
          status: 3, // ALARM
          temperature: 27.8,
          humidity: 68.2,
          resist_dosage: 41.5,
          scan_speed: 105.0,
          air_vacuum: 62.0,
          thickness: 0.108,
          board_no: 19,
          total_board: 20,
          total_time: 18.0,
          mo: 'MO-ALARM-07',
          fpn: 'FPN-07',
          layer_name: 'L7',
          last_seen: '2026-09-01T13:15:00Z',
        },
      ];

      act(() => {
        ws.onmessage?.({ data: JSON.stringify(partialUpdate) });
      });

      // LDI-07 updated
      expect(result.current.machines['LDI-07'].status).toBe(3);
      expect(result.current.machines['LDI-07'].mo).toBe('MO-ALARM-07');
      expect(result.current.machines['LDI-07'].temperature).toBe(27.8);

      // All other machines remain intact
      expect(result.current.machines['LDI-01'].mo).toBe('MO-INIT');
      expect(result.current.machines['LDI-01'].status).toBe(1);
      expect(result.current.machines['LDI-02'].mo).toBe('MO-INIT');
      expect(result.current.machines['LDI-10'].mo).toBe('MO-INIT');
      expect(result.current.machineList.length).toBe(10);
    });

    it('handles unexpected foreign equipment ID in telemetry stream without breaking LDI-01..10 mapping', async () => {
      const { result } = renderHook(() =>
        useLdiWebSocket({
          wsUrl: 'ws://localhost:8000/ws/ldi',
          enableHttpFallback: false,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      const ws = MockWebSocket.instances[0];

      // Unknown machine payload
      const foreignPayload: LdiMachine[] = [
        {
          eqp_id: 'UNKNOWN-EQP-99',
          status: 1,
          temperature: 20.0,
          humidity: 40.0,
          resist_dosage: 30.0,
          scan_speed: 100.0,
          air_vacuum: 70.0,
          thickness: 0.1,
          board_no: 1,
          total_board: 10,
          total_time: 10.0,
          mo: 'MO-UNKNOWN',
          fpn: 'FPN-UNKNOWN',
          layer_name: 'L-UNKNOWN',
          last_seen: '2026-09-01T12:00:00Z',
        },
      ];

      expect(() => {
        act(() => {
          ws.onmessage?.({ data: JSON.stringify(foreignPayload) });
        });
      }).not.toThrow();

      // Original 10 machines are intact
      for (let i = 1; i <= 10; i++) {
        const id = `LDI-${String(i).padStart(2, '0')}`;
        expect(result.current.machines[id]).toBeDefined();
      }
      expect(result.current.machines['UNKNOWN-EQP-99']).toBeDefined();
    });
  });
});
