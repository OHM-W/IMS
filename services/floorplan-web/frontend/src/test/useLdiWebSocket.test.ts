import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLdiWebSocket } from '../hooks/useLdiWebSocket';
import { LdiMachine } from '../types/ldi';

// Mock WebSocket
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
    }, 10);
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

describe('useLdiWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          eqp_id: 'LDI-01',
          status: 1,
          temperature: 22.1,
          humidity: 45.0,
          resist_dosage: 35.5,
          scan_speed: 120.0,
          air_vacuum: 82.0,
          thickness: 0.1,
          board_no: 5,
          total_board: 25,
          total_time: 18.5,
          mo: 'MO-2026-001',
          fpn: 'FPN-9988',
          layer_name: 'TOP-L1',
          last_seen: '2026-09-01T12:00:00Z',
        },
      ],
    }) as any;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with 10 default machines and fetches initial snapshot', async () => {
    const { result } = renderHook(() =>
      useLdiWebSocket({ wsUrl: 'ws://localhost:8000/ws/ldi', enableHttpFallback: false })
    );

    expect(result.current.machineList.length).toBe(10);
    expect(result.current.connectionState).toBe('connecting');

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    expect(result.current.machines['LDI-01'].status).toBe(1);
    expect(result.current.machines['LDI-01'].mo).toBe('MO-2026-001');
  });

  it('updates machine state when WebSocket receives telemetry stream', async () => {
    const { result } = renderHook(() =>
      useLdiWebSocket({ wsUrl: 'ws://localhost:8000/ws/ldi', enableHttpFallback: false })
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    const mockWs = MockWebSocket.instances[0];
    expect(mockWs).toBeDefined();

    const incomingUpdate: LdiMachine[] = [
      {
        eqp_id: 'LDI-03',
        status: 3, // ALARM
        temperature: 26.5,
        humidity: 62.0,
        resist_dosage: 40.0,
        scan_speed: 110.0,
        air_vacuum: 65.0,
        thickness: 0.105,
        board_no: 12,
        total_board: 50,
        total_time: 19.2,
        mo: 'MO-ALARM-03',
        fpn: 'FPN-1122',
        layer_name: 'BOT-L2',
        last_seen: '2026-09-01T12:01:00Z',
      },
    ];

    act(() => {
      mockWs.onmessage?.({ data: JSON.stringify(incomingUpdate) });
    });

    expect(result.current.machines['LDI-03'].status).toBe(3);
    expect(result.current.machines['LDI-03'].temperature).toBe(26.5);
    expect(result.current.activeAlarms.length).toBe(1);
    expect(result.current.activeAlarms[0].eqp_id).toBe('LDI-03');
  });

  it('triggers reconnection with backoff on WebSocket close', async () => {
    const { result } = renderHook(() =>
      useLdiWebSocket({
        wsUrl: 'ws://localhost:8000/ws/ldi',
        initialBackoffMs: 100,
        enableHttpFallback: false,
      })
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    const mockWs = MockWebSocket.instances[0];

    act(() => {
      mockWs.close();
    });

    expect(result.current.connectionState).toBe('reconnecting');
    expect(result.current.retryCount).toBe(1);
  });
});
