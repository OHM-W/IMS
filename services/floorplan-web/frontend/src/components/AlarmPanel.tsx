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
      className="fixed bottom-6 left-6 z-40 max-w-md w-full bg-red-950/90 border-2 border-[#FF003C] rounded-xl shadow-[0_0_30px_rgba(255,0,60,0.45)] backdrop-blur-md overflow-hidden transition-all duration-200"
    >
      {/* Header Banner */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-red-900/40 flex items-center justify-between cursor-pointer select-none border-b border-red-800/60"
      >
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-[#FF003C] animate-pulse" />
          <span className="font-mono text-xs font-bold text-red-100 tracking-wider">
            ACTIVE ALARMS ({alarms.length})
          </span>
        </div>
        <button className="text-red-300 hover:text-white transition-colors">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Alarm Items List */}
      {isExpanded && (
        <div className="p-2 max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
          {alarms.map((m) => {
            const coord = MACHINE_MAP.get(m.eqp_id);
            return (
              <div
                key={m.eqp_id}
                onClick={() => handleItemClick(m)}
                className="flex items-center justify-between p-2 rounded-lg bg-red-900/30 hover:bg-red-800/50 border border-red-700/40 cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-bold text-red-200">{m.eqp_id}</div>
                  <div className="text-[10px] text-red-300/70">
                    {coord?.bay || 'Cleanroom'} • {m.mo ? `MO: ${m.mo}` : 'No active order'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#FF003C]/30 text-red-100 border border-[#FF003C] rounded">
                    CRITICAL
                  </span>
                  <button
                    className="p-1 text-red-200 hover:text-white bg-red-800/60 rounded"
                    title="Focus Machine on Floorplan"
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
