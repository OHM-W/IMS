import React, { useState } from 'react';
import { Database, Save, AlertTriangle, Check } from 'lucide-react';
import { LdiMachine } from '../../types/ldi';
import { MachineDef } from '../../types/fleet';
import { getStatusTheme } from '../../constants/colors';

export interface DatabaseMappingPanelProps {
  machineDef?: MachineDef | null;
  eqpId: string;
  availableDbMachines?: LdiMachine[];
  fleetMachines?: MachineDef[];
  onSaveMapping?: (id: string, newName: string, newTelemetryId?: string) => Promise<void> | void;
}

export const DatabaseMappingPanel: React.FC<DatabaseMappingPanelProps> = ({
  machineDef,
  eqpId,
  availableDbMachines,
  fleetMachines,
  onSaveMapping,
}) => {
  const [isEditingMapping, setIsEditingMapping] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(machineDef?.name || '');
  const [editTelemetryId, setEditTelemetryId] = useState<string>(
    machineDef?.telemetryId || ''
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (!onSaveMapping) return null;

  const currentDefId = machineDef?.id || eqpId;

  // Real-time check if telemetryId is duplicate in other machines
  const duplicateMachine =
    editTelemetryId.trim() !== ''
      ? fleetMachines?.find(
          (m) =>
            m.id !== currentDefId &&
            m.telemetryId?.toLowerCase() === editTelemetryId.trim().toLowerCase()
        )
      : null;

  // Real-time check if telemetryId matches any live machine reported by DB
  const matchedDbMachine =
    editTelemetryId.trim() !== ''
      ? availableDbMachines?.find(
          (m) => m.eqp_id.toLowerCase() === editTelemetryId.trim().toLowerCase()
        )
      : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveMapping) return;

    setSaveStatus('saving');
    try {
      await onSaveMapping(
        currentDefId,
        editName.trim() || currentDefId,
        editTelemetryId.trim() || undefined
      );
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-2">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsEditingMapping(!isEditingMapping)}
        className={`w-full py-1.5 px-3 rounded font-mono text-xs font-semibold border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
          isEditingMapping
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700 shadow-sm'
            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
        }`}
      >
        <Database className="w-3.5 h-3.5 text-cyan-400" />
        <span>{isEditingMapping ? 'CLOSE DATABASE CONFIG' : 'CONFIG DATABASE MAPPING'}</span>
      </button>

      {/* Mapping Form */}
      {isEditingMapping && (
        <form
          onSubmit={handleSave}
          className="p-3 bg-slate-950 border border-cyan-800/60 rounded-md space-y-3 font-mono text-xs shadow-lg"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="text-cyan-400 font-bold text-[11px] tracking-wider uppercase flex items-center gap-1.5">
              <span>⚙️</span> STRICT DATABASE BINDING (1:1)
            </span>
            <span className="text-[10px] text-slate-500">UNIT: {currentDefId}</span>
          </div>

          {/* Label / Display Name */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
              CARD DISPLAY LABEL:
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. 054"
              className="w-full bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Database Equipment ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                DATABASE EQUIPMENT ID:
              </label>
              <span className="text-[9px] text-slate-500">EXACT MATCH (1:1)</span>
            </div>
            <input
              type="text"
              list="live-db-equipment-list"
              value={editTelemetryId}
              onChange={(e) => setEditTelemetryId(e.target.value)}
              placeholder="e.g. DRL054-M or LDI-01"
              className="w-full bg-[#080c14] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
            />
            <datalist id="live-db-equipment-list">
              {availableDbMachines?.map((m) => (
                <option
                  key={m.eqp_id}
                  value={m.eqp_id}
                  label={`${m.eqp_id} • ${m.process_type || 'Active'} • ${m.db_key || 'DB'}`}
                />
              ))}
            </datalist>

            {/* Real-Time Exact Match Status Indicator */}
            <div className="mt-1.5 px-2 py-1.5 rounded bg-[#080c14] border border-slate-800 text-[10px] flex items-center justify-between">
              {editTelemetryId.trim() === '' ? (
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />
                  Unmonitored (No database linked)
                </span>
              ) : matchedDbMachine ? (
                <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Connected: {matchedDbMachine.eqp_id} ({getStatusTheme(matchedDbMachine.status).label})
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Not detected in live DB (Must match exact case & ID)
                </span>
              )}
              {matchedDbMachine?.db_key && (
                <span className="text-[9px] text-slate-500 uppercase font-mono">
                  [{matchedDbMachine.db_key}]
                </span>
              )}
            </div>

            {/* Duplicate Warning */}
            {duplicateMachine && (
              <div className="mt-1.5 px-2 py-1 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[10px] flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Warning: Already bound to "{duplicateMachine.name}" ({duplicateMachine.id})</span>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className={`flex-1 py-1.5 px-3 rounded font-mono font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                saveStatus === 'saved'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950'
              }`}
            >
              {saveStatus === 'saved' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SAVED TO DATABASE ✓</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-slate-950" />
                  <span>{saveStatus === 'saving' ? 'SAVING...' : 'APPLY & SAVE MAPPING'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsEditingMapping(false)}
              className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded font-mono text-xs cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
