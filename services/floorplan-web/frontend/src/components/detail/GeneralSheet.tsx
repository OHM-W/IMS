import { LdiMachine } from '../../types/ldi';
import { MachineDef } from '../../types/fleet';
import { getStatusTheme } from '../../constants/colors';

export interface GeneralSheetProps {
  machine: LdiMachine | null;
  machineDef?: MachineDef | null;
}

const STANDARD_KEYS = new Set([
  'eqp_id',
  'status',
  'process_type',
  'last_seen',
  'db_key',
  'id',
  'name',
  'bay',
  'svgX',
  'svgY',
  'cardWidth',
  'cardHeight',
  'hasLiveFeed',
  'telemetryId',
  'event_message',
  'event_type',
  'event_code',
]);

export const GeneralSheet = ({ machine, machineDef }: GeneralSheetProps) => {
  const status = machine?.status ?? (machineDef?.hasLiveFeed ? 0 : 5);
  const theme = getStatusTheme(status);

  const dynamicEntries = Object.entries(machine || {}).filter(
    ([key, val]) =>
      !STANDARD_KEYS.has(key) &&
      val !== null &&
      val !== undefined &&
      val !== ''
  );

  return (
    <div className="space-y-3.5 font-mono text-xs">
      {/* Equipment Specification Section */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          EQUIPMENT PROFILE
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded divide-y divide-slate-800/80">
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-slate-500 text-[11px]">MACHINE ID</span>
            <span className="text-slate-200 font-bold">{machineDef?.id || machine?.eqp_id || '—'}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-slate-500 text-[11px]">DISPLAY NAME</span>
            <span className="text-slate-200 font-semibold">{machineDef?.name || '—'}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-slate-500 text-[11px]">PROCESS ZONE</span>
            <span className="text-cyan-400 font-semibold">{machineDef?.process || machine?.process_type || 'GENERAL'}</span>
          </div>
          {machineDef?.svgX !== undefined && machineDef?.svgY !== undefined && (
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-slate-500 text-[11px]">FLOOR POSITION</span>
              <span className="text-slate-400">
                X: {machineDef.svgX.toFixed(0)}, Y: {machineDef.svgY.toFixed(0)}
                {machineDef.cardWidth ? ` (${machineDef.cardWidth}×${machineDef.cardHeight ?? machineDef.cardWidth})` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry Status Section */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          MONITORING STATE
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded divide-y divide-slate-800/80">
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-slate-500 text-[11px]">STATE</span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
              style={{
                backgroundColor: theme.bgColor,
                borderColor: theme.borderColor,
                color: theme.textColor,
                borderWidth: '1px',
              }}
            >
              {theme.label}
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-slate-500 text-[11px]">TELEMETRY BINDING</span>
            <span className="text-slate-300 font-mono">
              {machineDef?.telemetryId || machine?.eqp_id || 'None (Unmapped)'}
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-slate-500 text-[11px]">DATA SOURCE</span>
            <span className="text-slate-300 font-mono">
              {machine?.db_key ? `DB: ${machine.db_key}` : machineDef?.hasLiveFeed ? 'Active Stream' : 'Unmonitored Baseline'}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Telemetry & Sensor Properties */}
      {dynamicEntries.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            <span>LIVE TELEMETRY & SENSOR METRICS</span>
            <span className="text-[9px] text-emerald-400 font-semibold px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-800/60 rounded">
              DYNAMIC ({dynamicEntries.length})
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded divide-y divide-slate-800/80">
            {dynamicEntries.map(([key, val]) => (
              <div key={key} className="flex justify-between items-center px-3 py-2">
                <span className="text-slate-500 text-[11px] uppercase tracking-wider">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-200 font-semibold font-mono">
                  {typeof val === 'number'
                    ? Number.isInteger(val)
                      ? val
                      : val.toFixed(2)
                    : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics / Event Info */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          OPERATIONAL NOTES
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded p-3 text-[11px] leading-relaxed text-slate-400">
          {machine?.event_message ? (
            <div className="text-slate-200">{machine.event_message}</div>
          ) : machineDef?.hasLiveFeed ? (
            <span>Telemetry link active. Operational status updated via SCADA pipeline.</span>
          ) : (
            <span className="text-slate-500">
              Unmonitored machine node. To connect real-time telemetry from an external database or PLC, bind a Telemetry ID in the mapping panel above.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
