import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { LdiMachine } from '../types/ldi';
import { MachineDef } from '../types/fleet';
import {
  getStatusTheme,
  getTemperatureTolerance,
  getHumidityTolerance,
} from '../constants/colors';
import { FLEET_MACHINE_MAP } from '../constants/fleet';
import { MACHINE_MAP } from '../constants/machines';

export interface MachineDetailPopupProps {
  machine: LdiMachine | null;
  machineDef?: MachineDef | null;
  onClose: () => void;
  onFocusMachine?: (svgX: number, svgY: number, eqpId?: string) => void;
}

export const MachineDetailPopup: React.FC<MachineDetailPopupProps> = ({
  machine,
  machineDef,
  onClose,
  onFocusMachine,
}) => {
  const [copied, setCopied] = useState(false);
  const eqpId = machine?.eqp_id || machineDef?.id || '';

  if (!machine && !machineDef) return null;

  // Resolve metadata definition
  const resolvedDef =
    machineDef ||
    FLEET_MACHINE_MAP.get(eqpId) ||
    (MACHINE_MAP.has(eqpId)
      ? ({
          id: eqpId,
          name: MACHINE_MAP.get(eqpId)!.name,
          process: 'LASER_DRILLING' as any,
          svgX: MACHINE_MAP.get(eqpId)!.svgX,
          svgY: MACHINE_MAP.get(eqpId)!.svgY,
          bay: MACHINE_MAP.get(eqpId)!.bay,
          zoneId: MACHINE_MAP.get(eqpId)!.zone,
        } as MachineDef)
      : null);

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
      return d.toLocaleTimeString('en-GB', { hour12: false }) + ` (${d.toLocaleDateString('en-GB')})`;
    } catch {
      return isoStr;
    }
  };

  const handleFocus = () => {
    if (resolvedDef && onFocusMachine) {
      onFocusMachine(resolvedDef.svgX, resolvedDef.svgY, eqpId);
    } else if (machine && onFocusMachine) {
      const coord = MACHINE_MAP.get(machine.eqp_id);
      if (coord) {
        onFocusMachine(coord.svgX, coord.svgY, eqpId);
      }
    }
  };

  // Keyboard-first UX: Escape key dismisses slide-over inspector
  React.useEffect(() => {
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
            <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${theme.badgeClass}`}>
              {machine?.event_type || theme.label}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
            {resolvedDef?.process ? resolvedDef.process.replace(/_/g, ' ') : 'DRILLING'} • {resolvedDef?.bay || 'ZONE 1F'}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Close Inspector"
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
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold rounded border border-slate-700/80 transition-colors uppercase tracking-wider"
          >
            FOCUS VIEW
          </button>
          <a
            href={grafanaDrilldownUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold rounded border border-slate-700/80 transition-colors text-center uppercase tracking-wider"
          >
            TELEMETRY LOGS
          </a>
        </div>

        {/* Sync Timestamp Row */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded font-mono text-[10px] text-slate-400">
          <span className="tracking-wider">LAST TELEMETRY UPDATE</span>
          <span className="text-slate-200 font-semibold">{formatLastSeen(machine?.last_seen)}</span>
        </div>

        {/* ==================================================================== */}
        {/* DRILLING TECHNICAL SHEET                                             */}
        {/* ==================================================================== */}
        {isDrillingMachine && (
          <div className="space-y-3.5">
            {/* Telemetry Status Section */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                OPERATION STATUS
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded divide-y divide-slate-800/80 font-mono text-xs">
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-slate-500 text-[11px]">STATE</span>
                  <span className={`font-bold ${
                    machine?.event_type === 'RUN' ? 'text-emerald-400' :
                    machine?.event_type === 'STOP' ? 'text-amber-400' :
                    machine?.event_type === 'ALARM' ? 'text-red-400' : 'text-slate-300'
                  }`}>
                    {machine?.event_type || 'IDLE / READY'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-slate-500 text-[11px]">EVENT CODE</span>
                  <span className="text-slate-200 font-semibold">{machine?.event_code || 'N/A'}</span>
                </div>
                <div className="px-3 py-2">
                  <span className="text-slate-500 text-[11px] block mb-1">EVENT MESSAGE</span>
                  <div className="bg-[#0e1420] border border-slate-800/80 p-2 rounded text-slate-200 text-[11px] leading-relaxed break-words font-mono">
                    {machine?.event_message || 'No active event message reported'}
                  </div>
                </div>
              </div>
            </div>

            {/* NC Program Section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                <span>ACTIVE NC PROGRAM (.TLP)</span>
                {machine?.program_name && (
                  <button
                    onClick={() => copyProgramName(machine.program_name!)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
                    title="Copy Program String"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'COPIED' : 'COPY'}</span>
                  </button>
                )}
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded font-mono text-xs text-slate-200 break-all leading-relaxed">
                {machine?.program_name || 'A220A-107BJ-FA SCALE X100.010 Y100.010.TLP'}
              </div>
            </div>

            {/* Spindle Tooling Section */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                SPINDLE &amp; TOOL GEOMETRY (6 HEADS)
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded font-mono space-y-2">
                <div className="text-slate-300 text-[11px] leading-relaxed break-words">
                  {machine?.tool_info || 'T200 tool diameter: 3.101 3.105 3.116 3.113 3.115 3.111'}
                </div>
                {machine?.hits_info && (
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">CYCLE HITS:</span>
                    <span className="text-emerald-400 font-bold">{machine.hits_info}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hardware Specifications */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                EQUIPMENT SPECIFICATIONS
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                  <span className="text-slate-500 text-[10px] block">SPINDLE HEADS</span>
                  <span className="text-slate-200 font-semibold">6 Multi-Spindle</span>
                </div>
                <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                  <span className="text-slate-500 text-[10px] block">RATED SPEED</span>
                  <span className="text-slate-200 font-semibold">200,000 RPM</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* LASER (LDI) TECHNICAL SHEET                                          */}
        {/* ==================================================================== */}
        {!isDrillingMachine && (
          <div className="space-y-3.5">
            {/* Manufacturing Order Information */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                MANUFACTURING ORDER
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded divide-y divide-slate-800 font-mono text-xs">
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-slate-500 text-[11px]">MO NUMBER</span>
                  <span className="text-slate-200 font-semibold">{machine?.mo || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-slate-500 text-[11px]">PART NUMBER (FPN)</span>
                  <span className="text-slate-200 font-semibold">{machine?.fpn || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-slate-500 text-[11px]">PCB LAYER</span>
                  <span className="text-slate-200 font-semibold">{machine?.layer_name || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Lot Progress */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded space-y-2 font-mono">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px] tracking-wider">LOT PRODUCTION PROGRESS</span>
                <span className="text-slate-200 font-bold">
                  {boardNo} / {totalBoard} ({progressPct}%)
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Cycle Exposure Time:</span>
                <span className="text-slate-200">
                  {machine?.total_time != null ? `${machine.total_time.toFixed(1)} s` : '--'}
                </span>
              </div>
            </div>

            {/* Chamber Telemetry */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                CHAMBER ENVIRONMENT &amp; OPTICS
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {/* Chamber Temp */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                    <span className="font-semibold tracking-wider">TEMPERATURE</span>
                    <span className={tempTol === 'ok' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {tempTol === 'ok' ? 'IN SPEC' : 'ALERT'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-slate-100 font-mono">
                    {machine?.temperature != null ? `${machine.temperature.toFixed(1)}°C` : '--'}
                  </div>
                  {/* Micro Analog Indicator Band */}
                  <div className="mt-1.5 space-y-0.5">
                    <div className="w-full bg-slate-900 h-1 rounded-sm overflow-hidden flex">
                      <div className="w-1/4 bg-amber-950 border-r border-slate-850" />
                      <div className="w-2/4 bg-emerald-950 border-r border-slate-850" />
                      <div className="w-1/4 bg-amber-950" />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono flex justify-between">
                      <span>20°C</span>
                      <span className="text-slate-400">Target 22±2°C</span>
                      <span>24°C</span>
                    </div>
                  </div>
                </div>

                {/* Chamber Humidity */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                    <span className="font-semibold tracking-wider">HUMIDITY</span>
                    <span className={humTol === 'ok' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {humTol === 'ok' ? 'IN SPEC' : 'ALERT'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-slate-100 font-mono">
                    {machine?.humidity != null ? `${machine.humidity.toFixed(1)}%` : '--'}
                  </div>
                  {/* Micro Analog Indicator Band */}
                  <div className="mt-1.5 space-y-0.5">
                    <div className="w-full bg-slate-900 h-1 rounded-sm overflow-hidden flex">
                      <div className="w-1/4 bg-amber-950 border-r border-slate-850" />
                      <div className="w-2/4 bg-emerald-950 border-r border-slate-850" />
                      <div className="w-1/4 bg-amber-950" />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono flex justify-between">
                      <span>40%</span>
                      <span className="text-slate-400">Target 45±5%</span>
                      <span>50%</span>
                    </div>
                  </div>
                </div>

                {/* Resist Dosage */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 mb-1">OPTICAL DOSAGE</div>
                  <div className="text-base font-bold text-slate-100">
                    {machine?.resist_dosage != null ? machine.resist_dosage.toFixed(2) : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">mJ/cm²</div>
                </div>

                {/* Scan Speed */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 mb-1">SCAN SPEED</div>
                  <div className="text-base font-bold text-slate-100">
                    {machine?.scan_speed != null ? machine.scan_speed.toFixed(1) : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">mm/s</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineDetailPopup;
