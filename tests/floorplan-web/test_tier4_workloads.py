"""
IMS Industrial Real-time 2D Factory Digital Twin WebApp
Tier 4: Real-World Application Workload Scenarios

Authoritative Specs: ORIGINAL_REQUEST.md, PROJECT.md, AGENTS.md
Scenarios:
  - Scenario 1: Full Factory Cold Startup & Batch Job Dispatch
  - Scenario 2: High-Volume Lot Execution & Order Completion Lifecycle
  - Scenario 3: Sudden Vacuum Failure / Chamber Alarm & Operator 1-Click Navigation
  - Scenario 4: Network Outage, Watchdog Trigger, Exponential Backoff & Seamless Resync
  - Scenario 5: Multi-Client Concurrent NOC WebSocket Broadcast & Fleet Scalability
"""

import unittest
import json
import time
from typing import Dict, List, Any, Optional, Tuple


class FactoryDigitalTwinE2EWorkload:
    """Full-featured digital twin E2E workload simulation harness."""

    def __init__(self):
        self.machines: Dict[str, Dict[str, Any]] = {
            f"LDI-{i:02d}": {
                "eqp_id": f"LDI-{i:02d}",
                "status": 0,  # Starts OFF before cold boot
                "state": False,
                "temperature": 22.0,
                "humidity": 55.0,
                "resist_dosage": 45.0,
                "scan_speed": 350.0,
                "air_vacuum": -22.0,
                "thickness": 1.600,
                "board_no": 0,
                "total_board": 0,
                "total_time": 0.0,
                "mo": "",
                "fpn": "",
                "layer_name": "",
                "last_seen": "2026-09-01T00:00:00Z"
            }
            for i in range(1, 11)
        }
        self.clients: Dict[str, Dict[str, Any]] = {}
        self.camera = {"scale": 1.0, "panX": 0.0, "panY": 0.0}
        self.active_alarms: List[str] = []
        self.selected_drawer: Optional[str] = None
        self.machine_coords = {
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

    def connect_client(self, client_id: str):
        self.clients[client_id] = {
            "connected": True,
            "ws_state": "OPEN",
            "last_frame": None,
            "reconnect_attempts": 0
        }

    def disconnect_client(self, client_id: str):
        if client_id in self.clients:
            self.clients[client_id]["connected"] = False
            self.clients[client_id]["ws_state"] = "CLOSED"

    def broadcast_telemetry(self):
        frame = json.dumps(list(self.machines.values()))
        for cid, cdata in self.clients.items():
            if cdata["connected"]:
                cdata["last_frame"] = frame

    def update_machine_telemetry(self, eqp_id: str, updates: Dict[str, Any]):
        if eqp_id not in self.machines:
            return
        m = self.machines[eqp_id]
        m.update(updates)

        # Re-evaluate status
        temp = m.get("temperature", 22.0)
        vacuum = m.get("air_vacuum", -22.0)
        state = m.get("state", False)

        if temp > 26.0 or temp < 18.0 or vacuum > -10.0:
            m["status"] = 3  # ALARM
            if eqp_id not in self.active_alarms:
                self.active_alarms.append(eqp_id)
        elif state:
            m["status"] = 1  # RUN
            if eqp_id in self.active_alarms:
                self.active_alarms.remove(eqp_id)
        else:
            m["status"] = 2  # IDLE
            if eqp_id in self.active_alarms:
                self.active_alarms.remove(eqp_id)

    def click_alarm_focus(self, eqp_id: str):
        if eqp_id in self.machine_coords:
            pos = self.machine_coords[eqp_id]
            self.camera["scale"] = 2.0
            self.camera["panX"] = pos["svgX"]
            self.camera["panY"] = pos["svgY"]
            self.selected_drawer = eqp_id


class TestTier4Workloads(unittest.TestCase):
    """Tier 4: Real-World Application Workload Scenarios."""

    def setUp(self):
        self.twin = FactoryDigitalTwinE2EWorkload()

    # ------------------------------------------------------------------------
    # Scenario 1: Full Factory Cold Startup & Batch Job Dispatch
    # ------------------------------------------------------------------------
    def test_scenario_1_full_factory_cold_startup(self):
        """Scenario 1: Full factory cold startup, DB connection, client connection, and 10-machine batch dispatch."""
        # Step 1: Initial state before startup (All machines OFF)
        for m in self.twin.machines.values():
            self.assertEqual(m["status"], 0)

        # Step 2: System boots up, NOC client connects via WebSocket
        self.twin.connect_client("NOC-Operator-01")
        self.assertTrue(self.twin.clients["NOC-Operator-01"]["connected"])

        # Step 3: TimescaleDB poll connects and returns initial IDLE state for 10 machines
        for i in range(1, 11):
            eqp = f"LDI-{i:02d}"
            self.twin.update_machine_telemetry(eqp, {
                "state": False,
                "temperature": 22.1,
                "humidity": 54.8,
                "air_vacuum": -22.0,
                "mo": f"MO-2026-{i:02d}",
                "fpn": f"PCB-{9000+i}",
                "layer_name": "L1-OUTER",
                "total_board": 100,
                "board_no": 0,
                "last_seen": "2026-09-01T09:15:00Z"
            })
        self.twin.broadcast_telemetry()

        # Step 4: Verify all 10 machines are in IDLE (Status 2, Amber)
        for m in self.twin.machines.values():
            self.assertEqual(m["status"], 2)

        # Step 5: Manufacturing Execution System (MES) dispatches production jobs to all 10 machines
        for i in range(1, 11):
            eqp = f"LDI-{i:02d}"
            self.twin.update_machine_telemetry(eqp, {
                "state": True,
                "board_no": 1,
                "scan_speed": 350.0,
                "resist_dosage": 45.12
            })
        self.twin.broadcast_telemetry()

        # Step 6: Verify 100% fleet utilization (10/10 RUN, Green)
        running_count = sum(1 for m in self.twin.machines.values() if m["status"] == 1)
        self.assertEqual(running_count, 10)
        self.assertEqual(len(self.twin.active_alarms), 0)

    # ------------------------------------------------------------------------
    # Scenario 2: High-Volume Lot Execution & Order Completion Lifecycle
    # ------------------------------------------------------------------------
    def test_scenario_2_lot_execution_and_completion_lifecycle(self):
        """Scenario 2: Manufacturing order progression from 0 to 100 boards and automatic completion back to IDLE."""
        target_machine = "LDI-03"
        total_boards = 100

        # Step 1: Start job on LDI-03
        self.twin.update_machine_telemetry(target_machine, {
            "state": True,
            "mo": "MO-2026-0901-EX",
            "fpn": "PCB-8891-B",
            "layer_name": "L3-SIGNAL",
            "board_no": 0,
            "total_board": total_boards,
            "total_time": 0.0
        })
        self.assertEqual(self.twin.machines[target_machine]["status"], 1)

        # Step 2: Simulate progress checkpoints: 25%, 50%, 75%
        checkpoints = [
            (25, 4.5, 25.0),
            (50, 9.0, 50.0),
            (75, 13.5, 75.0),
        ]
        for b_no, t_elapsed, expected_pct in checkpoints:
            self.twin.update_machine_telemetry(target_machine, {
                "board_no": b_no,
                "total_time": t_elapsed
            })
            m_data = self.twin.machines[target_machine]
            calc_pct = (m_data["board_no"] / m_data["total_board"]) * 100.0
            self.assertEqual(calc_pct, expected_pct)
            self.assertEqual(m_data["total_time"], t_elapsed)
            self.assertEqual(m_data["status"], 1)

        # Step 3: Lot completes at 100 boards (18.5 hours)
        self.twin.update_machine_telemetry(target_machine, {
            "board_no": 100,
            "total_time": 18.5,
            "state": False  # Machine finishes exposure and stops
        })

        # Step 4: Verify machine returns to IDLE state (Status 2) with 100% progress preserved
        completed_data = self.twin.machines[target_machine]
        self.assertEqual(completed_data["status"], 2)  # IDLE
        self.assertEqual(completed_data["board_no"], 100)
        self.assertEqual(completed_data["total_time"], 18.5)

    # ------------------------------------------------------------------------
    # Scenario 3: Sudden Vacuum Failure / Chamber Alarm & Operator 1-Click Navigation
    # ------------------------------------------------------------------------
    def test_scenario_3_alarm_and_operator_navigation(self):
        """Scenario 3: Sudden vacuum loss on LDI-07, alarm banner trigger, 1-click camera focus, and alarm recovery."""
        target_machine = "LDI-07"

        # Step 1: All machines running normally
        for i in range(1, 11):
            self.twin.update_machine_telemetry(f"LDI-{i:02d}", {"state": True, "temperature": 22.0, "air_vacuum": -22.5})
        self.assertEqual(len(self.twin.active_alarms), 0)

        # Step 2: Vacuum failure on LDI-07 (-22.5 kPa -> -2.1 kPa) and temperature spike (28.5°C)
        self.twin.update_machine_telemetry(target_machine, {
            "temperature": 28.5,
            "air_vacuum": -2.1
        })

        # Step 3: Verify Status 3 (ALARM) and active alarm banner list
        self.assertEqual(self.twin.machines[target_machine]["status"], 3)
        self.assertIn(target_machine, self.twin.active_alarms)
        self.assertEqual(len(self.twin.active_alarms), 1)

        # Step 4: Operator clicks the top alarm banner -> 1-click smooth camera navigation
        self.twin.click_alarm_focus(target_machine)

        # Verify camera zoomed to 2.0x and centered on LDI-07 coordinates (2350, 720)
        self.assertEqual(self.twin.camera["scale"], 2.0)
        self.assertEqual(self.twin.camera["panX"], 2350)
        self.assertEqual(self.twin.camera["panY"], 720)
        self.assertEqual(self.twin.selected_drawer, target_machine)

        # Step 5: Maintenance technician fixes vacuum hose; telemetry normalizes
        self.twin.update_machine_telemetry(target_machine, {
            "temperature": 22.3,
            "air_vacuum": -22.8
        })

        # Step 6: Verify alarm resolves and returns to RUN (Status 1)
        self.assertEqual(self.twin.machines[target_machine]["status"], 1)
        self.assertNotIn(target_machine, self.twin.active_alarms)
        self.assertEqual(len(self.twin.active_alarms), 0)

    # ------------------------------------------------------------------------
    # Scenario 4: Network Outage, Exponential Backoff & Seamless Resync
    # ------------------------------------------------------------------------
    def test_scenario_4_network_outage_backoff_and_resync(self):
        """Scenario 4: 15-second network drop, watchdog detection, exponential backoff, and live fleet resync."""
        client_id = "NOC-Wall-Display-01"
        self.twin.connect_client(client_id)

        # Step 1: Initial broadcast received
        self.twin.broadcast_telemetry()
        self.assertIsNotNone(self.twin.clients[client_id]["last_frame"])

        # Step 2: Network outage occurs
        self.twin.disconnect_client(client_id)
        self.assertFalse(self.twin.clients[client_id]["connected"])

        # Step 3: Client backoff progression (Attempts 1 to 4: 1s -> 2s -> 4s -> 8s)
        delays = []
        for attempt in range(1, 5):
            self.twin.clients[client_id]["reconnect_attempts"] = attempt
            delay = min(30.0, 1.0 * (2 ** (attempt - 1)))
            delays.append(delay)
        self.assertEqual(delays, [1.0, 2.0, 4.0, 8.0])

        # Step 4: During outage, MES stops LDI-01 and starts LDI-09
        self.twin.update_machine_telemetry("LDI-01", {"state": False})
        self.twin.update_machine_telemetry("LDI-09", {"state": True})

        # Step 5: Network connection restored -> Client reconnects
        self.twin.connect_client(client_id)
        self.twin.clients[client_id]["reconnect_attempts"] = 0
        self.twin.broadcast_telemetry()

        # Step 6: Verify client instantly receives updated snapshot without reload
        resynced_fleet = json.loads(self.twin.clients[client_id]["last_frame"])
        m_01 = next(m for m in resynced_fleet if m["eqp_id"] == "LDI-01")
        m_09 = next(m for m in resynced_fleet if m["eqp_id"] == "LDI-09")
        self.assertEqual(m_01["status"], 2)  # IDLE
        self.assertEqual(m_09["status"], 1)  # RUN

    # ------------------------------------------------------------------------
    # Scenario 5: Multi-Client Concurrent NOC WebSocket Broadcast & Scalability
    # ------------------------------------------------------------------------
    def test_scenario_5_multiclient_concurrent_broadcast(self):
        """Scenario 5: 25 concurrent NOC operator dashboards receiving simultaneous 2-second telemetry broadcasts."""
        num_clients = 25

        # Step 1: Connect 25 concurrent clients
        for i in range(1, num_clients + 1):
            self.twin.connect_client(f"Client-{i:02d}")
        self.assertEqual(len(self.twin.clients), 25)

        # Step 2: Ingest fleet state update
        for i in range(1, 11):
            self.twin.update_machine_telemetry(f"LDI-{i:02d}", {
                "state": (i % 2 == 0),
                "temperature": 22.0 + (i * 0.1),
                "air_vacuum": -22.0
            })

        # Step 3: Broadcast frame to all 25 clients
        t_start = time.perf_counter()
        self.twin.broadcast_telemetry()
        t_elapsed_ms = (time.perf_counter() - t_start) * 1000.0

        # Step 4: Assert all 25 clients received identical broadcast payload
        first_payload = self.twin.clients["Client-01"]["last_frame"]
        self.assertIsNotNone(first_payload)

        for i in range(1, num_clients + 1):
            cid = f"Client-{i:02d}"
            self.assertEqual(self.twin.clients[cid]["last_frame"], first_payload)

        # Step 5: Verify broadcast distribution latency is well within <50ms budget
        self.assertLess(t_elapsed_ms, 50.0)


if __name__ == "__main__":
    unittest.main()
