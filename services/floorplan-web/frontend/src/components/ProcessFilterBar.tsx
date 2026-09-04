import { FleetFilterOption } from '../types/fleet';

export interface ProcessFilterOptionDef {
  id: FleetFilterOption;
  label: string;
  shortLabel?: string;
  category?: string;
  defaultCount?: number;
}

export const PROCESS_FILTER_OPTIONS: ProcessFilterOptionDef[] = [
  { id: 'ALL', label: 'ALL FLEET', shortLabel: 'ALL', defaultCount: 250 },
  { id: 'DRILLING', label: 'DRILLING', shortLabel: 'DRILL', defaultCount: 203 },
  { id: 'AUTO_LAY_UP', label: 'AUTO LAY UP', shortLabel: 'LAYUP', defaultCount: 8 },
  { id: 'OXIDE', label: 'OXIDE LINE', shortLabel: 'OXIDE', defaultCount: 12 },
  { id: 'CUTTING', label: 'CUTTING', shortLabel: 'CUT', defaultCount: 11 },
  { id: 'LASER_DRILLING', label: 'LASER DRILL', shortLabel: 'LASER', defaultCount: 5 },
  { id: 'XRY', label: 'X-RAY', shortLabel: 'XRY', defaultCount: 3 },
];

export interface ProcessFilterBarProps {
  activeFilter: FleetFilterOption;
  onSelectFilter: (filter: FleetFilterOption) => void;
  counts?: Partial<Record<FleetFilterOption, number>>;
}

export const ProcessFilterBar = ({
  activeFilter,
  onSelectFilter,
  counts = {},
}: ProcessFilterBarProps) => {
  return (
    <nav
      data-testid="process-filter-bar"
      aria-label="Process Navigation Filter"
      className="bg-[#090e17] border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between gap-3 select-none z-20"
    >
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold shrink-0 mr-1">
          ZONE FILTER:
        </span>

        {/* Segmented Industrial Switch Group */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 gap-0.5">
          {PROCESS_FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt.id;
            const count = counts[opt.id] ?? opt.defaultCount;

            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`filter-btn-${opt.id}`}
                onClick={() => onSelectFilter(opt.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all duration-150 shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 font-bold shadow-sm border border-slate-600/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <span>{opt.label}</span>
                {count !== undefined && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-emerald-950 text-emerald-400 font-semibold'
                        : 'text-slate-500'
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

      {/* Scope Status Badge */}
      <div className="hidden md:flex items-center gap-2 shrink-0 font-mono text-xs">
        <span className="text-slate-500 text-[10px] uppercase">ACTIVE SCOPE:</span>
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-slate-200 font-semibold text-[11px]">
          {activeFilter}
        </span>
      </div>
    </nav>
  );
};

export default ProcessFilterBar;
