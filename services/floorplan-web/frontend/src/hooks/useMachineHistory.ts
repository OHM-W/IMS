import { useState, useEffect, useCallback } from 'react';
import { HistoryRecord } from '../types/ldi';

export interface UseMachineHistoryOptions {
  minutes?: number;
  limit?: number;
  autoRefreshIntervalMs?: number;
}

export interface UseMachineHistoryResult {
  history: HistoryRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMachineHistory(
  eqpId: string | null | undefined,
  options: UseMachineHistoryOptions = {}
): UseMachineHistoryResult {
  const { minutes = 60, limit = 100, autoRefreshIntervalMs } = options;
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!eqpId) {
      setHistory([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/history/${encodeURIComponent(eqpId)}?minutes=${minutes}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch history: HTTP ${res.status}`);
      }
      const data: HistoryRecord[] = await res.json();
      setHistory(data);
    } catch (err: any) {
      setError(err?.message || 'Error fetching telemetry history');
    } finally {
      setLoading(false);
    }
  }, [eqpId, minutes, limit]);

  useEffect(() => {
    fetchHistory();

    if (autoRefreshIntervalMs && autoRefreshIntervalMs > 0 && eqpId) {
      const interval = setInterval(fetchHistory, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchHistory, autoRefreshIntervalMs, eqpId]);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
  };
}
