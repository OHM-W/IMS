import { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Radio,
  Sliders,
} from 'lucide-react';
import { ConnectionState, LdiMachine, PanzoomControls } from '../types/ldi';
import { FleetFilterOption } from '../types/fleet';

export interface TopBarProps {
  connectionState: ConnectionState;
  retryCount: number;
  machines: LdiMachine[];
  totalFleetCount?: number;
  activeFilter?: FleetFilterOption;
  onSelectFilter?: (filter: FleetFilterOption) => void;
  panzoomControls?: PanzoomControls | null;
  onRefresh?: () => void;
}

export const TopBar = ({
  connectionState,
  retryCount,
  machines,
  totalFleetCount,
  panzoomControls,
}: TopBarProps) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const total = totalFleetCount ?? machines.length;
  const running = machines.filter((m) => m.status === 1).length;
  const idle = machines.filter((m) => m.status === 2).length;
  const alarm = machines.filter((m) => m.status === 3).length;
  const loto = machines.filter((m) => m.status === 4).length;
  const off = machines.filter((m) => m.status === 0 || m.status === undefined).length;
  const undefine = machines.filter((m) => m.status === 5).length;

  const renderConnectionBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-600/60 rounded text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-semibold tracking-wide">TELEMETRY LIVE</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-600/60 rounded text-xs font-mono text-amber-400">
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>CONNECTING</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/80 border border-amber-500 rounded text-xs font-mono text-amber-300">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>RETRY ({retryCount})</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/80 border border-red-500 rounded text-xs font-mono text-red-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>DISCONNECTED</span>
          </div>
        );
    }
  };

  return (
    <header
      data-testid="top-bar"
      className="h-12 bg-[#0c121e] border-b border-slate-800/90 px-4 flex items-center justify-between select-none z-30 relative"
    >
      {/* Brand & Factory Metadata */}
      <div className="flex items-center gap-3">
        <div className="px-2 py-1 bg-slate-900 border border-slate-700/80 rounded flex items-center gap-1.5 text-slate-200">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-bold tracking-wider">IMS SCADA</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-semibold tracking-tight text-slate-200 uppercase font-sans">
              Factory Floor 1F • Plant Twin
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/60 text-slate-400 rounded">
              REV 2.4
            </span>
          </div>
        </div>
      </div>

      {/* KPI Status Strip: Clean, High-Density Industrial Summary */}
      <div className="hidden lg:flex items-center bg-slate-900/90 border border-slate-800 rounded divide-x divide-slate-800 text-xs font-mono">
        <div className="px-3 py-1 flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">FLEET:</span>
          <span className="font-bold text-slate-200">{total}</span>
        </div>
        <div className="px-3 py-1 flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-slate-400 text-[11px]">RUN:</span>
          <span className="font-bold">{running}</span>
        </div>
        <div className="px-3 py-1 flex items-center gap-1.5 text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-slate-400 text-[11px]">IDLE:</span>
          <span className="font-bold">{idle}</span>
        </div>
        <div className={`px-3 py-1 flex items-center gap-1.5 ${
          alarm > 0 ? 'bg-red-950/60 text-red-300 font-bold border-red-600/50' : 'text-slate-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${alarm > 0 ? 'bg-red-500 animate-pulse' : 'bg-red-900'}`} />
          <span className="text-slate-400 text-[11px]">ALARM:</span>
          <span>{alarm}</span>
        </div>
        {loto > 0 && (
          <div className="px-3 py-1 flex items-center gap-1.5 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span className="text-slate-400 text-[11px]">PM:</span>
            <span className="font-bold">{loto}</span>
          </div>
        )}
        <div className="px-3 py-1 flex items-center gap-1.5 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span className="text-slate-500 text-[11px]">OFF:</span>
          <span className="font-bold">{off}</span>
        </div>
        {undefine > 0 && (
          <div className="px-3 py-1 flex items-center gap-1.5 text-slate-500">
            <span className="text-slate-500 text-[11px]">UNMAPPED:</span>
            <span>{undefine}</span>
          </div>
        )}
      </div>

      {/* Right Controls: Panzoom, Connection Status & System Clock */}
      <div className="flex items-center gap-2.5">
        {/* Navigation Controls Group */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-slate-400">
          <button
            onClick={() => panzoomControls?.zoomIn()}
            className="p-1 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => panzoomControls?.zoomOut()}
            className="p-1 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3.5 bg-slate-800 mx-0.5" />
          <button
            onClick={() => panzoomControls?.focusCleanroom()}
            className="p-1 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
            title="Focus Laser Area"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => panzoomControls?.resetView()}
            className="p-1 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Reset Pan/Zoom (0)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Status Badge */}
        {renderConnectionBadge()}

        {/* Precision Clock */}
        <div className="hidden sm:block font-mono text-xs text-slate-400 px-2 py-1 bg-slate-900/80 rounded border border-slate-800">
          {timeStr || '--:--:--'}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
