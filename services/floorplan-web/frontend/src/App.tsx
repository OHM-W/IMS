import React, { useState, useRef, useMemo } from 'react';
import { useLdiWebSocket } from './hooks/useLdiWebSocket';
import { useFleetLayout } from './hooks/useFleetLayout';
import { FloorplanPanzoomControls } from './components/FloorplanSVG';
import { TopBar } from './components/TopBar';
import { ProcessFilterBar } from './components/ProcessFilterBar';
import { DevLayoutToolbar } from './components/DevLayoutToolbar';
import { FloorplanSVG } from './components/FloorplanSVG';
import { MachineDetailPopup } from './components/MachineDetailPopup';
import { AlarmPanel } from './components/AlarmPanel';
import { StatusBar } from './components/StatusBar';
import {
  FLEET_MACHINE_MAP,
  CAMERA_FOCUS_PRESETS,
  TOTAL_FLEET_COUNT,
} from './constants/fleet';
import { FleetFilterOption, MachineDef } from './types/fleet';
import { LdiMachine } from './types/ldi';

export const App = () => {
  const {
    machines,
    machineList,
    connectionState,
    retryCount,
    activeAlarms,
    lastSeen,
    refreshSnapshot,
  } = useLdiWebSocket();

  const {
    isEditMode,
    setIsEditMode,
    selectedIds,
    toggleSelectMachine,
    selectAllInProcess,
    selectByMarquee,
    clearSelection,
    fleetMachines,
    moveGroupPositions,
    updateMachinePosition,
    updateMachineSize,
    renameMachine,
    addMachine,
    deleteMachine,
    deleteSelectedMachines,
    applySizeToProcess,
    alignSelected,
    saveLayoutToServer,
    resetLayout,
    exportFleetCode,
    isDirty,
    saveStatus,
  } = useFleetLayout();

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FleetFilterOption>('ALL');
  const [draggingInfo, setDraggingInfo] = useState<{ id: string; name: string; x: number; y: number; w?: number; h?: number; count?: number } | null>(null);

  const panzoomRef = useRef<FloorplanPanzoomControls>(null);

  /*
    =============================================================================
    [DEV MODE ONLY] สวิตช์เปิดเครื่องมือจัดผังโรงงานเต็มรูปแบบ (สำหรับ Developer)
    เปลี่ยนเป็น true หรือพิมพ์ URL ?dev=true เพื่อเปิดเครื่องมือลากย้าย/ย่อขยาย/จัดแนว
    =============================================================================
  */
  const ENABLE_DEV_LAYOUT_EDITOR = false || (typeof window !== 'undefined' && window.location.search.includes('dev=true'));

  // Safe Operator Mapping persistence
  const handleSaveMachineMapping = React.useCallback(
    async (id: string, newName: string, newTelemetryId?: string) => {
      const updatedMachines = fleetMachines.map((m) =>
        m.id === id
          ? {
              ...m,
              name: newName,
              telemetryId: newTelemetryId || undefined,
              hasLiveFeed: Boolean(newTelemetryId),
            }
          : m
      );
      renameMachine(id, newName, newTelemetryId);
      try {
        await fetch('/api/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machines: updatedMachines, deletedIds: [] }),
        });
      } catch (err) {
        console.error('Failed to persist machine mapping:', err);
      }
    },
    [renameMachine, fleetMachines]
  );

  // Compute category machine counts for the process filter bar
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<FleetFilterOption, number>> = {
      ALL: TOTAL_FLEET_COUNT,
      DRILLING: 0,
      AUTO_LAY_UP: 0,
      OXIDE: 0,
      CUTTING: 0,
      LASER_DRILLING: 0,
      XRY: 0,
    };

    for (const m of fleetMachines) {
      if (m.process === 'DRILLING_MAIN' || m.process === 'DRILLING_HOLD') {
        counts.DRILLING = (counts.DRILLING || 0) + 1;
      } else if (counts[m.process as FleetFilterOption] !== undefined) {
        counts[m.process as FleetFilterOption] =
          (counts[m.process as FleetFilterOption] || 0) + 1;
      }
    }

    return counts;
  }, [fleetMachines]);

  const handleSelectFilter = (filter: FleetFilterOption) => {
    setActiveFilter(filter);
    if (panzoomRef.current) {
      if (panzoomRef.current.focusProcess) {
        panzoomRef.current.focusProcess(filter);
      } else {
        const preset = CAMERA_FOCUS_PRESETS[filter] || {
          x: 1600,
          y: 775,
          zoom: 1.0,
        };
        panzoomRef.current.zoomToMachine(preset.x, preset.y, preset.zoom);
      }
    }
  };

  const handleSelectMachine = (eqpId: string) => {
    if (!isEditMode) {
      setSelectedMachineId(eqpId);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedMachineId(null);
  };

  const handleFocusMachine = (svgX: number, svgY: number, eqpId?: string) => {
    panzoomRef.current?.zoomToMachine(svgX, svgY, 2.4);
    if (eqpId) {
      if (!isEditMode) {
        setSelectedMachineId(eqpId);
      } else {
        toggleSelectMachine(eqpId, false);
      }
    }
  };

  const handleAddMachine = (newMachine: MachineDef) => {
    addMachine(newMachine);
    toggleSelectMachine(newMachine.id, false);
    setTimeout(() => {
      panzoomRef.current?.zoomToMachine(newMachine.svgX, newMachine.svgY, 2.2);
    }, 50);
  };

  // Resolve selected machine object for detail drawer (reactive from current fleet layout)
  const selectedMachineDef = selectedMachineId
    ? fleetMachines.find((m) => m.id === selectedMachineId) ?? FLEET_MACHINE_MAP.get(selectedMachineId) ?? null
    : null;

  // Resolve selected machine object for edit inspector
  const primarySelectedEditMachine = selectedIds.length === 1
    ? fleetMachines.find((m) => m.id === selectedIds[0]) ?? null
    : null;

  const selectedTelemetry: LdiMachine | null = useMemo(() => {
    if (!selectedMachineId) return null;

    // 1. Direct match in live stream map
    if (machines[selectedMachineId]) {
      return machines[selectedMachineId];
    }

    // 2. Match via telemetry binding ID (e.g. LSR-001 -> LDI-01)
    if (selectedMachineDef?.telemetryId && machines[selectedMachineDef.telemetryId]) {
      return machines[selectedMachineDef.telemetryId];
    }

    // 3. Fallback unmonitored baseline model
    return {
      eqp_id: selectedMachineId,
      status: selectedMachineDef?.hasLiveFeed ? 0 : 5,
      temperature: null,
      humidity: null,
      resist_dosage: null,
      scan_speed: null,
      air_vacuum: null,
      thickness: null,
      board_no: null,
      total_board: null,
      total_time: null,
      mo: null,
      fpn: null,
      layer_name: null,
      last_seen: null,
    };
  }, [selectedMachineId, selectedMachineDef, machines]);

  // Filter active alarms strictly to machines present in active floorplan layout
  const visibleAlarms = useMemo(() => {
    const activeFleetIds = new Set<string>();
    for (const m of fleetMachines) {
      activeFleetIds.add(m.id);
      if (m.telemetryId) activeFleetIds.add(m.telemetryId);
    }
    return activeAlarms.filter((a) => activeFleetIds.has(a.eqp_id));
  }, [activeAlarms, fleetMachines]);

  // Compute fleet status metrics strictly for machines present on the floorplan layout
  const fleetStatusList = useMemo<LdiMachine[]>(() => {
    return fleetMachines.map((fm) => {
      const live = machines[fm.telemetryId || fm.id];
      if (live) return live;
      return {
        eqp_id: fm.id,
        status: fm.hasLiveFeed ? 0 : 5,
        temperature: null,
        humidity: null,
        resist_dosage: null,
        scan_speed: null,
        air_vacuum: null,
        thickness: null,
        board_no: null,
        total_board: null,
        total_time: null,
        mo: null,
        fpn: null,
        layer_name: null,
        last_seen: null,
      };
    });
  }, [fleetMachines, machines]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080c16]">
      {/* Top Header Bar */}
      <TopBar
        connectionState={connectionState}
        retryCount={retryCount}
        machines={fleetStatusList}
        totalFleetCount={fleetMachines.length}
        activeFilter={activeFilter}
        onSelectFilter={handleSelectFilter}
        panzoomControls={panzoomRef.current}
        onRefresh={refreshSnapshot}
      />

      {/* Process Filter Bar Toolbar */}
      <ProcessFilterBar
        activeFilter={activeFilter}
        onSelectFilter={handleSelectFilter}
        counts={filterCounts}
      />

      {/* Main Floorplan Canvas */}
      <main className="flex-1 relative overflow-hidden bg-[#080c16]">
        {/* Dev Layout Toolbar: enabled via URL ?dev=true or feature flag */}
        {ENABLE_DEV_LAYOUT_EDITOR && (
          <DevLayoutToolbar
            isEditMode={isEditMode}
            onToggleEditMode={() => {
              setIsEditMode(!isEditMode);
              if (isEditMode) clearSelection();
            }}
            onSave={saveLayoutToServer}
            onReset={resetLayout}
            onExport={exportFleetCode}
            isDirty={isDirty}
            saveStatus={saveStatus}
            selectedIds={selectedIds}
            selectedMachine={primarySelectedEditMachine}
            onSelectAllInZone={(proc) => selectAllInProcess(proc, fleetMachines)}
            onClearSelection={clearSelection}
            onAlign={(type) => alignSelected(type, fleetMachines)}
            onUpdateSize={updateMachineSize}
            onApplySizeToZone={applySizeToProcess}
            onRenameMachine={renameMachine}
            onDeleteMachine={deleteMachine}
            onDeleteSelected={deleteSelectedMachines}
            onAddMachine={handleAddMachine}
            getViewCenter={() => panzoomRef.current?.getViewCenter?.() ?? { x: 1600, y: 860 }}
            draggingMachineInfo={draggingInfo}
          />
        )}

        <FloorplanSVG
          ref={panzoomRef}
          machines={machines}
          selectedId={selectedMachineId}
          activeFilter={activeFilter}
          fleetMachines={fleetMachines}
          isEditMode={isEditMode}
          selectedEditMachineIds={selectedIds}
          onSelectMachine={handleSelectMachine}
          onToggleSelectEditMachine={toggleSelectMachine}
          onSelectByMarquee={selectByMarquee}
          onClearSelection={clearSelection}
          onUpdatePosition={updateMachinePosition}
          onMoveGroupPositions={moveGroupPositions}
          onUpdateSize={updateMachineSize}
          onDraggingChange={setDraggingInfo}
        />

        {/* Active Alarm Banner */}
        <AlarmPanel
          alarms={visibleAlarms}
          fleetMachines={fleetMachines}
          onFocusMachine={handleFocusMachine}
        />

        {/* Machine Detail Slide-Over Inspection Drawer with Safe Operator Mapping */}
        {(selectedTelemetry || selectedMachineDef) && !isEditMode && (
          <MachineDetailPopup
            machine={selectedTelemetry}
            machineDef={selectedMachineDef}
            onClose={handleCloseDrawer}
            onFocusMachine={(x, y, id) => handleFocusMachine(x, y, id)}
            onSaveMapping={handleSaveMachineMapping}
            availableDbMachines={machineList}
            fleetMachines={fleetMachines}
          />
        )}
      </main>

      {/* Bottom Status Bar */}
      <StatusBar lastSeen={lastSeen} />
    </div>
  );
};

export default App;
