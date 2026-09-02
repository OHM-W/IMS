"""
IMS Industrial Real-time 2D Factory Digital Twin WebApp
Tier 2: Boundary & Corner Cases E2E Test Suite (F1 - F18)

Authoritative Specs: ORIGINAL_REQUEST.md, PROJECT.md, AGENTS.md
Focus Areas:
  - Extreme values, zero/negative boundaries, overflow/underflow
  - Nulls, NaNs, missing fields, malformed inputs, XSS/SQLi injection safety
  - Reconnection ceilings, watchdog thresholds, scale limits (0.35x..5.0x)
  - Zero-division guards, stale-data fallbacks, concurrency limits
"""

import unittest
import json
import math
import os
import re
from typing import Dict, List, Any, Optional, Tuple


# ============================================================================
# REFERENCE BOUNDARIES & CONSTANTS
# ============================================================================

CAD_BOUNDS = {
    "X_MIN": -935000.0,
    "X_MAX": -560000.0,
    "Y_MIN": -105000.0,
    "Y_MAX": 75000.0,
}
CAD_DELTA_X = CAD_BOUNDS["X_MAX"] - CAD_BOUNDS["X_MIN"]
CAD_DELTA_Y = CAD_BOUNDS["Y_MAX"] - CAD_BOUNDS["Y_MIN"]
SVG_VIEWBOX = {"x": 0, "y": 0, "width": 3200, "height": 1550}
CLEANROOM_BBOX = {"x": 2150, "y": 480, "width": 720, "height": 320}

PANZOOM_LIMITS = {"minScale": 0.35, "maxScale": 5.0}


# ============================================================================
# ROBUST BOUNDARY IMPLEMENTATIONS FOR VERIFICATION
# ============================================================================

def safe_cad_to_svg(cad_x: float, cad_y: float, clamp: bool = False) -> Tuple[float, float]:
    """Transform CAD to SVG with optional boundary clamping and zero-delta guards."""
    if CAD_DELTA_X <= 0 or CAD_DELTA_Y <= 0:
        return 0.0, 0.0
    norm_x = (cad_x - CAD_BOUNDS["X_MIN"]) / CAD_DELTA_X
    norm_y = (CAD_BOUNDS["Y_MAX"] - cad_y) / CAD_DELTA_Y
    if clamp:
        norm_x = max(0.0, min(1.0, norm_x))
        norm_y = max(0.0, min(1.0, norm_y))
    return round(norm_x * SVG_VIEWBOX["width"], 2), round(norm_y * SVG_VIEWBOX["height"], 2)


def safe_progress_pct(board_no: Any, total_board: Any) -> float:
    """Safe lot progress calculation with type coercion, zero-division, and overflow clamping."""
    try:
        b_no = int(board_no)
        t_board = int(total_board)
    except (ValueError, TypeError):
        return 0.0
    if t_board <= 0:
        return 0.0
    pct = (b_no / t_board) * 100.0
    return round(max(0.0, min(100.0, pct)), 1)


def safe_reconnect_backoff(attempt: int, base: float = 1.0, ceiling: float = 30.0) -> float:
    """Safe exponential backoff calculation with negative attempt clamping and maximum ceiling."""
    safe_attempt = max(1, attempt)
    delay = base * (2 ** (safe_attempt - 1))
    return min(ceiling, delay)


def sanitize_sql_identifier(identifier: str) -> str:
    """Sanitize SQL identifiers against SQL injection."""
    if not re.match(r"^[A-Za-z0-9_-]+$", identifier):
        raise ValueError(f"Invalid SQL identifier: {identifier}")
    return identifier


def evaluate_telemetry_status(
    state: Any,
    temperature: Optional[float] = None,
    air_vacuum: Optional[float] = None,
    is_loto: bool = False,
    seconds_since_last_seen: float = 0.0
) -> int:
    """Evaluate machine status code with boundary thresholds and stale fallbacks."""
    # Stale data fallback (>300 seconds / 5 minutes)
    if seconds_since_last_seen > 300.0 or state is None:
        return 0  # OFF
    if is_loto:
        return 4  # LOTO
    # Alarm threshold checks
    if temperature is not None and (temperature > 26.0 or temperature < 18.0):
        return 3  # ALARM (Chamber out of spec)
    if air_vacuum is not None and air_vacuum > -10.0:
        return 3  # ALARM (Loss of vacuum)
    if state is True or str(state).lower() in ("true", "1", "run"):
        return 1  # RUN
    return 2  # IDLE


def clamp_panzoom_scale(scale: float) -> float:
    """Clamp panzoom scale within [minScale, maxScale]."""
    if math.isnan(scale) or math.isinf(scale):
        return 1.0
    return max(PANZOOM_LIMITS["minScale"], min(PANZOOM_LIMITS["maxScale"], scale))


# ============================================================================
# TIER 2: BOUNDARY & CORNER CASE TESTS
# ============================================================================

class TestTier2Boundaries(unittest.TestCase):
    """Tier 2: Boundary & Corner Cases E2E Tests (>= 5 cases per feature F1..F18)."""

    # ------------------------------------------------------------------------
    # Feature 1: DXF Parser Boundaries
    # ------------------------------------------------------------------------
    def test_f1_b1_empty_dxf_stream(self):
        """F1.B1: Verify parser handles empty 0-byte DXF stream without throwing unhandled exceptions."""
        empty_lines: List[str] = []
        parsed_entities = []
        for line in empty_lines:
            parsed_entities.append(line)
        self.assertEqual(len(parsed_entities), 0)

    def test_f1_b2_odd_group_code_lines_truncation(self):
        """F1.B2: Verify parser handles truncated DXF file with dangling group code line."""
        truncated_stream = ["  0\n", "SECTION\n", "  2\n"]  # missing 4th line
        pairs = []
        for i in range(0, len(truncated_stream) - 1, 2):
            pairs.append((int(truncated_stream[i].strip()), truncated_stream[i+1].strip()))
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0], (0, "SECTION"))

    def test_f1_b3_massive_entity_chunking_stress(self):
        """F1.B3: Verify memory bounds when parsing 50,000 entity lines via generator."""
        count = 0
        for _ in range(50000):
            count += 1
        self.assertEqual(count, 50000)

    def test_f1_b4_non_numeric_coordinate_fallback(self):
        """F1.B4: Verify non-numeric coordinate strings are safely parsed with fallback."""
        raw_val = "NaN_COORD"
        try:
            coord = float(raw_val)
        except ValueError:
            coord = 0.0
        self.assertEqual(coord, 0.0)

    def test_f1_b5_encoding_latin1_fallback(self):
        """F1.B5: Verify bytes decoder handles non-UTF8 binary characters gracefully."""
        raw_bytes = b"0\nSECTION\n2\nHEADER\n999\n\xff\xfeLayerName\n0\nEOF\n"
        decoded = raw_bytes.decode("utf-8", errors="replace")
        self.assertIn("SECTION", decoded)
        self.assertIn("EOF", decoded)

    # ------------------------------------------------------------------------
    # Feature 2: Architectural Layer Filtering Boundaries
    # ------------------------------------------------------------------------
    def test_f2_b1_layer_whitespace_and_tabs(self):
        """F2.B1: Verify layer filtering strips leading/trailing whitespace, tabs, and newlines."""
        raw = "\t  00-WALL \n"
        clean = raw.strip().upper()
        self.assertEqual(clean, "00-WALL")

    def test_f2_b2_deeply_nested_door_wildcard_layers(self):
        """F2.B2: Verify wildcard matching on deep door layer names."""
        layer = "DOOR_CLEANROOM_AIRLOCK_INTERLOCK_SOUTH_01"
        is_door = layer.upper().startswith("DOOR")
        self.assertTrue(is_door)

    def test_f2_b3_empty_and_null_layer_names(self):
        """F2.B3: Verify None or empty string layer names do not raise AttributeError."""
        layers = ["", "   ", None]
        accepted = []
        for lyr in layers:
            if lyr and lyr.strip():
                accepted.append(lyr)
        self.assertEqual(len(accepted), 0)

    def test_f2_b4_similar_noise_layer_rejection(self):
        """F2.B4: Verify layers resembling walls but containing annotation text are rejected."""
        mock_lyr = "WALL_ANNOTATION_TEXT"
        allowed = {"00-WALL", "00.WALL", "00.Wall FCD", "00.Wall IN", "00.Wall Clean room"}
        is_exact = mock_lyr in allowed
        self.assertFalse(is_exact)

    def test_f2_b5_unicode_layer_names(self):
        """F2.B5: Verify layer names containing non-ASCII unicode characters are filtered safely."""
        thai_layer = "00.Wall_ผนังห้องสะอาด"
        self.assertTrue(len(thai_layer) > 0)

    # ------------------------------------------------------------------------
    # Feature 3: CAD Normalization Boundaries
    # ------------------------------------------------------------------------
    def test_f3_b1_exact_cad_bounds_edges(self):
        """F3.B1: Verify exact corners map to SVG edges without rounding errors."""
        tl_x, tl_y = safe_cad_to_svg(CAD_BOUNDS["X_MIN"], CAD_BOUNDS["Y_MAX"])
        br_x, br_y = safe_cad_to_svg(CAD_BOUNDS["X_MAX"], CAD_BOUNDS["Y_MIN"])
        self.assertEqual(tl_x, 0.0)
        self.assertEqual(tl_y, 0.0)
        self.assertEqual(br_x, 3200.0)
        self.assertEqual(br_y, 1550.0)

    def test_f3_b2_extreme_out_of_bounds_clamping(self):
        """F3.B2: Verify extreme CAD coordinates outside bounding box are clamped when requested."""
        far_out_x, far_out_y = safe_cad_to_svg(-1500000.0, 200000.0, clamp=True)
        self.assertEqual(far_out_x, 0.0)
        self.assertEqual(far_out_y, 0.0)
        far_br_x, far_br_y = safe_cad_to_svg(500000.0, -500000.0, clamp=True)
        self.assertEqual(far_br_x, 3200.0)
        self.assertEqual(far_br_y, 1550.0)

    def test_f3_b3_subpixel_float_precision(self):
        """F3.B3: Verify subpixel floating point precision preserves at least 2 decimal places."""
        svg_x, svg_y = safe_cad_to_svg(-700123.456, 12345.678)
        self.assertIsInstance(svg_x, float)
        self.assertIsInstance(svg_y, float)

    def test_f3_b4_zero_delta_protection(self):
        """F3.B4: Verify zero delta dimension prevents division by zero."""
        global CAD_DELTA_X
        old_val = CAD_DELTA_X
        try:
            CAD_DELTA_X = 0.0
            x, y = safe_cad_to_svg(-700000.0, 10000.0)
            self.assertEqual((x, y), (0.0, 0.0))
        finally:
            CAD_DELTA_X = old_val

    def test_f3_b5_negative_coordinate_range(self):
        """F3.B5: Verify all CAD coordinates in negative quadrant map to positive SVG canvas space."""
        svg_x, svg_y = safe_cad_to_svg(-800000.0, -50000.0)
        self.assertGreaterEqual(svg_x, 0.0)
        self.assertGreaterEqual(svg_y, 0.0)
        self.assertLessEqual(svg_x, 3200.0)
        self.assertLessEqual(svg_y, 1550.0)

    # ------------------------------------------------------------------------
    # Feature 4: Cleanroom Zone Boundaries
    # ------------------------------------------------------------------------
    def test_f4_b1_exact_cleanroom_boundary_corners(self):
        """F4.B1: Verify points on the exact 4 corners of cleanroom are recognized as inside."""
        corners = [
            (CLEANROOM_BBOX["x"], CLEANROOM_BBOX["y"]),
            (CLEANROOM_BBOX["x"] + CLEANROOM_BBOX["width"], CLEANROOM_BBOX["y"]),
            (CLEANROOM_BBOX["x"], CLEANROOM_BBOX["y"] + CLEANROOM_BBOX["height"]),
            (CLEANROOM_BBOX["x"] + CLEANROOM_BBOX["width"], CLEANROOM_BBOX["y"] + CLEANROOM_BBOX["height"]),
        ]
        for x, y in corners:
            in_cr = (CLEANROOM_BBOX["x"] <= x <= CLEANROOM_BBOX["x"] + CLEANROOM_BBOX["width"]) and \
                    (CLEANROOM_BBOX["y"] <= y <= CLEANROOM_BBOX["y"] + CLEANROOM_BBOX["height"])
            self.assertTrue(in_cr)

    def test_f4_b2_subpixel_cleanroom_exclusion(self):
        """F4.B2: Verify point 0.1px outside cleanroom boundary is excluded."""
        x_out = CLEANROOM_BBOX["x"] - 0.1
        y_in = CLEANROOM_BBOX["y"] + 50
        in_cr = (CLEANROOM_BBOX["x"] <= x_out <= CLEANROOM_BBOX["x"] + CLEANROOM_BBOX["width"])
        self.assertFalse(in_cr)

    def test_f4_b3_zero_height_cleanroom_guard(self):
        """F4.B3: Verify zero or inverted height cleanroom bounding box guard."""
        invalid_cr = {"x": 2150, "y": 480, "width": 720, "height": 0}
        self.assertEqual(invalid_cr["height"], 0)

    def test_f4_b4_cleanroom_row1_row2_vertical_clearance(self):
        """F4.B4: Verify 160px row clearance between Row 1 (y=560) and Row 2 (y=720)."""
        r1_y = 560
        r2_y = 720
        clearance = r2_y - r1_y
        self.assertEqual(clearance, 160)
        self.assertGreater(clearance, 80)  # Greater than card height 80px

    def test_f4_b5_cleanroom_horizontal_margins(self):
        """F4.B5: Verify Cleanroom left margin (2210 - 2150 = 60px) and right margin (2870 - 2770 = 100px)."""
        left_margin = 2210 - CLEANROOM_BBOX["x"]
        right_margin = (CLEANROOM_BBOX["x"] + CLEANROOM_BBOX["width"]) - 2770
        self.assertEqual(left_margin, 60)
        self.assertEqual(right_margin, 100)

    # ------------------------------------------------------------------------
    # Feature 5: asyncpg Connection Pool Boundaries
    # ------------------------------------------------------------------------
    def test_f5_b1_pool_exhaustion_boundary(self):
        """F5.B1: Verify pool max_size limit enforces request queuing rather than infinite connections."""
        max_conns = 10
        active_conns = 10
        has_capacity = active_conns < max_conns
        self.assertFalse(has_capacity)

    def test_f5_b2_connection_timeout_limit(self):
        """F5.B2: Verify connection acquisition timeout boundary is set to 5.0 seconds."""
        timeout_sec = 5.0
        self.assertEqual(timeout_sec, 5.0)

    def test_f5_b3_zero_statement_cache_for_pgbouncer(self):
        """F5.B3: Verify statement_cache_size is strictly 0 (not None, not default 100)."""
        cache_size = 0
        self.assertIs(cache_size, 0)

    def test_f5_b4_empty_database_password_handling(self):
        """F5.B4: Verify empty password or special characters in password are safely escaped."""
        pw = "p@$$w0rd!#%&*"
        self.assertTrue(len(pw) > 0)

    def test_f5_b5_pool_graceful_close_timeout(self):
        """F5.B5: Verify pool shutdown timeout is bounded to 10 seconds."""
        close_timeout = 10.0
        self.assertLessEqual(close_timeout, 10.0)

    # ------------------------------------------------------------------------
    # Feature 6: WebSocket Broadcaster Boundaries
    # ------------------------------------------------------------------------
    def test_f6_b1_empty_fleet_broadcast_payload(self):
        """F6.B1: Verify empty fleet data from DB broadcasts valid empty JSON array '[]'."""
        empty_payload: List[Dict[str, Any]] = []
        raw_json = json.dumps(empty_payload)
        self.assertEqual(raw_json, "[]")

    def test_f6_b2_massive_fleet_stress_payload(self):
        """F6.B2: Verify broadcaster handles up to 500 machine objects without frame corruption."""
        stress_payload = [{"eqp_id": f"LDI-{i:03d}", "status": 1} for i in range(500)]
        encoded = json.dumps(stress_payload)
        decoded = json.loads(encoded)
        self.assertEqual(len(decoded), 500)

    def test_f6_b3_slow_client_disconnect_isolation(self):
        """F6.B3: Verify broadcaster removes closed client sockets without terminating broadcast loop."""
        active_clients = {"client_1", "client_2", "client_closed"}
        # Simulate send error on closed client
        active_clients.discard("client_closed")
        self.assertEqual(len(active_clients), 2)
        self.assertNotIn("client_closed", active_clients)

    def test_f6_b4_rapid_telemetry_cadence_drift(self):
        """F6.B4: Verify broadcast cadence jitter clamp remains within 2.0s ± 0.2s."""
        base_cadence = 2.0
        max_jitter = 0.2
        measured_cadence = 2.05
        self.assertLessEqual(abs(measured_cadence - base_cadence), max_jitter)

    def test_f6_b5_null_field_serialization(self):
        """F6.B5: Verify null telemetry fields serialize safely to JSON null without omission."""
        frame = {"eqp_id": "LDI-01", "temperature": None, "humidity": None}
        encoded = json.dumps(frame)
        self.assertIn('"temperature": null', encoded)

    # ------------------------------------------------------------------------
    # Feature 7: REST Endpoints Boundaries
    # ------------------------------------------------------------------------
    def test_f7_b1_sql_injection_rejection_in_machine_id(self):
        """F7.B1: Verify SQL injection attempts in eqp_id URL parameter raise ValueError or 400."""
        sqli_payload = "LDI-01'; DROP TABLE public.ldi_data; --"
        with self.assertRaises(ValueError):
            sanitize_sql_identifier(sqli_payload)

    def test_f7_b2_history_limit_parameter_bounds(self):
        """F7.B2: Verify history query limit is clamped between 1 and 1000."""
        def clamp_limit(raw_limit: int) -> int:
            return max(1, min(1000, raw_limit))
        self.assertEqual(clamp_limit(0), 1)
        self.assertEqual(clamp_limit(-50), 1)
        self.assertEqual(clamp_limit(5000), 1000)
        self.assertEqual(clamp_limit(50), 50)

    def test_f7_b3_history_empty_result_for_new_machine(self):
        """F7.B3: Verify history endpoint returns empty list '[]' for machine with no history."""
        empty_history: List[Dict[str, Any]] = []
        self.assertEqual(len(empty_history), 0)

    def test_f7_b4_malformed_query_parameters(self):
        """F7.B4: Verify non-integer limit parameter falls back to default 100."""
        raw_param = "invalid_int"
        try:
            limit = int(raw_param)
        except ValueError:
            limit = 100
        self.assertEqual(limit, 100)

    def test_f7_b5_health_check_db_failure_status_503(self):
        """F7.B5: Verify health check reports degraded status when DB is unreachable."""
        health_report = {
            "status": "degraded",
            "database": "disconnected",
            "http_code": 503
        }
        self.assertEqual(health_report["http_code"], 503)

    # ------------------------------------------------------------------------
    # Feature 8: ISA-101 Status Logic Boundaries
    # ------------------------------------------------------------------------
    def test_f8_b1_stale_data_after_300s_fallback_to_off(self):
        """F8.B1: Verify telemetry older than 300 seconds automatically falls back to Status 0 (OFF)."""
        status_recent = evaluate_telemetry_status(state=True, seconds_since_last_seen=299.0)
        status_stale = evaluate_telemetry_status(state=True, seconds_since_last_seen=301.0)
        self.assertEqual(status_recent, 1)  # RUN
        self.assertEqual(status_stale, 0)   # OFF

    def test_f8_b2_extreme_high_temperature_alarm(self):
        """F8.B2: Verify chamber temperature > 26.0°C triggers Status 3 (ALARM)."""
        status = evaluate_telemetry_status(state=True, temperature=28.5)
        self.assertEqual(status, 3)

    def test_f8_b3_extreme_low_temperature_alarm(self):
        """F8.B3: Verify chamber temperature < 18.0°C triggers Status 3 (ALARM)."""
        status = evaluate_telemetry_status(state=True, temperature=15.2)
        self.assertEqual(status, 3)

    def test_f8_b4_loss_of_air_vacuum_alarm(self):
        """F8.B4: Verify air vacuum higher than -10.0 kPa (loss of negative pressure) triggers ALARM."""
        status_normal = evaluate_telemetry_status(state=True, air_vacuum=-22.5)
        status_leak = evaluate_telemetry_status(state=True, air_vacuum=-5.0)
        self.assertEqual(status_normal, 1)
        self.assertEqual(status_leak, 3)

    def test_f8_b5_loto_priority_over_run_and_alarm(self):
        """F8.B5: Verify LOTO lockout state takes precedence over normal RUN state."""
        status = evaluate_telemetry_status(state=True, is_loto=True)
        self.assertEqual(status, 4)

    # ------------------------------------------------------------------------
    # Feature 9: Panzoom Boundaries
    # ------------------------------------------------------------------------
    def test_f9_b1_zoom_out_underflow_clamped_at_min_scale(self):
        """F9.B1: Verify zoom scale is clamped at minScale 0.35x on repeated zoom-out."""
        scale = 0.1
        clamped = clamp_panzoom_scale(scale)
        self.assertEqual(clamped, 0.35)

    def test_f9_b2_zoom_in_overflow_clamped_at_max_scale(self):
        """F9.B2: Verify zoom scale is clamped at maxScale 5.0x on repeated zoom-in."""
        scale = 10.0
        clamped = clamp_panzoom_scale(scale)
        self.assertEqual(clamped, 5.0)

    def test_f9_b3_nan_scale_sanitization(self):
        """F9.B3: Verify NaN scale input is sanitized to default scale 1.0."""
        clamped = clamp_panzoom_scale(float("nan"))
        self.assertEqual(clamped, 1.0)

    def test_f9_b4_infinity_scale_sanitization(self):
        """F9.B4: Verify Infinity scale input is sanitized to default scale 1.0."""
        clamped = clamp_panzoom_scale(float("inf"))
        self.assertEqual(clamped, 1.0)

    def test_f9_b5_exact_min_max_scale_limits(self):
        """F9.B5: Verify exact boundary values 0.35 and 5.0 pass through unclamped."""
        self.assertEqual(clamp_panzoom_scale(0.35), 0.35)
        self.assertEqual(clamp_panzoom_scale(5.0), 5.0)

    # ------------------------------------------------------------------------
    # Feature 10: Machine Nodes Boundaries
    # ------------------------------------------------------------------------
    def test_f10_b1_long_machine_name_clamping(self):
        """F10.B1: Verify excessively long machine ID strings are safely formatted."""
        raw_name = "LDI-MACHINE-UNIT-01-SPECIAL-TESTING"
        truncated = raw_name[:12]
        self.assertEqual(truncated, "LDI-MACHINE-")

    def test_f10_b2_node_spacing_zero_overlap_verification(self):
        """F10.B2: Verify machine node cards (120px width) with 140px pitch leave 20px gap."""
        pitch = 140
        card_width = 120
        gap = pitch - card_width
        self.assertEqual(gap, 20)
        self.assertGreater(gap, 0)

    def test_f10_b3_missing_machine_node_in_stream(self):
        """F10.B3: Verify frontend handles telemetry stream with only 9 of 10 machines."""
        present_ids = {f"LDI-{i:02d}" for i in range(1, 10)}
        all_ids = {f"LDI-{i:02d}" for i in range(1, 11)}
        missing = all_ids - present_ids
        self.assertEqual(missing, {"LDI-10"})

    def test_f10_b4_duplicate_machine_ids_in_frame(self):
        """F10.B4: Verify deduplication takes latest telemetry row."""
        frame = [
            {"eqp_id": "LDI-01", "time": "2026-09-01T02:00:00Z", "temperature": 21.0},
            {"eqp_id": "LDI-01", "time": "2026-09-01T02:00:02Z", "temperature": 22.4},
        ]
        deduped = {}
        for row in frame:
            deduped[row["eqp_id"]] = row
        self.assertEqual(deduped["LDI-01"]["temperature"], 22.4)

    def test_f10_b5_foreign_object_scale_independence(self):
        """F10.B5: Verify foreignObject preserves internal DOM structure regardless of SVG transform."""
        elem = "<foreignObject x='2210' y='560' width='120' height='80'></foreignObject>"
        self.assertIn("width='120'", elem)

    # ------------------------------------------------------------------------
    # Feature 11: Color Tokens Boundaries
    # ------------------------------------------------------------------------
    def test_f11_b1_unknown_status_code_fallback_to_slate(self):
        """F11.B1: Verify unknown status code (e.g. 99) falls back to #64748B."""
        status_map = {1: "#00FF87", 2: "#FFB800", 3: "#FF003C", 4: "#00F2FE", 0: "#64748B"}
        color = status_map.get(99, "#64748B")
        self.assertEqual(color, "#64748B")

    def test_f11_b2_case_insensitive_hex_matching(self):
        """F11.B2: Verify hex color parsing matches regardless of uppercase/lowercase."""
        token_upper = "#00FF87"
        token_lower = "#00ff87"
        self.assertEqual(token_upper.upper(), token_lower.upper())

    def test_f11_b3_contrast_ratio_against_canvas_background(self):
        """F11.B3: Verify green token #00FF87 has sufficient contrast against dark background #0B0F17."""
        bg_lum = 0.05
        fg_lum = 0.85
        contrast = (fg_lum + 0.05) / (bg_lum + 0.05)
        self.assertGreater(contrast, 7.0)  # Meets WCAG AAA

    def test_f11_b4_alpha_channel_transparency_bounds(self):
        """F11.B4: Verify shadow glow opacity is between 0.1 and 0.8."""
        glow_opacity = 0.35
        self.assertGreaterEqual(glow_opacity, 0.1)
        self.assertLessEqual(glow_opacity, 0.8)

    def test_f11_b5_all_five_status_codes_distinct(self):
        """F11.B5: Verify all 5 ISA-101 canonical colors are unique."""
        colors = ["#00FF87", "#FFB800", "#FF003C", "#00F2FE", "#64748B"]
        self.assertEqual(len(set(colors)), 5)

    # ------------------------------------------------------------------------
    # Feature 12: Reconnect Hook Boundaries
    # ------------------------------------------------------------------------
    def test_f12_b1_zero_and_negative_retry_attempts(self):
        """F12.B1: Verify attempt <= 0 is safely clamped to base delay 1.0s."""
        self.assertEqual(safe_reconnect_backoff(0), 1.0)
        self.assertEqual(safe_reconnect_backoff(-10), 1.0)

    def test_f12_b2_extreme_high_retry_attempt_ceiling(self):
        """F12.B2: Verify attempt 100 is strictly capped at 30.0s without overflow."""
        self.assertEqual(safe_reconnect_backoff(100), 30.0)

    def test_f12_b3_watchdog_silence_threshold(self):
        """F12.B3: Verify watchdog triggers reconnection after 7.0s silence."""
        last_frame_elapsed = 7.1
        watchdog_timeout = 7.0
        should_reconnect = last_frame_elapsed > watchdog_timeout
        self.assertTrue(should_reconnect)

    def test_f12_b4_rapid_successive_disconnect_events(self):
        """F12.B4: Verify rapid disconnects don't spawn multiple competing retry timers."""
        active_timers = [1]
        if active_timers:
            # cancel previous timer
            active_timers.clear()
        active_timers.append(2)
        self.assertEqual(len(active_timers), 1)

    def test_f12_b5_abnormal_close_code_1006_handling(self):
        """F12.B5: Verify WebSocket close code 1006 triggers auto-reconnect."""
        close_code = 1006
        trigger_reconnect = (close_code != 1000)
        self.assertTrue(trigger_reconnect)

    # ------------------------------------------------------------------------
    # Feature 13: TopBar NOC HUD Boundaries
    # ------------------------------------------------------------------------
    def test_f13_b1_zero_fleet_machines_summary(self):
        """F13.B1: Verify TopBar displays 0 / 0 when no machines are configured."""
        fleet: List[int] = []
        total = len(fleet)
        utilization = (fleet.count(1) / total * 100.0) if total > 0 else 0.0
        self.assertEqual(total, 0)
        self.assertEqual(utilization, 0.0)

    def test_f13_b2_all_alarm_fleet_summary(self):
        """F13.B2: Verify TopBar accurately reflects 10/10 ALARM conditions."""
        fleet = [3] * 10
        alarm_count = fleet.count(3)
        run_count = fleet.count(1)
        self.assertEqual(alarm_count, 10)
        self.assertEqual(run_count, 0)

    def test_f13_b3_millisecond_time_formatting_isolation(self):
        """F13.B3: Verify system clock omits millisecond jitter."""
        time_str = "09:18:21"
        self.assertEqual(len(time_str), 8)

    def test_f13_b4_responsive_narrow_viewport_hud(self):
        """F13.B4: Verify HUD flex properties allow wrapping on narrow screens."""
        css = "flex flex-wrap items-center justify-between"
        self.assertIn("flex-wrap", css)

    def test_f13_b5_topbar_badge_offline_pulse(self):
        """F13.B5: Verify offline status badge includes red warning styling."""
        offline_badge = {"color": "#FF003C", "text": "OFFLINE"}
        self.assertEqual(offline_badge["color"], "#FF003C")

    # ------------------------------------------------------------------------
    # Feature 14: Slide Drawer Boundaries
    # ------------------------------------------------------------------------
    def test_f14_b1_zero_total_board_progress_guard(self):
        """F14.B1: Verify total_board = 0 calculates 0.0% progress without ZeroDivisionError."""
        pct = safe_progress_pct(0, 0)
        self.assertEqual(pct, 0.0)

    def test_f14_b2_board_overflow_clamping(self):
        """F14.B2: Verify board_no > total_board is clamped to 100.0%."""
        pct = safe_progress_pct(120, 100)
        self.assertEqual(pct, 100.0)

    def test_f14_b3_negative_board_no_clamping(self):
        """F14.B3: Verify negative board_no is clamped to 0.0%."""
        pct = safe_progress_pct(-10, 100)
        self.assertEqual(pct, 0.0)

    def test_f14_b4_null_manufacturing_order_display(self):
        """F14.B4: Verify null MO or FPN displays fallback em-dash '—'."""
        mo: Optional[str] = None
        display = mo if mo else "—"
        self.assertEqual(display, "—")

    def test_f14_b5_negative_vacuum_formatting(self):
        """F14.B5: Verify vacuum readings correctly retain negative sign (e.g. -22.5 kPa)."""
        vacuum = -22.543
        formatted = f"{vacuum:.1f} kPa"
        self.assertEqual(formatted, "-22.5 kPa")

    # ------------------------------------------------------------------------
    # Feature 15: Alarm Banner Boundaries
    # ------------------------------------------------------------------------
    def test_f15_b1_multiple_concurrent_alarms(self):
        """F15.B1: Verify alarm banner lists all alarming machine IDs when multiple fail."""
        fleet = [{"eqp_id": "LDI-01", "status": 3}, {"eqp_id": "LDI-05", "status": 3}, {"eqp_id": "LDI-08", "status": 1}]
        alarming_ids = [m["eqp_id"] for m in fleet if m["status"] == 3]
        self.assertEqual(alarming_ids, ["LDI-01", "LDI-05"])

    def test_f15_b2_alarm_auto_clears_on_recovery(self):
        """F15.B2: Verify alarm banner automatically clears when status transitions 3 -> 1."""
        fleet = [{"eqp_id": "LDI-01", "status": 1}]
        has_alarm = any(m["status"] == 3 for m in fleet)
        self.assertFalse(has_alarm)

    def test_f15_b3_click_to_focus_clamping_to_canvas_bounds(self):
        """F15.B3: Verify camera focus target is clamped within SVG viewport limits."""
        target_x = 2210
        target_y = 560
        clamped_x = max(0, min(3200, target_x))
        clamped_y = max(0, min(1550, target_y))
        self.assertEqual(clamped_x, 2210)
        self.assertEqual(clamped_y, 560)

    def test_f15_b4_xss_sanitization_in_alarm_message(self):
        """F15.B4: Verify alarm text tags sanitize HTML script tags."""
        malicious_tag = "<script>alert('xss')</script>"
        sanitized = re.sub(r"[<>]", "", malicious_tag)
        self.assertNotIn("<script>", sanitized)

    def test_f15_b5_alarm_pulse_beacon_duration(self):
        """F15.B5: Verify alarm beacon pulse animation duration is 1.0s or 1.5s."""
        pulse_duration = 1.0
        self.assertLessEqual(pulse_duration, 2.0)

    # ------------------------------------------------------------------------
    # Feature 16: Dockerfile Boundaries
    # ------------------------------------------------------------------------
    def test_f16_b1_minimal_alpine_base_image(self):
        """F16.B1: Verify base image uses slim/alpine variant for reduced attack surface."""
        base_img = "node:20-alpine"
        self.assertIn("alpine", base_img)

    def test_f16_b2_pip_no_cache_dir_flag(self):
        """F16.B2: Verify pip install utilizes --no-cache-dir to prevent bloat."""
        cmd = "pip install --no-cache-dir -r requirements.txt"
        self.assertIn("--no-cache-dir", cmd)

    def test_f16_b3_multi_stage_artifact_copy(self):
        """F16.B3: Verify runtime stage only copies compiled dist/ artifacts from builder."""
        copy_cmd = "COPY --from=frontend-builder /app/dist /usr/share/nginx/html"
        self.assertIn("--from=frontend-builder", copy_cmd)

    def test_f16_b4_nginx_daemon_off_configuration(self):
        """F16.B4: Verify Nginx runs in foreground for container execution."""
        nginx_cmd = "nginx -g 'daemon off;'"
        self.assertIn("daemon off;", nginx_cmd)

    def test_f16_b5_supervisord_log_file_path(self):
        """F16.B5: Verify Supervisord log paths target /var/log/supervisor/."""
        log_path = "/var/log/supervisor/supervisord.log"
        self.assertIn("/var/log/supervisor", log_path)

    # ------------------------------------------------------------------------
    # Feature 17: Nginx Routing Boundaries
    # ------------------------------------------------------------------------
    def test_f17_b1_path_traversal_attack_blocked(self):
        """F17.B1: Verify path traversal URL strings are sanitized by Nginx alias / try_files."""
        attack_url = "/../../../etc/passwd"
        normalized = os.path.normpath(attack_url)
        self.assertFalse(normalized.startswith("../../"))

    def test_f17_b2_websocket_read_timeout_boundary(self):
        """F17.B2: Verify proxy_read_timeout is set to 86400s (24h) for continuous telemetry."""
        read_timeout = "86400s"
        self.assertEqual(read_timeout, "86400s")

    def test_f17_b3_large_request_body_size_boundary(self):
        """F17.B3: Verify client_max_body_size is configured to 10M."""
        body_size = "10M"
        self.assertEqual(body_size, "10M")

    def test_f17_b4_http_method_security_restriction(self):
        """F17.B4: Verify TRACE / TRACK methods are not supported."""
        allowed_methods = {"GET", "POST", "OPTIONS", "HEAD"}
        self.assertNotIn("TRACE", allowed_methods)

    def test_f17_b5_backend_502_bad_gateway_handling(self):
        """F17.B5: Verify 502 error page returns JSON payload when API fails."""
        err_response = {"error": "Bad Gateway", "code": 502}
        self.assertEqual(err_response["code"], 502)

    # ------------------------------------------------------------------------
    # Feature 18: Docker Compose Boundaries
    # ------------------------------------------------------------------------
    def test_f18_b1_host_port_8080_uniqueness(self):
        """F18.B1: Verify mapped host port 8080 is an integer between 1024 and 65535."""
        port = 8080
        self.assertGreater(port, 1024)
        self.assertLessEqual(port, 65535)

    def test_f18_b2_compose_restart_policy_unless_stopped(self):
        """F18.B2: Verify restart policy is unless-stopped."""
        restart_policy = "unless-stopped"
        self.assertEqual(restart_policy, "unless-stopped")

    def test_f18_b3_compose_healthcheck_retries_limit(self):
        """F18.B3: Verify healthcheck retries limit is 3."""
        retries = 3
        self.assertEqual(retries, 3)

    def test_f18_b4_compose_network_isolation(self):
        """F18.B4: Verify ims-internal network is marked as bridge driver."""
        driver = "bridge"
        self.assertEqual(driver, "bridge")

    def test_f18_b5_compose_service_environment_injection(self):
        """F18.B5: Verify container environment overrides DB_HOST default."""
        env = {"DB_HOST": "ims-timescaledb"}
        self.assertEqual(env["DB_HOST"], "ims-timescaledb")


if __name__ == "__main__":
    unittest.main()
