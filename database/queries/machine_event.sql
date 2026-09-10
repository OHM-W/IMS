-- IMS Floorplan: Drilling Telemetry Query (Active Table: public.machine_event)
-- Used by drill_db pool in multiDb / broadcaster

WITH latest_event AS (
  SELECT DISTINCT ON (equipment_id)
    id,
    equipment_id,
    message_type,
    event_type,
    event_code,
    event_message,
    spindle,
    tool_no,
    tool_diameter,
    level,
    event_time
  FROM public.machine_event
  WHERE equipment_id IS NOT NULL
  ORDER BY equipment_id, event_time DESC, id DESC
),
latest_program AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    (regexp_match(event_message, '(?i)([a-zA-Z0-9_-]+\\.tlp)'))[1] AS program_name
  FROM public.machine_event
  WHERE event_code IN ('0101', '0103') OR event_message LIKE '%.tlp%'
  ORDER BY equipment_id, event_time DESC, id DESC
),
latest_tool AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    COALESCE(
      NULLIF(TRIM(tool_no || ' (' || tool_diameter || 'mm)'), ' ()mm'),
      (regexp_match(event_message, '(?i)(T[0-9]+(?:\\s*C[0-9.]+)?)'))[1],
      event_message
    ) AS tool_info
  FROM public.machine_event
  WHERE event_type = 'TOOL_CHANGE' 
     OR event_code IN ('0110', '0214', '0215', '0310')
     OR event_message ~* 'ATC T'
  ORDER BY equipment_id, event_time DESC, id DESC
),
latest_hits AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    (regexp_match(event_message, '(?i)(?:at hole|Hole:|start:)\\s*([0-9]+)'))[1] AS hits_info
  FROM public.machine_event
  WHERE event_message ~* '(?i)(?:at hole|Hole:|start:)\\s*([0-9]+)'
  ORDER BY equipment_id, event_time DESC, id DESC
)
SELECT
  e.equipment_id AS eqp_id,
  'DRILLING' AS process_type,
  CASE
    WHEN UPPER(e.event_type) = 'RUN' THEN 1
    WHEN e.event_code = '0408' OR UPPER(e.event_type) IN ('ALARM', 'ERROR', 'E') THEN 3
    WHEN UPPER(e.event_type) IN ('STOP', 'IDLE') OR e.event_code IN ('0108', '0204', '204') THEN 2
    WHEN UPPER(e.event_type) = 'TOOL_CHANGE' OR e.event_code = '0110' THEN 4
    WHEN e.message_type = 'event' THEN 1
    ELSE 5
  END AS status,
  e.event_type,
  e.event_code,
  e.event_message,
  p.program_name,
  t.tool_info,
  h.hits_info,
  e.spindle,
  e.level,
  e.event_time AS last_seen
FROM latest_event e
LEFT JOIN latest_program p ON p.equipment_id = e.equipment_id
LEFT JOIN latest_tool t ON t.equipment_id = e.equipment_id
LEFT JOIN latest_hits h ON h.equipment_id = e.equipment_id;
