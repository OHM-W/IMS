import React from 'react';
import { FleetFilterOption } from '../types/fleet';
import { Layers, Activity } from 'lucide-react';

export interface ProcessFilterOptionDef {
  id: FleetFilterOption;
  label: string;
  shortLabel?: string;
  category?: string;
  defaultCount?: number;
}

export const PROCESS_FILTER_OPTIONS: ProcessFilterOptionDef[] = [
  { id: 'ALL', label: 'ALL', shortLabel: 'ALL', defaultCount: 250 },
  { id: 'DRILLING', label: 'DRILLING', shortLabel: 'DRILL', defaultCount: 203 },
  { id: 'AUTO_LAY_UP', label: 'AUTO LAY UP', shortLabel: 'LAYUP', defaultCount: 8 },
  { id: 'OXIDE', label: 'OXIDE', shortLabel: 'OXIDE', defaultCount: 12 },
  { id: 'CUTTING', label: 'CUTTING', shortLabel: 'CUT', defaultCount: 11 },
  { id: 'LASER_DRILLING', label: 'LASER DRILLING', shortLabel: 'LASER', defaultCount: 5 },
  { id: 'XRY', label: 'XRY', shortLabel: 'XRY', defaultCount: 3 },
];

export interface ProcessFilterBarProps {
  activeFilter: FleetFilterOption;
  onSelectFilter: (filter: FleetFilterOption) => void;
  counts?: Partial<Record<FleetFilterOption, number>>;
}

export const ProcessFilterBar: React.FC<ProcessFilterBarProps> = ({
  activeFilter,
  onSelectFilter,
  counts = {},
}) => {
  return (
    <nav
      data-testid="process-filter-bar"
      aria-label="Process Navigation Filter"
      className="bg-[#080c16]/95 border-b border-slate-800/80 backdrop-blur-md px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto select-none z-20"
    >
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider pr-2 border-r border-slate-800">
          <Layers className="w-3.5 h-3.5 text-[#00F2FE]" />
          <span className="hidden sm:inline">PROCESS FILTER:</span>
          <span className="sm:hidden">FILTER:</span>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-thin">
          {PROCESS_FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt.id;
            const count = counts[opt.id] ?? opt.defaultCount;

            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`filter-btn-${opt.id}`}
                onClick={() => onSelectFilter(opt.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all duration-200 shrink-0 ${
                  isActive
                    ? 'bg-[#00F2FE]/15 border border-[#00F2FE] text-[#00F2FE] shadow-[0_0_12px_rgba(0,242,254,0.35)]'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span>{opt.label}</span>
                {count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-[#00F2FE]/25 text-[#00F2FE] font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Indicator Badge */}
      <div className="hidden md:flex items-center gap-2 shrink-0 text-xs font-mono">
        <span className="text-slate-500 text-[11px]">ACTIVE VIEW:</span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[#00FF87] font-semibold">
          <Activity className="w-3 h-3 text-[#00FF87]" />
          {activeFilter}
        </span>
      </div>
    </nav>
  );
};

export default ProcessFilterBar;
