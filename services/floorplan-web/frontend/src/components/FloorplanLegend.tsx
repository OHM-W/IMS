import React, { useState, useCallback } from 'react';
import { PanzoomObject } from '@panzoom/panzoom';
import { SVG_VIEWBOX } from '../constants/fleet';

export interface FloorplanLegendProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  panzoomInstanceRef: React.RefObject<PanzoomObject | null>;
}

export const FloorplanLegend: React.FC<FloorplanLegendProps> = ({
  containerRef,
  panzoomInstanceRef,
}) => {
  // Draggable Legend Position with LocalStorage memory
  const [legendPos, setLegendPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('ims_floorplan_legend_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return { x: 2950, y: 1370 };
  });

  const [isDraggingLegend, setIsDraggingLegend] = useState(false);

  const handleLegendPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      panzoomInstanceRef.current?.setOptions({ disablePan: true });

      const rect = container.getBoundingClientRect();
      const svgRatioX = (rect.width || 1200) / SVG_VIEWBOX.width;
      const svgRatioY = (rect.height || 600) / SVG_VIEWBOX.height;
      const baseScale = Math.min(svgRatioX, svgRatioY);
      const panzoomScale = panzoomInstanceRef.current?.getScale() || 1;
      const effectiveScale = baseScale * panzoomScale;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const initialPos = { ...legendPos };

      setIsDraggingLegend(true);

      const handlePointerMove = (moveEvt: PointerEvent) => {
        const deltaX = (moveEvt.clientX - startClientX) / effectiveScale;
        const deltaY = (moveEvt.clientY - startClientY) / effectiveScale;

        const nextX = Math.round(
          Math.max(50, Math.min(SVG_VIEWBOX.width - 250, initialPos.x + deltaX))
        );
        const nextY = Math.round(
          Math.max(50, Math.min(SVG_VIEWBOX.height - 280, initialPos.y + deltaY))
        );
        setLegendPos({ x: nextX, y: nextY });
      };

      const handlePointerUp = () => {
        setIsDraggingLegend(false);
        panzoomInstanceRef.current?.setOptions({ disablePan: false });
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);

        setLegendPos((latest) => {
          try {
            localStorage.setItem('ims_floorplan_legend_pos', JSON.stringify(latest));
          } catch {}
          return latest;
        });
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [containerRef, panzoomInstanceRef, legendPos]
  );

  return (
    <g
      id="scada-legend-box"
      transform={`translate(${legendPos.x}, ${legendPos.y})`}
      onPointerDown={handleLegendPointerDown}
      className={`draggable-node select-none cursor-move transition-opacity ${
        isDraggingLegend ? 'opacity-90' : 'hover:opacity-100'
      }`}
    >
      {/* Matte Slate Panel Background */}
      <rect
        width="200"
        height="240"
        rx="4"
        fill="#0b101b"
        fillOpacity="0.96"
        stroke="#1e293b"
        strokeWidth="1"
      />

      {/* Header */}
      <text
        x="15"
        y="24"
        fill="#94a3b8"
        fontSize="11"
        fontWeight="600"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        letterSpacing="1"
      >
        STATUS LEGEND
      </text>
      <line x1="15" y1="32" x2="185" y2="32" stroke="#1e293b" strokeWidth="1" />

      {/* 1. RUN */}
      <rect x="15" y="44" width="12" height="12" rx="2" fill="#10b981" />
      <text x="36" y="54" fill="#e2e8f0" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
        RUN
      </text>
      <text x="185" y="54" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="end">
        ACTIVE
      </text>

      {/* 2. IDLE */}
      <rect x="15" y="74" width="12" height="12" rx="2" fill="#f59e0b" />
      <text x="36" y="84" fill="#e2e8f0" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
        IDLE
      </text>
      <text x="185" y="84" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="end">
        STANDBY
      </text>

      {/* 3. ALARM */}
      <rect x="15" y="104" width="12" height="12" rx="2" fill="#ef4444" />
      <text x="36" y="114" fill="#f87171" fontSize="11" fontWeight="700" fontFamily="ui-monospace, monospace">
        ALARM
      </text>
      <text x="185" y="114" fill="#ef4444" fontSize="10" fontWeight="600" fontFamily="ui-monospace, monospace" textAnchor="end">
        CRITICAL
      </text>

      {/* 4. STOP / PM */}
      <rect x="15" y="134" width="12" height="12" rx="2" fill="#06b6d4" />
      <text x="36" y="144" fill="#e2e8f0" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
        STOP / PM
      </text>
      <text x="185" y="144" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="end">
        SERVICE
      </text>

      {/* 5. OFF */}
      <rect x="15" y="164" width="12" height="12" rx="2" fill="#64748b" />
      <text x="36" y="174" fill="#94a3b8" fontSize="11" fontWeight="500" fontFamily="ui-monospace, monospace">
        OFF
      </text>
      <text x="185" y="174" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="end">
        NO SYNC
      </text>

      {/* 6. UNDEFINE */}
      <rect
        x="15"
        y="194"
        width="12"
        height="12"
        rx="2"
        fill="none"
        stroke="#475569"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <text x="36" y="204" fill="#64748b" fontSize="11" fontWeight="500" fontFamily="ui-monospace, monospace">
        UNMAPPED
      </text>
      <text x="185" y="204" fill="#475569" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="end">
        STATIC
      </text>
    </g>
  );
};
