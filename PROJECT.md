# Project: IMS 1F Factory Floorplan Digital Twin

## Architecture
- **Pipeline Architecture:**
  - Storage: TimescaleDB `public.ldi_data` hypertable
  - Backend: FastAPI + asyncpg (`STATEMENT_CACHE_SIZE=0`) + WebSocket broadcaster (`/ws/ldi`, `/api/snapshot`, `/api/history/{eqp_id}`)
  - Frontend: React 18 + Vite + TypeScript + TailwindCSS + Panzoom (`viewBox="0 0 3200 1550"`)
  - Deployment: Multi-stage Docker container (Node.js 20 build -> Python 3.12 + Nginx 80 + Supervisord), host port `8085:80` on network `ims-internal`.
- **ISA-101 SCADA Design System:**
  - Theme: Dark Mode SCADA (`#080c16` background, crisp architectural zone boundaries, high-contrast glowing machine cards).
  - Standard 6-State Status Tokens:
    - `1 = RUN`: Green (`#00FF87` border & glow)
    - `2 = IDLE`: Amber/Orange (`#FFB800`)
    - `3 = DOWN / ALARM`: Red (`#FF003C` pulsing blink)
    - `4 = INITIAL / PM / STOP`: Cyan/Blue (`#00F2FE`)
    - `0 = OFF`: Slate/Gray (`#64748B`)
    - `5 = UNDEFINE`: White/Muted outline (`#ECEFF1`) for unmonitored equipment.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Multi-Zone Factory Fleet Model | Structured definition of all 10 manufacturing zones and 250 equipment nodes in `constants/fleet.ts` | M1 | ORIGINAL_REQUEST R1 |
| F2 | Mechanical Drilling Matrix | Top (16 cols/102 units), Bottom (8 cols/40 units), Middle (9 cols/56 units) column groups | M1 | ORIGINAL_REQUEST R1 |
| F3 | Peripheral Process Fleets | Drilling Hold (5), Auto Lay Up (8), Bonding (1), Brown Oxide (12), PP (4), Cutting (11), De-Oxide (3), Laser Drilling (5), X-Ray (3) | M1 | ORIGINAL_REQUEST R1 |
| F4 | ISA-101 6-State SCADA Tokens | Canonical colors (`#00FF87`, `#FFB800`, `#FF003C`, `#00F2FE`, `#64748B`, `#ECEFF1`) and status mappings in `constants/colors.ts` | M1 | ORIGINAL_REQUEST R2 |
| F5 | Process Filter Bar Toolbar | Header filter buttons (`ALL`, `DRILLING`, `AUTO LAY UP`, `OXIDE`, `CUTTING`, `LASER DRILLING`, `XRY`) with smooth auto-pan | M2 | ORIGINAL_REQUEST R2 |
| F6 | Multi-Density Floorplan SVG & Zone Overlay | Inline SVG floorplan rendering 250 cards with adaptive node sizing (compact for drilling, standard for peripheral zones) | M2 | ORIGINAL_REQUEST R2 |
| F7 | Interactive Inspection Drawer | Slide-over drawer displaying live telemetry or process specifications with tolerance gauges | M2 | ORIGINAL_REQUEST R2 |
| F8 | TopBar & KPI Summary | NOC clock, live connection badge, 6-state fleet KPI counter, panzoom control bar | M2 | ORIGINAL_REQUEST R2 |
| F9 | Loose-Coupled Data Adapter | Dynamic lookup map binding live DB telemetry or gracefully falling back to Undefine/Off without errors | M3 | ORIGINAL_REQUEST R3 |
| F10 | Backend Telemetry Integration | FastAPI `/ws/ldi`, `/api/snapshot`, `/api/history/{eqp_id}` with PgBouncer compatibility | M3 | ORIGINAL_REQUEST R3 |
| F11 | Docker Containerization (Port 8085) | Multi-stage Dockerfile, Nginx reverse proxy, Supervisord, Compose mapping `8085:80` | M3 | ORIGINAL_REQUEST R4 |
| F12 | Opaque-Box E2E Test Suite | 4-Tier requirement-driven test suite with >=11*N test cases, verifying all features | E2E | ORIGINAL_REQUEST Criteria |
| F13 | Final Integration & Adversarial Hardening | 100% E2E test pass + Tier 5 adversarial verification + live container verification | M4 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Fleet Model & SCADA Constants | `src/constants/fleet.ts`, `src/constants/colors.ts`, `src/types/fleet.ts` | none | DONE |
| M2 | SCADA UI, Floorplan SVG & Inspection Drawer | `src/components/FloorplanSVG.tsx`, `MachineNode.tsx`, `ProcessFilterBar.tsx`, `MachineDetailPopup.tsx`, `TopBar.tsx` | M1 | PLANNED |
| M3 | Loose-Coupled Telemetry Adapter & Docker Deployment | `src/hooks/useLdiWebSocket.ts`, `backend/`, `Dockerfile`, `docker-compose.yaml` (port 8085) | M1, M2 | PLANNED |
| E2E | E2E Testing Track | Independent 4-Tier test suite, test harness, publishing `TEST_READY.md` | none | DONE |
| M4 | Final Integration, Test Pass & Verification | 100% E2E test pass (Tiers 1-4) + Tier 5 adversarial coverage + Docker deployment on port 8085 | M1, M2, M3, E2E | PLANNED |

## Interface Contracts
### `src/types/fleet.ts`
```typescript
export type ProcessCategory =
  | 'DRILLING_HOLD'
  | 'DRILLING_MAIN'
  | 'AUTO_LAY_UP'
  | 'BONDING'
  | 'OXIDE'
  | 'PP_STORAGE'
  | 'CUTTING'
  | 'DE_OXIDE'
  | 'LASER_DRILLING'
  | 'XRY';

export type StatusToken = 'RUN' | 'IDLE' | 'ALARM' | 'STOP' | 'OFF' | 'UNDEFINE';

export interface MachineDef {
  id: string;
  name: string;
  process: ProcessCategory;
  processGroup?: string;
  columnGroup?: string;
  svgX: number;
  svgY: number;
  cardWidth?: number;
  cardHeight?: number;
  isCompact?: boolean;
  hasLiveFeed?: boolean;
  telemetryId?: string;
  specs?: Record<string, string | number>;
}

export interface ZoneDef {
  id: ProcessCategory;
  name: string;
  displayName: string;
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number };
  focusView: { x: number; y: number; zoom: number };
  machineCount: number;
  description: string;
}
```

### `src/constants/colors.ts`
```typescript
export const ISA_STATUS_TOKENS = {
  RUN: { code: 1, label: 'Run', color: '#00FF87', glow: 'rgba(0, 255, 135, 0.4)' },
  IDLE: { code: 2, label: 'Idle', color: '#FFB800', glow: 'rgba(255, 184, 0, 0.4)' },
  ALARM: { code: 3, label: 'Down / Alarm', color: '#FF003C', glow: 'rgba(255, 0, 60, 0.6)' },
  STOP: { code: 4, label: 'Initial / PM / Stop', color: '#00F2FE', glow: 'rgba(0, 242, 254, 0.4)' },
  OFF: { code: 0, label: 'Off', color: '#64748B', glow: 'rgba(100, 116, 139, 0.2)' },
  UNDEFINE: { code: 5, label: 'Undefine', color: '#ECEFF1', glow: 'rgba(236, 239, 241, 0.2)' },
};
```

## Code Layout
- `services/floorplan-web/frontend/src/constants/`: Fleet model, color tokens, layout configs.
- `services/floorplan-web/frontend/src/types/`: TypeScript definitions for fleet, telemetry, and WebSocket.
- `services/floorplan-web/frontend/src/components/`: SVG floorplan, machine nodes, filter toolbar, drawer, topbar.
- `services/floorplan-web/frontend/src/hooks/`: WebSocket client and telemetry adapter hooks.
- `services/floorplan-web/backend/`: FastAPI backend, broadcaster, routes.
- `c:\IMS\docker-compose.yaml`: Service container mappings.
