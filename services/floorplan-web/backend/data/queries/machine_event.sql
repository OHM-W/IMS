-- IMS Floorplan: Drilling Telemetry Query (Aligned with Grafana Production Standard)
-- Used by drill_db pool in multiDb / broadcaster

WITH latest_per_eqp AS (
  SELECT DISTINCT ON (equipment_id)
    equipment_id,
    event_type,
    event_code,
    event_message,
    event_time,
    spindle,
    id
  FROM public.machine_event
  WHERE equipment_id IS NOT NULL
  ORDER BY equipment_id, event_time DESC, id DESC
)
SELECT
  l.equipment_id AS eqp_id,
  'DRILLING' AS process_type,
  CASE 
    WHEN l.event_code IN ('0408', '0417') OR l.event_type IN ('ALARM', 'E') THEN 3
    WHEN l.event_type = 'STOP' OR l.event_code = '0108' THEN 2
    WHEN l.event_type = 'PROGRAM_LOAD' OR l.event_code = '0103' THEN 2
    WHEN l.event_type = 'TOOL_CHANGE' OR l.event_code = '0110' THEN 4
    ELSE 1
  END AS status,
  CASE 
    WHEN l.event_code IN ('0408', '0417') THEN 
      COALESCE(
        INITCAP((regexp_match(l.event_message, '(?i)(spindle\s*#?[0-9]+)'))[1]) || ' Tool is broken',
        'Tool is broken'
      )
    WHEN l.event_type IN ('ALARM', 'E') THEN 'ALARM'
    WHEN l.event_type = 'STOP' OR l.event_code = '0108' THEN 'STOP'
    WHEN l.event_type = 'TOOL_CHANGE' OR l.event_code = '0110' THEN 'TOOL_CHANGE'
    WHEN l.event_type = 'PROGRAM_LOAD' OR l.event_code = '0103' THEN 'FINISHED'
    ELSE 'RUN'
  END AS event_type,
  COALESCE(
    CASE 
      WHEN l.event_code ~ '^[0-9]+$' AND (l.event_type IN ('ALARM', 'E') OR l.event_code IN ('0408', '0417')) THEN 'E-' || l.event_code
      WHEN l.event_code ~ '^[0-9]+$' THEN 'M-' || l.event_code
      ELSE l.event_code
    END, 'N/A'
  ) AS event_code,
  COALESCE(l.event_message, 'Normal execution') AS event_message,
  p.prog AS program_name,
  td.tool_dia AS tool_info,
  h.holes AS hits_info,
  r.rpm,
  f.feed,
  COALESCE(NULLIF(TRIM(l.spindle), ''), INITCAP((regexp_match(l.event_message, '(?i)(spindle\s*#?[0-9]+)'))[1]), 'SPINDLE_MAIN_1') AS spindle,
  NULL AS level,
  l.event_time AS last_seen
FROM latest_per_eqp l
LEFT JOIN LATERAL (
  SELECT (regexp_match(event_message, '(?i)([a-zA-Z0-9_\- ]+\.tlp)'))[1] AS prog
  FROM public.machine_event me
  WHERE me.equipment_id = l.equipment_id
    AND (me.event_code IN ('0101', '0103') OR me.event_message ILIKE '%.tlp%')
  ORDER BY me.event_time DESC, me.id DESC
  LIMIT 1
) p ON true
LEFT JOIN LATERAL (
  SELECT 
    CASE
      WHEN me.event_message ~* 'T[0-9]+' AND me.event_message ~* 'C[0-9]+(?:\.[0-9]+)?' THEN
        UPPER((regexp_match(me.event_message, '(T[0-9]+)', 'i'))[1]) || ' (' || 
        (regexp_match(me.event_message, 'C([0-9]+(?:\.[0-9]+)?)', 'i'))[1] || 'mm)'
      WHEN me.event_message ~* '->[[:space:]]*T[1-9][0-9]*M[0-9]+' THEN
        UPPER((regexp_match(me.event_message, '->[[:space:]]*(T[0-9]+)', 'i'))[1]) || ' (' || 
        UPPER((regexp_match(me.event_message, '->[[:space:]]*T[0-9]+(M[0-9]+)', 'i'))[1]) || ')'
      WHEN me.event_message ~* 'ATC[[:space:]]*T[1-9][0-9]*M[0-9]+' THEN
        UPPER((regexp_match(me.event_message, 'ATC[[:space:]]*(T[0-9]+)', 'i'))[1]) || ' (' || 
        UPPER((regexp_match(me.event_message, 'ATC[[:space:]]*T[0-9]+(M[0-9]+)', 'i'))[1]) || ')'
      WHEN me.event_message ~* '^(T[0-9]+)[[:space:]]+' THEN
        UPPER((regexp_match(me.event_message, '^(T[0-9]+)', 'i'))[1])
      WHEN me.event_message ~* '[[:<:]](T[0-9]{1,4})[[:>:]]' THEN
        UPPER((regexp_match(me.event_message, '[[:<:]](T[0-9]{1,4})[[:>:]]', 'i'))[1])
      ELSE NULL
    END AS tool_dia
  FROM public.machine_event me
  WHERE me.equipment_id = l.equipment_id
    AND (me.event_type = 'TOOL_CHANGE' OR me.event_code IN ('0110', '0119', '0214', '0215', '0310'))
  ORDER BY me.event_time DESC, me.id DESC
  LIMIT 1
) td ON true
LEFT JOIN LATERAL (
  SELECT 
    to_char((regexp_match(event_message, '(?i)(?:at hole|Hole:|start:)[[:space:]]*([0-9]+)'))[1]::bigint, 'FM999,999,999') || ' (' ||
    CASE 
      WHEN event_code = '0110' THEN 'Tool Change'
      WHEN event_code = '0108' THEN 'Machine Stop'
      WHEN event_code IN ('0417', '0120') THEN 'Tool Broken'
      WHEN event_code = '0112' THEN 'Cycle Start'
      ELSE 'Running'
    END || ')' AS holes
  FROM public.machine_event me
  WHERE me.equipment_id = l.equipment_id
    AND me.event_code IN ('0110', '0108', '0417', '0120', '0112', '0201')
    AND me.event_message ~* '(?i)(?:at hole|Hole:|start:|Run Hits:)[[:space:]]*([0-9]+)'
  ORDER BY me.event_time DESC, me.id DESC
  LIMIT 1
) h ON true
LEFT JOIN LATERAL (
  SELECT 
    ROUND((regexp_match(event_message, '(?i)\[Rpm\]:[^>]+->[[:space:]]*([0-9.]+)'))[1]::numeric)::text || 'k' AS rpm
  FROM public.machine_event me
  WHERE me.equipment_id = l.equipment_id
    AND me.event_code = '0109'
    AND me.event_message ILIKE '%[Rpm]%'
  ORDER BY me.event_time DESC, me.id DESC
  LIMIT 1
) r ON true
LEFT JOIN LATERAL (
  SELECT 
    ROUND((regexp_match(event_message, '(?i)\[Feed\]:[^>]+->[[:space:]]*([0-9.]+)'))[1]::numeric, 1)::text AS feed
  FROM public.machine_event me
  WHERE me.equipment_id = l.equipment_id
    AND me.event_code = '0109'
    AND me.event_message ILIKE '%[Feed]%'
  ORDER BY me.event_time DESC, me.id DESC
  LIMIT 1
) f ON true
ORDER BY l.equipment_id;
