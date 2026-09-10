import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LdiMachine } from '../types/ldi';
import { MachineDef } from '../types/fleet';
import {
  getStatusTheme,
  getTemperatureTolerance,
  getHumidityTolerance,
} from '../constants/colors';
import { FLEET_MACHINE_MAP } from '../constants/fleet';
import { DrillSheet } from './detail/DrillSheet';
import { LaserSheet } from './detail/LaserSheet';
import { GeneralSheet } from './detail/GeneralSheet';
import { DatabaseMappingPanel } from './detail/DatabaseMappingPanel';

export interface MachineDetailPopupProps {
  machine: LdiMachine | null;
  machineDef?: MachineDef | null;
  onClose: () => void;
  onFocusMachine?: (svgX: number, svgY: number, eqpId?: string) => void;
  onSaveMapping?: (id: string, newName: string, newTelemetryId?: string) => Promise<void> | void;
  availableDbMachines?: LdiMachine[];
  fleetMachines?: MachineDef[];
}

export const MachineDetailPopup = ({
  machine,
  machineDef,
  onClose,
  onFocusMachine,
  onSaveMapping,
  availableDbMachines,
  fleetMachines,
}: MachineDetailPopupProps) => {
  const [copied, setCopied] = useState(false);
  const eqpId = machine?.eqp_id || machineDef?.id || '';

  const resolvedDef =
    machineDef ||
    (eqpId ? FLEET_MACHINE_MAP.get(eqpId) : null) ||
    fleetMachines?.find((f) => f.id === eqpId || f.telemetryId === eqpId) ||
    null;

  const status =
    machine?.status !== undefined
      ? machine.status
      : resolvedDef?.hasLiveFeed
      ? 0
      : 5;
  const theme = getStatusTheme(status);

  const isDrillingMachine =
    machine?.process_type === 'DRILLING' ||
    resolvedDef?.process === 'DRILLING_MAIN' ||
    resolvedDef?.process === 'DRILLING_HOLD' ||
    eqpId.startsWith('DRL');

  const isLaserMachine =
    machine?.process_type === 'LASER' ||
    machine?.process_type === 'LDI' ||
    resolvedDef?.process === 'LASER_DRILLING' ||
    eqpId.startsWith('LDI');

  const tempTol = getTemperatureTolerance(machine?.temperature);
  const humTol = getHumidityTolerance(machine?.humidity);

  const boardNo = machine?.board_no ?? 0;
  const totalBoard = machine?.total_board ?? 0;
  const progressPct =
    totalBoard > 0 ? Math.min(Math.round((boardNo / totalBoard) * 100), 100) : 0;

  const formatLastSeen = (isoStr: string | null | undefined) => {
    if (!isoStr) return 'NO SYNC DATA';
    try {
      const d = new Date(isoStr);
      return (
        d.toLocaleTimeString('en-GB', { hour12: false }) +
        ` (${d.toLocaleDateString('en-GB')})`
      );
    } catch {
      return isoStr;
    }
  };

  const handleFocus = () => {
    if (onFocusMachine) {
      if (resolvedDef) {
        const w = resolvedDef.cardWidth ?? (resolvedDef.isCompact ? 38 : 80);
        const h = resolvedDef.cardHeight ?? (resolvedDef.isCompact ? 22 : 50);
        onFocusMachine(
          resolvedDef.svgX + Math.round(w / 2),
          resolvedDef.svgY + Math.round(h / 2),
          resolvedDef.id
        );
      } else if (machine) {
        onFocusMachine(0, 0, eqpId);
      }
    }
  };

  // Keyboard-first UX: Escape key dismisses slide-over inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyProgramName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const grafanaDrilldownUrl = `/d/ims-engineering/ims-engineering-drill-down?var-machine_id=${encodeURIComponent(
    eqpId
  )}`;

  return (
    <div
      data-testid="machine-detail-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`Equipment Inspector: ${machine?.eqp_id || eqpId}`}
      className="fixed inset-y-0 right-0 w-[410px] max-w-full bg-[#0b0f17] border-l border-slate-800 shadow-2xl z-50 flex flex-col select-none transition-all duration-150"
    >
      {/* 1. Header: Asset ID & Status Badge */}
      <div className="px-4 py-3 bg-[#080c14] border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-base font-bold text-slate-100 tracking-tight leading-tight">
              {machine?.eqp_id || eqpId}
            </h2>
            <span
              className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${theme.badgeClass}`}
            >
              {machine?.event_type || theme.label}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
            {resolvedDef?.process ? resolvedDef.process.replace(/_/g, ' ') : 'DRILLING'} •{' '}
            {resolvedDef?.bay || 'ZONE 1F'}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrollable Body: Technical Property Inspector */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans scrollbar-thin">
        {/* Actions Bar */}
        <div className="grid grid-cols-2 gap-2 font-mono">
          <button
            onClick={handleFocus}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold rounded border border-slate-700/80 transition-colors uppercase tracking-wider cursor-pointer"
          >
            Focus Camera
          </button>
          <a
            href={grafanaDrilldownUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold rounded border border-slate-700/80 transition-colors text-center uppercase tracking-wider"
          >
            Grafana Drill-Down
          </a>
        </div>

        {/* Database Mapping Configuration Panel */}
        <DatabaseMappingPanel
          machineDef={resolvedDef}
          eqpId={eqpId}
          availableDbMachines={availableDbMachines}
          fleetMachines={fleetMachines}
          onSaveMapping={onSaveMapping}
        />

        {/* Sync Timestamp Row */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded font-mono text-[10px] text-slate-400">
          <span className="tracking-wider">LAST TELEMETRY UPDATE</span>
          <span className="text-slate-300 font-semibold">{formatLastSeen(machine?.last_seen)}</span>
        </div>

        {/* Render Specialized Sheet: Drilling vs Laser/LDI vs General Factory Machine */}
        {isDrillingMachine ? (
          <DrillSheet
            machine={machine}
            copied={copied}
            copyProgramName={copyProgramName}
          />
        ) : isLaserMachine ? (
          <LaserSheet
            machine={machine}
            boardNo={boardNo}
            totalBoard={totalBoard}
            progressPct={progressPct}
            tempTol={tempTol}
            humTol={humTol}
          />
        ) : (
          <GeneralSheet machine={machine} machineDef={resolvedDef} />
        )}
      </div>
    </div>
  );
};
