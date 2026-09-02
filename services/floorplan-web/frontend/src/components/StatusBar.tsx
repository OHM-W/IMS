import React from 'react';
import { Database, Zap, Navigation, Layers } from 'lucide-react';

interface StatusBarProps {
  lastSeen: Date | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ lastSeen }) => {
  const lastSeenStr = lastSeen
    ? lastSeen.toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  return (
    <footer
      data-testid="status-bar"
      className="h-7 bg-[#080c16] border-t border-slate-800 px-4 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none z-30"
    >
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Database className="w-3.5 h-3.5 text-[#00F2FE]" />
          <span>TimescaleDB (public.ldi_data)</span>
        </span>
        <span className="hidden md:flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#00FF87]" />
          <span>Stream: 2.0s</span>
        </span>
        <span className="hidden lg:flex items-center gap-1.5 text-slate-500">
          <Layers className="w-3 h-3 text-slate-400" />
          <span>Fleet: 250 Units / 10 Zones</span>
        </span>
        <span className="hidden sm:inline text-slate-500">
          Last Sync: {lastSeenStr}
        </span>
      </div>

      <div className="flex items-center gap-2 text-slate-500">
        <Navigation className="w-3 h-3 text-slate-400" />
        <span className="hidden sm:inline">
          Drag to pan • Scroll to zoom • Click machine for inspection • Filter by process
        </span>
        <span className="sm:hidden">Interactive SCADA Floorplan</span>
      </div>
    </footer>
  );
};

export default StatusBar;
