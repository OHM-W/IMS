# IMS 1F Factory Floorplan Digital Twin — Test Infrastructure & Automation Architecture

> **Author**: `e2e_test_writer_1`  
> **Target Module**: IMS Factory Floorplan 2D Digital Twin (`services/floorplan-web/`)  
> **Status**: Production Ready 4-Tier Test Suite (183 Vitest Frontend Tests + 96 Pytest Backend Tests, 100% Pass Rate)  
> **Authoritative Specs**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `survey_spec_miner_3/analysis.md`, `survey_explorer_1/analysis.md`, `survey_explorer_2/analysis.md`  

---

## 1. Overview & Test Architecture

The IMS 1F Factory Floorplan Digital Twin test infrastructure implements a comprehensive, requirement-driven, 4-Tier test harness covering all 10 factory manufacturing zones, 250 equipment nodes, ISA-101 6-state SCADA visualization, loose-coupled data adapter, and containerized Docker deployment on port `8085`.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        1. Factory Fleet Model & Spatial Hierarchy                 │
│  AutoCAD Floor1.dxf (CAD Bounds: [-935k, 75k]) ---> Normalized SVG (3200x1550)   │
│  10 Manufacturing Zones: Drilling Hold, Drilling Matrix (198), Auto Layup (8),    │
│  Bonding (1), Brown Oxide (12), PP Storage (4), Cutting (11), De-Oxide (3),       │
│  Laser Drilling Cleanroom (5), X-Ray Inspection (3) ---> Total 250 Fleet Units    │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                   2. TimescaleDB Telemetry & Loose-Coupled Data Adapter           │
│  TimescaleDB public.ldi_data  <--- asyncpg Pool (STATEMENT_CACHE_SIZE=0)          │
│  FastAPI WebSocket /ws/ldi    <--- 2.0s Telemetry Cadence (15 Fields)             │
│  Loose-Coupled Adapter Map    <--- Active Stream / Undefine (5) / Off (0) Fallback│
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                   3. React SPA + Panzoom ISA-101 SCADA UI                         │
│  @panzoom/panzoom Canvas (0.35x - 6.0x) ---> Process Filter Toolbar (7 filters)   │
│  Adaptive Nodes (Compact 44x32 vs Standard 110x90) ---> ISA-101 6-State Tokens    │
│  Slide-Over Telemetry & Specs Drawer   ---> TopBar NOC HUD & Alarm Focus Panel    │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                   4. Containerization & Docker Orchestration                      │
│  Multi-Stage Dockerfile (Node 20 Vite Build -> Python 3.12 Runtime)               │
│  Supervisord (Uvicorn + Nginx Reverse Proxy) ---> Port 8085:80 (ims-internal)     │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 4-Tier Test Design Methodology

| Tier | Focus | Coverage Target | Tests | Status |
|---|---|---|---|---|
| **Tier 1: Feature Coverage** | Complete functional coverage of all 10 factory zones and features F1..F11 | $\ge 5$ test cases per feature (10 zones $\times$ 5 + F1..F11 $\times$ 5) | **105 tests** | ✅ **100% Pass** |
| **Tier 2: Boundary & Corner Cases** | Empty telemetry datasets, missing fields, extreme coordinates, rapid filter toggling, disconnected WebSocket, SQL injection | $\ge 6$ comprehensive boundary stress scenarios | **6 tests** | ✅ **100% Pass** |
| **Tier 3: Cross-Feature Combinations** | Process filter + Panzoom focus + Telemetry updates + Slide-over drawer state consistency | $\ge 5$ multi-module integration pipelines | **5 tests** | ✅ **100% Pass** |
| **Tier 4: Real-World Scenarios** | Full 8-hour shift simulation, critical alarm escalation, 10-zone supervisor walkthrough, mixed-fleet operation | $\ge 4$ end-to-end industrial manufacturing workflows | **4 tests** | ✅ **100% Pass** |
| **Supporting Suites** | Component stress, WebSocket lifecycle, historical sparklines, App layout | Regressions & component invariant checks | **63 tests** | ✅ **100% Pass** |
| **Total Frontend Suite** | **Comprehensive Vitest Digital Twin Suite** | **Full System & Fleet Verification** | **183 tests** | ✅ **100% Pass** |

---

## 3. Authoritative Derivation Baseline

Every test case derives its expected values strictly from authoritative CAD coordinates, TimescaleDB schema contracts, and ISA-101 standards:

### 3.1 10 Factory Manufacturing Zones & Spatial Coordinates
- **Canvas ViewBox**: `viewBox="0 0 3200 1550"` (Aspect Ratio: 2.0645 : 1)
- **CAD Bounding Box**: $X \in [-935,000.0, -560,000.0]\text{ mm}$, $Y \in [-105,000.0, 75,000.0]\text{ mm}$
- **Zone Specifications**:
  1. `DRILLING_HOLD` (5 units): `[80, 80, 480, 550]`, center `(280, 315)`, zoom `2.6x`
  2. `DRILLING_MAIN` (198 units): `[500, 80, 1420, 1250]`, center `(960, 665)`, zoom `1.35x`
     - Top Array: 16 columns (`140..144` down to `047..039`), 102 units
     - Bottom Array: 8 columns (`101..104` down to `042..038`), 40 units
     - Middle Array: 8 columns (`030..033` down to `007..001`) + 2 standalone, 56 units
  3. `AUTO_LAY_UP` (8 units): `[1650, 80, 2250, 600]`, center `(1950, 340)`, zoom `2.2x`
  4. `BONDING` (1 unit): `[2280, 100, 2550, 500]`, center `(2415, 300)`, zoom `2.8x`
  5. `OXIDE` (12 units): `[1600, 620, 2200, 1080]`, center `(1900, 850)`, zoom `2.2x` (3 lines $\times$ 4 stages)
  6. `PP_STORAGE` (4 units): `[2580, 80, 3120, 800]`, center `(2850, 440)`, zoom `1.9x`
  7. `CUTTING` (11 units): `[1100, 1220, 1580, 1520]`, center `(1340, 1370)`, zoom `2.4x`
  8. `DE_OXIDE` (3 units): `[1600, 1100, 2100, 1480]`, center `(1850, 1290)`, zoom `2.4x`
  9. `LASER_DRILLING` (5 units): `[2150, 480, 2870, 820]`, center `(2510, 650)`, zoom `2.0x` (Cleanroom Bay 1)
  10. `XRY` (3 units): `[1350, 760, 1550, 980]`, center `(1450, 870)`, zoom `3.0x`
- **Total Fleet Count**: Exactly **250 units** with zero pairwise collisions.

### 3.2 ISA-101 SCADA 6-State Status Tokens
| Code | Token | SCADA Meaning | Hex Color | Glow / Styling |
|---|---|---|---|---|
| `1` | `RUN` | Active Production | `#00FF87` | Mint Green glow (`rgba(0, 255, 135, 0.45)`) |
| `2` | `IDLE` | Standby / Material Wait | `#FFB800` | Warm Amber glow (`rgba(255, 184, 0, 0.35)`) |
| `3` | `ALARM` | Down / Critical Alarm | `#FF003C` | Ruby Red pulsing blink (`animate-pulse-alarm`) |
| `4` | `STOP` | Initial / PM / LOTO | `#00F2FE` | Cyan glow (`rgba(0, 242, 254, 0.35)`) |
| `0` | `OFF` | Offline / Stale (>300s) | `#64748B` | Muted Slate border |
| `5` | `UNDEFINE` | Unmonitored Digital Twin | `#ECEFF1` | Subtle White/Gray outline |

---

## 4. Test Suite Execution Guide

### 4.1 Frontend Test Suite (Vitest)
```bash
# In directory: services/floorplan-web/frontend/
npm run test

# Run strict TypeScript typecheck
npm run typecheck

# Run production bundle build
npm run build
```

### 4.2 Backend Test Suite (Pytest)
```bash
# In repository root: c:/IMS/
python -m pytest services/floorplan-web/backend/tests/ -v
```

---

## 5. Feature-to-Test Mapping Matrix

| Feature | Feature Description | Vitest Test Suite Module |
|---|---|---|
| **F1** | Multi-Zone Factory Fleet Model (250 units) | `e2e_factory_fleet.test.tsx` (T1.F1.1 .. T1.F1.5) |
| **F2** | Mechanical Drilling Matrix (198 units) | `e2e_factory_fleet.test.tsx` (T1.F2.1 .. T1.F2.5) |
| **F3** | Peripheral Process Fleets (9 zones) | `e2e_factory_fleet.test.tsx` (T1.F3.1 .. T1.F3.5) |
| **F4** | ISA-101 6-State SCADA Tokens | `e2e_factory_fleet.test.tsx` (T1.F4.1 .. T1.F4.5), `empiricalStress.test.tsx` |
| **F5** | Process Filter Bar Toolbar & Focus Camera | `e2e_factory_fleet.test.tsx` (T1.F5.1 .. T1.F5.5) |
| **F6** | Multi-Density Floorplan SVG & Zone Overlay | `e2e_factory_fleet.test.tsx` (T1.F6.1 .. T1.F6.5), `FloorplanSVG.test.tsx` |
| **F7** | Interactive Inspection Drawer & Tolerances | `e2e_factory_fleet.test.tsx` (T1.F7.1 .. T1.F7.5), `MachineDetailPopup.test.tsx` |
| **F8** | TopBar & NOC Fleet KPI Summary | `e2e_factory_fleet.test.tsx` (T1.F8.1 .. T1.F8.5) |
| **F9** | Loose-Coupled Data Adapter | `e2e_factory_fleet.test.tsx` (T1.F9.1 .. T1.F9.5) |
| **F10** | Backend Telemetry Integration Contracts | `e2e_factory_fleet.test.tsx` (T1.F10.1 .. T1.F10.5), `useLdiWebSocket.test.ts` |
| **F11** | Docker Containerization (Port 8085) | `e2e_factory_fleet.test.tsx` (T1.F11.1 .. T1.F11.5) |
| **T2** | Boundary & Corner Cases | `e2e_factory_fleet.test.tsx` (T2.1 .. T2.6) |
| **T3** | Cross-Feature Combinations | `e2e_factory_fleet.test.tsx` (T3.1 .. T3.5) |
| **T4** | Real-World Manufacturing Scenarios | `e2e_factory_fleet.test.tsx` (T4.1 .. T4.4) |
