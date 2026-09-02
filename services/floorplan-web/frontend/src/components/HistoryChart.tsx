import React, { useMemo } from 'react';
import { HistoryRecord } from '../types/ldi';

interface HistoryChartProps {
  history: HistoryRecord[];
  loading?: boolean;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ history, loading }) => {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;

    // Filter valid records and sort chronologically (oldest to newest)
    const valid = [...history]
      .filter((h) => h && h.time)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (valid.length < 2) return null;

    const temps = valid.map((v) => v.temperature).filter((t): t is number => t !== null && !isNaN(t));
    const hums = valid.map((v) => v.humidity).filter((h): h is number => h !== null && !isNaN(h));

    const minTemp = temps.length > 0 ? Math.min(...temps) : 20;
    const maxTemp = temps.length > 0 ? Math.max(...temps) : 24;
    const minHum = hums.length > 0 ? Math.min(...hums) : 40;
    const maxHum = hums.length > 0 ? Math.max(...hums) : 60;

    const width = 320;
    const height = 100;
    const padding = 15;

    // Map temp points
    const tempRange = Math.max(maxTemp - minTemp, 1.0);
    const tempPoints = valid
      .map((item, idx) => {
        if (item.temperature === null) return null;
        const x = padding + (idx / (valid.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((item.temperature - minTemp) / tempRange) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter((p): p is string => p !== null)
      .join(' ');

    // Map humidity points
    const humRange = Math.max(maxHum - minHum, 1.0);
    const humPoints = valid
      .map((item, idx) => {
        if (item.humidity === null) return null;
        const x = padding + (idx / (valid.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((item.humidity - minHum) / humRange) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter((p): p is string => p !== null)
      .join(' ');

    return {
      pointsCount: valid.length,
      tempPoints,
      humPoints,
      minTemp: minTemp.toFixed(1),
      maxTemp: maxTemp.toFixed(1),
      minHum: minHum.toFixed(1),
      maxHum: maxHum.toFixed(1),
      lastTemp: temps.length > 0 ? temps[temps.length - 1].toFixed(1) : '--',
      lastHum: hums.length > 0 ? hums[hums.length - 1].toFixed(1) : '--',
      width,
      height,
    };
  }, [history]);

  if (loading) {
    return (
      <div className="h-28 flex items-center justify-center bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400">
        <span className="animate-pulse">Loading telemetry trend...</span>
      </div>
    );
  }

  if (!chartData || !chartData.tempPoints) {
    return (
      <div className="h-28 flex items-center justify-center bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-500">
        Insufficient telemetry history (waiting for samples)
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-1 bg-[#00FF87] rounded-full"></span>
          <span className="text-slate-300">Temp: {chartData.lastTemp}°C</span>
          <span className="text-[10px] text-slate-500">({chartData.minTemp}–{chartData.maxTemp})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-1 bg-[#00F2FE] rounded-full"></span>
          <span className="text-slate-300">Hum: {chartData.lastHum}%</span>
          <span className="text-[10px] text-slate-500">({chartData.minHum}–{chartData.maxHum})</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        className="w-full h-20 overflow-visible"
      >
        {/* Subtle grid lines */}
        <line x1="15" y1="15" x2={chartData.width - 15} y2="15" stroke="#1E293B" strokeDasharray="3 3" />
        <line x1="15" y1="50" x2={chartData.width - 15} y2="50" stroke="#1E293B" strokeDasharray="3 3" />
        <line x1="15" y1="85" x2={chartData.width - 15} y2="85" stroke="#1E293B" strokeDasharray="3 3" />

        {/* Humidity polyline */}
        {chartData.humPoints && (
          <polyline
            fill="none"
            stroke="#00F2FE"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.7"
            points={chartData.humPoints}
          />
        )}

        {/* Temperature polyline */}
        {chartData.tempPoints && (
          <polyline
            fill="none"
            stroke="#00FF87"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={chartData.tempPoints}
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>-60m</span>
        <span>-30m</span>
        <span>now</span>
      </div>
    </div>
  );
};
