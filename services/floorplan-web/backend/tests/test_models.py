from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from app.models import HealthResponse, HistoryRecord, LdiMachineTelemetry, MachineInfo


def test_ldi_machine_telemetry_valid():
    """Verify LdiMachineTelemetry model parses all 15 fields correctly."""
    now = datetime.now(timezone.utc)
    data = {
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
        "last_seen": now,
    }
    model = LdiMachineTelemetry(**data)
    assert model.eqp_id == "LDI-01"
    assert model.status == 1
    assert model.temperature == 22.4
    assert model.humidity == 55.2
    assert model.resist_dosage == 45.12
    assert model.scan_speed == 350.0
    assert model.air_vacuum == -22.5
    assert model.thickness == 1.600
    assert model.board_no == 42
    assert model.total_board == 100
    assert model.total_time == 18.5
    assert model.mo == "MO-2026-0901"
    assert model.fpn == "PCB-8891-B"
    assert model.layer_name == "L3-SIGNAL"
    assert model.last_seen == now


def test_ldi_machine_telemetry_optional_fields():
    """Verify LdiMachineTelemetry handles None values in optional fields."""
    now = datetime.now(timezone.utc)
    data = {
        "eqp_id": "LDI-05",
        "status": 0,
        "last_seen": now,
    }
    model = LdiMachineTelemetry(**data)
    assert model.eqp_id == "LDI-05"
    assert model.status == 0
    assert model.temperature is None
    assert model.mo is None


def test_ldi_machine_telemetry_missing_required():
    """Verify validation error when required fields are missing."""
    with pytest.raises(ValidationError):
        LdiMachineTelemetry(eqp_id="LDI-01")  # missing status and last_seen


def test_machine_info():
    """Verify MachineInfo model."""
    info = MachineInfo(eqp_id="LDI-02", location="Zone Cleanroom A", enabled=True)
    assert info.eqp_id == "LDI-02"
    assert info.location == "Zone Cleanroom A"
    assert info.enabled is True


def test_history_record():
    """Verify HistoryRecord model."""
    now = datetime.now(timezone.utc)
    rec = HistoryRecord(
        time=now,
        temperature=23.1,
        humidity=54.8,
        resist_dosage=46.0,
        scan_speed=340.0,
        air_vacuum=-21.8,
        thickness=1.55,
        board_no=10,
        total_board=50,
        state=True,
    )
    assert rec.time == now
    assert rec.temperature == 23.1
    assert rec.state is True


def test_health_response():
    """Verify HealthResponse model."""
    now = datetime.now(timezone.utc)
    health = HealthResponse(
        status="healthy",
        db_connected=True,
        ws_clients_count=3,
        pool_free=2,
        pool_used=1,
        timestamp=now,
    )
    assert health.status == "healthy"
    assert health.db_connected is True
    assert health.ws_clients_count == 3
