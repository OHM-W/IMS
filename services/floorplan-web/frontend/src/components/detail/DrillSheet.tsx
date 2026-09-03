import React from 'react';
import { Copy, Check } from 'lucide-react';
import { LdiMachine } from '../../types/ldi';

export interface DrillSheetProps {
  machine: LdiMachine | null;
  copied: boolean;
  copyProgramName: (name: string) => void;
}

export const DrillSheet: React.FC<DrillSheetProps> = ({
  machine,
  copied,
  copyProgramName,
}) => (
  <div className="space-y-3.5">
    {/* Telemetry Status Section */}
    <div className="space-y-1">
      <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
        OPERATION STATUS
      </div>
      <div className="bg-slate-950 border border-slate-800 rounded divide-y divide-slate-800/80 font-mono text-xs">
        <div className="flex justify-between items-center px-3 py-2">
          <span className="text-slate-500 text-[11px]">STATE</span>
          <span
            className={`font-bold ${
              machine?.event_type === 'RUN'
                ? 'text-emerald-400'
                : machine?.event_type === 'STOP'
                ? 'text-amber-400'
                : machine?.event_type === 'ALARM'
                ? 'text-red-400'
                : 'text-slate-300'
            }`}
          >
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
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Copy Program String"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'COPIED' : 'COPY'}</span>
          </button>
        )}
      </div>
      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded font-mono text-xs text-slate-200 break-all leading-relaxed">
        {machine?.program_name || '—'}
      </div>
    </div>

    {/* Spindle Tooling Section */}
    <div className="space-y-1">
      <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
        SPINDLE & TOOL GEOMETRY (6 HEADS)
      </div>
      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded font-mono space-y-2">
        <div className="text-slate-300 text-[11px] leading-relaxed break-words">
          {machine?.tool_info || '—'}
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
);
