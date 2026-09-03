import React, { useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';
import { LdiMachine } from '../types/ldi';
import { MACHINE_MAP } from '../constants/machines';

interface AlarmPanelProps {
  alarms: LdiMachine[];
  onFocusMachine: (svgX: number, svgY: number, eqpId: string) => void;
}

export const AlarmPanel: React.FC<AlarmPanelProps> = ({ alarms, onFocusMachine }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!alarms || alarms.length === 0) {
    return null;
  }

  const handleItemClick = (machine: LdiMachine) => {
    const coord = MACHINE_MAP.get(machine.eqp_id);
    if (coord) {
      onFocusMachine(coord.svgX, coord.svgY, machine.eqp_id);
    }
  };

  return (
    <div
      data-testid="alarm-panel"
      className="fixed bottom-8 left-4 z-40 max-w-sm w-full bg-[#160b10] border border-red-600/80 rounded shadow-2xl overflow-hidden transition-all duration-150"
    >
      {/* Header Banner */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-2 bg-red-950/90 flex items-center justify-between cursor-pointer select-none border-b border-red-800/60"
      >
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-400" />
          <span className="font-mono text-xs font-bold text-red-200 tracking-wider">
            CRITICAL ALARMS ({alarms.length})
          </span>
        </div>
        <button className="text-red-400 hover:text-red-200 transition-colors">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Alarm Items List */}
      {isExpanded && (
        <div className="p-1.5 max-h-48 overflow-y-auto space-y-1 font-mono text-xs divide-y divide-red-950/40">
          {alarms.map((m) => {
            const coord = MACHINE_MAP.get(m.eqp_id);
            return (
              <div
                key={m.eqp_id}
                onClick={() => handleItemClick(m)}
                className="flex items-center justify-between p-2 rounded bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-bold text-red-200">{m.eqp_id}</div>
                  <div className="text-[10px] text-red-400/80">
                    {coord?.bay || 'ZONE'} • {m.event_message || m.mo || 'Fault detected'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 text-[10px] font-bold bg-red-900/60 text-red-200 border border-red-600/60 rounded">
                    TRIP
                  </span>
                  <button
                    className="p-1 text-red-300 hover:text-white bg-red-950/80 border border-red-800 rounded"
                    title="Focus Machine"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
