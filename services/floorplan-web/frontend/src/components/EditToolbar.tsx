import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Save,
  Download,
  RotateCcw,
  AlignLeft,
  ArrowUp,
  Trash2,
  Sliders,
  Check,
} from 'lucide-react';
import { MachineDef, ProcessCategory } from '../types/fleet';

export interface EditToolbarProps {
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

  const handleAddCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nameToUse = inputMachineName.trim() || 'NEW';
    const viewCenter = getViewCenter ? getViewCenter() : { x: 1600, y: 860 };
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
    <div className="absolute top-18 left-4 z-40 flex flex-col gap-2 pointer-events-auto select-none font-mono">
      {/* Main Control Bar */}
      <div className="flex items-center gap-1.5 bg-[#0b101b] border border-slate-800 rounded p-1 shadow-xl">
        <button
          type="button"
          onClick={onToggleEditMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
            isEditMode
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700/80 hover:bg-slate-800'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>{isEditMode ? 'EDIT MODE: ON' : 'EDIT LAYOUT'}</span>
        </button>

        {isEditMode && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-1" />

            {/* Quick Add Form */}
            <form onSubmit={handleAddCard} className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Name"
                value={inputMachineName}
                onChange={(e) => setInputMachineName(e.target.value)}
                className="w-20 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded px-2 py-0.5 text-slate-100 text-xs focus:outline-none"
              />
              <button
                type="submit"
                title="Create card at center"
                className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>ADD</span>
              </button>
            </form>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            {/* Save Button */}
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                saveStatus === 'saved'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : isDirty
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/80 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {saveStatus === 'saved' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saveStatus === 'saved' ? 'SAVED' : saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={onExport}
              title="Copy positions JSON to clipboard"
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>EXPORT</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Revert all machine positions and custom edits to default CAD layout?')) {
                  onReset();
                }
              }}
              title="Reset all to default baseline"
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-red-950/80 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 rounded text-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
            </button>
          </>
        )}
      </div>

      {/* Multi-Selection Group Operations Box */}
      {isEditMode && isMultiSelected && (
        <div className="bg-[#0b101b] border border-slate-800 rounded p-2.5 shadow-xl flex flex-col gap-2 min-w-[280px]">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
            <span className="text-slate-200 font-semibold uppercase tracking-wider text-[11px]">
              SELECTED: {selectedIds.length} UNITS
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded cursor-pointer"
            >
              CLEAR
            </button>
          </div>

          {/* Alignment Tools */}
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">ALIGNMENT:</span>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => onAlign?.('left')}
                title="Align Left Edges"
                className="py-1 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <AlignLeft className="w-3 h-3" />
                <span>Left</span>
              </button>
              <button
                type="button"
                onClick={() => onAlign?.('top')}
                title="Align Top Edges"
                className="py-1 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Top</span>
              </button>
              <button
                type="button"
                onClick={() => onAlign?.('distribute-h')}
                title="Distribute Evenly Horizontally"
                className="py-1 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[11px] text-center cursor-pointer"
              >
                <span>Dist-H</span>
              </button>
              <button
                type="button"
                onClick={() => onAlign?.('distribute-v')}
                title="Distribute Evenly Vertically"
                className="py-1 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[11px] text-center cursor-pointer"
              >
                <span>Dist-V</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-850">
            Drag any highlighted machine to translate all {selectedIds.length} units together.
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete all ${selectedIds.length} selected machines?`)) {
                onDeleteSelected?.();
              }
            }}
            className="w-full py-1 px-2 bg-red-950/40 hover:bg-red-950/80 border border-red-900/60 text-red-300 rounded text-[11px] transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>DELETE {selectedIds.length} MACHINES</span>
          </button>
        </div>
      )}

      {/* Single Machine Inspector Box */}
      {isEditMode && isSingleSelected && selectedMachine && (
        <div className="bg-[#0b101b] border border-slate-800 rounded p-2.5 shadow-xl flex flex-col gap-2 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
            <span className="text-slate-200 font-bold truncate">
              PROPERTIES: {selectedMachine.id}
            </span>
            <span className="text-[10px] text-slate-500 uppercase">{selectedMachine.process}</span>
          </div>

          {/* Rename & Telemetry ID Fields */}
          <div className="flex flex-col gap-1.5 text-xs">
            <div>
              <label className="text-slate-500 text-[10px] block mb-0.5 uppercase tracking-wider">LABEL / NAME:</label>
              <input
                type="text"
                value={selectedMachine.name}
                onChange={(e) =>
                  onRenameMachine?.(selectedMachine.id, e.target.value, selectedMachine.telemetryId)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-100 focus:outline-none focus:border-cyan-500 font-bold text-xs"
              />
            </div>

            <div>
              <label className="text-slate-500 text-[10px] block mb-0.5 uppercase tracking-wider">TELEMETRY ID (DB EQP_ID):</label>
              <input
                type="text"
                placeholder="e.g. DRL-054"
                value={selectedMachine.telemetryId || ''}
                onChange={(e) =>
                  onRenameMachine?.(selectedMachine.id, selectedMachine.name, e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>
          </div>

          {/* Width & Height Steppers */}
          <div className="grid grid-cols-2 gap-1.5 text-xs pt-0.5">
            <div className="flex flex-col gap-0.5 bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 text-[9px] uppercase">WIDTH: {currentW}PX</span>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW - 4, currentH)}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="font-bold text-slate-200">{currentW}</span>
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW + 4, currentH)}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 text-[9px] uppercase">HEIGHT: {currentH}PX</span>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW, currentH - 4)}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="font-bold text-slate-200">{currentH}</span>
                <button
                  type="button"
                  onClick={() => onUpdateSize?.(selectedMachine.id, currentW, currentH + 4)}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 font-bold cursor-pointer"
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
            className="w-full py-1 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-semibold transition-colors text-center border border-slate-800 cursor-pointer"
          >
            SELECT ALL IN {selectedMachine.process}
          </button>

          {/* Bulk Apply & Delete Actions */}
          <div className="flex flex-col gap-1 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Apply size (${currentW}×${currentH}px) to ALL machines in ${selectedMachine.process}?`
                  )
                ) {
                  onApplySizeToZone?.(selectedMachine.process, currentW, currentH);
                }
              }}
              className="w-full py-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[10px] transition-colors text-center cursor-pointer flex items-center justify-center gap-1"
            >
              <Sliders className="w-3 h-3 text-slate-400" />
              <span>APPLY DIMENSIONS TO ZONE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete machine "${selectedMachine.name}" (${selectedMachine.id})?`)) {
                  onDeleteMachine?.(selectedMachine.id);
                }
              }}
              className="w-full py-1 px-2 bg-red-950/40 hover:bg-red-950/80 border border-red-900/60 text-red-300 rounded text-[10px] transition-colors text-center cursor-pointer flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
              <span>DELETE THIS UNIT</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Dragging Coordinates & Size Tooltip */}
      {isEditMode && draggingMachineInfo && (
        <div className="bg-[#0b101b] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 shadow-xl flex items-center gap-2">
          <span className="font-semibold text-emerald-400">{draggingMachineInfo.name || draggingMachineInfo.id}:</span>
          <span>X: {draggingMachineInfo.x}</span>
          <span>Y: {draggingMachineInfo.y}</span>
          {draggingMachineInfo.count && draggingMachineInfo.count > 1 && (
            <span className="text-slate-400">({draggingMachineInfo.count} units)</span>
          )}
        </div>
      )}
    </div>
  );
};

export default EditToolbar;
