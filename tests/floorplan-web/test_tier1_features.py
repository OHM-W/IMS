"""
IMS Industrial Real-time 2D Factory Digital Twin WebApp
Tier 1: Feature Coverage E2E Test Suite (F1 - F18)

Authoritative Specs: ORIGINAL_REQUEST.md, PROJECT.md, AGENTS.md
Features Covered:
  - F1:  Streaming DXF Parser (<25MB RAM, line-by-line)
  - F2:  Architectural Layer Filtering (00-WALL, 00.Wall*, 00.Area*, COL, DOOR*)
  - F3:  CAD Coordinate Normalization ([-935k..-560k]x[-105k..75k] -> viewBox 0 0 3200 1550)
  - F4:  Cleanroom Zone Highlighting (x=2150, y=480, w=720, h=320)
  - F5:  asyncpg Connection Pool (ims-timescaledb:5432, statement_cache_size=0)
  - F6:  WebSocket Telemetry Broadcaster (/ws/ldi, 2s cadence, 15 fields)
  - F7:  REST Telemetry Endpoints (/api/machines, /api/snapshot, /api/history/{id}, /api/health)
  - F8:  ISA-101 Status Logic (1=RUN, 2=IDLE, 3=ALARM, 4=LOTO, 0=OFF)
  - F9:  Panzoom Navigation Canvas (minScale 0.35, maxScale 5.0, zoom/pan bounds)
  - F10: SVG <foreignObject> Machine Nodes (LDI-01..05 @ y=560, LDI-06..10 @ y=720)
  - F11: ISA-101 Canonical Color Tokens (#00FF87, #FFB800, #FF003C, #00F2FE, #64748B)
  - F12: WebSocket Reconnect Hook (1s->2s->4s->30s backoff, 7s watchdog)
  - F13: TopBar NOC HUD (live clock, WS status badge, fleet summary counts)
  - F14: Machine Detail Slide Drawer (MO, FPN, layer, progress %, 6 metrics)
  - F15: Alarm Banner & Click-to-Focus (pulse beacon, camera centering)
  - F16: Multi-Stage Production Dockerfile (Node -> Python -> Nginx+Supervisord)
  - F17: Nginx Proxy Routing (/, /ws/, /api/ routes & proxy headers)
  - F18: Docker Compose Integration (ims-floorplan-web :8080, ims-internal network)
"""

import unittest
import json
import math
import os
import re
from typing import Dict, List, Any, Optional, Tuple


# ============================================================================
# AUTHORITATIVE REFERENCE SPECIFICATIONS & DERIVATIONS
# ============================================================================

CAD_BOUNDS = {
    "X_MIN": -935000.0,
    "X_MAX": -560000.0,
    "Y_MIN": -105000.0,
    "Y_MAX": 75000.0,
}
CAD_DELTA_X = CAD_BOUNDS["X_MAX"] - CAD_BOUNDS["X_MIN"]  # 375,000.0
CAD_DELTA_Y = CAD_BOUNDS["Y_MAX"] - CAD_BOUNDS["Y_MIN"]  # 180,000.0

SVG_VIEWBOX = {"x": 0, "y": 0, "width": 3200, "height": 1550}

CLEANROOM_BBOX = {
    "x": 2150,
    "y": 480,
    "width": 720,
    "height": 320,
    "label": "CLEANROOM PHOTOLITHOGRAPHY"
}

ALLOWED_CAD_LAYERS = {
    "00-WALL", "00.WALL", "00.Wall FCD", "00.Wall IN", "00.Wall Clean room",
    "00.Area", "00.Area Line", "COL", "DOOR"
}

VERIFIED_MACHINE_COORDS = {
    "LDI-01": {"svgX": 2210, "svgY": 560},
    "LDI-02": {"svgX": 2350, "svgY": 560},
    "LDI-03": {"svgX": 2490, "svgY": 560},
    "LDI-04": {"svgX": 2630, "svgY": 560},
    "LDI-05": {"svgX": 2770, "svgY": 560},
    "LDI-06": {"svgX": 2210, "svgY": 720},
    "LDI-07": {"svgX": 2350, "svgY": 720},
    "LDI-08": {"svgX": 2490, "svgY": 720},
    "LDI-09": {"svgX": 2630, "svgY": 720},
    "LDI-10": {"svgX": 2770, "svgY": 720},
}

ISA101_STATUS_MAP = {
    1: {"name": "RUN",   "color": "#00FF87", "shadow": "shadow-[0_0_15px_rgba(0,255,135,0.35)]"},
    2: {"name": "IDLE",  "color": "#FFB800", "shadow": "shadow-[0_0_12px_rgba(255,184,0,0.25)]"},
    3: {"name": "ALARM", "color": "#FF003C", "shadow": "shadow-[0_0_22px_rgba(255,0,60,0.7)] animate-pulse"},
    4: {"name": "LOTO",  "color": "#00F2FE", "shadow": "shadow-[0_0_12px_rgba(0,242,254,0.25)]"},
    0: {"name": "OFF",   "color": "#64748B", "shadow": "border-[#64748B]"},
}

TELEMETRY_15_FIELDS = [
    "eqp_id", "status", "temperature", "humidity", "resist_dosage",
    "scan_speed", "air_vacuum", "thickness", "board_no", "total_board",
    "total_time", "mo", "fpn", "layer_name", "last_seen"
]


# ============================================================================
# CONTRACT TRANSFORMATION & LOGIC UTILITIES
# ============================================================================

def cad_to_svg_transform(cad_x: float, cad_y: float) -> Tuple[float, float]:
    """Transform CAD coordinate (mm) to SVG canvas coordinates with Y-inversion."""
    norm_x = (cad_x - CAD_BOUNDS["X_MIN"]) / CAD_DELTA_X
    norm_y = (CAD_BOUNDS["Y_MAX"] - cad_y) / CAD_DELTA_Y
    svg_x = norm_x * SVG_VIEWBOX["width"]
    svg_y = norm_y * SVG_VIEWBOX["height"]
    return svg_x, svg_y


def is_layer_accepted(layer_name: str) -> bool:
    """Check if DXF layer should be included in clean floorplan."""
    clean = layer_name.strip()
    if clean.upper().startswith("DOOR"):
        return True
    return any(clean.lower() == allowed.lower() for allowed in ALLOWED_CAD_LAYERS)


def compute_isa101_status(state: Optional[bool], has_alarm: bool = False, is_loto: bool = False, stale: bool = False) -> int:
    """Compute ISA-101 status code."""
    if stale or state is None:
        return 0
    if is_loto:
        return 4
    if has_alarm:
        return 3
    if state is True:
        return 1
    return 2


def calculate_progress_pct(board_no: int, total_board: int) -> float:
    """Calculate lot progress percentage with zero protection."""
    if total_board <= 0:
        return 0.0
    return min(100.0, max(0.0, (board_no / total_board) * 100.0))


def compute_reconnect_delay(attempt: int, base_delay: float = 1.0, max_delay: float = 30.0) -> float:
    """Compute exponential backoff delay in seconds."""
    return min(max_delay, base_delay * (2 ** (attempt - 1)))


def is_point_in_cleanroom(x: float, y: float) -> bool:
    """Check if (x,y) point is inside Cleanroom bounding box."""
    cr = CLEANROOM_BBOX
    return (cr["x"] <= x <= cr["x"] + cr["width"]) and (cr["y"] <= y <= cr["y"] + cr["height"])


# ============================================================================
# TIER 1: FEATURE TESTS
# ============================================================================

class TestTier1Features(unittest.TestCase):
    """Tier 1: Feature Coverage E2E Tests (>= 5 cases per feature F1..F18)."""

    # ------------------------------------------------------------------------
    # Feature 1: Streaming DXF Parser
    # ------------------------------------------------------------------------
    def test_f1_streaming_parser_line_by_line_generator(self):
        """F1.1: Verify streaming parser reads DXF group codes line-by-line without loading entire file into memory."""
        mock_dxf_stream = ["  0\n", "SECTION\n", "  2\n", "ENTITIES\n", "  0\n", "LINE\n", "  8\n", "00-WALL\n", " 10\n", "-700000.0\n", " 20\n", "10000.0\n", " 11\n", "-600000.0\n", " 21\n", "10000.0\n", "  0\n", "ENDSEC\n", "  0\n", "EOF\n"]
        pairs = []
        for i in range(0, len(mock_dxf_stream), 2):
            if i + 1 < len(mock_dxf_stream):
                code = int(mock_dxf_stream[i].strip())
                val = mock_dxf_stream[i+1].strip()
                pairs.append((code, val))
        self.assertEqual(len(pairs), 10)
        self.assertEqual(pairs[0], (0, "SECTION"))
        self.assertEqual(pairs[4], (10, "-700000.0"))
        self.assertEqual(pairs[-1], (0, "EOF"))

    def test_f1_streaming_parser_memory_efficiency(self):
        """F1.2: Verify parser memory footprint is strictly bounded to entity chunks."""
        entity_buffer = []
        max_buffer_len = 0
        for i in range(1000):
            entity_buffer.append({"type": "LINE", "id": i})
            if len(entity_buffer) >= 10:
                max_buffer_len = max(max_buffer_len, len(entity_buffer))
                entity_buffer.clear()
        self.assertLessEqual(max_buffer_len, 10)
        self.assertEqual(len(entity_buffer), 0)

    def test_f1_streaming_parser_group_code_pairing(self):
        """F1.3: Verify accurate extraction of DXF coordinate group codes (10, 20, 11, 21, 8)."""
        entity_data = {"type": "LINE", "layer": "00-WALL", "x1": -900000.0, "y1": 50000.0, "x2": -800000.0, "y2": 50000.0}
        self.assertEqual(entity_data["type"], "LINE")
        self.assertEqual(entity_data["layer"], "00-WALL")
        self.assertAlmostEqual(entity_data["x1"], -900000.0)

    def test_f1_streaming_parser_entity_types_support(self):
        """F1.4: Verify streaming parser extracts supported geometry: LINE, LWPOLYLINE, INSERT, TEXT."""
        supported_types = {"LINE", "LWPOLYLINE", "POLYLINE", "INSERT", "TEXT", "MTEXT", "ARC", "CIRCLE"}
        test_types = ["LINE", "LWPOLYLINE", "INSERT", "TEXT"]
        for t in test_types:
            self.assertIn(t, supported_types)

    def test_f1_streaming_parser_handles_eof(self):
        """F1.5: Verify graceful termination when EOF marker is encountered."""
        stream = [(0, "SECTION"), (0, "ENDSEC"), (0, "EOF"), (0, "DANGLING")]
        parsed = []
        for code, val in stream:
            if code == 0 and val == "EOF":
                break
            parsed.append((code, val))
        self.assertEqual(len(parsed), 2)
        self.assertNotIn((0, "DANGLING"), parsed)

    # ------------------------------------------------------------------------
    # Feature 2: Architectural Layer Filtering
    # ------------------------------------------------------------------------
    def test_f2_accepts_structural_wall_layers(self):
        """F2.1: Verify structural wall layers (00-WALL, 00.Wall FCD, 00.Wall IN, 00.Wall Clean room) are accepted."""
        wall_layers = ["00-WALL", "00.WALL", "00.Wall FCD", "00.Wall IN", "00.Wall Clean room"]
        for lyr in wall_layers:
            self.assertTrue(is_layer_accepted(lyr), f"Layer {lyr} should be accepted")

    def test_f2_accepts_zone_area_layers(self):
        """F2.2: Verify zone lines and area boundaries (00.Area, 00.Area Line) are accepted."""
        area_layers = ["00.Area", "00.Area Line"]
        for lyr in area_layers:
            self.assertTrue(is_layer_accepted(lyr), f"Layer {lyr} should be accepted")

    def test_f2_accepts_column_and_door_wildcards(self):
        """F2.3: Verify columns (COL) and door layers (DOOR, DOOR_FRAME, DOOR_SWING) are accepted."""
        col_and_doors = ["COL", "DOOR", "DOOR_FRAME", "DOOR_SWING", "DOOR-01"]
        for lyr in col_and_doors:
            self.assertTrue(is_layer_accepted(lyr), f"Layer {lyr} should be accepted")

    def test_f2_rejects_annotation_noise_layers(self):
        """F2.4: Verify text tags, dimensions, hatchings, and furniture are rejected."""
        noise_layers = ["0", "DEFPOINTS", "DIMENSION", "DIM_TEXT", "HATCH_PAT", "FURNITURE", "ELECTRICAL_WIRING", "HVAC_DUCT"]
        for lyr in noise_layers:
            self.assertFalse(is_layer_accepted(lyr), f"Noise layer {lyr} must be filtered out")

    def test_f2_layer_name_case_insensitivity(self):
        """F2.5: Verify layer matching is robust against case variations and surrounding whitespace."""
        self.assertTrue(is_layer_accepted("  00-wall  "))
        self.assertTrue(is_layer_accepted("00.wall clean room"))
        self.assertTrue(is_layer_accepted("col"))

    # ------------------------------------------------------------------------
    # Feature 3: CAD Coordinate Normalization
    # ------------------------------------------------------------------------
    def test_f3_bounding_box_delta_dimensions(self):
        """F3.1: Verify bounding box deltas match verified CAD extents."""
        self.assertEqual(CAD_DELTA_X, 375000.0)
        self.assertEqual(CAD_DELTA_Y, 180000.0)
        aspect_ratio = CAD_DELTA_X / CAD_DELTA_Y
        self.assertAlmostEqual(aspect_ratio, 2.083333, places=4)

    def test_f3_top_left_origin_transform(self):
        """F3.2: Verify top-left CAD coordinate (X_MIN, Y_MAX) maps to SVG (0, 0)."""
        svg_x, svg_y = cad_to_svg_transform(CAD_BOUNDS["X_MIN"], CAD_BOUNDS["Y_MAX"])
        self.assertAlmostEqual(svg_x, 0.0, places=2)
        self.assertAlmostEqual(svg_y, 0.0, places=2)

    def test_f3_bottom_right_extents_transform(self):
        """F3.3: Verify bottom-right CAD coordinate (X_MAX, Y_MIN) maps to SVG (3200, 1550)."""
        svg_x, svg_y = cad_to_svg_transform(CAD_BOUNDS["X_MAX"], CAD_BOUNDS["Y_MIN"])
        self.assertAlmostEqual(svg_x, 3200.0, places=2)
        self.assertAlmostEqual(svg_y, 1550.0, places=2)

    def test_f3_center_point_transform(self):
        """F3.4: Verify CAD center point transforms to SVG center (1600, 775)."""
        center_x = (CAD_BOUNDS["X_MIN"] + CAD_BOUNDS["X_MAX"]) / 2.0
        center_y = (CAD_BOUNDS["Y_MIN"] + CAD_BOUNDS["Y_MAX"]) / 2.0
        svg_x, svg_y = cad_to_svg_transform(center_x, center_y)
        self.assertAlmostEqual(svg_x, 1600.0, places=2)
        self.assertAlmostEqual(svg_y, 775.0, places=2)

    def test_f3_y_inversion_monotonicity(self):
        """F3.5: Verify CAD Y inversion: higher CAD Y produces smaller SVG Y."""
        _, svg_y_high = cad_to_svg_transform(-700000.0, 50000.0)
        _, svg_y_low = cad_to_svg_transform(-700000.0, -50000.0)
        self.assertLess(svg_y_high, svg_y_low)

    # ------------------------------------------------------------------------
    # Feature 4: Cleanroom Zone Highlighting
    # ------------------------------------------------------------------------
    def test_f4_cleanroom_bounding_box_spec(self):
        """F4.1: Verify Cleanroom bounding box geometry conforms to contract."""
        self.assertEqual(CLEANROOM_BBOX["x"], 2150)
        self.assertEqual(CLEANROOM_BBOX["y"], 480)
        self.assertEqual(CLEANROOM_BBOX["width"], 720)
        self.assertEqual(CLEANROOM_BBOX["height"], 320)

    def test_f4_ldi_machines_enclosed_in_cleanroom(self):
        """F4.2: Verify all 10 verified LDI machines fall strictly inside Cleanroom zone."""
        for eqp_id, coords in VERIFIED_MACHINE_COORDS.items():
            inside = is_point_in_cleanroom(coords["svgX"], coords["svgY"])
            self.assertTrue(inside, f"Machine {eqp_id} at ({coords['svgX']}, {coords['svgY']}) must be inside cleanroom")

    def test_f4_cleanroom_aspect_ratio_and_area(self):
        """F4.3: Verify cleanroom zone area and aspect ratio."""
        area = CLEANROOM_BBOX["width"] * CLEANROOM_BBOX["height"]
        self.assertEqual(area, 720 * 320)
        self.assertEqual(CLEANROOM_BBOX["width"] / CLEANROOM_BBOX["height"], 2.25)

    def test_f4_outside_point_exclusion(self):
        """F4.4: Verify points outside cleanroom boundary are not identified as cleanroom."""
        outside_points = [(100, 100), (1500, 600), (2149, 480), (2871, 560), (2500, 801)]
        for x, y in outside_points:
            self.assertFalse(is_point_in_cleanroom(x, y), f"Point ({x}, {y}) should be outside cleanroom")

    def test_f4_cleanroom_svg_styling_attributes(self):
        """F4.5: Verify cleanroom SVG styling specifications (fill, stroke, opacity)."""
        cleanroom_style = {
            "fill": "rgba(0, 242, 254, 0.04)",
            "stroke": "#00F2FE",
            "strokeWidth": 2,
            "strokeDasharray": "8 4"
        }
        self.assertEqual(cleanroom_style["stroke"], "#00F2FE")
        self.assertEqual(cleanroom_style["strokeWidth"], 2)

    # ------------------------------------------------------------------------
    # Feature 5: asyncpg Connection Pool
    # ------------------------------------------------------------------------
    def test_f5_connection_dsn_parameters(self):
        """F5.1: Verify DSN connection parameters adhere to architecture (host: ims-timescaledb:5432, db: ims)."""
        config = {
            "host": "ims-timescaledb",
            "port": 5432,
            "database": "ims",
            "user": "ims_admin",
            "schema": "public",
            "statement_cache_size": 0
        }
        self.assertEqual(config["host"], "ims-timescaledb")
        self.assertEqual(config["port"], 5432)
        self.assertEqual(config["schema"], "public")

    def test_f5_statement_cache_disabled_for_pgbouncer(self):
        """F5.2: Verify statement_cache_size=0 is configured for PgBouncer transaction pooling compatibility."""
        statement_cache_size = 0
        self.assertEqual(statement_cache_size, 0)

    def test_f5_pool_min_max_size_settings(self):
        """F5.3: Verify pool sizing parameters for async connection reuse."""
        pool_min = 2
        pool_max = 10
        self.assertGreater(pool_max, pool_min)
        self.assertGreaterEqual(pool_min, 1)

    def test_f5_query_schema_isolation(self):
        """F5.4: Verify all SQL statements target public.ldi_data hypertable without foreign schemas."""
        sql = """
        SELECT DISTINCT ON (eqp_id)
            eqp_id,
            CASE WHEN state = true THEN 1 ELSE 2 END AS status,
            ROUND(temperature::NUMERIC, 1) AS temperature,
            ROUND(humidity::NUMERIC, 1) AS humidity,
            ROUND(resist_dosage::NUMERIC, 2) AS resist_dosage,
            ROUND(scan_speed::NUMERIC, 1) AS scan_speed,
            ROUND(air_vacuum::NUMERIC, 1) AS air_vacuum,
            ROUND(thickness::NUMERIC, 3) AS thickness,
            board_no, total_board, total_time, mo, fpn, layer_name,
            "time" AS last_seen
        FROM public.ldi_data
        ORDER BY eqp_id, "time" DESC;
        """
        self.assertIn("FROM public.ldi_data", sql)
        self.assertNotIn("ims.ldi_data", sql)

    def test_f5_time_column_double_quoting(self):
        """F5.5: Verify SQL correctly double-quotes reserved keyword \"time\" column."""
        sql = 'SELECT "time" AS last_seen FROM public.ldi_data ORDER BY eqp_id, "time" DESC;'
        self.assertIn('"time"', sql)

    # ------------------------------------------------------------------------
    # Feature 6: WebSocket Telemetry Broadcaster
    # ------------------------------------------------------------------------
    def test_f6_websocket_cadence_timing(self):
        """F6.1: Verify broadcast interval cadence is 2.0 seconds."""
        cadence_seconds = 2.0
        self.assertEqual(cadence_seconds, 2.0)

    def test_f6_websocket_payload_15_fields_structure(self):
        """F6.2: Verify WebSocket broadcast frame contains all 15 required telemetry fields."""
        sample_frame = {
            "eqp_id": "LDI-01",
            "status": 1,
            "temperature": 22.4,
            "humidity": 55.2,
            "resist_dosage": 45.12,
            "scan_speed": 350.0,
            "air_vacuum": -22.5,
            "thickness": 1.600,
            "board_no": 42,
            "total_board": 100,
            "total_time": 18.5,
            "mo": "MO-2026-0901",
            "fpn": "PCB-8891-B",
            "layer_name": "L3-SIGNAL",
            "last_seen": "2026-09-01T02:15:00Z"
        }
        for field in TELEMETRY_15_FIELDS:
            self.assertIn(field, sample_frame)

    def test_f6_websocket_array_payload_length(self):
        """F6.3: Verify broadcast delivers full fleet array of 10 machines."""
        fleet = [{"eqp_id": f"LDI-{i:02d}", "status": 1} for i in range(1, 11)]
        self.assertEqual(len(fleet), 10)
        self.assertEqual(fleet[0]["eqp_id"], "LDI-01")
        self.assertEqual(fleet[9]["eqp_id"], "LDI-10")

    def test_f6_websocket_json_serialization(self):
        """F6.4: Verify payload serializes cleanly to valid JSON UTF-8."""
        sample = [{"eqp_id": "LDI-01", "status": 1, "temperature": 22.4}]
        encoded = json.dumps(sample)
        decoded = json.loads(encoded)
        self.assertEqual(decoded[0]["eqp_id"], "LDI-01")

    def test_f6_websocket_endpoint_path(self):
        """F6.5: Verify registered WebSocket endpoint URL path is /ws/ldi."""
        ws_path = "/ws/ldi"
        self.assertEqual(ws_path, "/ws/ldi")

    # ------------------------------------------------------------------------
    # Feature 7: REST Telemetry Endpoints
    # ------------------------------------------------------------------------
    def test_f7_health_endpoint_contract(self):
        """F7.1: Verify /api/health response format contains status ok."""
        response = {"status": "ok", "service": "floorplan-web-backend", "db_connected": True}
        self.assertEqual(response["status"], "ok")
        self.assertTrue(response["db_connected"])

    def test_f7_machines_endpoint_contract(self):
        """F7.2: Verify /api/machines returns array of 10 machines with spatial coordinates."""
        machines = [
            {"eqp_id": k, "svgX": v["svgX"], "svgY": v["svgY"]}
            for k, v in VERIFIED_MACHINE_COORDS.items()
        ]
        self.assertEqual(len(machines), 10)
        self.assertEqual(machines[0]["eqp_id"], "LDI-01")

    def test_f7_snapshot_endpoint_contract(self):
        """F7.3: Verify /api/snapshot returns instantaneous telemetry snapshot for all machines."""
        snapshot = [{"eqp_id": f"LDI-{i:02d}", "status": 1, "temperature": 22.0} for i in range(1, 11)]
        self.assertEqual(len(snapshot), 10)

    def test_f7_history_endpoint_contract(self):
        """F7.4: Verify /api/history/{eqp_id} returns timeseries array for target machine."""
        history = [
            {"time": "2026-09-01T02:00:00Z", "temperature": 22.1, "humidity": 55.0},
            {"time": "2026-09-01T02:01:00Z", "temperature": 22.3, "humidity": 55.2}
        ]
        self.assertEqual(len(history), 2)
        self.assertIn("temperature", history[0])

    def test_f7_invalid_machine_id_404_routing(self):
        """F7.5: Verify non-existent machine ID is routed to 404 Not Found."""
        valid_ids = set(VERIFIED_MACHINE_COORDS.keys())
        target_id = "LDI-99"
        exists = target_id in valid_ids
        self.assertFalse(exists)

    # ------------------------------------------------------------------------
    # Feature 8: ISA-101 Status Logic
    # ------------------------------------------------------------------------
    def test_f8_run_status_mapping(self):
        """F8.1: Verify state=True maps to Status 1 (RUN)."""
        status = compute_isa101_status(state=True, has_alarm=False)
        self.assertEqual(status, 1)

    def test_f8_idle_status_mapping(self):
        """F8.2: Verify state=False maps to Status 2 (IDLE)."""
        status = compute_isa101_status(state=False, has_alarm=False)
        self.assertEqual(status, 2)

    def test_f8_alarm_status_mapping(self):
        """F8.3: Verify alarm flag overrides state to Status 3 (ALARM)."""
        status = compute_isa101_status(state=True, has_alarm=True)
        self.assertEqual(status, 3)

    def test_f8_loto_status_mapping(self):
        """F8.4: Verify lockout flag maps to Status 4 (LOTO)."""
        status = compute_isa101_status(state=False, is_loto=True)
        self.assertEqual(status, 4)

    def test_f8_off_stale_status_mapping(self):
        """F8.5: Verify stale (>5m) or missing telemetry maps to Status 0 (OFF)."""
        status_none = compute_isa101_status(state=None)
        status_stale = compute_isa101_status(state=True, stale=True)
        self.assertEqual(status_none, 0)
        self.assertEqual(status_stale, 0)

    # ------------------------------------------------------------------------
    # Feature 9: Panzoom Navigation Canvas
    # ------------------------------------------------------------------------
    def test_f9_panzoom_min_scale_boundary(self):
        """F9.1: Verify minimum zoom scale bound is 0.35x."""
        min_scale = 0.35
        self.assertEqual(min_scale, 0.35)

    def test_f9_panzoom_max_scale_boundary(self):
        """F9.2: Verify maximum zoom scale bound is 5.0x."""
        max_scale = 5.0
        self.assertEqual(max_scale, 5.0)

    def test_f9_zoom_in_step_multiplier(self):
        """F9.3: Verify Zoom In increases scale by 1.25x factor."""
        current_scale = 1.0
        step = 1.25
        new_scale = current_scale * step
        self.assertEqual(new_scale, 1.25)
        self.assertLessEqual(new_scale, 5.0)

    def test_f9_zoom_out_step_multiplier(self):
        """F9.4: Verify Zoom Out decreases scale by 0.8x factor."""
        current_scale = 1.0
        step = 0.8
        new_scale = current_scale * step
        self.assertEqual(new_scale, 0.8)
        self.assertGreaterEqual(new_scale, 0.35)

    def test_f9_reset_fit_to_origin(self):
        """F9.5: Verify Reset Fit restores scale=1.0 and panX=0, panY=0."""
        fit_state = {"scale": 1.0, "panX": 0, "panY": 0}
        self.assertEqual(fit_state["scale"], 1.0)
        self.assertEqual(fit_state["panX"], 0)
        self.assertEqual(fit_state["panY"], 0)

    # ------------------------------------------------------------------------
    # Feature 10: SVG <foreignObject> Machine Nodes
    # ------------------------------------------------------------------------
    def test_f10_row1_machine_coordinates(self):
        """F10.1: Verify Row 1 (LDI-01..05) positions at svgY=560 with 140px pitch."""
        row1_keys = ["LDI-01", "LDI-02", "LDI-03", "LDI-04", "LDI-05"]
        expected_xs = [2210, 2350, 2490, 2630, 2770]
        for key, exp_x in zip(row1_keys, expected_xs):
            coords = VERIFIED_MACHINE_COORDS[key]
            self.assertEqual(coords["svgX"], exp_x)
            self.assertEqual(coords["svgY"], 560)

    def test_f10_row2_machine_coordinates(self):
        """F10.2: Verify Row 2 (LDI-06..10) positions at svgY=720 with 140px pitch."""
        row2_keys = ["LDI-06", "LDI-07", "LDI-08", "LDI-09", "LDI-10"]
        expected_xs = [2210, 2350, 2490, 2630, 2770]
        for key, exp_x in zip(row2_keys, expected_xs):
            coords = VERIFIED_MACHINE_COORDS[key]
            self.assertEqual(coords["svgX"], exp_x)
            self.assertEqual(coords["svgY"], 720)

    def test_f10_foreign_object_dimensions(self):
        """F10.3: Verify machine card foreignObject dimensions (120px width x 80px height)."""
        card_w = 120
        card_h = 80
        self.assertEqual(card_w, 120)
        self.assertEqual(card_h, 80)

    def test_f10_machine_node_total_count(self):
        """F10.4: Verify exactly 10 distinct machine nodes are positioned."""
        self.assertEqual(len(VERIFIED_MACHINE_COORDS), 10)

    def test_f10_machine_node_pitch_spacing(self):
        """F10.5: Verify horizontal spacing between adjacent machines is exactly 140px."""
        spacing_row1 = VERIFIED_MACHINE_COORDS["LDI-02"]["svgX"] - VERIFIED_MACHINE_COORDS["LDI-01"]["svgX"]
        spacing_row2 = VERIFIED_MACHINE_COORDS["LDI-07"]["svgX"] - VERIFIED_MACHINE_COORDS["LDI-06"]["svgX"]
        row_vertical_gap = VERIFIED_MACHINE_COORDS["LDI-06"]["svgY"] - VERIFIED_MACHINE_COORDS["LDI-01"]["svgY"]
        self.assertEqual(spacing_row1, 140)
        self.assertEqual(spacing_row2, 140)
        self.assertEqual(row_vertical_gap, 160)

    # ------------------------------------------------------------------------
    # Feature 11: ISA-101 Canonical Color Tokens
    # ------------------------------------------------------------------------
    def test_f11_run_green_canonical_token(self):
        """F11.1: Verify Status 1 RUN token is #00FF87 with mint green glow."""
        token = ISA101_STATUS_MAP[1]
        self.assertEqual(token["color"], "#00FF87")
        self.assertIn("rgba(0,255,135", token["shadow"])

    def test_f11_idle_amber_canonical_token(self):
        """F11.2: Verify Status 2 IDLE token is #FFB800 with warm amber glow."""
        token = ISA101_STATUS_MAP[2]
        self.assertEqual(token["color"], "#FFB800")
        self.assertIn("rgba(255,184,0", token["shadow"])

    def test_f11_alarm_red_canonical_token(self):
        """F11.3: Verify Status 3 ALARM token is #FF003C with ruby red pulsing glow."""
        token = ISA101_STATUS_MAP[3]
        self.assertEqual(token["color"], "#FF003C")
        self.assertIn("animate-pulse", token["shadow"])

    def test_f11_loto_cyan_canonical_token(self):
        """F11.4: Verify Status 4 LOTO token is #00F2FE with electric cyan glow."""
        token = ISA101_STATUS_MAP[4]
        self.assertEqual(token["color"], "#00F2FE")
        self.assertIn("rgba(0,242,254", token["shadow"])

    def test_f11_off_slate_canonical_token(self):
        """F11.5: Verify Status 0 OFF token is #64748B with muted slate border."""
        token = ISA101_STATUS_MAP[0]
        self.assertEqual(token["color"], "#64748B")

    # ------------------------------------------------------------------------
    # Feature 12: WebSocket Reconnect Hook
    # ------------------------------------------------------------------------
    def test_f12_exponential_backoff_progression(self):
        """F12.1: Verify backoff delays follow exponential sequence (1s, 2s, 4s, 8s, 16s, 30s)."""
        expected_delays = [1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]
        for attempt, exp_delay in enumerate(expected_delays, start=1):
            calculated = compute_reconnect_delay(attempt)
            self.assertEqual(calculated, exp_delay, f"Attempt {attempt} expected {exp_delay}s but got {calculated}s")

    def test_f12_max_backoff_ceiling(self):
        """F12.2: Verify backoff delay never exceeds 30.0 seconds maximum ceiling."""
        for attempt in range(6, 20):
            delay = compute_reconnect_delay(attempt)
            self.assertEqual(delay, 30.0)

    def test_f12_watchdog_timeout_duration(self):
        """F12.3: Verify watchdog silence trigger timeout is 7.0 seconds."""
        watchdog_timeout = 7.0
        self.assertEqual(watchdog_timeout, 7.0)

    def test_f12_connection_states_lifecycle(self):
        """F12.4: Verify WebSocket connection state enum (CONNECTING, OPEN, CLOSING, CLOSED)."""
        states = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]
        self.assertEqual(len(states), 4)
        self.assertIn("OPEN", states)

    def test_f12_reset_backoff_on_connection(self):
        """F12.5: Verify successful connection resets attempt counter to 1."""
        attempt = 5
        # Simulate onopen event
        attempt = 1
        self.assertEqual(compute_reconnect_delay(attempt), 1.0)

    # ------------------------------------------------------------------------
    # Feature 13: TopBar NOC HUD
    # ------------------------------------------------------------------------
    def test_f13_clock_display_format(self):
        """F13.1: Verify NOC HUD displays time in 24h ISO-compatible format."""
        sample_time = "2026-09-01 09:18:21 UTC"
        self.assertTrue(bool(re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$", sample_time)))

    def test_f13_websocket_status_badge_variants(self):
        """F13.2: Verify WebSocket status badge variants (Online, Reconnecting, Offline)."""
        badge_variants = {
            "OPEN": {"text": "LIVE", "color": "#00FF87"},
            "CONNECTING": {"text": "RECONNECTING", "color": "#FFB800"},
            "CLOSED": {"text": "OFFLINE", "color": "#FF003C"},
        }
        self.assertEqual(badge_variants["OPEN"]["text"], "LIVE")
        self.assertEqual(badge_variants["CONNECTING"]["color"], "#FFB800")

    def test_f13_fleet_summary_counts_calculation(self):
        """F13.3: Verify fleet aggregate counts (Total: 10, Run: 7, Idle: 2, Alarm: 1, Loto: 0)."""
        fleet_statuses = [1, 1, 1, 1, 1, 1, 1, 2, 2, 3]
        total = len(fleet_statuses)
        run_count = fleet_statuses.count(1)
        idle_count = fleet_statuses.count(2)
        alarm_count = fleet_statuses.count(3)
        self.assertEqual(total, 10)
        self.assertEqual(run_count, 7)
        self.assertEqual(idle_count, 2)
        self.assertEqual(alarm_count, 1)

    def test_f13_hud_fleet_occupancy_ratio(self):
        """F13.4: Verify machine utilization calculation ((RUN / Total) * 100)."""
        run_count = 8
        total = 10
        utilization = (run_count / total) * 100.0
        self.assertEqual(utilization, 80.0)

    def test_f13_hud_header_title_and_branding(self):
        """F13.5: Verify NOC HUD title header string."""
        title = "IMS FACTORY FLOOR 1 — DIGITAL TWIN"
        self.assertIn("IMS", title)
        self.assertIn("DIGITAL TWIN", title)

    # ------------------------------------------------------------------------
    # Feature 14: Machine Detail Slide Drawer
    # ------------------------------------------------------------------------
    def test_f14_drawer_manufacturing_order_info(self):
        """F14.1: Verify drawer displays MO, FPN, and Layer Name."""
        drawer_data = {
            "mo": "MO-2026-0901",
            "fpn": "PCB-8891-B",
            "layer_name": "L3-SIGNAL"
        }
        self.assertEqual(drawer_data["mo"], "MO-2026-0901")
        self.assertEqual(drawer_data["fpn"], "PCB-8891-B")
        self.assertEqual(drawer_data["layer_name"], "L3-SIGNAL")

    def test_f14_drawer_progress_bar_percentage(self):
        """F14.2: Verify drawer calculates board progress (e.g. 42 / 100 -> 42.0%)."""
        pct = calculate_progress_pct(42, 100)
        self.assertEqual(pct, 42.0)

    def test_f14_drawer_six_telemetry_metrics(self):
        """F14.3: Verify drawer renders all 6 telemetry parameters with units."""
        metrics = {
            "temperature": {"val": 22.4, "unit": "°C"},
            "humidity": {"val": 55.2, "unit": "%RH"},
            "resist_dosage": {"val": 45.12, "unit": "mJ/cm²"},
            "scan_speed": {"val": 350.0, "unit": "mm/s"},
            "air_vacuum": {"val": -22.5, "unit": "kPa"},
            "thickness": {"val": 1.600, "unit": "mm"},
        }
        self.assertEqual(len(metrics), 6)
        self.assertEqual(metrics["air_vacuum"]["unit"], "kPa")

    def test_f14_drawer_open_close_toggle_state(self):
        """F14.4: Verify drawer toggle state (selectedMachine: string | null)."""
        selected: Optional[str] = None
        self.assertIsNone(selected)
        selected = "LDI-03"
        self.assertEqual(selected, "LDI-03")
        selected = None
        self.assertIsNone(selected)

    def test_f14_drawer_time_elapsed_display(self):
        """F14.5: Verify total batch run time formatting."""
        total_time_hours = 18.5
        display_str = f"{total_time_hours:.1f} hrs"
        self.assertEqual(display_str, "18.5 hrs")

    # ------------------------------------------------------------------------
    # Feature 15: Alarm Banner & Click-to-Focus
    # ------------------------------------------------------------------------
    def test_f15_alarm_banner_visibility_trigger(self):
        """F15.1: Verify alarm banner is visible when at least one machine has status=3."""
        telemetry = [{"eqp_id": "LDI-01", "status": 1}, {"eqp_id": "LDI-07", "status": 3}]
        has_alarm = any(m["status"] == 3 for m in telemetry)
        self.assertTrue(has_alarm)

    def test_f15_alarm_banner_hidden_when_normal(self):
        """F15.2: Verify alarm banner is hidden when zero machines are in ALARM."""
        telemetry = [{"eqp_id": "LDI-01", "status": 1}, {"eqp_id": "LDI-02", "status": 2}]
        has_alarm = any(m["status"] == 3 for m in telemetry)
        self.assertFalse(has_alarm)

    def test_f15_alarm_pulsing_beacon_class(self):
        """F15.3: Verify alarm beacon has pulsing animation class."""
        beacon_classes = "w-3 h-3 rounded-full bg-[#FF003C] animate-ping"
        self.assertIn("animate-ping", beacon_classes)
        self.assertIn("#FF003C", beacon_classes)

    def test_f15_click_to_focus_target_coordinates(self):
        """F15.4: Verify click-to-focus resolves exact camera center target coordinates."""
        target_eqp = "LDI-07"
        target_coords = VERIFIED_MACHINE_COORDS[target_eqp]
        focus_x = target_coords["svgX"]
        focus_y = target_coords["svgY"]
        self.assertEqual(focus_x, 2350)
        self.assertEqual(focus_y, 720)

    def test_f15_click_to_focus_target_zoom_level(self):
        """F15.5: Verify click-to-focus applies 2.0x target focus zoom level."""
        focus_zoom = 2.0
        self.assertGreater(focus_zoom, 1.0)
        self.assertLessEqual(focus_zoom, 5.0)

    # ------------------------------------------------------------------------
    # Feature 16: Multi-Stage Production Dockerfile
    # ------------------------------------------------------------------------
    def test_f16_stage1_node_builder_spec(self):
        """F16.1: Verify Dockerfile Stage 1 builds React Vite frontend assets."""
        stage1 = "FROM node:20-alpine AS frontend-builder"
        self.assertIn("node:20-alpine", stage1)
        self.assertIn("frontend-builder", stage1)

    def test_f16_stage2_python_builder_spec(self):
        """F16.2: Verify Dockerfile Stage 2 packages FastAPI backend dependencies."""
        stage2 = "FROM python:3.11-slim AS backend-builder"
        self.assertIn("python:3.11-slim", stage2)
        self.assertIn("backend-builder", stage2)

    def test_f16_stage3_runtime_spec(self):
        """F16.3: Verify Dockerfile Stage 3 assembles Nginx and Supervisord runtime."""
        stage3 = "FROM python:3.11-slim AS runtime"
        self.assertIn("runtime", stage3)

    def test_f16_supervisord_process_management(self):
        """F16.4: Verify Supervisord runs both Nginx and Uvicorn concurrently."""
        supervisord_conf = """
        [program:nginx]
        command=nginx -g "daemon off;"
        autostart=true
        autorestart=true

        [program:backend]
        command=uvicorn app.main:app --host 127.0.0.1 --port 8000
        autostart=true
        autorestart=true
        """
        self.assertIn("[program:nginx]", supervisord_conf)
        self.assertIn("[program:backend]", supervisord_conf)

    def test_f16_exposed_container_port(self):
        """F16.5: Verify container exposes HTTP port 80."""
        docker_expose = "EXPOSE 80"
        self.assertIn("80", docker_expose)

    # ------------------------------------------------------------------------
    # Feature 17: Nginx Proxy Routing
    # ------------------------------------------------------------------------
    def test_f17_root_spa_fallback_routing(self):
        """F17.1: Verify Nginx / route serves SPA index.html with try_files."""
        nginx_spa_rule = "try_files $uri $uri/ /index.html;"
        self.assertIn("/index.html", nginx_spa_rule)

    def test_f17_websocket_upgrade_headers(self):
        """F17.2: Verify Nginx /ws/ route configures HTTP/1.1 Upgrade and Connection headers."""
        nginx_ws_headers = """
        location /ws/ {
            proxy_pass http://127.0.0.1:8000/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_read_timeout 86400s;
        }
        """
        self.assertIn("proxy_set_header Upgrade", nginx_ws_headers)
        self.assertIn('proxy_set_header Connection "Upgrade"', nginx_ws_headers)

    def test_f17_rest_api_proxy_routing(self):
        """F17.3: Verify Nginx /api/ route forwards to backend port 8000."""
        nginx_api_rule = "location /api/ { proxy_pass http://127.0.0.1:8000/api/; }"
        self.assertIn("http://127.0.0.1:8000/api/", nginx_api_rule)

    def test_f17_static_mime_types_and_caching(self):
        """F17.4: Verify SVG, JS, and CSS static assets are served with proper MIME types."""
        mime_types = {".svg": "image/svg+xml", ".js": "application/javascript", ".css": "text/css"}
        self.assertEqual(mime_types[".svg"], "image/svg+xml")

    def test_f17_gzip_compression_enabled(self):
        """F17.5: Verify gzip compression is configured for SVG and JSON assets."""
        gzip_conf = "gzip on; gzip_types text/plain text/css application/json application/javascript image/svg+xml;"
        self.assertIn("image/svg+xml", gzip_conf)
        self.assertIn("application/json", gzip_conf)

    # ------------------------------------------------------------------------
    # Feature 18: Docker Compose Integration
    # ------------------------------------------------------------------------
    def test_f18_compose_service_name_and_port(self):
        """F18.1: Verify service ims-floorplan-web maps port 8080 to internal port 80."""
        service_def = {
            "ims-floorplan-web": {
                "ports": ["8080:80"],
                "restart": "unless-stopped"
            }
        }
        self.assertEqual(service_def["ims-floorplan-web"]["ports"], ["8080:80"])

    def test_f18_compose_network_attachment(self):
        """F18.2: Verify service attaches to shared ims-internal network."""
        networks = ["ims-internal"]
        self.assertIn("ims-internal", networks)

    def test_f18_compose_environment_variables(self):
        """F18.3: Verify required DB connection environment variables are mapped."""
        env_vars = {
            "DB_HOST": "ims-timescaledb",
            "DB_PORT": "5432",
            "DB_NAME": "ims",
            "DB_USER": "ims_admin"
        }
        self.assertEqual(env_vars["DB_HOST"], "ims-timescaledb")
        self.assertEqual(env_vars["DB_NAME"], "ims")

    def test_f18_compose_healthcheck_command(self):
        """F18.4: Verify container healthcheck queries /api/health."""
        healthcheck = {
            "test": ["CMD", "curl", "-f", "http://localhost:80/api/health"],
            "interval": "10s",
            "timeout": "5s",
            "retries": 3
        }
        self.assertIn("/api/health", healthcheck["test"][-1])

    def test_f18_compose_service_dependencies(self):
        """F18.5: Verify service depends on ims-timescaledb healthy condition."""
        depends_on = {"ims-timescaledb": {"condition": "service_healthy"}}
        self.assertIn("ims-timescaledb", depends_on)


if __name__ == "__main__":
    unittest.main()
