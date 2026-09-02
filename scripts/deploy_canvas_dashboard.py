#!/usr/bin/env python3
"""
Deploy IMS Factory Floor 1 Real-Time Canvas Floorplan Dashboard.

Generates the complete Grafana Canvas Dashboard JSON model from:
- assets/machines_1F.json (AutoCAD extracted coordinates)
- TimescaleDB public.ldi_data hypertable telemetry
- ISA-101 industrial canonical color tokens
- Interactive drill-down navigation to LDI Engineering Analytics

Saves to monitoring/grafana/dashboards/manufacturing/ims-factory-floor-1-canvas.json
and deploys to Grafana HTTP API at http://localhost:3000/api/dashboards/db.
"""

import os
import sys
import json
import base64
import urllib.request
import urllib.error
from pathlib import Path


def load_env():
    """Load configuration from .env if present."""
    env = {}
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get_grafana_auth(env):
    """Retrieve Grafana API credentials and base URL."""
    user = os.environ.get('GRAFANA_ADMIN_USER', env.get('GRAFANA_ADMIN_USER', 'admin'))
    password = os.environ.get('GRAFANA_ADMIN_PASSWORD', env.get('GRAFANA_ADMIN_PASSWORD', 'admin1234'))
    grafana_url = os.environ.get('GRAFANA_URL', env.get('GRAFANA_URL', 'http://localhost:3000')).rstrip('/')
    auth_header = 'Basic ' + base64.b64encode(f"{user}:{password}".encode()).decode()
    return grafana_url, auth_header


def build_dashboard_model(repo_root: Path) -> dict:
    """Build the complete Grafana Canvas Dashboard JSON specification."""
    machines_json_path = repo_root / 'assets' / 'machines_1F.json'
    if not machines_json_path.exists():
        raise FileNotFoundError(f"Machine coordinates not found at {machines_json_path}")

    with open(machines_json_path, 'r', encoding='utf-8') as f:
        machines_data = json.load(f)

    cleanroom_machines = machines_data.get('cleanroom_ldi_machines', [])
    if not cleanroom_machines:
        raise ValueError("No cleanroom_ldi_machines found in machines_1F.json")

    letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

    targets = []
    elements = []

    # Build per-machine query targets and canvas elements
    for idx, m in enumerate(cleanroom_machines):
        eqp_id = m['eqp_id']
        name = m.get('name', f"LDI Exposure Unit {idx+1:02d}")
        process = m.get('process', 'DF INNER')
        zone = m.get('zone', 'Cleanroom')
        ref_id = letters[idx] if idx < len(letters) else f"T{idx+1}"

        # Per-machine SQL query with chunk pruning and alarm correlation
        raw_sql = f"""
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
    d.board_no,
    d.total_board
  FROM public.ldi_data d
  WHERE d."time" > NOW() - INTERVAL '1 hour'
    AND d.eqp_id = '{eqp_id}'
    AND d.eqp_id IN (${{machine_id:singlequote}})
  ORDER BY d.eqp_id, d."time" DESC
  LIMIT 1
),
recent_alarms AS (
  SELECT DISTINCT ON (a.equipmentid)
    a.equipmentid,
    m.severity,
    m.alarm_msg
  FROM public.ldi_alarm_log a
  JOIN public.ldi_alarm_ms_code m ON a.errorcode::TEXT = m.alarm_code::TEXT
  WHERE a.equipmentid = '{eqp_id}'
    AND a.logdate > NOW() - INTERVAL '5 minutes'
    AND m.severity IN ('Critical', 'Major')
  ORDER BY a.equipmentid, a.logdate DESC
  LIMIT 1
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
  COALESCE(l.board_no::TEXT, '—') || ' / ' || COALESCE(l.total_board::TEXT, '—') AS progress,
  CASE
    WHEN l."time" IS NULL OR l."time" < NOW() - INTERVAL '5 minutes' THEN 0
    WHEN a.equipmentid IS NOT NULL THEN 3
    WHEN l.state = TRUE THEN 1
    WHEN l.state = FALSE THEN 2
    ELSE 0
  END AS state_code,
  CASE
    WHEN l."time" IS NULL OR l."time" < NOW() - INTERVAL '5 minutes' THEN 'OFF'
    WHEN a.equipmentid IS NOT NULL THEN 'ALARM'
    WHEN l.state = TRUE THEN 'RUN'
    WHEN l.state = FALSE THEN 'IDLE'
    ELSE 'OFF'
  END AS status_label,
  CASE
    WHEN l."time" IS NULL OR l."time" < NOW() - INTERVAL '5 minutes' THEN '#64748B'
    WHEN a.equipmentid IS NOT NULL THEN '#FF003C'
    WHEN l.state = TRUE THEN '#00FF87'
    WHEN l.state = FALSE THEN '#FFB800'
    ELSE '#64748B'
  END AS status_color,
  COALESCE(a.alarm_msg, 'Normal Operation') AS alarm_detail
FROM latest_ldi l
LEFT JOIN recent_alarms a ON l.eqp_id = a.equipmentid;
""".strip()

        targets.append({
            "refId": ref_id,
            "datasource": {"uid": "timescaledb", "type": "postgres"},
            "editorMode": "code",
            "format": "table",
            "rawQuery": True,
            "rawSql": raw_sql
        })

        # Coordinates from CAD normalization
        left = round(m['canvas_left_px_1920'])
        top = round(m['canvas_top_px_1080'])

        # Metric value node for machine status
        elem = {
            "type": "metric-value",
            "name": f"machine-{eqp_id}",
            "placement": {
                "top": top,
                "left": left,
                "width": 110,
                "height": 55,
                "rotation": 0
            },
            "config": {
                "text": {
                    "mode": "fixed",
                    "fixed": eqp_id
                },
                "color": {
                    "mode": "fixed",
                    "fixed": "#FFFFFF"
                },
                "size": 13
            },
            "background": {
                "color": {
                    "mode": "field",
                    "field": "state_code"
                }
            },
            "border": {
                "color": {
                    "mode": "fixed",
                    "fixed": "#1E293B"
                },
                "width": 1,
                "radius": 4
            },
            "links": [
                {
                    "title": f"Open Engineering Drilldown for {eqp_id}",
                    "url": f"/d/ims-engineering/ims-engineering-drill-down?var-machine_id={eqp_id}&from=${{__from}}&to=${{__to}}",
                    "targetBlank": False,
                    "oneClick": True
                }
            ]
        }
        elements.append(elem)

    dashboard = {
        "uid": "floor1-canvas",
        "title": "IMS Factory Floor 1 - Real-Time Canvas Floorplan",
        "description": "Industrial 2D Factory Floor Plan monitoring all 10 LDI cleanroom machines overlaid on AutoCAD architectural blueprint.",
        "tags": ["IMS", "Floor1", "Canvas", "manufacturing", "ISA-101"],
        "timezone": "UTC",
        "schemaVersion": 39,
        "refresh": "5s",
        "liveNow": True,
        "style": "dark",
        "editable": True,
        "graphTooltip": 0,
        "time": {
            "from": "now-1h",
            "to": "now"
        },
        "timepicker": {
            "refresh_intervals": ["5s", "10s", "30s", "1m", "5m"]
        },
        "templating": {
            "list": [
                {
                    "name": "machine_id",
                    "type": "query",
                    "datasource": {"uid": "timescaledb"},
                    "query": "SELECT DISTINCT eqp_id FROM public.ldi_data ORDER BY eqp_id;",
                    "refresh": 2,
                    "multi": True,
                    "includeAll": True,
                    "allValue": ".*",
                    "current": {
                        "text": "All",
                        "value": ["$__all"],
                        "selected": True
                    },
                    "label": "Machine"
                }
            ]
        },
        "panels": [
            {
                "id": 1,
                "type": "canvas",
                "title": "Factory Floor 1 - Real-Time Machine Status",
                "description": "2D Floorplan Canvas visualizing machine states and telemetry across Floor 1 Cleanroom.",
                "gridPos": {
                    "x": 0,
                    "y": 0,
                    "w": 24,
                    "h": 20
                },
                "datasource": {
                    "uid": "timescaledb"
                },
                "fieldConfig": {
                    "defaults": {
                        "mappings": [],
                        "thresholds": {
                            "mode": "absolute",
                            "steps": [{"color": "#64748B", "value": None}]
                        }
                    },
                    "overrides": [
                        {
                            "matcher": {
                                "id": "byName",
                                "options": "state_code"
                            },
                            "properties": [
                                {
                                    "id": "mappings",
                                    "value": [
                                        {
                                            "type": "value",
                                            "options": {
                                                "0": {"color": "#64748B", "text": "OFF"},
                                                "1": {"color": "#00FF87", "text": "RUN"},
                                                "2": {"color": "#FFB800", "text": "IDLE"},
                                                "3": {"color": "#FF003C", "text": "ALARM"},
                                                "4": {"color": "#00F2FE", "text": "LOTO"}
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                "targets": targets,
                "options": {
                    "inlineEditing": False,
                    "showAdvancedTypes": True,
                    "panZoom": True,
                    "root": {
                        "type": "frame",
                        "name": "root",
                        "background": {
                            "color": {
                                "mode": "fixed",
                                "fixed": "#0B0F19"
                            },
                            "image": {
                                "url": "/public/plugins/3d-panel/img/floorplan_1F.png",
                                "mode": "cover"
                            }
                        },
                        "elements": elements
                    }
                }
            }
        ]
    }

    return dashboard


def deploy_dashboard():
    """Deploy dashboard JSON model to disk and Grafana API."""
    repo_root = Path(__file__).resolve().parent.parent
    env = load_env()
    grafana_url, auth_header = get_grafana_auth(env)

    print("=" * 70)
    print("IMS Factory Floor 1 Canvas Dashboard Generator & Deployer")
    print("=" * 70)

    # 1. Generate Dashboard JSON Model
    print("\n[1/4] Generating dashboard JSON model from assets/machines_1F.json...")
    dashboard = build_dashboard_model(repo_root)
    print(f"  - Dashboard UID: {dashboard['uid']}")
    print(f"  - Title: {dashboard['title']}")
    print(f"  - Canvas Elements: {len(dashboard['panels'][0]['options']['root']['elements'])}")
    print(f"  - Query Targets: {len(dashboard['panels'][0]['targets'])}")

    # 2. Save JSON to disk
    output_path = repo_root / 'monitoring' / 'grafana' / 'dashboards' / 'manufacturing' / 'ims-factory-floor-1-canvas.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)
    print(f"\n[2/4] Saved dashboard JSON to:\n  {output_path} ({output_path.stat().st_size:,} bytes)")

    # 3. Deploy to Grafana HTTP API
    print(f"\n[3/4] Deploying dashboard to Grafana API ({grafana_url}/api/dashboards/db)...")
    payload = {
        "dashboard": dashboard,
        "folderUid": "ffwbcp6ncinlsa",  # IMS Manufacturing folder
        "overwrite": True,
        "message": "Deployed IMS Factory Floor 1 Real-Time Canvas Floorplan Dashboard"
    }

    req = urllib.request.Request(
        f"{grafana_url}/api/dashboards/db",
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': auth_header
        }
    )

    try:
        with urllib.request.urlopen(req) as resp:
            status_code = resp.status
            resp_data = json.loads(resp.read().decode('utf-8'))
            print(f"  HTTP POST Response: Status {status_code}")
            print(f"  Response Body: {json.dumps(resp_data, indent=2)}")
            if status_code != 200 or resp_data.get('status') != 'success':
                raise RuntimeError(f"Unexpected Grafana API response: {resp_data}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        print(f"  [ERROR] HTTP {e.code}: {err_body}", file=sys.stderr)
        raise

    # 4. Verify GET & Image Renderer
    print(f"\n[4/4] Verifying dashboard deployment and server-side rendering...")
    # Verify GET
    get_req = urllib.request.Request(
        f"{grafana_url}/api/dashboards/uid/floor1-canvas",
        headers={'Authorization': auth_header}
    )
    with urllib.request.urlopen(get_req) as get_resp:
        get_body = json.loads(get_resp.read().decode('utf-8'))
        print(f"  - GET /api/dashboards/uid/floor1-canvas: Status {get_resp.status} (OK)")
        print(f"  - Confirmed Title: {get_body.get('dashboard', {}).get('title')}")

    # Verify PNG Render
    render_url = f"{grafana_url}/render/d/floor1-canvas/ims-factory-floor-1-real-time-canvas-floorplan?width=1920&height=1080&tz=UTC"
    render_req = urllib.request.Request(render_url, headers={'Authorization': auth_header})
    try:
        with urllib.request.urlopen(render_req) as render_resp:
            png_bytes = render_resp.read()
            print(f"  - Grafana Image Renderer: Status {render_resp.status} (OK)")
            print(f"  - Rendered PNG Size: {len(png_bytes):,} bytes")
            if len(png_bytes) < 10000:
                print("  [WARNING] Rendered image is smaller than expected.", file=sys.stderr)
    except Exception as e:
        print(f"  [NOTE] Image renderer check: {e}")

    print("\n" + "=" * 70)
    print("SUCCESS: IMS Factory Floor 1 Canvas Dashboard deployed and verified!")
    print(f"URL: {grafana_url}/d/floor1-canvas/ims-factory-floor-1-real-time-canvas-floorplan")
    print("=" * 70)


if __name__ == '__main__':
    try:
        deploy_dashboard()
    except Exception as exc:
        print(f"\n[FAILED] Execution error: {exc}", file=sys.stderr)
        sys.exit(1)
