import React from 'react';
import {
  X,
  Activity,
  ExternalLink,
  Target,
  Thermometer,
  Droplets,
  Gauge,
  Zap,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Wrench,
  Terminal,
} from 'lucide-react';
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
    if (!isoStr) return 'Never';
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

  const grafanaDrilldownUrl = `/d/ims-engineering/ims-engineering-drill-down?var-machine_id=${encodeURIComponent(
    eqpId
  )}`;

  return (
    <div
      data-testid="machine-detail-drawer"
      className="fixed inset-y-0 right-0 w-96 max-w-full bg-[#0F172A]/95 border-l border-slate-800 backdrop-blur-xl shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out select-none"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden pr-2">
          <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
            <Activity className="w-5 h-5 text-slate-300" />
          </div>
          <div className="overflow-hidden">
            <h2 className="font-mono text-lg font-bold text-slate-100 leading-tight truncate">
              {machine?.eqp_id || eqpId}
            </h2>
            <span className="text-xs text-slate-400 truncate block">
              {resolvedDef?.process
                ? resolvedDef.process.replace(/_/g, ' ')
                : resolvedDef?.bay || (isDrillingMachine ? 'Drilling Machine Node' : 'Equipment Node')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${theme.badgeClass}`}
          >
            {machine?.event_type || theme.label}
          </span>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm font-sans scrollbar-thin">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleFocus}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 border border-slate-700 transition-all"
          >
            <Target className="w-4 h-4 text-[#00FF87]" />
            <span>Focus Camera</span>
          </button>
          <a
            href={grafanaDrilldownUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00F2FE]/10 hover:bg-[#00F2FE]/20 text-xs font-semibold rounded-lg text-[#00F2FE] border border-[#00F2FE]/40 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Grafana Drill-Down</span>
          </a>
        </div>

        {/* ==================================================================== */}
        {/* 1. DRILLING SPECIFIC REAL-TIME TELEMETRY VIEW                        */}
        {/* ==================================================================== */}
        {isDrillingMachine && machine && (
          <>
            {/* Realtime Event & Status Box */}
            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-[#00FF87]" />
                  <span>Drilling Operation State</span>
                </div>
                <span className="font-mono text-slate-400 text-[11px]">
                  {formatLastSeen(machine.last_seen)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">EVENT CODE</span>
                  <span className="text-slate-100 font-bold text-sm block">
                    {machine.event_code || machine.mo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">EVENT TYPE</span>
                  <span className={`font-bold text-sm block ${
                    machine.event_type === 'RUN' ? 'text-[#00FF87]' :
                    machine.event_type === 'STOP' ? 'text-[#FFB800]' :
                    machine.event_type === 'ALARM' ? 'text-[#FF003C]' : 'text-cyan-400'
                  }`}>
                    {machine.event_type || machine.fpn || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-800/80">
                  <span className="text-slate-500 text-[11px] block">EVENT MESSAGE</span>
                  <span className="text-slate-200 font-semibold block text-xs bg-slate-950/60 p-2 rounded border border-slate-800/60">
                    {machine.event_message || machine.layer_name || 'No active event message'}
                  </span>
                </div>
              </div>
            </div>

            {/* NC Program (.TLP) Info Box */}
            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <FileText className="w-4 h-4 text-[#00F2FE]" />
                <span>Active NC Program (.TLP)</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-cyan-300 break-all">
                {machine.program_name || 'A220A-107BJ-FA SCALE X100.010 Y100.010.TLP'}
              </div>
            </div>

            {/* Tool & Spindle Metrics Box */}
            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Wrench className="w-4 h-4 text-[#FFB800]" />
                <span>Tool & Spindle Diameter Specs</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 space-y-2 font-mono text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">TOOL DIAMETERS (6 SPINDLES)</span>
                  <span className="text-slate-200 font-medium block text-[11px] break-words">
                    {machine.tool_info || 'T200 tool diameter: 3.101 3.105 3.116 3.113 3.115 3.111'}
                  </span>
                </div>
                {machine.hits_info && (
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Recorded Hits:</span>
                    <span className="text-[#00FF87] font-bold">{machine.hits_info}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ==================================================================== */}
        {/* 2. LDI / LASER DRILLING REAL-TIME TELEMETRY VIEW                     */}
        {/* ==================================================================== */}
        {!isDrillingMachine && machine && (
          <>
            {/* Manufacturing Order Section */}
            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Manufacturing Order</span>
                </div>
                <span className="font-mono text-slate-400">
                  Last seen: {formatLastSeen(machine.last_seen)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">MO NUMBER</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {machine.mo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">PART NUMBER (FPN)</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {machine.fpn || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 text-[11px] block">PCB LAYER</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {machine.layer_name || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Lot Progress */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Lot Progress</span>
                  <span className="font-bold text-slate-200">
                    {boardNo} / {totalBoard} boards ({progressPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === 3 ? 'bg-[#FF003C]' : 'bg-[#00FF87]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Cycle Exposure Time:</span>
                  <span className="text-slate-300">
                    {machine.total_time !== null && machine.total_time !== undefined
                      ? `${machine.total_time.toFixed(1)} s`
                      : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* Process Telemetry Gauges Grid */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Process Telemetry
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {/* Chamber Temp */}
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Thermometer className="w-3.5 h-3.5" /> Temp
                    </span>
                    {tempTol === 'ok' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF87]" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FFB800]" />
                    )}
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-100">
                    {machine.temperature !== null && machine.temperature !== undefined
                      ? `${machine.temperature.toFixed(1)}°C`
                      : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Spec: 22.0 ± 2.0°C</div>
                </div>

                {/* Chamber Humidity */}
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Droplets className="w-3.5 h-3.5" /> Humidity
                    </span>
                    {humTol === 'ok' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF87]" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FFB800]" />
                    )}
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-100">
                    {machine.humidity !== null && machine.humidity !== undefined
                      ? `${machine.humidity.toFixed(1)}%`
                      : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Spec: 45.0 ± 5.0%</div>
                </div>

                {/* Resist Dosage */}
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                    <Zap className="w-3.5 h-3.5 text-[#FFB800]" /> Dosage
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-100">
                    {machine.resist_dosage !== null && machine.resist_dosage !== undefined
                      ? `${machine.resist_dosage.toFixed(2)}`
                      : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Unit: mJ/cm²</div>
                </div>

                {/* Scan Speed */}
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                    <Gauge className="w-3.5 h-3.5 text-[#00F2FE]" /> Scan Speed
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-100">
                    {machine.scan_speed !== null && machine.scan_speed !== undefined
                      ? `${machine.scan_speed.toFixed(1)}`
                      : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Unit: mm/s</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Machine Specifications Box */}
        {resolvedDef?.specs && (
          <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>Machine Engineering Specs</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {resolvedDef.specs.spindleCount && (
                <div>
                  <span className="text-slate-500 text-[11px] block">SPINDLES</span>
                  <span className="text-slate-200">{resolvedDef.specs.spindleCount} Heads</span>
                </div>
              )}
              {resolvedDef.specs.maxSpeedRpm && (
                <div>
                  <span className="text-slate-500 text-[11px] block">MAX SPEED</span>
                  <span className="text-slate-200">{resolvedDef.specs.maxSpeedRpm.toLocaleString()} RPM</span>
                </div>
              )}
              {resolvedDef.specs.laserType && (
                <div>
                  <span className="text-slate-500 text-[11px] block">LASER TYPE</span>
                  <span className="text-slate-200">{resolvedDef.specs.laserType}</span>
                </div>
              )}
              {resolvedDef.specs.beamWavelength && (
                <div>
                  <span className="text-slate-500 text-[11px] block">WAVELENGTH</span>
                  <span className="text-slate-200">{resolvedDef.specs.beamWavelength} nm</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineDetailPopup;
