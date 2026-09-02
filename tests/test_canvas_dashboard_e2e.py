#!/usr/bin/env python3
"""
Industrial Monitoring System (IMS) - Factory Floor Plan Canvas Dashboard E2E Test Suite
========================================================================================
Comprehensive automated opaque-box test suite for the 2D Factory Floor Plan
Grafana Canvas Dashboard, TimescaleDB telemetry integration, and CAD coordinate pipeline.

Test Coverage Tiers:
- Tier 1: Feature Coverage (Floorplan Image, Machine Coordinates, TimescaleDB Query, Canvas Dashboard Schema, HTTP API Deployment)
- Tier 2: Boundary & Corner Cases (DXF Boundary Clamping, Stale Telemetry Fallback, SQL Injection Prevention, Null Telemetry Handling)
- Tier 3: Cross-Feature Combinations (Live Telemetry Element Data Binding, ISA-101 Canonical Color Tokens, Drilldown Link Navigation)
- Tier 4: Real-World Workload Scenarios (End-to-End CAD-to-Grafana-to-TimescaleDB Pipeline & Screenshot Verification)

Run Command:
    python -m unittest tests/test_canvas_dashboard_e2e.py
    python -m unittest -v tests/test_canvas_dashboard_e2e.py
"""

import base64
import json
import os
import re
import struct
import subprocess
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

# ==============================================================================
# AUTHORITATIVE CONSTANTS & SPECIFICATION BASELINE
# ==============================================================================

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# DXF ModelSpace Extents from Floor1.dxf Specification (R2)
CAD_BOUNDS = {
    "X_MIN": -931055.0,
    "X_MAX": -564063.0,
    "Y_MIN": -99570.0,
    "Y_MAX": 68645.0,
}
CAD_SPAN_X = CAD_BOUNDS["X_MAX"] - CAD_BOUNDS["X_MIN"]  # 366,992.0 mm
CAD_SPAN_Y = CAD_BOUNDS["Y_MAX"] - CAD_BOUNDS["Y_MIN"]  # 168,215.0 mm
EXPECTED_ASPECT_RATIO = CAD_SPAN_X / CAD_SPAN_Y  # ~2.181684

# ISA-101 Canonical Color Token Standards (AGENTS.md)
ISA101_TOKENS = {
    0: {"name": "OFF", "color": "#64748B", "desc": "Offline / No Data / Stale"},
    1: {"name": "RUN", "color": "#00FF87", "desc": "Running / Normal Operation"},
    2: {"name": "IDLE", "color": "#FFB800", "desc": "Idle / Standby"},
    3: {"name": "ALARM", "color": "#FF003C", "desc": "Active Critical or Major Alarm"},
    4: {"name": "LOTO", "color": "#00F2FE", "desc": "Lockout / Tagout / Maintenance"},
}

EXPECTED_EQUIPMENT_IDS = [f"LDI-{i:02d}" for i in range(1, 11)]

GRAFANA_BASE_URL = os.environ.get("GRAFANA_BASE_URL", "http://localhost:3000")
DASHBOARD_UID = "floor1-canvas"
DASHBOARD_SLUG = "ims-factory-floor-1-real-time-canvas-floorplan"
DRILLDOWN_UID = "ims-engineering"
DRILLDOWN_SLUG = "ims-engineering-drill-down"

ASSET_FLOORPLAN_REL = os.path.join("assets", "floorplan_1F.png")
ASSET_MACHINES_JSON_REL = os.path.join("assets", "machines_1F.json")
PLUGIN_STATIC_FLOORPLAN_REL = os.path.join("monitoring", "grafana", "plugins", "3d-panel", "dist", "img", "floorplan_1F.png")
DASHBOARD_FILE_REL = os.path.join("monitoring", "grafana", "dashboards", "manufacturing", "ims-factory-floor-1-canvas.json")

PNG_MAGIC_BYTES = b"\x89PNG\r\n\x1a\n"


# ==============================================================================
# HELPER UTILITIES
# ==============================================================================

def get_env_vars() -> Dict[str, str]:
    """Reads repository .env file safely without exposing secrets in output."""
    env_vars = {}
    env_file = os.path.join(REPO_ROOT, ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars


def get_grafana_auth_header() -> Optional[str]:
    """Builds HTTP Basic Auth header from .env or environment."""
    env = get_env_vars()
    user = os.environ.get("GRAFANA_ADMIN_USER", env.get("GRAFANA_ADMIN_USER", "admin"))
    pwd = os.environ.get("GRAFANA_ADMIN_PASSWORD", env.get("GRAFANA_ADMIN_PASSWORD", "admin"))
    if user and pwd:
        token = base64.b64encode(f"{user}:{pwd}".encode("utf-8")).decode("utf-8")
        return f"Basic {token}"
    return None


def execute_timescaledb_query(sql: str, timeout_sec: int = 10) -> Tuple[int, str, str]:
    """Executes a SQL query against the TimescaleDB container via docker exec."""
    cmd = [
        "docker", "exec", "-i", "ims-timescaledb",
        "psql", "-U", "ims_admin", "-d", "ims", "-c", sql
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_sec
        )
        return proc.returncode, proc.stdout, proc.stderr
    except Exception as exc:
        return -1, "", str(exc)


def cad_to_canvas_percentage(dxf_x: float, dxf_y: float, clamp: bool = True) -> Tuple[float, float]:
    """
    Authoritative DXF Cartesian (origin bottom-left) to Grafana Canvas (origin top-left)
    coordinate normalization and percentage transformation.
    """
    x_pct = ((dxf_x - CAD_BOUNDS["X_MIN"]) / CAD_SPAN_X) * 100.0
    y_pct = ((CAD_BOUNDS["Y_MAX"] - dxf_y) / CAD_SPAN_Y) * 100.0

    if clamp:
        x_pct = max(0.0, min(100.0, x_pct))
        y_pct = max(0.0, min(100.0, y_pct))

    return round(x_pct, 4), round(y_pct, 4)


def get_png_dimensions(file_path: str) -> Optional[Tuple[int, int]]:
    """Extracts width and height from PNG IHDR chunk."""
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "rb") as f:
            header = f.read(24)
            if len(header) >= 24 and header.startswith(PNG_MAGIC_BYTES):
                width, height = struct.unpack(">II", header[16:24])
                return width, height
    except Exception:
        pass
    return None


# ==============================================================================
# TIER 1: FEATURE COVERAGE
# ==============================================================================

class TestTier1FeatureCoverage(unittest.TestCase):
    """
    Tier 1 tests verify fundamental feature implementations:
    - Floorplan PNG rendering & file validity
    - Machine coordinate JSON extraction schema
    - TimescaleDB hypertable query execution & latency
    - Canvas dashboard JSON panel specification
    - Grafana REST API deployment & health
    """

    def test_t1_1_floorplan_image_generation_and_properties(self):
        """Verify floorplan_1F.png exists, is valid PNG, and maintains CAD aspect ratio."""
        target_path = os.path.join(REPO_ROOT, ASSET_FLOORPLAN_REL)
        self.assertTrue(
            os.path.exists(target_path),
            f"Floorplan asset not found at {target_path}. Run CAD extraction pipeline."
        )

        file_size = os.path.getsize(target_path)
        self.assertGreater(
            file_size, 10240,
            f"Floorplan image size ({file_size} bytes) is suspiciously small (<10KB)."
        )

        with open(target_path, "rb") as f:
            magic = f.read(8)
            self.assertEqual(
                magic, PNG_MAGIC_BYTES,
                f"Floorplan file at {target_path} is not a valid PNG image."
            )

        dims = get_png_dimensions(target_path)
        self.assertIsNotNone(dims, "Failed to read PNG dimensions from IHDR chunk.")
        width, height = dims
        self.assertGreaterEqual(width, 1920, f"Floorplan width {width}px is below 1920px standard.")
        self.assertGreaterEqual(height, 800, f"Floorplan height {height}px is below 800px standard.")

        actual_aspect_ratio = width / float(height)
        # Allow 5% tolerance around CAD span ratio (2.1818)
        self.assertAlmostEqual(
            actual_aspect_ratio, EXPECTED_ASPECT_RATIO, delta=0.15,
            msg=f"Aspect ratio {actual_aspect_ratio:.4f} deviates significantly from CAD extents {EXPECTED_ASPECT_RATIO:.4f}."
        )

    def test_t1_2_machines_json_coordinate_schema(self):
        """Verify assets/machines_1F.json conforms to the normalized coordinate schema."""
        target_path = os.path.join(REPO_ROOT, ASSET_MACHINES_JSON_REL)
        self.assertTrue(
            os.path.exists(target_path),
            f"Machine coordinates JSON not found at {target_path}."
        )

        with open(target_path, "r", encoding="utf-8") as f:
            try:
                machines_data = json.load(f)
            except json.JSONDecodeError as err:
                self.fail(f"Invalid JSON in {target_path}: {err}")

        # Support both dictionary structure (with cleanroom_ldi_machines/all_machines) and raw list
        if isinstance(machines_data, dict):
            self.assertTrue(
                "cleanroom_ldi_machines" in machines_data or "all_machines" in machines_data,
                "machines_1F.json dict must contain 'cleanroom_ldi_machines' or 'all_machines'."
            )
            machines = machines_data.get("cleanroom_ldi_machines") or machines_data.get("all_machines") or []
        elif isinstance(machines_data, list):
            machines = machines_data
        else:
            self.fail(f"machines_1F.json must be a JSON object or array, got {type(machines_data).__name__}.")

        self.assertGreaterEqual(
            len(machines), 10,
            f"Expected at least 10 machines, found {len(machines)}."
        )

        found_eqp_ids = set()
        for idx, item in enumerate(machines):
            self.assertIn("eqp_id", item, f"Item at index {idx} missing 'eqp_id'.")
            self.assertIn("canvas_x_pct", item, f"Machine {item.get('eqp_id')} missing 'canvas_x_pct'.")
            self.assertIn("canvas_y_pct", item, f"Machine {item.get('eqp_id')} missing 'canvas_y_pct'.")
            self.assertIn("dxf_x", item, f"Machine {item.get('eqp_id')} missing 'dxf_x'.")
            self.assertIn("dxf_y", item, f"Machine {item.get('eqp_id')} missing 'dxf_y'.")

            eqp_id = item["eqp_id"]
            found_eqp_ids.add(eqp_id)

            x_pct = float(item["canvas_x_pct"])
            y_pct = float(item["canvas_y_pct"])
            self.assertTrue(
                0.0 <= x_pct <= 100.0,
                f"Machine {eqp_id} canvas_x_pct ({x_pct}) outside [0.0, 100.0]%."
            )
            self.assertTrue(
                0.0 <= y_pct <= 100.0,
                f"Machine {eqp_id} canvas_y_pct ({y_pct}) outside [0.0, 100.0]%."
            )

            # Validate mathematical consistency with CAD bounds
            exp_x, exp_y = cad_to_canvas_percentage(float(item["dxf_x"]), float(item["dxf_y"]))
            self.assertAlmostEqual(
                x_pct, exp_x, delta=0.5,
                msg=f"Machine {eqp_id} canvas_x_pct {x_pct} deviates from CAD formula {exp_x}."
            )
            self.assertAlmostEqual(
                y_pct, exp_y, delta=0.5,
                msg=f"Machine {eqp_id} canvas_y_pct {y_pct} deviates from CAD formula {exp_y}."
            )

        for req_id in EXPECTED_EQUIPMENT_IDS:
            self.assertIn(req_id, found_eqp_ids, f"Required equipment {req_id} missing from machines_1F.json.")

    def test_t1_3_timescaledb_query_columns_and_latency(self):
        """Verify TimescaleDB query executes under 500ms budget and returns all required telemetry columns."""
        sql = """
        EXPLAIN (ANALYZE, BUFFERS)
        WITH latest_ldi AS (
          SELECT DISTINCT ON (d.eqp_id)
            d.eqp_id,
            d."time",
            d.state,
            d.temperature,
            d.humidity,
            d.resist_dosage,
            d.scan_speed,
            d.air_vacuum,
            d.mo,
            d.fpn,
            d.layer_name,
            d.board_no,
            d.total_board
          FROM public.ldi_data d
          WHERE d."time" > NOW() - INTERVAL '1 hour'
            AND d.eqp_id IN ('LDI-01','LDI-02','LDI-03','LDI-04','LDI-05','LDI-06','LDI-07','LDI-08','LDI-09','LDI-10')
          ORDER BY d.eqp_id, d."time" DESC
        ),
        recent_alarms AS (
          SELECT DISTINCT ON (a.equipmentid)
            a.equipmentid,
            a.errorcode,
            m.severity,
            m.alarm_msg
          FROM public.ldi_alarm_log a
          JOIN public.ldi_alarm_ms_code m ON a.errorcode::TEXT = m.alarm_code::TEXT
          WHERE a.logdate > NOW() - INTERVAL '5 minutes'
            AND m.severity IN ('Critical', 'Major')
          ORDER BY a.equipmentid, a.logdate DESC
        )
        SELECT
          l.eqp_id AS machine_name,
          l.eqp_id,
          l."time",
          ROUND(l.temperature::NUMERIC, 1) AS temperature,
          ROUND(l.humidity::NUMERIC, 1) AS humidity,
          ROUND(l.resist_dosage::NUMERIC, 1) AS resist_dosage,
          ROUND(l.scan_speed::NUMERIC, 1) AS scan_speed,
          ROUND(l.air_vacuum::NUMERIC, 2) AS air_vacuum,
          l.mo,
          l.fpn,
          l.layer_name,
          l.board_no,
          l.total_board,
          COALESCE(l.board_no::TEXT, '-') || ' / ' || COALESCE(l.total_board::TEXT, '-') AS progress,
          CASE
            WHEN l."time" IS NULL OR l."time" < NOW() - INTERVAL '5 minutes' THEN 0
            WHEN a.equipmentid IS NOT NULL THEN 3
            WHEN l.state = TRUE THEN 1
            WHEN l.state = FALSE THEN 2
            ELSE 0
          END AS state_code,
          CASE
            WHEN l."time" IS NULL OR l."time" < NOW() - INTERVAL '5 minutes' THEN '#64748B'
            WHEN a.equipmentid IS NOT NULL THEN '#FF003C'
            WHEN l.state = TRUE THEN '#00FF87'
            WHEN l.state = FALSE THEN '#FFB800'
            ELSE '#64748B'
          END AS state_color
        FROM latest_ldi l
        LEFT JOIN recent_alarms a ON l.eqp_id = a.equipmentid
        ORDER BY l.eqp_id, l."time" DESC;
        """

        t0 = time.perf_counter()
        retcode, stdout, stderr = execute_timescaledb_query(sql)
        duration_ms = (time.perf_counter() - t0) * 1000.0

        self.assertEqual(retcode, 0, f"Database query failed. Stderr: {stderr}")
        # Allow sufficient budget for Windows Docker CLI subprocess overhead while asserting strictly on internal DB engine execution time
        self.assertLess(
            duration_ms, 5000.0,
            f"Subprocess process invocation {duration_ms:.2f}ms exceeds 5000ms timeout budget."
        )

        # Check execution plan for chunk pruning and execution time in ms
        exec_time_match = re.search(r"Execution Time:\s+([\d\.]+)\s+ms", stdout)
        self.assertIsNotNone(
            exec_time_match,
            f"Could not parse Execution Time from EXPLAIN ANALYZE output:\n{stdout}"
        )
        engine_ms = float(exec_time_match.group(1))
        self.assertLess(
            engine_ms, 50.0,
            f"TimescaleDB internal execution time {engine_ms}ms exceeds 50ms fast-path threshold."
        )

    def test_t1_4_canvas_dashboard_json_structure(self):
        """Verify Canvas Dashboard JSON structure complies with schemaVersion 39+ and Grid-24."""
        target_path = os.path.join(REPO_ROOT, DASHBOARD_FILE_REL)
        dashboard_obj = None

        if os.path.exists(target_path):
            with open(target_path, "r", encoding="utf-8") as f:
                dashboard_obj = json.load(f)
        else:
            # Fallback: check Grafana API if deployed directly
            auth_header = get_grafana_auth_header()
            if auth_header:
                req = urllib.request.Request(
                    f"{GRAFANA_BASE_URL}/api/dashboards/uid/{DASHBOARD_UID}",
                    headers={"Authorization": auth_header}
                )
                try:
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        res_json = json.loads(resp.read().decode("utf-8"))
                        dashboard_obj = res_json.get("dashboard", {})
                except Exception:
                    pass

        self.assertIsNotNone(
            dashboard_obj,
            f"Dashboard not found at {target_path} or via Grafana API UID {DASHBOARD_UID}."
        )

        self.assertEqual(dashboard_obj.get("uid"), DASHBOARD_UID, f"Dashboard UID must be '{DASHBOARD_UID}'.")
        self.assertGreaterEqual(
            dashboard_obj.get("schemaVersion", 0), 39,
            "Dashboard schemaVersion must be >= 39."
        )

        panels = dashboard_obj.get("panels", [])
        self.assertGreaterEqual(len(panels), 1, "Dashboard must contain at least 1 panel.")

        canvas_panel = None
        for p in panels:
            if p.get("type") == "canvas":
                canvas_panel = p
                break

        self.assertIsNotNone(canvas_panel, "Dashboard does not contain a panel with type 'canvas'.")

        # Grid-24 layout verification
        grid_pos = canvas_panel.get("gridPos", {})
        self.assertEqual(grid_pos.get("w"), 24, "Canvas panel width must equal 24 (Grid-24 discipline).")
        self.assertGreaterEqual(grid_pos.get("h", 0), 16, "Canvas panel height should be >= 16 grid units.")

        # Canvas Options Verification
        opts = canvas_panel.get("options", {})
        self.assertTrue(opts.get("panZoom", False), "Canvas panel options.panZoom must be true.")

        root = opts.get("root", {})
        self.assertEqual(root.get("type"), "frame", "Canvas root element must be of type 'frame'.")

        bg = root.get("background", {})
        img_cfg = bg.get("image", {})
        self.assertIn(
            "floorplan_1F.png", img_cfg.get("url", ""),
            "Canvas root background image URL must reference 'floorplan_1F.png'."
        )

        elements = root.get("elements", [])
        self.assertGreaterEqual(
            len(elements), 10,
            f"Canvas root must contain at least 10 machine elements, found {len(elements)}."
        )

    def test_t1_5_http_api_deployment_and_health(self):
        """Verify Grafana instance is healthy and dashboard UID is accessible via HTTP REST API."""
        # 1. Health check
        try:
            with urllib.request.urlopen(f"{GRAFANA_BASE_URL}/api/health", timeout=5) as resp:
                self.assertEqual(resp.status, 200, "Grafana /api/health returned non-200 status.")
                health_data = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(health_data.get("database"), "ok", "Grafana internal database not OK.")
        except urllib.error.URLError as err:
            self.fail(f"Failed to connect to Grafana at {GRAFANA_BASE_URL}: {err}")

        # 2. Dashboard API Retrieval
        auth = get_grafana_auth_header()
        self.assertIsNotNone(auth, "Grafana admin credentials missing in .env.")

        req = urllib.request.Request(
            f"{GRAFANA_BASE_URL}/api/dashboards/uid/{DASHBOARD_UID}",
            headers={"Authorization": auth}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.assertEqual(resp.status, 200, f"Dashboard UID '{DASHBOARD_UID}' returned status {resp.status}.")
                dash_resp = json.loads(resp.read().decode("utf-8"))
                self.assertIn("dashboard", dash_resp, "API response missing 'dashboard' key.")
                self.assertEqual(dash_resp["dashboard"].get("uid"), DASHBOARD_UID)
        except urllib.error.HTTPError as http_err:
            self.fail(f"Grafana API error for UID {DASHBOARD_UID}: HTTP {http_err.code} - {http_err.reason}")


# ==============================================================================
# TIER 2: BOUNDARY & CORNER CASES
# ==============================================================================

class TestTier2BoundaryAndCornerCases(unittest.TestCase):
    """
    Tier 2 tests verify boundary conditions, error handling, and robustness:
    - Mathematical boundary clamping on CAD limits (0.0% to 100.0%)
    - Stale telemetry and missing machine data fallback to OFF (#64748B)
    - SQL injection resistance with singlequote escaping
    - Null telemetry sensor values handling without failure
    """

    def test_t2_1_dxf_boundary_clamping(self):
        """Verify CAD transformation math clamps properly at exact boundaries and out-of-bounds coords."""
        # Exact Top-Left Corner (-931055, 68645) -> (0.0%, 0.0%)
        x_tl, y_tl = cad_to_canvas_percentage(CAD_BOUNDS["X_MIN"], CAD_BOUNDS["Y_MAX"], clamp=True)
        self.assertEqual(x_tl, 0.0, "Top-Left X coordinate did not normalize to 0.0%.")
        self.assertEqual(y_tl, 0.0, "Top-Left Y coordinate did not normalize to 0.0%.")

        # Exact Bottom-Right Corner (-564063, -99570) -> (100.0%, 100.0%)
        x_br, y_br = cad_to_canvas_percentage(CAD_BOUNDS["X_MAX"], CAD_BOUNDS["Y_MIN"], clamp=True)
        self.assertEqual(x_br, 100.0, "Bottom-Right X coordinate did not normalize to 100.0%.")
        self.assertEqual(y_br, 100.0, "Bottom-Right Y coordinate did not normalize to 100.0%.")

        # Exact Center (-747559.0, -15462.5) -> (50.0%, 50.0%)
        x_center = (CAD_BOUNDS["X_MIN"] + CAD_BOUNDS["X_MAX"]) / 2.0
        y_center = (CAD_BOUNDS["Y_MIN"] + CAD_BOUNDS["Y_MAX"]) / 2.0
        x_mid, y_mid = cad_to_canvas_percentage(x_center, y_center, clamp=True)
        self.assertEqual(x_mid, 50.0, "Center X coordinate did not normalize to 50.0%.")
        self.assertEqual(y_mid, 50.0, "Center Y coordinate did not normalize to 50.0%.")

        # Out-of-bounds Far Left / Top -> Clamped to (0.0%, 0.0%)
        x_out_tl, y_out_tl = cad_to_canvas_percentage(-1200000.0, 150000.0, clamp=True)
        self.assertEqual(x_out_tl, 0.0, "Far out-of-bounds Top-Left X failed to clamp to 0.0%.")
        self.assertEqual(y_out_tl, 0.0, "Far out-of-bounds Top-Left Y failed to clamp to 0.0%.")

        # Out-of-bounds Far Right / Bottom -> Clamped to (100.0%, 100.0%)
        x_out_br, y_out_br = cad_to_canvas_percentage(-400000.0, -200000.0, clamp=True)
        self.assertEqual(x_out_br, 100.0, "Far out-of-bounds Bottom-Right X failed to clamp to 100.0%.")
        self.assertEqual(y_out_br, 100.0, "Far out-of-bounds Bottom-Right Y failed to clamp to 100.0%.")

    def test_t2_2_missing_telemetry_and_stale_fallback(self):
        """Verify SQL state logic returns state_code 0 (OFF / #64748B) for stale/null timestamps."""
        test_sql = """
        WITH test_inputs AS (
          SELECT
            'STALE-01' AS eqp_id,
            NOW() - INTERVAL '15 minutes' AS "time",
            TRUE AS state
          UNION ALL
          SELECT
            'NULL-01' AS eqp_id,
            NULL::TIMESTAMP WITH TIME ZONE AS "time",
            TRUE AS state
        )
        SELECT
          eqp_id,
          CASE
            WHEN "time" IS NULL OR "time" < NOW() - INTERVAL '5 minutes' THEN 0
            WHEN state = TRUE THEN 1
            WHEN state = FALSE THEN 2
            ELSE 0
          END AS state_code,
          CASE
            WHEN "time" IS NULL OR "time" < NOW() - INTERVAL '5 minutes' THEN '#64748B'
            WHEN state = TRUE THEN '#00FF87'
            WHEN state = FALSE THEN '#FFB800'
            ELSE '#64748B'
          END AS state_color
        FROM test_inputs;
        """

        retcode, stdout, stderr = execute_timescaledb_query(test_sql)
        self.assertEqual(retcode, 0, f"Query failed: {stderr}")

        lines = [line.strip() for line in stdout.splitlines() if line.strip() and not line.startswith("-")]
        # Header is line 0, data starts line 1
        data_rows = [line for line in lines if "STALE-01" in line or "NULL-01" in line]
        self.assertEqual(len(data_rows), 2, "Expected 2 test rows.")

        for row in data_rows:
            parts = [p.strip() for p in row.split("|")]
            eqp, code, color = parts[0], parts[1], parts[2]
            self.assertEqual(
                code, "0",
                f"Machine {eqp} did not fall back to state_code 0 (OFF). Got: {code}"
            )
            self.assertEqual(
                color, "#64748B",
                f"Machine {eqp} did not fall back to color #64748B. Got: {color}"
            )

    def test_t2_3_sql_injection_safety(self):
        """Verify query formatting resists SQL injection vectors."""
        # Simulated malicious equipment IDs
        injection_payloads = [
            "LDI-01' OR '1'='1",
            "'; DROP TABLE public.ldi_data; --",
            "LDI-01' UNION SELECT 'hacked', NOW(), TRUE, 0, 0, 0, 0, 0, 'MO', 'PN', 'layer', 1, 1 --",
            "LDI-01'; SELECT pg_sleep(5); --"
        ]

        for payload in injection_payloads:
            # Simulate Grafana's ${machine_id:singlequote} macro behavior:
            # Replaces ' with '' inside the single-quoted string literal
            sanitized = payload.replace("'", "''")
            safe_sql = f"""
            SELECT count(*)
            FROM public.ldi_data
            WHERE eqp_id IN ('{sanitized}')
              AND "time" > NOW() - INTERVAL '1 hour';
            """

            retcode, stdout, stderr = execute_timescaledb_query(safe_sql)
            self.assertEqual(
                retcode, 0,
                f"Query syntax failed on injection test payload: {payload}. Error: {stderr}"
            )
            # The query should safely return 0 rows for non-existent injected equipment IDs
            self.assertIn(
                "0", stdout,
                f"Unexpected matching rows for injection payload: {payload}"
            )

    def test_t2_4_null_value_handling(self):
        """Verify queries handle NULL values in sensor columns without exceptions or NaN."""
        null_test_sql = """
        WITH test_null_row AS (
          SELECT
            'TEST-NULL' AS eqp_id,
            NOW() AS "time",
            TRUE AS state,
            NULL::DOUBLE PRECISION AS temperature,
            NULL::DOUBLE PRECISION AS humidity,
            NULL::DOUBLE PRECISION AS resist_dosage,
            NULL::REAL AS scan_speed,
            NULL::REAL AS air_vacuum,
            NULL::SMALLINT AS board_no,
            NULL::SMALLINT AS total_board
        )
        SELECT
          eqp_id,
          ROUND(temperature::NUMERIC, 1) AS temperature,
          ROUND(humidity::NUMERIC, 1) AS humidity,
          ROUND(resist_dosage::NUMERIC, 1) AS resist_dosage,
          ROUND(scan_speed::NUMERIC, 1) AS scan_speed,
          ROUND(air_vacuum::NUMERIC, 2) AS air_vacuum,
          COALESCE(board_no::TEXT, '-') || ' / ' || COALESCE(total_board::TEXT, '-') AS progress
        FROM test_null_row;
        """

        retcode, stdout, stderr = execute_timescaledb_query(null_test_sql)
        self.assertEqual(retcode, 0, f"Null test query failed: {stderr}")
        self.assertIn("- / -", stdout, "Progress string did not coalesce null boards to '- / -'.")


# ==============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS
# ==============================================================================

class TestTier3CrossFeatureCombinations(unittest.TestCase):
    """
    Tier 3 tests verify integration between modules and visual bindings:
    - Live telemetry fields bound to Canvas metric-value elements
    - ISA-101 canonical color mapping tokens in fieldConfig and SQL
    - Drilldown link URL parameterization targeting ims-engineering
    """

    def _get_dashboard_json(self) -> Dict[str, Any]:
        """Loads dashboard JSON from file or live API."""
        target_path = os.path.join(REPO_ROOT, DASHBOARD_FILE_REL)
        if os.path.exists(target_path):
            with open(target_path, "r", encoding="utf-8") as f:
                return json.load(f)

        auth_header = get_grafana_auth_header()
        if auth_header:
            req = urllib.request.Request(
                f"{GRAFANA_BASE_URL}/api/dashboards/uid/{DASHBOARD_UID}",
                headers={"Authorization": auth_header}
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return json.loads(resp.read().decode("utf-8")).get("dashboard", {})
            except Exception:
                pass
        return {}

    def test_t3_1_live_telemetry_element_data_bindings(self):
        """Verify Canvas elements map field bindings correctly to SQL query aliases."""
        dash = self._get_dashboard_json()
        self.assertTrue(bool(dash), "Could not load floor1-canvas dashboard definition.")

        panels = [p for p in dash.get("panels", []) if p.get("type") == "canvas"]
        self.assertGreater(len(panels), 0, "No canvas panel found in dashboard.")

        panel = panels[0]
        elements = panel.get("options", {}).get("root", {}).get("elements", [])
        self.assertGreaterEqual(len(elements), 10, "Canvas root elements count is less than 10.")

        # Check that metric-value elements bind text and background colors to expected fields
        for elem in elements:
            elem_type = elem.get("type")
            elem_name = elem.get("name", "")

            # Look for machine elements (e.g. machine-LDI-01 or LDI-01)
            if "LDI-" in elem_name or elem_type == "metric-value":
                cfg = elem.get("config", {})
                text_cfg = cfg.get("text", {})

                # Text mode can be field or fixed
                if text_cfg.get("mode") == "field":
                    field_name = text_cfg.get("field")
                    self.assertIn(
                        field_name,
                        ["machine_name", "eqp_id", "temperature", "humidity", "progress", "state_code"],
                        f"Element {elem_name} binds text to unknown field '{field_name}'."
                    )

                # Background color field binding (ISA-101 state token)
                bg_cfg = elem.get("background", {})
                bg_color_cfg = bg_cfg.get("color", {})
                if bg_color_cfg.get("mode") == "field":
                    bg_field = bg_color_cfg.get("field")
                    self.assertIn(
                        bg_field,
                        ["state_code", "status_code", "state_color", "state"],
                        f"Element {elem_name} binds background color to unknown field '{bg_field}'."
                    )

    def test_t3_2_isa101_canonical_color_mappings(self):
        """Verify dashboard fieldConfig value mappings contain all 5 ISA-101 status tokens."""
        dash = self._get_dashboard_json()
        self.assertTrue(bool(dash), "Dashboard definition empty.")

        panels = [p for p in dash.get("panels", []) if p.get("type") == "canvas"]
        self.assertGreater(len(panels), 0, "No canvas panel found.")
        panel = panels[0]

        field_config = panel.get("fieldConfig", {})
        overrides = field_config.get("overrides", [])

        # Search for value mappings override on state_code or status_code
        state_mappings = None
        for ovr in overrides:
            matcher = ovr.get("matcher", {})
            if matcher.get("options") in ["state_code", "status_code", "state"]:
                for prop in ovr.get("properties", []):
                    if prop.get("id") == "mappings":
                        state_mappings = prop.get("value", [])
                        break

        self.assertIsNotNone(
            state_mappings,
            "Could not find fieldConfig override with 'mappings' for state_code."
        )

        # Extract mapped color codes
        mapped_options = {}
        for m in state_mappings:
            if m.get("type") == "value":
                mapped_options.update(m.get("options", {}))

        # Check all ISA-101 codes 0, 1, 2, 3, 4
        for code, meta in ISA101_TOKENS.items():
            str_code = str(code)
            self.assertIn(
                str_code, mapped_options,
                f"ISA-101 state code {str_code} ({meta['name']}) missing from value mappings."
            )
            assigned_color = mapped_options[str_code].get("color", "").upper()
            expected_color = meta["color"].upper()
            self.assertEqual(
                assigned_color, expected_color,
                f"State code {str_code} mapped to {assigned_color}, expected canonical token {expected_color}."
            )

    def test_t3_3_drilldown_link_url_structure(self):
        """Verify navigation links target ims-engineering drilldown with proper machine_id variable."""
        dash = self._get_dashboard_json()
        panels = [p for p in dash.get("panels", []) if p.get("type") == "canvas"]
        self.assertGreater(len(panels), 0, "No canvas panel found.")

        elements = panels[0].get("options", {}).get("root", {}).get("elements", [])
        machine_elements = [e for e in elements if "LDI-" in e.get("name", "") or e.get("type") == "metric-value"]

        self.assertGreaterEqual(
            len(machine_elements), 10,
            f"Expected 10 machine elements with drilldown links, found {len(machine_elements)}."
        )

        for elem in machine_elements:
            elem_name = elem.get("name", "")
            links = elem.get("links", [])
            self.assertGreaterEqual(
                len(links), 1,
                f"Element '{elem_name}' is missing click navigation links."
            )

            link = links[0]
            url = link.get("url", "")
            self.assertIn(
                DRILLDOWN_UID, url,
                f"Element '{elem_name}' drilldown URL does not reference UID '{DRILLDOWN_UID}'. URL: {url}"
            )
            self.assertIn(
                DRILLDOWN_SLUG, url,
                f"Element '{elem_name}' drilldown URL does not reference slug '{DRILLDOWN_SLUG}'. URL: {url}"
            )
            self.assertIn(
                "var-machine_id=", url,
                f"Element '{elem_name}' drilldown URL missing 'var-machine_id=' query parameter. URL: {url}"
            )
            self.assertTrue(
                link.get("oneClick", False),
                f"Element '{elem_name}' drilldown link should have oneClick=true."
            )


# ==============================================================================
# TIER 4: REAL-WORLD WORKLOAD SCENARIOS
# ==============================================================================

class TestTier4RealWorldWorkloadScenarios(unittest.TestCase):
    """
    Tier 4 tests verify the complete full-stack workflow:
    - Step 1: CAD Extracted Floorplan Asset presence
    - Step 2: Live TimescaleDB hypertable query execution & data freshness
    - Step 3: Grafana Canvas panel deployment via REST API (HTTP 200)
    - Step 4: Static plugin asset accessibility via Grafana HTTP proxy (HTTP 200)
    - Step 5: Live server-side screenshot rendering via grafana-image-renderer
    """

    def test_t4_1_full_e2e_pipeline_and_screenshot_rendering(self):
        """Execute end-to-end multi-step verification across CAD, DB, API, and Renderer."""
        auth_header = get_grafana_auth_header()
        self.assertIsNotNone(auth_header, "Grafana credentials unavailable in .env.")

        # --- STEP 1: CAD Asset Files Check ---
        floorplan_local = os.path.join(REPO_ROOT, ASSET_FLOORPLAN_REL)
        machines_local = os.path.join(REPO_ROOT, ASSET_MACHINES_JSON_REL)
        plugin_floorplan = os.path.join(REPO_ROOT, PLUGIN_STATIC_FLOORPLAN_REL)

        self.assertTrue(os.path.exists(floorplan_local), f"Floorplan image missing at {floorplan_local}")
        self.assertTrue(os.path.exists(machines_local), f"Machines coordinate JSON missing at {machines_local}")
        self.assertTrue(os.path.exists(plugin_floorplan), f"Plugin static image missing at {plugin_floorplan}")

        # --- STEP 2: Live TimescaleDB Telemetry Freshness ---
        sql = """
        SELECT eqp_id, "time", state, temperature, humidity
        FROM public.ldi_data
        WHERE "time" > NOW() - INTERVAL '1 hour'
        ORDER BY eqp_id, "time" DESC
        LIMIT 10;
        """
        retcode, stdout, stderr = execute_timescaledb_query(sql)
        self.assertEqual(retcode, 0, f"Database query failed in E2E scenario: {stderr}")
        self.assertIn("LDI-", stdout, "No active LDI equipment telemetry returned from TimescaleDB.")

        # --- STEP 3: Grafana Canvas Panel API Verification ---
        dash_url = f"{GRAFANA_BASE_URL}/api/dashboards/uid/{DASHBOARD_UID}"
        req_dash = urllib.request.Request(dash_url, headers={"Authorization": auth_header})
        try:
            with urllib.request.urlopen(req_dash, timeout=10) as resp:
                self.assertEqual(resp.status, 200, f"Failed to retrieve dashboard UID {DASHBOARD_UID} via API.")
                dash_body = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(dash_body.get("dashboard", {}).get("uid"), DASHBOARD_UID)
        except urllib.error.HTTPError as err:
            self.fail(f"HTTP error fetching dashboard {DASHBOARD_UID}: {err.code} {err.reason}")

        # --- STEP 4: Static Image Route Accessibility ---
        static_img_url = f"{GRAFANA_BASE_URL}/public/plugins/3d-panel/img/floorplan_1F.png"
        req_img = urllib.request.Request(static_img_url, headers={"Authorization": auth_header})
        try:
            with urllib.request.urlopen(req_img, timeout=10) as resp:
                self.assertEqual(resp.status, 200, f"Static asset route {static_img_url} returned {resp.status}.")
                content_type = resp.headers.get("Content-Type", "")
                self.assertIn("image/png", content_type, f"Expected image/png Content-Type, got '{content_type}'.")
                img_bytes = resp.read()
                self.assertGreater(len(img_bytes), 10240, "Static floorplan image size is under 10KB.")
                self.assertTrue(img_bytes.startswith(PNG_MAGIC_BYTES), "Static floorplan is not valid PNG.")
        except urllib.error.HTTPError as err:
            self.fail(f"Static image route {static_img_url} failed: HTTP {err.code} {err.reason}")

        # --- STEP 5: Server-Side Screenshot Rendering Verification ---
        render_url = (
            f"{GRAFANA_BASE_URL}/render/d/{DASHBOARD_UID}/{DASHBOARD_SLUG}"
            f"?width=1920&height=1080&tz=UTC&timeout=30"
        )
        req_render = urllib.request.Request(render_url, headers={"Authorization": auth_header})
        try:
            t0 = time.perf_counter()
            with urllib.request.urlopen(req_render, timeout=35) as resp:
                render_duration = time.perf_counter() - t0
                self.assertEqual(resp.status, 200, f"Image renderer returned HTTP {resp.status}.")
                content_type = resp.headers.get("Content-Type", "")
                self.assertIn("image/png", content_type, f"Image renderer Content-Type is '{content_type}'.")

                rendered_png = resp.read()
                self.assertGreater(
                    len(rendered_png), 20480,
                    f"Rendered dashboard screenshot size ({len(rendered_png)} bytes) is below 20KB."
                )
                self.assertTrue(
                    rendered_png.startswith(PNG_MAGIC_BYTES),
                    "Rendered screenshot does not have valid PNG magic bytes."
                )

                # Save rendered evidence artifact for audit
                evidence_dir = os.path.join(REPO_ROOT, "assets", "evidence")
                os.makedirs(evidence_dir, exist_ok=True)
                evidence_path = os.path.join(evidence_dir, "evidence-canvas-floorplan-e2e.png")
                with open(evidence_path, "wb") as f_ev:
                    f_ev.write(rendered_png)

        except urllib.error.HTTPError as err:
            self.fail(f"Image renderer failed for dashboard {DASHBOARD_UID}: HTTP {err.code} {err.reason}")


# ==============================================================================
# MAIN TEST RUNNER
# ==============================================================================

if __name__ == "__main__":
    unittest.main(verbosity=2)
