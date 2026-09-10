import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';
import { LdiMachine, PanzoomControls } from '../types/ldi';
import { MachineDef, ProcessCategory, FleetFilterOption } from '../types/fleet';
import {
  FLEET_MACHINES,
  ZONE_MAP,
  CAMERA_FOCUS_PRESETS,
  SVG_VIEWBOX,
} from '../constants/fleet';
import { MachineNode } from './MachineNode';
import { FloorplanLegend } from './FloorplanLegend';

export interface FloorplanPanzoomControls extends PanzoomControls {
  focusProcess?: (filter: FleetFilterOption) => void;
  zoomToZone?: (zoneId: ProcessCategory) => void;
  getViewCenter?: () => { x: number; y: number };
  focusBoundingBox?: (
    bounds: { xMin: number; yMin: number; xMax: number; yMax: number },
    zoom?: number
  ) => void;
}

export interface FloorplanSVGProps {
  machines: Record<string, LdiMachine>;
  selectedId: string | null;
  activeFilter?: FleetFilterOption;
  fleetMachines?: MachineDef[];
  isEditMode?: boolean;
  selectedEditMachineIds?: string[];
  onSelectMachine: (eqpId: string) => void;
  onToggleSelectEditMachine?: (id: string, isMulti: boolean) => void;
  onSelectByMarquee?: (ids: string[], isAdditive: boolean) => void;
  onClearSelection?: () => void;
  onUpdatePosition?: (id: string, x: number, y: number) => void;
  onMoveGroupPositions?: (initialPositions: Record<string, { x: number; y: number }>, deltaX: number, deltaY: number) => void;
  onUpdateSize?: (id: string, width: number, height: number) => void;
  onDraggingChange?: (info: { id: string; name: string; x: number; y: number; w?: number; h?: number; count?: number } | null) => void;
}

const createPanzoom = (elem: HTMLElement | SVGElement, options?: any): PanzoomObject => {
  const fn: any = (Panzoom as any)?.default || Panzoom;
  if (typeof fn === 'function') {
    try {
      return fn(elem, options);
    } catch {
      // fallback in headless testing environment
    }
  }
  return {
    destroy: () => {},
    reset: () => {},
    zoom: () => {},
    zoomWithWheel: () => {},
    pan: () => ({ x: 0, y: 0 }),
    getScale: () => 1,
    getPan: () => ({ x: 0, y: 0 }),
    setOptions: () => {},
  } as any;
};

export const FloorplanSVG = forwardRef<FloorplanPanzoomControls, FloorplanSVGProps>(
  (
    {
      machines,
      selectedId,
      activeFilter = 'ALL',
      fleetMachines = FLEET_MACHINES,
      isEditMode = false,
      selectedEditMachineIds = [],
      onSelectMachine,
      onToggleSelectEditMachine,
      onSelectByMarquee,
      onClearSelection,
      onUpdatePosition,
      onMoveGroupPositions,
      onUpdateSize,
      onDraggingChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRootRef = useRef<SVGSVGElement>(null);
    const contentRef = useRef<SVGGElement>(null);
    const panzoomInstanceRef = useRef<PanzoomObject | null>(null);

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    // Initialize Panzoom
    useEffect(() => {
      if (!contentRef.current || !containerRef.current) return;

      const panzoom = createPanzoom(contentRef.current, {
        maxScale: 6.0,
        minScale: 0.35,
        step: 0.25,
        cursor: 'grab',
        excludeClass: 'draggable-node',
      });

      panzoomInstanceRef.current = panzoom;

      const container = containerRef.current;
      const handleWheel = (event: WheelEvent) => {
        panzoom.zoomWithWheel(event);
      };

      container.addEventListener('wheel', handleWheel, { passive: false });

      setTimeout(() => {
        panzoom.reset();
      }, 100);

      return () => {
        container.removeEventListener('wheel', handleWheel);
        panzoom.destroy();
      };
    }, []);

    // Group / Single Machine Drag Handler
    const handleNodePointerDown = useCallback(
      (e: React.PointerEvent, machine: MachineDef) => {
        if (!isEditMode) return;

        e.stopPropagation();
        e.preventDefault();

        const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;

        // If clicking with Shift/Ctrl, toggle selection without dragging
        if (isMultiKey) {
          onToggleSelectEditMachine?.(machine.id, true);
          return;
        }

        // Determine which machines will move
        const movingIds = selectedEditMachineIds.includes(machine.id)
          ? selectedEditMachineIds
          : [machine.id];

        if (!selectedEditMachineIds.includes(machine.id)) {
          onToggleSelectEditMachine?.(machine.id, false);
        }

        const container = containerRef.current;
        if (!container) return;

        panzoomInstanceRef.current?.setOptions({ disablePan: true });

        const rect = container.getBoundingClientRect();
        const svgRatioX = (rect.width || 1200) / SVG_VIEWBOX.width;
        const svgRatioY = (rect.height || 600) / SVG_VIEWBOX.height;
        const baseScale = Math.min(svgRatioX, svgRatioY);
        const currentZoom = panzoomInstanceRef.current?.getScale() || 1.0;
        const effectiveScale = (baseScale > 0 ? baseScale : 1.0) * currentZoom;

        const startX = e.clientX;
        const startY = e.clientY;

        // Capture initial positions of all moving machines
        const initialPositions: Record<string, { x: number; y: number }> = {};
        for (const m of fleetMachines) {
          if (movingIds.includes(m.id)) {
            initialPositions[m.id] = { x: m.svgX, y: m.svgY };
          }
        }

        setDraggingId(machine.id);

        const onPointerMove = (moveE: PointerEvent) => {
          moveE.stopPropagation();
          moveE.preventDefault();

          const deltaScreenX = moveE.clientX - startX;
          const deltaScreenY = moveE.clientY - startY;

          const deltaSvgX = deltaScreenX / effectiveScale;
          const deltaSvgY = deltaScreenY / effectiveScale;

          if (movingIds.length > 1 && onMoveGroupPositions) {
            onMoveGroupPositions(initialPositions, deltaSvgX, deltaSvgY);
          } else if (onUpdatePosition) {
            const newX = Math.round((initialPositions[machine.id]?.x || machine.svgX) + deltaSvgX);
            const newY = Math.round((initialPositions[machine.id]?.y || machine.svgY) + deltaSvgY);
            onUpdatePosition(machine.id, newX, newY);
          }

          if (onDraggingChange) {
            onDraggingChange({
              id: machine.id,
              name: movingIds.length > 1 ? `${movingIds.length} Machines` : machine.name,
              x: Math.round((initialPositions[machine.id]?.x || machine.svgX) + deltaSvgX),
              y: Math.round((initialPositions[machine.id]?.y || machine.svgY) + deltaSvgY),
              count: movingIds.length,
            });
          }
        };

        const onPointerUp = (upE: PointerEvent) => {
          upE.stopPropagation();
          setDraggingId(null);
          panzoomInstanceRef.current?.setOptions({ disablePan: false });

          if (onDraggingChange) {
            onDraggingChange(null);
          }
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerUp, true);
        };

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
      },
      [isEditMode, selectedEditMachineIds, fleetMachines, onToggleSelectEditMachine, onMoveGroupPositions, onUpdatePosition, onDraggingChange]
    );

    // Marquee Box Selection on Empty Space Drag
    const handleCanvasPointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (!isEditMode) return;

        const isMultiKey = e.shiftKey || e.ctrlKey;
        if (!isMultiKey && (e.target as HTMLElement).tagName !== 'svg' && (e.target as HTMLElement).tagName !== 'image') {
          return;
        }

        const container = containerRef.current;
        if (!container) return;

        panzoomInstanceRef.current?.setOptions({ disablePan: true });

        const rect = container.getBoundingClientRect();
        const svgRatioX = (rect.width || 1200) / SVG_VIEWBOX.width;
        const svgRatioY = (rect.height || 600) / SVG_VIEWBOX.height;
        const baseScale = Math.min(svgRatioX, svgRatioY);
        const currentZoom = panzoomInstanceRef.current?.getScale() || 1.0;
        const effectiveScale = (baseScale > 0 ? baseScale : 1.0) * currentZoom;

        const pan = panzoomInstanceRef.current?.getPan() || { x: 0, y: 0 };
        const originX = (e.clientX - rect.left - pan.x) / effectiveScale;
        const originY = (e.clientY - rect.top - pan.y) / effectiveScale;

        setMarqueeBox({ x: originX, y: originY, width: 0, height: 0 });

        const onPointerMove = (moveE: PointerEvent) => {
          const currentX = (moveE.clientX - rect.left - pan.x) / effectiveScale;
          const currentY = (moveE.clientY - rect.top - pan.y) / effectiveScale;

          const boxX = Math.min(originX, currentX);
          const boxY = Math.min(originY, currentY);
          const boxW = Math.abs(currentX - originX);
          const boxH = Math.abs(currentY - originY);

          setMarqueeBox({ x: boxX, y: boxY, width: boxW, height: boxH });
        };

        const onPointerUp = (upE: PointerEvent) => {
          panzoomInstanceRef.current?.setOptions({ disablePan: false });

          const endX = (upE.clientX - rect.left - pan.x) / effectiveScale;
          const endY = (upE.clientY - rect.top - pan.y) / effectiveScale;

          const boxX = Math.min(originX, endX);
          const boxY = Math.min(originY, endY);
          const boxW = Math.abs(endX - originX);
          const boxH = Math.abs(endY - originY);

          if (boxW > 10 && boxH > 10) {
            const enclosedIds = fleetMachines
              .filter((m) => {
                const mW = m.cardWidth || 38;
                const mH = m.cardHeight || 22;
                return (
                  m.svgX + mW >= boxX &&
                  m.svgX <= boxX + boxW &&
                  m.svgY + mH >= boxY &&
                  m.svgY <= boxY + boxH
                );
              })
              .map((m) => m.id);

            onSelectByMarquee?.(enclosedIds, isMultiKey);
          } else if (!isMultiKey) {
            onClearSelection?.();
          }

          setMarqueeBox(null);
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerUp, true);
        };

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
      },
      [isEditMode, fleetMachines, onSelectByMarquee, onClearSelection]
    );

    // Interactive Drag-to-Resize Corner Handle
    const handleResizePointerDown = useCallback(
      (e: React.PointerEvent, machine: MachineDef) => {
        if (!isEditMode) return;

        e.stopPropagation();
        e.preventDefault();

        const container = containerRef.current;
        if (!container) return;

        panzoomInstanceRef.current?.setOptions({ disablePan: true });

        const rect = container.getBoundingClientRect();
        const svgRatioX = (rect.width || 1200) / SVG_VIEWBOX.width;
        const svgRatioY = (rect.height || 600) / SVG_VIEWBOX.height;
        const baseScale = Math.min(svgRatioX, svgRatioY);
        const currentZoom = panzoomInstanceRef.current?.getScale() || 1.0;
        const effectiveScale = (baseScale > 0 ? baseScale : 1.0) * currentZoom;

        const startX = e.clientX;
        const startY = e.clientY;
        const initW = machine.cardWidth ?? (machine.isCompact ? 38 : 80);
        const initH = machine.cardHeight ?? (machine.isCompact ? 22 : 50);

        const onPointerMove = (moveE: PointerEvent) => {
          moveE.stopPropagation();
          moveE.preventDefault();

          const deltaScreenX = moveE.clientX - startX;
          const deltaScreenY = moveE.clientY - startY;

          const deltaSvgW = deltaScreenX / effectiveScale;
          const deltaSvgH = deltaScreenY / effectiveScale;

          const newW = Math.max(16, Math.min(300, Math.round(initW + deltaSvgW)));
          const newH = Math.max(12, Math.min(200, Math.round(initH + deltaSvgH)));

          if (onUpdateSize) {
            onUpdateSize(machine.id, newW, newH);
          }
          if (onDraggingChange) {
            onDraggingChange({
              id: machine.id,
              name: machine.name,
              x: machine.svgX,
              y: machine.svgY,
              w: newW,
              h: newH,
            });
          }
        };

        const onPointerUp = (upE: PointerEvent) => {
          upE.stopPropagation();
          panzoomInstanceRef.current?.setOptions({ disablePan: false });

          if (onDraggingChange) {
            onDraggingChange(null);
          }
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerUp, true);
        };

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
      },
      [isEditMode, onUpdateSize, onDraggingChange]
    );

    // Camera Navigation Helper: Centers targetX, targetY in SVG viewBox (3200x1550)
    const applyCameraTransform = (targetX: number, targetY: number, zoomLevel: number) => {
      if (!panzoomInstanceRef.current) return;

      const centerX = SVG_VIEWBOX.width / 2;
      const centerY = SVG_VIEWBOX.height / 2;

      // Panzoom transform on <g> is: scale(zoom) translate(panX px, panY px) with origin (0, 0)
      // To center target (targetX, targetY) at the viewBox center (centerX, centerY):
      // zoom * (targetX + panX) = centerX  =>  panX = centerX / zoom - targetX
      const panX = Math.round(centerX / zoomLevel - targetX);
      const panY = Math.round(centerY / zoomLevel - targetY);

      panzoomInstanceRef.current.zoom(zoomLevel, { animate: true });
      panzoomInstanceRef.current.pan(panX, panY, { animate: true, force: true });
    };

    // Imperative Camera Controls
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          panzoomInstanceRef.current?.zoomIn();
        },
        zoomOut: () => {
          panzoomInstanceRef.current?.zoomOut();
        },
        resetView: () => {
          panzoomInstanceRef.current?.reset({ animate: true });
        },
        zoomToFit: () => {
          panzoomInstanceRef.current?.reset({ animate: true });
        },
        zoomToMachine: (svgX: number, svgY: number, zoomLevel = 2.2) => {
          applyCameraTransform(svgX, svgY, zoomLevel);
        },
        getViewCenter: () => {
          if (!panzoomInstanceRef.current) {
            return { x: 1600, y: 775 };
          }
          const pan = panzoomInstanceRef.current.getPan() || { x: 0, y: 0 };
          const zoom = panzoomInstanceRef.current.getScale() || 1.0;

          const centerX = SVG_VIEWBOX.width / 2;
          const centerY = SVG_VIEWBOX.height / 2;

          const svgX = Math.round(centerX / zoom - pan.x);
          const svgY = Math.round(centerY / zoom - pan.y);
          return {
            x: Math.max(50, Math.min(SVG_VIEWBOX.width - 100, svgX)),
            y: Math.max(50, Math.min(SVG_VIEWBOX.height - 100, svgY)),
          };
        },
        focusCleanroom: () => {
          const cleanroomPreset = CAMERA_FOCUS_PRESETS.LASER_DRILLING || {
            x: 2440,
            y: 665,
            zoom: 2.2,
          };
          applyCameraTransform(cleanroomPreset.x, cleanroomPreset.y, cleanroomPreset.zoom);
        },
        focusProcess: (filter: FleetFilterOption) => {
          if (filter === 'ALL') {
            panzoomInstanceRef.current?.reset({ animate: true });
            return;
          }

          // Dynamically compute bounding box from active fleetMachines
          const matching = fleetMachines.filter((m) =>
            filter === 'DRILLING'
              ? m.process === 'DRILLING_MAIN' || m.process === 'DRILLING_HOLD'
              : m.process === filter
          );

          if (matching.length > 0) {
            const minX = Math.min(...matching.map((m) => m.svgX));
            const maxX = Math.max(...matching.map((m) => m.svgX + (m.cardWidth || 40)));
            const minY = Math.min(...matching.map((m) => m.svgY));
            const maxY = Math.max(...matching.map((m) => m.svgY + (m.cardHeight || 26)));

            const centerX = Math.round((minX + maxX) / 2);
            const centerY = Math.round((minY + maxY) / 2);

            const preset = CAMERA_FOCUS_PRESETS[filter];
            const zoom = preset?.zoom ?? (matching.length <= 5 ? 2.4 : 1.8);
            applyCameraTransform(centerX, centerY, zoom);
          } else {
            const preset = CAMERA_FOCUS_PRESETS[filter] || {
              x: SVG_VIEWBOX.width / 2,
              y: SVG_VIEWBOX.height / 2,
              zoom: 1.0,
            };
            applyCameraTransform(preset.x, preset.y, preset.zoom);
          }
        },
        zoomToZone: (zoneId: ProcessCategory) => {
          const zone = ZONE_MAP[zoneId];
          if (zone) {
            applyCameraTransform(zone.focusView.x, zone.focusView.y, zone.focusView.zoom);
          }
        },
        focusBoundingBox: (bounds, zoom = 1.8) => {
          const centerX = (bounds.xMin + bounds.xMax) / 2;
          const centerY = (bounds.yMin + bounds.yMax) / 2;
          applyCameraTransform(centerX, centerY, zoom);
        },
      }),
      [fleetMachines]
    );

    const isMachineDimmed = (machine: MachineDef): boolean => {
      if (activeFilter === 'ALL') return false;
      if (activeFilter === 'DRILLING') {
        return machine.process !== 'DRILLING_MAIN' && machine.process !== 'DRILLING_HOLD';
      }
      return machine.process !== activeFilter;
    };

    return (
      <div
        ref={containerRef}
        data-testid="floorplan-svg-container"
        onPointerDown={handleCanvasPointerDown}
        className={`w-full h-full relative overflow-hidden bg-[#080c16] select-none ${
          isEditMode ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <svg
          ref={svgRootRef}
          data-testid="floorplan-svg-root"
          viewBox={SVG_VIEWBOX.viewBox}
          className="w-full h-full pointer-events-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Panzoom Transformable Content Group */}
          <g id="panzoom-content" ref={contentRef}>
            {/* Background Vector CAD Floorplan Image */}
            <image
              href="/floorplan.svg"
              x="0"
              y="0"
              width={SVG_VIEWBOX.width}
              height={SVG_VIEWBOX.height}
              preserveAspectRatio="xMidYMid meet"
              opacity="0.9"
            />

            {/* Complete 250 Machine Fleet Overlays via foreignObject */}
            <g id="machine-nodes-overlay">
              {fleetMachines.map((machine) => {
                const telemetry = machine.telemetryId
                  ? machines[machine.telemetryId]
                  : machines[machine.id];
                const isSelected =
                  selectedId === machine.id ||
                  (machine.telemetryId ? selectedId === machine.telemetryId : false);
                const isDimmed = isMachineDimmed(machine);
                const isBeingDragged = draggingId === machine.id;
                const isEditSelected = selectedEditMachineIds.includes(machine.id);

                const width = machine.cardWidth ?? (machine.isCompact ? 38 : 80);
                const height = machine.cardHeight ?? (machine.isCompact ? 22 : 50);

                return (
                  <foreignObject
                    key={machine.id}
                    x={machine.svgX}
                    y={machine.svgY}
                    width={width}
                    height={height}
                    style={{ overflow: 'visible' }}
                    className={`draggable-node ${isEditMode ? 'cursor-move' : ''}`}
                  >
                    <div
                      onPointerDown={(e) => handleNodePointerDown(e, machine)}
                      className={`draggable-node w-full h-full relative touch-none select-none ${
                        isBeingDragged ? 'z-50 scale-105 ring-2 ring-amber-400 opacity-90' : ''
                      } ${isEditSelected && isEditMode ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-[#080c16] z-40' : ''}`}
                    >
                      <MachineNode
                        coord={machine}
                        telemetry={telemetry}
                        isSelected={isSelected}
                        isDimmed={isDimmed}
                        onSelect={onSelectMachine}
                      />

                      {/* Edit Mode Visual Indicators */}
                      {isEditMode && (
                        <>
                          <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-slate-900 pointer-events-none ${
                            isEditSelected ? 'bg-cyan-400' : 'bg-amber-400'
                          }`} />
                          
                          {/* Corner Resize Handle on Bottom-Right */}
                          <div
                            onPointerDown={(e) => handleResizePointerDown(e, machine)}
                            title="Drag to resize card"
                            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-400 hover:bg-cyan-300 border-2 border-slate-950 shadow-md cursor-se-resize flex items-center justify-center text-[8px] text-slate-950 font-black select-none z-50 hover:scale-125 transition-transform"
                          >
                            ↘
                          </div>
                        </>
                      )}
                    </div>
                  </foreignObject>
                );
              })}
            </g>

            {/* Live Marquee Drag Box Selection Overlay */}
            {isEditMode && marqueeBox && (
              <rect
                x={marqueeBox.x}
                y={marqueeBox.y}
                width={marqueeBox.width}
                height={marqueeBox.height}
                fill="#38bdf8"
                fillOpacity="0.15"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="pointer-events-none"
              />
            )}

            {/* High-Performance SCADA Status Legend HUD */}
            <FloorplanLegend
              containerRef={containerRef}
              panzoomInstanceRef={panzoomInstanceRef}
            />
          </g>
        </svg>
      </div>
    );
  }
);

FloorplanSVG.displayName = 'FloorplanSVG';

export default FloorplanSVG;
