from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class LdiMachineTelemetry(BaseModel):
    """Schema for single LDI machine telemetry state (15 fields)."""

    model_config = ConfigDict(from_attributes=True)

    eqp_id: str = Field(..., description="Equipment identifier (e.g. LDI-01)")
    status: int = Field(..., description="ISA-101 status code: 1=RUN, 2=IDLE, 3=ALARM, 4=LOTO, 0=OFF")
    temperature: Optional[float] = Field(None, description="Chamber temperature (deg C)")
    humidity: Optional[float] = Field(None, description="Chamber relative humidity (%RH)")
    resist_dosage: Optional[float] = Field(None, description="Exposure dosage (mJ/cm2)")
    scan_speed: Optional[float] = Field(None, description="Optical scan speed (mm/s)")
    air_vacuum: Optional[float] = Field(None, description="Chuck vacuum level (kPa)")
    thickness: Optional[float] = Field(None, description="Board thickness (mm)")
    board_no: Optional[int] = Field(None, description="Current board sequence number")
    total_board: Optional[int] = Field(None, description="Total boards in lot")
    total_time: Optional[float] = Field(None, description="Exposure time per board (s)")
    mo: Optional[str] = Field(None, description="Manufacturing Order number")
    fpn: Optional[str] = Field(None, description="Factory Part Number")
    layer_name: Optional[str] = Field(None, description="PCB Layer Name")
    last_seen: datetime = Field(..., description="Timestamp of latest telemetry reading (ISO 8601)")


class MachineInfo(BaseModel):
    """Schema for machine inventory / discovery."""

    model_config = ConfigDict(from_attributes=True)

    eqp_id: str = Field(..., description="Equipment identifier (e.g. LDI-01)")
    location: Optional[str] = Field(None, description="Physical location or zone name")
    enabled: bool = Field(True, description="Whether device is actively monitored")


class HistoryRecord(BaseModel):
    """Historical telemetry record for machine drill-down analytics."""

    model_config = ConfigDict(from_attributes=True)

    time: datetime = Field(..., description="Sample timestamp")
    temperature: Optional[float] = Field(None, description="Chamber temperature (deg C)")
    humidity: Optional[float] = Field(None, description="Chamber relative humidity (%RH)")
    resist_dosage: Optional[float] = Field(None, description="Exposure dosage (mJ/cm2)")
    scan_speed: Optional[float] = Field(None, description="Optical scan speed (mm/s)")
    air_vacuum: Optional[float] = Field(None, description="Chuck vacuum level (kPa)")
    thickness: Optional[float] = Field(None, description="Board thickness (mm)")
    board_no: Optional[int] = Field(None, description="Current board sequence number")
    total_board: Optional[int] = Field(None, description="Total boards in lot")
    state: Optional[bool] = Field(None, description="Machine operational state (True=RUN, False=IDLE)")


class HealthResponse(BaseModel):
    """System and connection health status response."""

    model_config = ConfigDict(from_attributes=True)

    status: str = Field(..., description="'healthy' or 'degraded'")
    db_connected: bool = Field(..., description="True if database connection is active and responsive")
    ws_clients_count: int = Field(..., description="Number of currently connected WebSocket clients")
    pool_free: int = Field(..., description="Free connection count in asyncpg pool")
    pool_used: int = Field(..., description="Active in-use connection count in asyncpg pool")
    timestamp: datetime = Field(..., description="UTC server timestamp")
