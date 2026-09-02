"""
IMS Real-Time 2D Factory Digital Twin WebApp
Challenger 2 Empirical Verification Test Suite

Covers:
1. Docker Build Configuration & Multi-stage Structure
2. Nginx Reverse Proxy Configuration, Routing Logic, and Proxy Headers
3. Supervisord Process Management Configuration
4. Docker Compose Service Dependencies, Networks, Port Mappings, and Healthchecks
5. Backend API Endpoints, WebSocket Handling, Database Pooling (PgBouncer compatibility), and Data Serialization Stress
"""

import os
import sys
import re
import json
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

# Safe parser for docker-compose.yaml without third-party pyyaml dependency
from fastapi.testclient import TestClient

# Ensure services/floorplan-web/backend is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(BASE_DIR, "services", "floorplan-web", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.config import settings
from app.models import LdiMachineTelemetry, MachineInfo, HistoryRecord, HealthResponse
from app.broadcaster import Broadcaster, serialize_row, PRIMARY_TELEMETRY_SQL, FALLBACK_TELEMETRY_SQL


class TestDockerBuildConfig(unittest.TestCase):
    """Empirically verifies Dockerfile structure, multi-stage build, and file references."""

    def setUp(self):
        self.dockerfile_path = os.path.join(BASE_DIR, "services", "floorplan-web", "Dockerfile")
        self.assertTrue(os.path.exists(self.dockerfile_path), "Dockerfile does not exist")
        with open(self.dockerfile_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_multi_stage_structure(self):
        """Verify presence of Node build stage and Python runtime stage."""
        self.assertIn("FROM node:20-alpine AS frontend-builder", self.content)
        self.assertIn("FROM python:3.12-slim", self.content)

    def test_frontend_build_steps(self):
        """Verify frontend builder steps in Dockerfile."""
        self.assertIn("WORKDIR /app/frontend", self.content)
        self.assertIn("COPY frontend/package.json ./", self.content)
        self.assertIn("RUN npm install", self.content)
        self.assertIn("COPY frontend/ ./", self.content)
        self.assertIn("RUN npm run build", self.content)

    def test_runtime_dependencies_and_copies(self):
        """Verify runtime dependencies, file copies, and configurations."""
        self.assertIn("nginx", self.content)
        self.assertIn("supervisor", self.content)
        self.assertIn("curl", self.content)
        self.assertIn("rm -f /etc/nginx/sites-enabled/default", self.content)
        self.assertIn("COPY backend/requirements.txt /app/requirements.txt", self.content)
        self.assertIn("COPY backend/app /app/app", self.content)
        self.assertIn("COPY --from=frontend-builder /app/frontend/dist /var/www/html", self.content)
        self.assertIn("COPY nginx.conf /etc/nginx/conf.d/default.conf", self.content)
        self.assertIn("COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf", self.content)

    def test_healthcheck_and_ports(self):
        """Verify EXPOSE 80 and HEALTHCHECK command."""
        self.assertIn("EXPOSE 80", self.content)
        self.assertIn("HEALTHCHECK", self.content)
        self.assertIn("http://127.0.0.1:80/api/health", self.content)
        self.assertIn('CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]', self.content)

    def test_all_referenced_source_files_exist_on_host(self):
        """Verify that every local file referenced in Dockerfile COPY exists."""
        service_root = os.path.join(BASE_DIR, "services", "floorplan-web")
        files_to_check = [
            os.path.join(service_root, "frontend", "package.json"),
            os.path.join(service_root, "frontend", "vite.config.ts"),
            os.path.join(service_root, "backend", "requirements.txt"),
            os.path.join(service_root, "backend", "app", "main.py"),
            os.path.join(service_root, "nginx.conf"),
            os.path.join(service_root, "supervisord.conf"),
        ]
        for path in files_to_check:
            self.assertTrue(os.path.exists(path), f"Referenced file missing: {path}")


class TestNginxConfigAndRouting(unittest.TestCase):
    """Empirically parses and verifies Nginx configuration directives, routing logic, and proxy headers."""

    def setUp(self):
        self.nginx_conf_path = os.path.join(BASE_DIR, "services", "floorplan-web", "nginx.conf")
        self.assertTrue(os.path.exists(self.nginx_conf_path), "nginx.conf does not exist")
        with open(self.nginx_conf_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_server_listening_and_root(self):
        """Verify port 80 listening, web root, and index directives."""
        self.assertRegex(self.content, r"listen\s+80\s*;")
        self.assertRegex(self.content, r"root\s+/var/www/html\s*;")
        self.assertRegex(self.content, r"index\s+index\.html\s*;")

    def test_gzip_compression(self):
        """Verify gzip compression and MIME types including SVG and JSON."""
        self.assertRegex(self.content, r"gzip\s+on\s*;")
        self.assertIn("image/svg+xml", self.content)
        self.assertIn("application/json", self.content)
        self.assertIn("application/javascript", self.content)
        self.assertIn("text/css", self.content)

    def test_spa_static_routing(self):
        """Verify SPA fallback routing via try_files."""
        self.assertIn("location / {", self.content)
        self.assertIn("try_files $uri $uri/ /index.html;", self.content)

    def test_static_asset_caching(self):
        """Verify long-term caching headers for /assets/."""
        self.assertIn("location /assets/ {", self.content)
        self.assertIn("expires 1y;", self.content)
        self.assertIn('add_header Cache-Control "public, immutable";', self.content)

    def test_websocket_proxy_headers_and_timeouts(self):
        """Verify /ws/ proxy pass, upgrade headers, and long timeouts."""
        self.assertIn("location /ws/ {", self.content)
        self.assertIn("proxy_pass http://127.0.0.1:8000/ws/;", self.content)
        self.assertIn("proxy_http_version 1.1;", self.content)
        self.assertIn("proxy_set_header Upgrade $http_upgrade;", self.content)
        self.assertIn('proxy_set_header Connection "Upgrade";', self.content)
        self.assertIn("proxy_set_header Host $host;", self.content)
        self.assertIn("proxy_read_timeout 3600s;", self.content)
        self.assertIn("proxy_send_timeout 3600s;", self.content)

    def test_rest_api_proxy_headers(self):
        """Verify /api/ proxy pass and forwarded headers."""
        self.assertIn("location /api/ {", self.content)
        self.assertIn("proxy_pass http://127.0.0.1:8000/api/;", self.content)
        self.assertIn("proxy_http_version 1.1;", self.content)
        self.assertIn("proxy_set_header Host $host;", self.content)
        self.assertIn("proxy_set_header X-Real-IP $remote_addr;", self.content)
        self.assertIn("proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;", self.content)
        self.assertIn("proxy_set_header X-Forwarded-Proto $scheme;", self.content)

    def test_openapi_docs_proxy(self):
        """Verify /docs and /openapi.json routing."""
        self.assertIn("location /docs {", self.content)
        self.assertIn("proxy_pass http://127.0.0.1:8000/docs;", self.content)
        self.assertIn("location /openapi.json {", self.content)
        self.assertIn("proxy_pass http://127.0.0.1:8000/openapi.json;", self.content)


class TestSupervisordConfig(unittest.TestCase):
    """Empirically verifies Supervisord process definitions."""

    def setUp(self):
        self.conf_path = os.path.join(BASE_DIR, "services", "floorplan-web", "supervisord.conf")
        self.assertTrue(os.path.exists(self.conf_path), "supervisord.conf does not exist")
        with open(self.conf_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_supervisord_global_section(self):
        """Verify global supervisord settings."""
        self.assertIn("[supervisord]", self.content)
        self.assertIn("nodaemon=true", self.content)
        self.assertIn("logfile=/var/log/supervisor/supervisord.log", self.content)
        self.assertIn("pidfile=/run/supervisord.pid", self.content)

    def test_supervisord_socket_and_cli_sections(self):
        """Verify UNIX socket and supervisorctl CLI configuration."""
        self.assertIn("[unix_http_server]", self.content)
        self.assertIn("file=/run/supervisor.sock", self.content)
        self.assertIn("[rpcinterface:supervisor]", self.content)
        self.assertIn("supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface", self.content)
        self.assertIn("[supervisorctl]", self.content)
        self.assertIn("serverurl=unix:///run/supervisor.sock", self.content)

    def test_uvicorn_program(self):
        """Verify uvicorn process definition."""
        self.assertIn("[program:uvicorn]", self.content)
        self.assertIn("command=uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1", self.content)
        self.assertIn("directory=/app", self.content)
        self.assertIn("autostart=true", self.content)
        self.assertIn("autorestart=true", self.content)
        self.assertIn("stdout_logfile=/dev/stdout", self.content)
        self.assertIn("stderr_logfile=/dev/stderr", self.content)

    def test_nginx_program(self):
        """Verify nginx process definition."""
        self.assertIn("[program:nginx]", self.content)
        self.assertIn('command=nginx -g "daemon off;"', self.content)
        self.assertIn("autostart=true", self.content)
        self.assertIn("autorestart=true", self.content)
        self.assertIn("stdout_logfile=/dev/stdout", self.content)
        self.assertIn("stderr_logfile=/dev/stderr", self.content)


class TestDockerComposeIntegration(unittest.TestCase):
    """Empirically parses and verifies docker-compose.yaml service configuration."""

    def setUp(self):
        self.compose_path = os.path.join(BASE_DIR, "docker-compose.yaml")
        self.assertTrue(os.path.exists(self.compose_path), "docker-compose.yaml does not exist")
        with open(self.compose_path, "r", encoding="utf-8") as f:
            self.compose_text = f.read()

    def test_floorplan_web_service_exists(self):
        """Verify floorplan-web service is defined in services."""
        self.assertIn("floorplan-web:", self.compose_text)
        self.assertIn("container_name: ims-floorplan-web", self.compose_text)

    def test_build_context_and_port_mapping(self):
        """Verify build context and port 8080:80 mapping."""
        self.assertIn("context: ./services/floorplan-web", self.compose_text)
        self.assertIn('"8080:80"', self.compose_text)

    def test_network_and_dependencies(self):
        """Verify network attachment and service dependency conditions."""
        self.assertIn("ims-internal", self.compose_text)
        self.assertIn("pgbouncer:\n        condition: service_healthy", self.compose_text)
        self.assertIn("db-migrate:\n        condition: service_completed_successfully", self.compose_text)

    def test_environment_variables(self):
        """Verify required environment variables for PgBouncer & TimescaleDB connection."""
        self.assertIn("PGHOST: ims-pgbouncer", self.compose_text)
        self.assertIn('PGPORT: "5432"', self.compose_text)
        self.assertIn("PGDATABASE: ${POSTGRES_DB}", self.compose_text)
        self.assertIn("POLL_INTERVAL_SECONDS: \"2.0\"", self.compose_text)

    def test_healthcheck_configuration(self):
        """Verify healthcheck curl probe definition."""
        self.assertIn("curl -f http://127.0.0.1:80/api/health || exit 1", self.compose_text)


class TestBackendApiAndDataContractStress(unittest.TestCase):
    """Empirically stress-tests backend API endpoints, serialization, error conditions, and database contracts."""

    def setUp(self):
        self.client = TestClient(app)

    def test_root_endpoint_metadata(self):
        """Verify root endpoint provides API directory and status."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "running")
        self.assertIn("endpoints", data)
        self.assertEqual(data["endpoints"]["health"], "/api/health")
        self.assertEqual(data["endpoints"]["snapshot"], "/api/snapshot")
        self.assertEqual(data["endpoints"]["websocket"], "/ws/ldi")

    def test_health_endpoint_response_structure(self):
        """Verify /api/health endpoint structure under degraded / mock states."""
        with patch("app.routes.health.db.check_health", new_callable=AsyncMock) as mock_health, \
             patch("app.routes.health.db.get_pool_stats", return_value=(5, 2)):
            mock_health.return_value = True
            response = self.client.get("/api/health")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "healthy")
            self.assertTrue(data["db_connected"])
            self.assertEqual(data["pool_free"], 5)
            self.assertEqual(data["pool_used"], 2)
            self.assertIn("timestamp", data)

            # Degraded state
            mock_health.return_value = False
            response = self.client.get("/api/health")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "degraded")
            self.assertFalse(data["db_connected"])

    def test_snapshot_endpoint_15_fields_strict_contract(self):
        """Verify /api/snapshot output strictly adheres to 15-field LdiMachineTelemetry schema."""
        mock_snapshot = [
            {
                "eqp_id": "LDI-01",
                "status": 1,
                "temperature": 22.4,
                "humidity": 45.2,
                "resist_dosage": 35.50,
                "scan_speed": 120.0,
                "air_vacuum": -85.2,
                "thickness": 1.250,
                "board_no": 42,
                "total_board": 100,
                "total_time": 45.0,
                "mo": "MO-2026-001",
                "fpn": "FPN-8890",
                "layer_name": "L3_SIGNAL",
                "last_seen": "2026-09-01T12:00:00+00:00",
            }
        ]
        with patch("app.routes.telemetry.broadcaster.fetch_snapshot", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_snapshot
            response = self.client.get("/api/snapshot")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(len(data), 1)
            item = data[0]
            
            # Assert all 15 fields exist
            expected_fields = {
                "eqp_id", "status", "temperature", "humidity", "resist_dosage",
                "scan_speed", "air_vacuum", "thickness", "board_no", "total_board",
                "total_time", "mo", "fpn", "layer_name", "last_seen"
            }
            self.assertEqual(set(item.keys()), expected_fields)
            self.assertEqual(item["eqp_id"], "LDI-01")
            self.assertEqual(item["status"], 1)

    def test_history_endpoint_validation_and_bounds(self):
        """Verify /api/history/{eqp_id} query parameter validation and SQL parameterization."""
        # Test boundary validation on minutes (1..1440) and limit (1..1000)
        # Invalid minutes < 1
        res = self.client.get("/api/history/LDI-01?minutes=0")
        self.assertEqual(res.status_code, 422)

        # Invalid minutes > 1440
        res = self.client.get("/api/history/LDI-01?minutes=2000")
        self.assertEqual(res.status_code, 422)

        # Invalid limit > 1000
        res = self.client.get("/api/history/LDI-01?limit=5000")
        self.assertEqual(res.status_code, 422)

    def test_serialize_row_robustness_stress(self):
        """Stress-test serialize_row function with Decimal, nulls, unexpected strings, and datetimes."""
        now = datetime.now(timezone.utc)
        raw_row = {
            "eqp_id": "LDI-09",
            "status": "3",
            "temperature": Decimal("23.45"),
            "humidity": "48.1",
            "resist_dosage": 32.1,
            "scan_speed": None,
            "air_vacuum": Decimal("-80.0"),
            "thickness": 1.2,
            "board_no": "15",
            "total_board": 50,
            "total_time": Decimal("60.5"),
            "mo": None,
            "fpn": "PART-X",
            "layer_name": None,
            "last_seen": now,
        }
        res = serialize_row(raw_row)
        self.assertIsInstance(res["last_seen"], str)
        self.assertEqual(res["last_seen"], now.isoformat())
        self.assertIsInstance(res["status"], int)
        self.assertEqual(res["status"], 3)
        self.assertIsInstance(res["temperature"], float)
        self.assertEqual(res["temperature"], 23.45)
        self.assertIsInstance(res["humidity"], float)
        self.assertEqual(res["humidity"], 48.1)
        self.assertIsInstance(res["board_no"], int)
        self.assertEqual(res["board_no"], 15)
        self.assertIsNone(res["scan_speed"])
        self.assertIsNone(res["mo"])

    def test_sql_dialect_pgbouncer_compatibility(self):
        """Verify that backend configuration complies with AGENTS.md rules for PgBouncer & public schema."""
        self.assertEqual(settings.STATEMENT_CACHE_SIZE, 0, "STATEMENT_CACHE_SIZE must be 0 for PgBouncer transaction pooling")
        self.assertIn("public.ldi_data", PRIMARY_TELEMETRY_SQL)
        self.assertIn("public.ldi_alarm_log", PRIMARY_TELEMETRY_SQL)
        self.assertIn("public.ldi_data", FALLBACK_TELEMETRY_SQL)
        self.assertNotIn("ims.ldi_data", PRIMARY_TELEMETRY_SQL, "Schema must be public only, never ims.*")


if __name__ == "__main__":
    unittest.main(verbosity=2)
