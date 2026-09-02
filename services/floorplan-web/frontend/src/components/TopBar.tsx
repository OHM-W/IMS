import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Radio,
  Cpu,
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

export const TopBar: React.FC<TopBarProps> = ({
  connectionState,
  retryCount,
  machines,
  totalFleetCount,
  panzoomControls,
}) => {
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00FF87]/15 border border-[#00FF87]/40 rounded-full font-mono text-xs text-[#00FF87] shadow-[0_0_10px_rgba(0,255,135,0.25)]">
            <span className="w-2 h-2 rounded-full bg-[#00FF87] animate-ping" />
            <span className="font-bold">● LIVE</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFB800]/15 border border-[#FFB800]/40 rounded-full font-mono text-xs text-[#FFB800]">
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>CONNECTING...</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFB800]/20 border border-[#FFB800]/50 rounded-full font-mono text-xs text-[#FFB800] animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            <span>RECONNECTING ({retryCount})</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FF003C]/20 border border-[#FF003C]/50 rounded-full font-mono text-xs text-[#FF003C]">
            <span className="w-2 h-2 rounded-full bg-[#FF003C]" />
            <span>DISCONNECTED</span>
          </div>
        );
    }
  };

  return (
    <header
      data-testid="top-bar"
      className="h-14 bg-[#080c16]/95 border-b border-slate-800 backdrop-blur-md px-4 flex items-center justify-between select-none z-30 relative"
    >
      {/* Brand & Area Title */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-cyan-950/60 border border-cyan-500/40 rounded-lg">
          <Cpu className="w-5 h-5 text-[#00F2FE]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm font-bold tracking-tight text-slate-100 uppercase">
              IMS Factory Digital Twin
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 border border-slate-700 text-slate-300 rounded">
              1F Floorplan
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Multi-Process SCADA Telemetry &amp; Machine Fleet
          </p>
        </div>
      </div>

      {/* KPI Status Summary Bar (Standard 6-State SCADA Legend) */}
      <div className="hidden lg:flex items-center gap-2 font-mono text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/80 border border-slate-800 rounded-md">
          <span className="text-slate-400">TOTAL:</span>
          <span className="font-bold text-slate-200">{total}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#00FF87]/10 border border-[#00FF87]/30 rounded-md text-[#00FF87]">
          <span>RUN:</span>
          <span className="font-bold">{running}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FFB800]/10 border border-[#FFB800]/30 rounded-md text-[#FFB800]">
          <span>IDLE:</span>
          <span className="font-bold">{idle}</span>
        </div>
        {alarm > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FF003C]/20 border border-[#FF003C] rounded-md text-[#FF003C] font-bold animate-pulse">
            <span>ALARM:</span>
            <span>{alarm}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FF003C]/10 border border-[#FF003C]/30 rounded-md text-[#FF003C]">
            <span>ALARM:</span>
            <span className="font-bold">{alarm}</span>
          </div>
        )}
        {loto > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#00F2FE]/10 border border-[#00F2FE]/30 rounded-md text-[#00F2FE]">
            <span>LOTO:</span>
            <span className="font-bold">{loto}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/40 border border-slate-800 rounded-md text-slate-400">
          <span>OFF:</span>
          <span className="font-bold">{off}</span>
        </div>
        {undefine > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/20 border border-slate-700/40 rounded-md text-slate-300">
            <span>UNDEFINE:</span>
            <span className="font-bold">{undefine}</span>
          </div>
        )}
      </div>

      {/* Right Controls: Panzoom actions, Live Badge & Clock */}
      <div className="flex items-center gap-3">
        {/* Navigation / Panzoom buttons */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => panzoomControls?.zoomIn()}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => panzoomControls?.zoomOut()}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => panzoomControls?.focusCleanroom()}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Focus Cleanroom"
          >
            <Maximize2 className="w-4 h-4 text-[#00FF87]" />
          </button>
          <button
            onClick={() => panzoomControls?.resetView()}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Reset Floorplan View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Live status badge */}
        {renderConnectionBadge()}

        {/* Real-time Clock */}
        <div className="hidden sm:block font-mono text-xs font-semibold text-slate-300 px-2 py-1 bg-slate-900/60 rounded border border-slate-800">
          {timeStr || '--:--:--'}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
