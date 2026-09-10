-- IMS Floorplan: Primary TimescaleDB LDI & Laser Manufacturing Telemetry Query
-- Used by core timescale pool in multiDb / broadcaster

WITH latest_telemetry AS (
  SELECT DISTINCT ON (d.eqp_id)
    d.eqp_id,
    d.state,
    ROUND(d.temperature::NUMERIC, 1) AS temperature,
    ROUND(d.humidity::NUMERIC, 1) AS humidity,
    ROUND(d.resist_dosage::NUMERIC, 2) AS resist_dosage,
    ROUND(d.scan_speed::NUMERIC, 1) AS scan_speed,
    ROUND(d.air_vacuum::NUMERIC, 1) AS air_vacuum,
    ROUND(d.thickness::NUMERIC, 3) AS thickness,
    d.board_no,
    d.total_board,
    ROUND(d.total_time::NUMERIC, 1) AS total_time,
    d.mo,
    d.fpn,
    d.layer_name,
    d."time" AS last_seen
  FROM public.ldi_data d
  ORDER BY d.eqp_id, d."time" DESC
),
active_alarms AS (
  SELECT DISTINCT a.equipmentid
  FROM public.ldi_alarm_log a
  JOIN public.ldi_alarm_ms_code m ON a.errorcode::TEXT = m.alarm_code::TEXT
  WHERE a.logdate > NOW() - INTERVAL '{{ALARM_WINDOW_MINUTES}} minutes'
    AND m.severity IN ('Critical', 'Major')
)
SELECT
  t.eqp_id,
  'LASER' AS process_type,
  CASE
    WHEN t.last_seen < NOW() - INTERVAL '{{STALENESS_THRESHOLD_MINUTES}} minutes' THEN 0
    WHEN a.equipmentid IS NOT NULL THEN 3
    WHEN t.state = true THEN 1
    ELSE 2
  END AS status,
  t.temperature,
  t.humidity,
  t.resist_dosage,
  t.scan_speed,
  t.air_vacuum,
  t.thickness,
  t.board_no,
  t.total_board,
  t.total_time,
  t.mo,
  t.fpn,
  t.layer_name,
  t.last_seen
FROM latest_telemetry t
LEFT JOIN active_alarms a ON a.equipmentid = t.eqp_id
ORDER BY t.eqp_id;
