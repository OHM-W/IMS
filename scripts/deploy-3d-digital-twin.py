import json
import random
import subprocess
import requests

# 1. Coordinate Setup
FLOOR_SIZE = 175.0
IMG_W = 1539.0
IMG_H = 913.0
ASPECT = IMG_W / IMG_H  # ~1.68565
WORLD_W = FLOOR_SIZE * ASPECT  # ~294.989
WORLD_H = FLOOR_SIZE  # 175.0

all_boxes = []

# =========================================================================
# 1. ZONE: DRILLING - TOP LEFT & MID LEFT
# =========================================================================
for i, y0 in enumerate([32, 67, 102, 137, 172]):
    all_boxes.append({'name': f'DR00_{i+1}', 'bbox': (37, y0, 60, y0+31)})

dr_cols = [
    ('DR01', 144, 164), ('DR02', 174, 194),
    ('DR03', 228, 248), ('DR04', 253, 273),
    ('DR05', 304, 324), ('DR06', 329, 349),
    ('DR07', 380, 400), ('DR08', 405, 425),
    ('DR09', 434, 454), ('DR10', 463, 483),
    ('DR11', 507, 527), ('DR12', 536, 556),
    ('DR13', 585, 605), ('DR14', 613, 633),
    ('DR15', 664, 684), ('DR16', 692, 712)
]

for cname, x0, x1 in dr_cols:
    for ridx, y0 in enumerate([25, 59, 93, 127, 161]):
        all_boxes.append({'name': f'{cname}_{ridx+1}', 'bbox': (x0, y0, x1, y0+30)})

all_boxes.append({'name': 'DR15_MID', 'bbox': (664, 198, 684, 230)})

lower_dr_cols = [
    ('DR09_L', 434, 454), ('DR10_L', 463, 483),
    ('DR11_L', 507, 527), ('DR12_L', 536, 556),
    ('DR13_L', 585, 605), ('DR14_L', 613, 633),
    ('DR15_L', 664, 684)
]
for cname, x0, x1 in lower_dr_cols:
    for ridx, y0 in enumerate([240, 274, 308, 342]):
        all_boxes.append({'name': f'{cname}{ridx+1}', 'bbox': (x0, y0, x1, y0+30)})

# =========================================================================
# 2. ZONE: CENTER DRILLING & XRY
# =========================================================================
for i, y0 in enumerate([145, 178, 212]):
    all_boxes.append({'name': f'DR_C1_{i+1}', 'bbox': (757, y0, 779, y0+29)})

for i, y0 in enumerate([144, 178, 212, 246, 280, 314]):
    all_boxes.append({'name': f'DR_C2_{i+1}', 'bbox': (802, y0, 824, y0+29)})

for i, y0 in enumerate([145, 178, 212, 246, 280, 314, 348, 382]):
    all_boxes.append({'name': f'DR_C3_{i+1}', 'bbox': (831, y0, 853, y0+29)})

for i, y0 in enumerate([144, 178, 212, 246, 280, 314, 348, 382]):
    all_boxes.append({'name': f'DR_C4_{i+1}', 'bbox': (878, y0, 900, y0+29)})

for i, y0 in enumerate([144, 178, 212, 246, 280, 314, 348, 382]):
    all_boxes.append({'name': f'DR_C5_{i+1}', 'bbox': (906, y0, 928, y0+29)})

for i, y0 in enumerate([143, 178, 212, 246, 280, 314, 348, 382]):
    all_boxes.append({'name': f'DR_C6_{i+1}', 'bbox': (953, y0, 975, y0+29)})

for i, y0 in enumerate([338, 371, 404, 437]):
    all_boxes.append({'name': f'DR_C0_{i+1}', 'bbox': (728, y0, 750, y0+28)})

for i, y0 in enumerate([226, 260, 294, 328, 362]):
    all_boxes.append({'name': f'XR1_{i+1}', 'bbox': (998, y0, 1019, y0+29)})
for i, y0 in enumerate([226, 260, 294, 328, 362]):
    all_boxes.append({'name': f'XR2_{i+1}', 'bbox': (1024, y0, 1045, y0+29)})

all_boxes.append({'name': 'MID_001', 'bbox': (743, 513, 781, 545)})
all_boxes.append({'name': 'MID_002', 'bbox': (787, 513, 825, 545)})

# =========================================================================
# 3. ZONE: OXIDE & BONDING
# =========================================================================
oxide_cols = [
    ('BWN001', 1175, 1198),
    ('BWN002', 1205, 1228),
    ('BWN003', 1238, 1261)
]
for cname, x0, x1 in oxide_cols:
    all_boxes.append({'name': f'{cname}_BWN', 'bbox': (x0, 422, x1, 468)})
    all_boxes.append({'name': f'{cname}_PUC', 'bbox': (x0, 472, x1, 514)})
    all_boxes.append({'name': f'{cname}_LDG', 'bbox': (x0, 518, x1, 558)})

# =========================================================================
# 4. ZONE: TOP RIGHT - AUTO LAY UP & PP
# =========================================================================
all_boxes.append({'name': '1-A1', 'bbox': (1332, 32, 1356, 58)})
all_boxes.append({'name': '1-B1', 'bbox': (1362, 32, 1386, 58)})
all_boxes.append({'name': '1-C1', 'bbox': (1392, 32, 1416, 58)})
all_boxes.append({'name': '1-H1', 'bbox': (1422, 32, 1446, 58)})
all_boxes.append({'name': 'PRS', 'bbox': (1452, 32, 1478, 58)})
all_boxes.append({'name': 'FRS', 'bbox': (1380, 64, 1445, 94)})
all_boxes.append({'name': 'DLM', 'bbox': (1145, 98, 1395, 136)})
all_boxes.append({'name': 'LTK', 'bbox': (1405, 98, 1468, 178)})
all_boxes.append({'name': 'PP_01', 'bbox': (1425, 212, 1458, 258)})

# =========================================================================
# 5. ZONE: BOTTOM - CUTTING, DE-OXIDE, LASER DRILLING
# =========================================================================
all_boxes.append({'name': 'CCL001', 'bbox': (745, 690, 805, 728)})
all_boxes.append({'name': 'CCL002', 'bbox': (745, 645, 805, 685)})
all_boxes.append({'name': 'VSC_1', 'bbox': (815, 645, 860, 685)})
all_boxes.append({'name': 'VSC_2', 'bbox': (815, 690, 860, 728)})
all_boxes.append({'name': 'MIL_3', 'bbox': (870, 640, 965, 663)})
all_boxes.append({'name': 'MIL_2', 'bbox': (870, 665, 965, 688)})
all_boxes.append({'name': 'MIL_1', 'bbox': (870, 690, 965, 713)})
all_boxes.append({'name': 'CUT_01', 'bbox': (870, 718, 925, 745)})
all_boxes.append({'name': 'ULD_3', 'bbox': (970, 640, 1025, 663)})
all_boxes.append({'name': 'ULD_2', 'bbox': (970, 665, 1025, 688)})
all_boxes.append({'name': 'ULD_1', 'bbox': (970, 690, 1025, 713)})
all_boxes.append({'name': 'ULD_4', 'bbox': (970, 718, 1025, 745)})

all_boxes.append({'name': 'DEOX_LDG', 'bbox': (1058, 580, 1084, 622)})
all_boxes.append({'name': 'DEOX_DEO', 'bbox': (1058, 625, 1084, 666)})
all_boxes.append({'name': 'DEOX_ULD', 'bbox': (1058, 669, 1084, 710)})

all_boxes.append({'name': 'LDR_TOP_L', 'bbox': (1130, 612, 1192, 648)})
all_boxes.append({'name': 'LDR_TOP_R', 'bbox': (1205, 612, 1268, 648)})
all_boxes.append({'name': 'LDR_004', 'bbox': (1130, 654, 1192, 688)})
all_boxes.append({'name': 'LDR_005', 'bbox': (1130, 694, 1192, 728)})
all_boxes.append({'name': 'LDR_003', 'bbox': (1205, 654, 1268, 678)})
all_boxes.append({'name': 'LDR_002', 'bbox': (1205, 684, 1268, 708)})
all_boxes.append({'name': 'LDR_001', 'bbox': (1205, 714, 1268, 738)})

print(f'Deploying {len(all_boxes)} machines...')

# 2. Populate TimescaleDB
sql_lines = [
    'CREATE TABLE IF NOT EXISTS public.machine_telemetry (time TIMESTAMPTZ NOT NULL, machine_name TEXT NOT NULL, status INT, temperature FLOAT, humidity FLOAT, board_no INT, total_board INT, severity TEXT, is_loto BOOLEAN);',
    'DELETE FROM public.machine_telemetry;'
]

# Realistic industrial status pool
status_pool = [2, 2, 2, 2, 2, 2, 1, 1, 3, 4, 0] # ~60% Running, 20% Idle, 10% Alarm, 5% LOTO, 5% Off

for i, b in enumerate(all_boxes):
    name = b['name']
    st = status_pool[i % len(status_pool)]
    temp = round(random.uniform(38.0, 74.0), 1) if st != 0 else 24.0
    hum = round(random.uniform(46.0, 62.0), 1)
    b_no = random.randint(25, 490) if st != 0 else 0
    tot = 500
    sev = 'Critical' if (st == 3 and i % 2 == 0) else ('Major' if st == 3 else 'None')
    is_loto = (st == 4)
    sql_lines.append(
        'INSERT INTO public.machine_telemetry (time, machine_name, status, temperature, humidity, board_no, total_board, severity, is_loto) VALUES (NOW(), \'%s\', %d, %.1f, %.1f, %d, %d, \'%s\', %s);' % (
            name, st, temp, hum, b_no, tot, sev, str(is_loto).lower()
        )
    )

sql_text = '\n'.join(sql_lines)
res = subprocess.run(['docker', 'exec', '-i', 'ims-timescaledb', 'psql', '-U', 'ims_admin', '-d', 'ims'], input=sql_text, text=True, capture_output=True)
if res.returncode == 0:
    print('[SUCCESS] TimescaleDB populated with', len(all_boxes), 'machines!')
else:
    print('[ERROR] TimescaleDB:', res.stderr)

# 3. Calculate 3D machineConfigs
machine_configs = {}
for b in all_boxes:
    x0, y0, x1, y1 = b['bbox']
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0
    w_px = x1 - x0
    h_px = y1 - y0
    
    u = cx / IMG_W
    v = cy / IMG_H
    w_norm = w_px / IMG_W
    h_norm = h_px / IMG_H
    
    wx = (u - 0.5) * WORLD_W
    wz = (v - 0.5) * WORLD_H
    scaleX = max(1.2, w_norm * WORLD_W)
    scaleZ = max(1.2, h_norm * WORLD_H)
    scaleY = 2.0
    
    machine_configs[b['name']] = {
        'x': round(wx, 2),
        'z': round(wz, 2),
        'scaleX': round(scaleX, 2),
        'scaleY': scaleY,
        'scaleZ': round(scaleZ, 2),
        'rotationY': 0.0,
        'hidden': False
    }

# 4. Save to Grafana Dashboard
auth = ('admin', 'admin1234')
resp = requests.get('http://localhost:3000/api/dashboards/uid/magic-3d', auth=auth)
if resp.status_code != 200:
    print('[ERROR] Failed to fetch dashboard:', resp.status_code)
    exit(1)

dash_data = resp.json()
dashboard = dash_data['dashboard']

for panel in dashboard.get('panels', []):
    if panel.get('type') == '3d-panel':
        if 'options' not in panel:
            panel['options'] = {}
        opts = panel['options']
        opts['floorSize'] = FLOOR_SIZE
        opts['floorplanUrl'] = '/public/plugins/3d-panel/img/Floor_d.jpg?v=2'
        opts['machineConfigs'] = machine_configs
        opts['machineNameField'] = 'machine_name'
        opts['statusFieldName'] = 'status'
        opts['severityFieldName'] = 'severity'
        opts['lotoFieldName'] = 'is_loto'
        opts['tooltipFields'] = 'temperature=Temp:°C, humidity=Humidity:%, board_no=Board:, total_board=Total:'
        opts['enableEditMode'] = True
        opts['showHUD'] = True
        opts['showLabels'] = False
        opts['enableSnap'] = False
        opts['enableISA101Alarms'] = True
        opts['enableLOTO'] = True
        
        panel['targets'] = [{
            'datasource': {'type': 'grafana-postgresql-datasource', 'uid': 'timescaledb'},
            'editorMode': 'code',
            'format': 'table',
            'rawQuery': True,
            'rawSql': 'SELECT\n  NOW() AS time,\n  machine_name,\n  status,\n  temperature,\n  humidity,\n  board_no,\n  total_board,\n  severity,\n  is_loto\nFROM public.machine_telemetry\nORDER BY machine_name;',
            'refId': 'A'
        }]

payload = {
    'dashboard': dashboard,
    'folderId': dash_data.get('meta', {}).get('folderId', 0),
    'overwrite': True,
    'message': 'Deployed 211 Pixel-Perfect Aligned Machines from Blueprint V4'
}

save_resp = requests.post('http://localhost:3000/api/dashboards/db', json=payload, auth=auth)
if save_resp.status_code == 200:
    print('[DONE] SUCCESS: Dashboard magic-3d saved with', len(machine_configs), 'machines aligned!')
else:
    print('[ERROR] Failed to save dashboard:', save_resp.status_code, save_resp.text)
