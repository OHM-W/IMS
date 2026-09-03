import { useState, useEffect, useRef, useCallback } from 'react';
import { LdiMachine, ConnectionState, WsPayload } from '../types/ldi';

export interface UseLdiWebSocketOptions {
  wsUrl?: string;
  snapshotUrl?: string;
  maxBackoffMs?: number;
  initialBackoffMs?: number;
  enableHttpFallback?: boolean;
}

export interface UseLdiWebSocketResult {
  machines: Record<string, LdiMachine>;
  machineList: LdiMachine[];
  connectionState: ConnectionState;
  lastSeen: Date | null;
  retryCount: number;
  activeAlarms: LdiMachine[];
  reconnect: () => void;
  refreshSnapshot: () => Promise<void>;
}

const DEFAULT_LDI_IDS = [
  'LDI-01', 'LDI-02', 'LDI-03', 'LDI-04', 'LDI-05',
  'LDI-06', 'LDI-07', 'LDI-08', 'LDI-09', 'LDI-10',
];

function createInitialMachineMap(): Record<string, LdiMachine> {
  const map: Record<string, LdiMachine> = {};
  for (const id of DEFAULT_LDI_IDS) {
    map[id] = {
      eqp_id: id,
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
  }
  return map;
}

export function useLdiWebSocket(options: UseLdiWebSocketOptions = {}): UseLdiWebSocketResult {
  const {
    wsUrl,
    snapshotUrl = '/api/snapshot',
    maxBackoffMs = 30000,
    initialBackoffMs = 1000,
    enableHttpFallback = true,
  } = options;

  const [machines, setMachines] = useState<Record<string, LdiMachine>>(createInitialMachineMap);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const fallbackPollTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const retryCountRef = useRef<number>(0);
  const isUnmountedRef = useRef<boolean>(false);

  // Update machines dictionary safely
  const updateMachines = useCallback((payload: any) => {
    if (!payload) return;

    let items: LdiMachine[] = [];
    if (Array.isArray(payload)) {
      items = payload;
    } else if (Array.isArray(payload.list)) {
      items = payload.list;
    } else if (payload.machines && typeof payload.machines === 'object') {
      items = Object.values(payload.machines);
    }

    if (items.length === 0) return;

    setMachines((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (item && item.eqp_id) {
          next[item.eqp_id] = { ...item };
          // If drilling machine (e.g. DRL054-M), alias under pure number '054' and full ID 'DRL-B06-054'
          if (item.eqp_id.startsWith('DRL')) {
            const numMatch = item.eqp_id.match(/(\d+)/);
            if (numMatch) {
              const num = numMatch[1];
              next[num] = { ...item };
              next[`DRL-${num}`] = { ...item };
              next[`DRL-B06-${num}`] = { ...item };
              next[`DRL-B06-054`] = { ...item };
            }
          }
        }
      }
      return next;
    });
    setLastSeen(new Date());
  }, []);

  // Fetch REST snapshot
  const refreshSnapshot = useCallback(async () => {
    try {
      const res = await fetch(snapshotUrl);
      if (res.ok) {
        const data: WsPayload = await res.json();
        if (!isUnmountedRef.current) {
          updateMachines(data);
        }
      }
    } catch {
      // Ignore network errors on snapshot
    }
  }, [snapshotUrl, updateMachines]);

  // Determine WebSocket URL
  const resolveWsUrl = useCallback(() => {
    if (wsUrl) return wsUrl;
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws/ldi`;
    }
    return 'ws://localhost:8000/ws/ldi';
  }, [wsUrl]);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    const targetUrl = resolveWsUrl();
    try {
      const ws = new WebSocket(targetUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setConnectionState('connected');
        setRetryCount(0);
        retryCountRef.current = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current as any);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isUnmountedRef.current) return;
        try {
          const data: WsPayload = JSON.parse(event.data);
          updateMachines(data);
        } catch {
          // invalid JSON ignored
        }
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        // error event triggers onclose
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setConnectionState('reconnecting');
        socketRef.current = null;

        // Exponential backoff: initial * 2^attempts up to max
        const attempts = retryCountRef.current;
        const delay = Math.min(initialBackoffMs * Math.pow(2, attempts), maxBackoffMs);
        retryCountRef.current = attempts + 1;
        setRetryCount(retryCountRef.current);

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current as any);
        }
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
        }, delay);
      };
    } catch {
      if (isUnmountedRef.current) return;
      setConnectionState('reconnecting');
      const attempts = retryCountRef.current;
      const delay = Math.min(initialBackoffMs * Math.pow(2, attempts), maxBackoffMs);
      retryCountRef.current = attempts + 1;
      setRetryCount(retryCountRef.current);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current as any);
      }
      reconnectTimerRef.current = setTimeout(() => {
        connectWs();
      }, delay);
    }
  }, [resolveWsUrl, initialBackoffMs, maxBackoffMs, updateMachines]);

  // Initial mount: load snapshot & connect WS
  useEffect(() => {
    isUnmountedRef.current = false;
    refreshSnapshot();
    connectWs();

    // Fallback polling if WS disconnected
    if (enableHttpFallback) {
      fallbackPollTimerRef.current = setInterval(() => {
        if (connectionState !== 'connected') {
          refreshSnapshot();
        }
      }, 5000);
    }

    return () => {
      isUnmountedRef.current = true;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current as any);
        reconnectTimerRef.current = null;
      }
      if (fallbackPollTimerRef.current) {
        clearInterval(fallbackPollTimerRef.current as any);
        fallbackPollTimerRef.current = null;
      }
    };
  }, [connectWs, refreshSnapshot, enableHttpFallback, connectionState]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    setRetryCount(0);
    setConnectionState('connecting');
    connectWs();
  }, [connectWs]);

  const machineList = Object.values(machines);
  const activeAlarms = machineList.filter((m) => m.status === 3);

  return {
    machines,
    machineList,
    connectionState,
    lastSeen,
    retryCount,
    activeAlarms,
    reconnect,
    refreshSnapshot,
  };
}
