import React, { useState } from 'react';
import { MachineDef, ProcessCategory } from '../types/fleet';

interface EditToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  selectedIds: string[];
  selectedMachine?: MachineDef | null;
  onSelectAllInZone?: (process: ProcessCategory) => void;
  onClearSelection?: () => void;
  onAlign?: (type: 'left' | 'top' | 'distribute-h' | 'distribute-v') => void;
  onUpdateSize?: (id: string, width: number, height: number) => void;
  onApplySizeToZone?: (process: ProcessCategory, width: number, height: number) => void;
  onRenameMachine?: (id: string, newName: string, newTelemetryId?: string) => void;
  onDeleteMachine?: (id: string) => void;
  onDeleteSelected?: () => void;
  onAddMachine?: (newMachine: MachineDef) => void;
  getViewCenter?: () => { x: number; y: number };
  draggingMachineInfo?: { id: string; name: string; x: number; y: number; w?: number; h?: number; count?: number } | null;
}

export const EditToolbar: React.FC<EditToolbarProps> = ({
  isEditMode,
  onToggleEditMode,
  onSave,
  onReset,
  onExport,
  isDirty,
  saveStatus,
  selectedIds,
  selectedMachine,
  onSelectAllInZone,
  onClearSelection,
  onAlign,
  onUpdateSize,
  onApplySizeToZone,
  onRenameMachine,
  onDeleteMachine,
  onDeleteSelected,
  onAddMachine,
  getViewCenter,
  draggingMachineInfo,
}) => {
  const [inputMachineName, setInputMachineName] = useState('004');

  const currentW = selectedMachine?.cardWidth ?? (selectedMachine?.isCompact ? 38 : 80);
  const currentH = selectedMachine?.cardHeight ?? (selectedMachine?.isCompact ? 22 : 50);

  // Instant Add with typed name (e.g. 004)
  const handleAddCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nameToUse = inputMachineName.trim() || 'NEW';
    const viewCenter = getViewCenter ? getViewCenter() : { x: 1600, y: 860 };
    
    // Unique ID ensuring zero collision
    const uniqueId = `CUSTOM-${Date.now()}`;

    const created: MachineDef = {
      id: uniqueId,
      name: nameToUse,
      process: 'DRILLING_MAIN',
      processGroup: 'CUSTOM',
      svgX: Math.round(viewCenter.x - 25),
      svgY: Math.round(viewCenter.y - 13),
      cardWidth: 50,
      cardHeight: 26,
      isCompact: true,
      hasLiveFeed: false,
    };

    onAddMachine?.(created);
  };

  const isMultiSelected = selectedIds.length > 1;
  const isSingleSelected = selectedIds.length === 1 && selectedMachine;

  return (
    <div className="absolute top-20 left-6 z-40 flex flex-col gap-2 pointer-events-auto">
      {/* Main Control Bar */}
      <div className="flex items-center gap-2 bg-[#0F172A]/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 shadow-2xl">
        <button
          type="button"
          onClick={onToggleEditMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all duration-200 cursor-pointer ${
            isEditMode
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-600/50'
          }`}
        >
          <span>{isEditMode ? '🛠️ EDIT MODE: ON' : '⚙️ EDIT LAYOUT'}</span>
        </button>

        {isEditMode && (
          <>
            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Inline Quick Add Input & Button */}
            <form onSubmit={handleAddCard} className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Name e.g. 004"
                value={inputMachineName}
                onChange={(e) => setInputMachineName(e.target.value)}
                className="w-24 bg-slate-900 border border-slate-600 focus:border-emerald-400 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs focus:outline-none"
              />
              <button
                type="submit"
                title="Create card at center of screen"
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.5)] cursor-pointer"
              >
                ➕ ADD
              </button>
            </form>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all duration-200 cursor-pointer ${
                saveStatus === 'saved'
                  ? 'bg-emerald-600 text-white'
                  : isDirty
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <span>{saveStatus === 'saved' ? '✅ SAVED!' : saveStatus === 'saving' ? '💾 SAVING...' : '💾 SAVE'}</span>
            </button>

            <button
              type="button"
              onClick={onExport}
              title="Copy positions to clipboard"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-mono text-xs transition-all cursor-pointer"
            >
              📋 EXPORT
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('Revert all machine positions, sizes and custom edits to default CAD layout?')) {
                  onReset();
                }
              }}
              title="Reset all to default"
              className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white rounded-lg font-mono text-xs transition-all cursor-pointer"
            >
              🔄 RESET
            </button>
          </>
        )}
      </div>

      {/* Multi-Selection Group Operations Box */}
      {isEditMode && isMultiSelected && (
        <div className="bg-[#071329]/95 backdrop-blur-md border border-amber-500/80 rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[300px] animate-fade-in">
          <div className="flex items-center justify-between text-xs font-mono pb-1 border-b border-slate-700/80">
            <span className="text-amber-400 font-bold">
              📦 GROUP SELECTED: {selectedIds.length} MACHINES
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer"
            >
              DESELECT
            </button>
          </div>

          {/* Alignment Tools */}
          <div className="flex flex-col gap-1 text-xs font-mono">
            <span className="text-[10px] text-slate-400">ALIGNMENT TOOLS:</span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onAlign?.('left')}
                title="Align Left Edges"
                className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold text-center cursor-pointer"
              >
                ⬅️ Left
              </button>
              <button
                type="button"
                onClick={() => onAlign?.('top')}
                title="Align Top Edges"
                className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold text-center cursor-pointer"
              >
                ⬆️ Top
              </button>
              <button
                type="button"
                onClick={() => onAlign?.('distribute-h')}
                title="Distribute Evenly Horizontally"
                className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold text-center cursor-pointer"
              >
                ↔️ Dist-H
              </button>
              <button
                type="button"
                onClick={() => onAlign?.('distribute-v')}
                title="Distribute Evenly Vertically"
                className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold text-center cursor-pointer"
              >
                ↕️ Dist-V
              </button>
            </div>
          </div>

          <div className="text-[11px] font-mono text-amber-300/90 bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
            💡 Drag any selected machine to move all {selectedIds.length} machines together!
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete ALL ${selectedIds.length} selected machines?`)) {
                onDeleteSelected?.();
              }
            }}
            className="w-full py-1.5 px-2 bg-red-950/90 hover:bg-red-900 border border-red-700 text-red-200 rounded-lg text-[11px] font-mono font-bold transition-all text-center cursor-pointer"
          >
            🗑️ DELETE ALL {selectedIds.length} MACHINES
          </button>
        </div>
      )}

      {/* Single Machine Inspector Box (Appears when a machine is clicked) */}
      {isEditMode && isSingleSelected && selectedMachine && (
        <div className="bg-[#071329]/95 backdrop-blur-md border border-cyan-500/60 rounded-xl p-3 shadow-2xl flex flex-col gap-2.5 min-w-[300px] animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between text-xs font-mono pb-1 border-b border-slate-700/80">
            <span className="text-cyan-400 font-bold truncate">
              ⚙️ EDIT: {selectedMachine.id}
            </span>
            <span className="text-[10px] text-slate-400 uppercase">{selectedMachine.process}</span>
          </div>

          {/* Rename & Telemetry ID Fields */}
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">MACHINE NAME / LABEL:</label>
              <input
                type="text"
                value={selectedMachine.name}
                onChange={(e) =>
                  onRenameMachine?.(selectedMachine.id, e.target.value, selectedMachine.telemetryId)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-cyan-400 font-bold text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">TELEMETRY ID (DB eqp_id):</label>
              <input
                type="text"
                placeholder="e.g. LDI-01"
                value={selectedMachine.telemetryId || ''}
                onChange={(e) =>
                  onRenameMachine?.(selectedMachine.id, selectedMachine.name, e.target.value)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
              />
            </div>
          </div>

          {/* Width & Height Steppers */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="flex flex-col gap-1 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
              <span className="text-slate-400 text-[10px]">WIDTH: {currentW}px</span>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW - 4, currentH)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="font-bold text-slate-100">{currentW}</span>
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW + 4, currentH)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
              <span className="text-slate-400 text-[10px]">HEIGHT: {currentH}px</span>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW, currentH - 4)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="font-bold text-slate-100">{currentH}</span>
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW, currentH + 4)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Quick Zone Selection Shortcut */}
          <button
            type="button"
            onClick={() => onSelectAllInZone?.(selectedMachine.process)}
            className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[11px] font-mono font-bold transition-all text-center border border-slate-700 cursor-pointer"
          >
            🔍 SELECT ALL IN {selectedMachine.process}
          </button>

          {/* Bulk Apply & Delete Actions */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `Apply size (${currentW}×${currentH}px) to ALL machines in ${selectedMachine.process}?`
                  )
                ) {
                  onApplySizeToZone?.(selectedMachine.process, currentW, currentH);
                }
              }}
              className="w-full py-1 px-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 rounded-lg text-[11px] font-mono font-semibold transition-all text-center cursor-pointer"
            >
              ⚡ APPLY SIZE TO ALL IN {selectedMachine.process}
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete machine "${selectedMachine.name}" (${selectedMachine.id})?`)) {
                  onDeleteMachine?.(selectedMachine.id);
                }
              }}
              className="w-full py-1 px-2 bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 rounded-lg text-[11px] font-mono font-bold transition-all text-center cursor-pointer"
            >
              🗑️ DELETE THIS MACHINE
            </button>
          </div>
        </div>
      )}

      {/* Live Dragging Coordinates & Size Tooltip */}
      {isEditMode && draggingMachineInfo && (
        <div className="bg-[#071329]/95 backdrop-blur-md border border-amber-500/80 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 shadow-xl flex items-center gap-2 animate-fade-in">
          <span className="font-bold">📍 {draggingMachineInfo.name || draggingMachineInfo.id}:</span>
          <span>X: {draggingMachineInfo.x}</span>
          <span>Y: {draggingMachineInfo.y}</span>
          {draggingMachineInfo.count && draggingMachineInfo.count > 1 && (
            <span className="text-cyan-300 font-bold">({draggingMachineInfo.count} units)</span>
          )}
        </div>
      )}
    </div>
  );
};
