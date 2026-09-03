-- IMS Floorplan: Drilling Telemetry Ingestion Query
-- Used by drill_db pool in multiDb / broadcaster

WITH latest_event AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_type,
    event_code,
    event_message,
    level,
    event_time
  FROM public.tbl_dr_event
  ORDER BY equipment_id, event_time DESC
),
latest_program AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_message AS program_name
  FROM public.tbl_dr_event
  WHERE event_type = 'PROGRAM_LOAD'
  ORDER BY equipment_id, event_time DESC
),
latest_tool AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_message AS tool_info
  FROM public.tbl_dr_event
  WHERE event_type = 'TOOL_CHANGE'
  ORDER BY equipment_id, event_time DESC
),
latest_hits AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_message AS hits_info
  FROM public.tbl_dr_event
  WHERE event_message LIKE 'Run Hits:%'
  ORDER BY equipment_id, event_time DESC
)
SELECT
  e.equipment_id AS eqp_id,
  'DRILLING' AS process_type,
  CASE
    WHEN UPPER(e.event_type) = 'RUN' THEN 1
    WHEN UPPER(e.event_type) IN ('STOP', 'IDLE') THEN 2
    WHEN UPPER(e.event_type) IN ('ALARM', 'ERROR') THEN 3
    WHEN UPPER(e.event_type) = 'TOOL_CHANGE' THEN 4
    ELSE 5
  END AS status,
  e.event_type,
  e.event_code,
  e.event_message,
  p.program_name,
  t.tool_info,
  h.hits_info,
  e.level,
  e.event_time AS last_seen
FROM latest_event e
LEFT JOIN latest_program p ON p.equipment_id = e.equipment_id
LEFT JOIN latest_tool t ON t.equipment_id = e.equipment_id
LEFT JOIN latest_hits h ON h.equipment_id = e.equipment_id;
