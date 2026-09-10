import { useState, useEffect, useCallback, useMemo } from 'react';
import { FLEET_MACHINES } from '../constants/fleet';
import { MachineDef, ProcessCategory } from '../types/fleet';

const STORAGE_KEY = 'ims_custom_fleet_crud_state';

interface StoredFleetState {
  overrides: Record<string, Partial<MachineDef>>;
  added: MachineDef[];
  deletedIds: string[];
}

export function useFleetLayout() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [overrides, setOverrides] = useState<Record<string, Partial<MachineDef>>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: StoredFleetState = JSON.parse(saved);
        return parsed.overrides || {};
      }
    } catch (e) {
      console.error('Failed to load fleet state:', e);
    }
    return {};
  });

  const [addedMachines, setAddedMachines] = useState<MachineDef[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: StoredFleetState = JSON.parse(saved);
        return parsed.added || [];
      }
    } catch (e) {
      console.error('Failed to load added machines:', e);
    }
    return [];
  });

  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: StoredFleetState = JSON.parse(saved);
        return parsed.deletedIds || [];
      }
    } catch (e) {
      console.error('Failed to load deleted machines:', e);
    }
    return [];
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Sync state to localStorage
  const persistLocally = useCallback(
    (
      newOverrides: Record<string, Partial<MachineDef>>,
      newAdded: MachineDef[],
      newDeleted: string[]
    ) => {
      try {
        const state: StoredFleetState = {
          overrides: newOverrides,
          added: newAdded,
          deletedIds: newDeleted,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    },
    []
  );

  // Load from server on mount
  useEffect(() => {
    fetch('/api/layout')
      .then((res) => res.json())
      .then((data) => {
        if (data.custom) {
          if (Array.isArray(data.deletedIds) && data.deletedIds.length > 0) {
            setDeletedIds(data.deletedIds);
          }
          if (Array.isArray(data.machines) && data.machines.length > 0) {
            const serverOverrides: Record<string, Partial<MachineDef>> = {};
            const serverAdded: MachineDef[] = [];
            const defaultIdSet = new Set(FLEET_MACHINES.map((m) => m.id));

            for (const item of data.machines) {
              if (defaultIdSet.has(item.id)) {
                serverOverrides[item.id] = {
                  svgX: item.svgX,
                  svgY: item.svgY,
                  cardWidth: item.cardWidth,
                  cardHeight: item.cardHeight,
                  name: item.name,
                  telemetryId: item.telemetryId,
                  hasLiveFeed: item.hasLiveFeed ?? Boolean(item.telemetryId),
                  process: item.process,
                };
              } else {
                serverAdded.push({
                  id: item.id,
                  name: item.name || item.id,
                  process: item.process || 'DRILLING_MAIN',
                  processGroup: item.processGroup || 'CUSTOM',
                  telemetryId: item.telemetryId,
                  svgX: item.svgX,
                  svgY: item.svgY,
                  cardWidth: item.cardWidth || 38,
                  cardHeight: item.cardHeight || 22,
                  isCompact: item.isCompact ?? true,
                  hasLiveFeed: item.hasLiveFeed ?? Boolean(item.telemetryId),
                });
              }
            }
            setOverrides((prev) => ({ ...prev, ...serverOverrides }));
            setAddedMachines((prev) => (serverAdded.length > 0 ? serverAdded : prev));
          }
        }
      })
      .catch((err) => {
        console.warn('Could not fetch server layout:', err);
      });
  }, []);

  // Selection toggle
  const toggleSelectMachine = useCallback((id: string, isMulti: boolean) => {
    setSelectedIds((prev) => {
      if (isMulti) {
        return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      }
      return [id];
    });
  }, []);

  const selectAllInProcess = useCallback((process: ProcessCategory, machinesList: MachineDef[]) => {
    const ids = machinesList.filter((m) => m.process === process).map((m) => m.id);
    setSelectedIds(ids);
  }, []);

  const selectByMarquee = useCallback((ids: string[], isAdditive: boolean) => {
    setSelectedIds((prev) => {
      if (isAdditive) {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      }
      return ids;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Move multiple machines together by delta (X, Y)
  const moveGroupPositions = useCallback(
    (initialPositions: Record<string, { x: number; y: number }>, deltaX: number, deltaY: number) => {
      setOverrides((prev) => {
        const next = { ...prev };
        for (const [id, initPos] of Object.entries(initialPositions)) {
          const newX = Math.round((initPos.x + deltaX) / 2) * 2;
          const newY = Math.round((initPos.y + deltaY) / 2) * 2;
          next[id] = { ...next[id], svgX: newX, svgY: newY };
        }
        persistLocally(next, addedMachines, deletedIds);
        return next;
      });
      setIsDirty(true);
    },
    [addedMachines, deletedIds, persistLocally]
  );

  // Update a single machine's position
  const updateMachinePosition = useCallback(
    (id: string, x: number, y: number) => {
      const snappedX = Math.round(x / 2) * 2;
      const snappedY = Math.round(y / 2) * 2;

      setOverrides((prev) => {
        const updated = {
          ...prev,
          [id]: { ...prev[id], svgX: snappedX, svgY: snappedY },
        };
        persistLocally(updated, addedMachines, deletedIds);
        return updated;
      });
      setIsDirty(true);
    },
    [addedMachines, deletedIds, persistLocally]
  );

  // Update a single machine's size
  const updateMachineSize = useCallback(
    (id: string, width: number, height: number) => {
      const clampedW = Math.max(16, Math.min(300, Math.round(width)));
      const clampedH = Math.max(12, Math.min(200, Math.round(height)));

      setOverrides((prev) => {
        const updated = {
          ...prev,
          [id]: { ...prev[id], cardWidth: clampedW, cardHeight: clampedH },
        };
        persistLocally(updated, addedMachines, deletedIds);
        return updated;
      });
      setIsDirty(true);
    },
    [addedMachines, deletedIds, persistLocally]
  );

  // Rename machine / update telemetry ID / update process
  const renameMachine = useCallback(
    (id: string, newName: string, newTelemetryId?: string, newProcess?: ProcessCategory) => {
      const targetTelemetryId =
        newTelemetryId !== undefined
          ? newTelemetryId.trim() === ''
            ? ''
            : newTelemetryId.trim()
          : undefined;
      const targetHasLiveFeed = Boolean(targetTelemetryId);

      setOverrides((prev) => {
        const updated = {
          ...prev,
          [id]: {
            ...prev[id],
            name: newName,
            telemetryId: targetTelemetryId,
            hasLiveFeed: targetHasLiveFeed,
            ...(newProcess ? { process: newProcess } : {}),
          },
        };
        persistLocally(updated, addedMachines, deletedIds);
        return updated;
      });

      setAddedMachines((prev) => {
        const updated = prev.map((m) =>
          m.id === id
            ? {
                ...m,
                name: newName,
                telemetryId: targetTelemetryId || undefined,
                hasLiveFeed: targetHasLiveFeed,
                ...(newProcess ? { process: newProcess } : {}),
              }
            : m
        );
        persistLocally(overrides, updated, deletedIds);
        return updated;
      });

      setIsDirty(true);
    },
    [overrides, addedMachines, deletedIds, persistLocally]
  );

  // Add a brand new machine
  const addMachine = useCallback(
    (newMachine: MachineDef) => {
      const cleanDeleted = deletedIds.filter((d) => d !== newMachine.id && d !== newMachine.name);
      setDeletedIds(cleanDeleted);

      setAddedMachines((prev) => {
        const filtered = prev.filter((m) => m.id !== newMachine.id);
        const updated = [...filtered, newMachine];
        persistLocally(overrides, updated, cleanDeleted);
        return updated;
      });
      setSelectedIds([newMachine.id]);
      setIsDirty(true);
    },
    [overrides, deletedIds, persistLocally]
  );

  // Delete an existing or added machine
  const deleteMachine = useCallback(
    (id: string) => {
      setDeletedIds((prev) => {
        const updated = prev.includes(id) ? prev : [...prev, id];
        persistLocally(overrides, addedMachines, updated);
        return updated;
      });

      setAddedMachines((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        persistLocally(overrides, updated, deletedIds);
        return updated;
      });

      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setIsDirty(true);
    },
    [overrides, addedMachines, deletedIds, persistLocally]
  );

  // Delete all currently selected machines
  const deleteSelectedMachines = useCallback(() => {
    if (selectedIds.length === 0) return;

    setDeletedIds((prev) => {
      const set = new Set([...prev, ...selectedIds]);
      const updated = Array.from(set);
      persistLocally(overrides, addedMachines, updated);
      return updated;
    });

    setAddedMachines((prev) => {
      const updated = prev.filter((m) => !selectedIds.includes(m.id));
      persistLocally(overrides, updated, deletedIds);
      return updated;
    });

    setSelectedIds([]);
    setIsDirty(true);
  }, [selectedIds, overrides, addedMachines, deletedIds, persistLocally]);

  // Apply size to all machines in a specific process/zone
  const applySizeToProcess = useCallback(
    (process: ProcessCategory, width: number, height: number) => {
      const clampedW = Math.max(16, Math.min(300, Math.round(width)));
      const clampedH = Math.max(12, Math.min(200, Math.round(height)));

      setOverrides((prev) => {
        const next = { ...prev };
        for (const m of FLEET_MACHINES) {
          if (m.process === process) {
            next[m.id] = { ...next[m.id], cardWidth: clampedW, cardHeight: clampedH };
          }
        }
        for (const m of addedMachines) {
          if (m.process === process) {
            next[m.id] = { ...next[m.id], cardWidth: clampedW, cardHeight: clampedH };
          }
        }
        persistLocally(next, addedMachines, deletedIds);
        return next;
      });
      setIsDirty(true);
    },
    [addedMachines, deletedIds, persistLocally]
  );

  // Align selected machines
  const alignSelected = useCallback(
    (
      type: 'left' | 'top' | 'distribute-h' | 'distribute-v',
      currentMachines: MachineDef[]
    ) => {
      if (selectedIds.length < 2) return;
      const targets = currentMachines.filter((m) => selectedIds.includes(m.id));
      if (targets.length < 2) return;

      setOverrides((prev) => {
        const next = { ...prev };

        if (type === 'left') {
          const minX = Math.min(...targets.map((m) => m.svgX));
          for (const m of targets) {
            next[m.id] = { ...next[m.id], svgX: minX };
          }
        } else if (type === 'top') {
          const minY = Math.min(...targets.map((m) => m.svgY));
          for (const m of targets) {
            next[m.id] = { ...next[m.id], svgY: minY };
          }
        } else if (type === 'distribute-h') {
          const sorted = [...targets].sort((a, b) => a.svgX - b.svgX);
          const minX = sorted[0].svgX;
          const maxX = sorted[sorted.length - 1].svgX;
          const step = (maxX - minX) / (sorted.length - 1);
          sorted.forEach((m, idx) => {
            next[m.id] = { ...next[m.id], svgX: Math.round(minX + idx * step) };
          });
        } else if (type === 'distribute-v') {
          const sorted = [...targets].sort((a, b) => a.svgY - b.svgY);
          const minY = sorted[0].svgY;
          const maxY = sorted[sorted.length - 1].svgY;
          const step = (maxY - minY) / (sorted.length - 1);
          sorted.forEach((m, idx) => {
            next[m.id] = { ...next[m.id], svgY: Math.round(minY + idx * step) };
          });
        }

        persistLocally(next, addedMachines, deletedIds);
        return next;
      });
      setIsDirty(true);
    },
    [selectedIds, addedMachines, deletedIds, persistLocally]
  );

  // Merge default FLEET_MACHINES, added machines, deleted machines, and overrides
  const fleetMachines = useMemo<MachineDef[]>(() => {
    const deletedSet = new Set(deletedIds);
    const baseList = FLEET_MACHINES.filter((m) => !deletedSet.has(m.id));
    const combined = [...baseList, ...addedMachines];

    return combined.map((m) => {
      const custom = overrides[m.id];
      if (custom) {
        const isExplicitlyUnbound = custom.telemetryId === '';
        const resolvedTelemetryId = isExplicitlyUnbound
          ? undefined
          : custom.telemetryId !== undefined
          ? custom.telemetryId
          : m.telemetryId;

        return {
          ...m,
          name: custom.name ?? m.name,
          telemetryId: resolvedTelemetryId,
          hasLiveFeed:
            custom.hasLiveFeed !== undefined
              ? custom.hasLiveFeed
              : Boolean(resolvedTelemetryId),
          svgX: custom.svgX !== undefined ? custom.svgX : m.svgX,
          svgY: custom.svgY !== undefined ? custom.svgY : m.svgY,
          cardWidth: custom.cardWidth !== undefined ? custom.cardWidth : m.cardWidth,
          cardHeight: custom.cardHeight !== undefined ? custom.cardHeight : m.cardHeight,
        };
      }
      return m;
    });
  }, [deletedIds, addedMachines, overrides]);

  // Save current layout to server storage
  const saveLayoutToServer = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const payload = fleetMachines.map((m) => ({
        id: m.id,
        name: m.name,
        process: m.process,
        processGroup: m.processGroup,
        telemetryId: m.telemetryId,
        svgX: m.svgX,
        svgY: m.svgY,
        cardWidth: m.cardWidth,
        cardHeight: m.cardHeight,
        isCompact: m.isCompact,
        hasLiveFeed: m.hasLiveFeed,
      }));

      await fetch('/api/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machines: payload, deletedIds }),
      });

      setSaveStatus('saved');
      setIsDirty(false);
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Failed to save to server:', e);
      setSaveStatus('idle');
    }
  }, [fleetMachines, deletedIds]);

  // Reset all layout to defaults
  const resetLayout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setOverrides({});
    setAddedMachines([]);
    setDeletedIds([]);
    setIsDirty(false);
    setSelectedIds([]);
    try {
      await fetch('/api/layout', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to reset server layout:', e);
    }
  }, []);

  // Export clean TypeScript code
  const exportFleetCode = useCallback(() => {
    const lines = fleetMachines.map((m) => {
      return `  { id: '${m.id}', name: '${m.name}', process: '${m.process}', svgX: ${m.svgX}, svgY: ${m.svgY}, cardWidth: ${m.cardWidth}, cardHeight: ${m.cardHeight}${m.telemetryId ? `, telemetryId: '${m.telemetryId}'` : ''} },`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
  }, [fleetMachines]);

  return {
    isEditMode,
    setIsEditMode,
    selectedIds,
    setSelectedIds,
    toggleSelectMachine,
    selectAllInProcess,
    selectByMarquee,
    clearSelection,
    fleetMachines,
    addedMachines,
    deletedIds,
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
  };
}
