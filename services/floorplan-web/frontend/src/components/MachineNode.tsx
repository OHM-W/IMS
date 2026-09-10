import { LdiMachine } from '../types/ldi';
import { MachineDef } from '../types/fleet';
import { getStatusTheme } from '../constants/colors';

export interface MachineNodeProps {
  coord: MachineDef;
  telemetry?: LdiMachine;
  isSelected?: boolean;
  isDimmed?: boolean;
  onSelect: (eqpId: string) => void;
}

export const MachineNode = ({
  coord,
  telemetry,
  isSelected = false,
  isDimmed = false,
  onSelect,
}: MachineNodeProps) => {
  const machineId = coord.id;
  const isCompact = coord.isCompact ?? false;

  // Status resolution
  let defaultStatus = 0; // default OFF
  if (coord.hasLiveFeed === false) {
    defaultStatus = 5; // UNDEFINE for unmonitored baseline
  }
  const status = telemetry?.status !== undefined ? telemetry.status : defaultStatus;
  const theme = getStatusTheme(status);
  const isAlarm = status === 3;

  const boardNo = telemetry?.board_no;
  const totalBoard = telemetry?.total_board;
  const progressPct =
    boardNo !== null && boardNo !== undefined && totalBoard !== null && totalBoard !== undefined && totalBoard > 0
      ? Math.min(Math.round((boardNo / totalBoard) * 100), 100)
      : 0;

  const tempStr =
    telemetry?.temperature !== null && telemetry?.temperature !== undefined
      ? `${telemetry.temperature.toFixed(1)}°C`
      : '--';

  const humStr =
    telemetry?.humidity !== null && telemetry?.humidity !== undefined
      ? `${telemetry.humidity.toFixed(1)}%`
      : '--';

  // Compact Mode (Dense Drilling Spindles & Staging Racks)
  if (isCompact) {
    const displayName = coord.name || machineId;
    const cleanLabel = displayName.replace(/^DRL-/, '');
    
    // Solid Status Fill: High-contrast visibility across factory floorplan
    const bgStyle =
      status === 1
        ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
        : status === 2
        ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
        : status === 3
        ? 'bg-red-500 text-white font-black animate-pulse shadow-sm'
        : status === 4
        ? 'bg-cyan-400 text-slate-950 font-black shadow-sm'
        : status === 0
        ? 'bg-slate-600 text-slate-100 font-bold border border-slate-500'
        : 'bg-slate-800/90 text-slate-300 font-bold border border-slate-600/70';

    return (
      <div
        data-testid={`machine-node-${machineId}`}
        onClick={() => onSelect(machineId)}
        title={`${displayName} (${theme.label})`}
        className={`relative w-full h-full rounded-[2px] cursor-pointer select-none transition-all duration-150 flex items-center justify-center ${bgStyle} ${
          isSelected
            ? 'ring-2 ring-white ring-offset-1 ring-offset-[#071329] scale-125 z-30'
            : 'hover:scale-110 hover:brightness-110'
        } ${isDimmed ? 'opacity-25' : 'opacity-100'}`}
      >
        <span className="font-mono text-[8px] leading-none tracking-tighter truncate">
          {cleanLabel}
        </span>
      </div>
    );
  }

  // Standard Mode (Peripheral Units, Presses, Oxide Lines, Cleanroom LDI)
  return (
    <div
      data-testid={`machine-node-${machineId}`}
      onClick={() => onSelect(machineId)}
      className={`relative w-full h-full rounded p-1.5 cursor-pointer select-none transition-all duration-150 flex flex-col justify-between ${
        isAlarm
          ? 'bg-red-950/90 border-2 border-red-500 animate-pulse-alarm'
          : `bg-[#0f172a]/95 border-2 ${theme.borderClass}`
      } ${
        isSelected
          ? 'ring-2 ring-white ring-offset-1 ring-offset-[#080c16] scale-105 z-30'
          : 'hover:scale-102 hover:border-slate-300'
      } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
    >
      {/* Header: Machine ID and Status Badge */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="font-mono text-[11px] font-bold text-slate-100 tracking-tight truncate">
          {machineId}
        </span>
        <span
          className={`px-1 py-0.2 text-[9px] font-mono font-bold rounded shrink-0 ${theme.badgeClass}`}
        >
          {theme.label}
        </span>
      </div>

      {/* Metrics Row: Temp & Hum */}
      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 mb-0.5">
        <div className="bg-slate-900/80 rounded px-1 py-0.5 text-center truncate">
          <span className="text-[9px] text-slate-500 block leading-tight">TMP</span>
          <span className="font-semibold text-slate-200">{tempStr}</span>
        </div>
        <div className="bg-slate-900/80 rounded px-1 py-0.5 text-center truncate">
          <span className="text-[9px] text-slate-500 block leading-tight">HUM</span>
          <span className="font-semibold text-slate-200">{humStr}</span>
        </div>
      </div>

      {/* Lot Board Progress */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[9px] font-mono text-slate-400">
          <span>LOT</span>
          <span className="text-slate-200">
            {boardNo !== undefined && boardNo !== null ? boardNo : '-'}/{totalBoard !== undefined && totalBoard !== null ? totalBoard : '-'}
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isAlarm ? 'bg-[#FF003C]' : 'bg-[#00FF87]'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MachineNode;
