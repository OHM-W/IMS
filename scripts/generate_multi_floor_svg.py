import os
import sys
import math
import time

sys.stdout.reconfigure(encoding="utf-8")

SVG_W = 3200.0
SVG_H = 1720.0
BG_COLOR = "#080c16"

# Uniform geometry window across all floors:
# Width = 190,000 mm, Height = 122,000 mm
Y_MIN = -113500.0
Y_MAX = 7500.0

FLOOR_CONFIGS = [
    {
        "name": "Floor 2",
        "dxf": r"C:\Users\ohmat\OneDrive - Rajamangala University of Technology Phranakhon\เดสก์ท็อป\layout\Floor2.dxf",
        "output": r"c:\IMS\services\floorplan-web\frontend\public\floorplan_2F.svg",
        "preview": r"c:\IMS\floor2_preview.png",
        "x_window": (-665000.0, -475000.0),
        "y_window": (Y_MIN, Y_MAX),
        "layers": {
            "00.Wall FCD": {"stroke": "#475569", "sw": 1.0, "fill": "none"},
            "00.Wall IN": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "Wall": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00. New Wall Gold Plate": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "mt-wall": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "A-WALL": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00.open FCD": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "COL": {"stroke": "#475569", "sw": 1.0, "fill": "#1e293b"},
            "DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "DOOR-SW": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F3-layout$0$D-Emergency Door": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F1-layout$0$D-DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
        }
    },
    {
        "name": "Floor 3",
        "dxf": r"C:\Users\ohmat\OneDrive - Rajamangala University of Technology Phranakhon\เดสก์ท็อป\layout\Floor3.dxf",
        "output": r"c:\IMS\services\floorplan-web\frontend\public\floorplan_3F.svg",
        "preview": r"c:\IMS\floor3_preview.png",
        "x_window": (-440000.0, -250000.0),
        "y_window": (Y_MIN, Y_MAX),
        "layers": {
            "00.Wall FCD": {"stroke": "#475569", "sw": 1.0, "fill": "none"},
            "00.Wall IN": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00.New Wall SM": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00. New wall DES-Inner": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F3-layout$0$MOVE WALL": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00Wall open": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00.open FCD": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "COL": {"stroke": "#475569", "sw": 1.0, "fill": "#1e293b"},
            "F3-layout$0$D-DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "DOOR-SW": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F3-layout$0$D-Emergency Door": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F1-layout$0$D-DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
        }
    },
    {
        "name": "Floor 4",
        "dxf": r"C:\Users\ohmat\OneDrive - Rajamangala University of Technology Phranakhon\เดสก์ท็อป\layout\Floor4.dxf",
        "output": r"c:\IMS\services\floorplan-web\frontend\public\floorplan_4F.svg",
        "preview": r"c:\IMS\floor4_preview.png",
        "x_window": (-215000.0, -25000.0),
        "y_window": (Y_MIN, Y_MAX),
        "layers": {
            "00.Wall FCD": {"stroke": "#475569", "sw": 1.0, "fill": "none"},
            "00.Wall IN": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F4-layout$0$MOVE WALL": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00.open FCD": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "DOOR-SW": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F4-layout$0$D-DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F1-layout$0$D-DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "F3-layout$0$D-DOOR": {"stroke": "#334155", "sw": 0.8, "fill": "none"},
            "00.Column-F4-SS": {"stroke": "#475569", "sw": 1.0, "fill": "#1e293b"},
        }
    }
]

def process_floor(cfg):
    print(f"\n==================================================")
    print(f"[*] Processing {cfg['name']} from {os.path.basename(cfg['dxf'])}")
    t0 = time.time()

    dxf_path = cfg["dxf"]
    x_min_win, x_max_win = cfg["x_window"]
    y_min_win, y_max_win = cfg["y_window"]
    target_layers = cfg["layers"]

    raw_lines = []
    raw_polys = []

    code = None
    curr_ent = ""
    curr_layer = ""
    x1, y1, x2, y2 = None, None, None, None
    poly_pts = []
    is_closed = False

    all_xs = []
    all_ys = []

    with open(dxf_path, "r", encoding="latin-1", errors="ignore") as f:
        for line in f:
            v = line.strip()
            if code is None:
                try: code = int(v)
                except: code = None
            else:
                if code == 0:
                    if curr_ent == "LINE" and curr_layer in target_layers:
                        if x1 is not None and y1 is not None and x2 is not None and y2 is not None:
                            if (x_min_win <= x1 <= x_max_win and x_min_win <= x2 <= x_max_win) and \
                               (y_min_win <= y1 <= y_max_win and y_min_win <= y2 <= y_max_win):
                                raw_lines.append((curr_layer, x1, y1, x2, y2))
                                all_xs.extend([x1, x2])
                                all_ys.extend([y1, y2])
                    elif curr_ent in ("LWPOLYLINE", "POLYLINE") and curr_layer in target_layers and len(poly_pts) >= 2:
                        valid = all(x_min_win <= p[0] <= x_max_win and y_min_win <= p[1] <= y_max_win for p in poly_pts)
                        if valid:
                            raw_polys.append((curr_layer, poly_pts, is_closed))
                            for p in poly_pts:
                                all_xs.append(p[0])
                                all_ys.append(p[1])

                    curr_ent = v
                    curr_layer = ""
                    x1, y1, x2, y2 = None, None, None, None
                    poly_pts = []
                    is_closed = False
                elif code == 8:
                    curr_layer = v
                elif code == 70:
                    try: is_closed = bool(int(v) & 1)
                    except: pass
                elif code == 10:
                    try:
                        num = float(v)
                        if curr_ent == "LINE": x1 = num
                        elif curr_ent in ("LWPOLYLINE", "POLYLINE"): poly_pts.append([num, 0.0])
                    except: pass
                elif code == 20:
                    try:
                        num = float(v)
                        if curr_ent == "LINE": y1 = num
                        elif curr_ent in ("LWPOLYLINE", "POLYLINE") and poly_pts: poly_pts[-1][1] = num
                    except: pass
                elif code == 11:
                    try: x2 = float(v)
                    except: pass
                elif code == 21:
                    try: y2 = float(v)
                    except: pass

                code = None

    if not all_xs or not all_ys:
        print(f"[-] No geometry found in {cfg['name']}!")
        return

    import numpy as np
    xs_arr = np.array(all_xs)
    ys_arr = np.array(all_ys)
    cad_x_min = float(xs_arr.min())
    cad_x_max = float(xs_arr.max())
    cad_y_min = float(ys_arr.min())
    cad_y_max = float(ys_arr.max())

    span_x = cad_x_max - cad_x_min
    span_y = cad_y_max - cad_y_min
    print(f"[+] Clean Extents: X=[{cad_x_min:.1f} .. {cad_x_max:.1f}] ({span_x:.1f}mm), Y=[{cad_y_min:.1f} .. {cad_y_max:.1f}] ({span_y:.1f}mm)")

    pad_x = 100.0
    pad_y = 70.0
    avail_w = SVG_W - 2 * pad_x
    avail_h = SVG_H - 2 * pad_y

    scale = min(avail_w / span_x, avail_h / span_y)
    
    drawn_w = span_x * scale
    drawn_h = span_y * scale
    offset_x = pad_x + (avail_w - drawn_w) / 2.0
    offset_y = pad_y + (avail_h - drawn_h) / 2.0

    def to_svg(x, y):
        sx = offset_x + (x - cad_x_min) * scale
        sy = offset_y + (cad_y_max - y) * scale # Invert Y
        return round(sx, 2), round(sy, 2)

    paths_by_layer = {lay: [] for lay in target_layers}

    for lay, lx1, ly1, lx2, ly2 in raw_lines:
        sx1, sy1 = to_svg(lx1, ly1)
        sx2, sy2 = to_svg(lx2, ly2)
        if -50 <= sx1 <= SVG_W + 50 and -50 <= sy1 <= SVG_H + 50 and \
           -50 <= sx2 <= SVG_W + 50 and -50 <= sy2 <= SVG_H + 50:
            paths_by_layer[lay].append(f"M {sx1},{sy1} L {sx2},{sy2}")

    for lay, pts, closed in raw_polys:
        s_pts = [to_svg(p[0], p[1]) for p in pts]
        valid = any(0 <= p[0] <= SVG_W and 0 <= p[1] <= SVG_H for p in s_pts)
        if valid:
            if lay in ("COL", "00.Column-F4-SS") or (len(pts) in (3, 4) and not closed):
                dist = math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1])
                if 300 < dist < 3000:
                    d_str = "M " + " L ".join(f"{p[0]},{p[1]}" for p in s_pts) + " Z"
                else:
                    d_str = "M " + " L ".join(f"{p[0]},{p[1]}" for p in s_pts) + (" Z" if closed else "")
            else:
                d_str = "M " + " L ".join(f"{p[0]},{p[1]}" for p in s_pts) + (" Z" if closed else "")
            paths_by_layer[lay].append(d_str)

    os.makedirs(os.path.dirname(cfg["output"]), exist_ok=True)
    with open(cfg["output"], "w", encoding="utf-8") as out:
        out.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        out.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}" width="{SVG_W}" height="{SVG_H}">\n')
        out.write('  <defs>\n')
        out.write('    <style>\n')
        out.write('      .cad-layer { stroke-linecap: round; stroke-linejoin: round; }\n')
        out.write('    </style>\n')
        out.write('  </defs>\n')
        out.write(f'  <rect width="{SVG_W}" height="{SVG_H}" fill="{BG_COLOR}" />\n')

        for lay, paths in paths_by_layer.items():
            if not paths: continue
            st = target_layers.get(lay, {"stroke": "#334155", "sw": 0.8, "fill": "none"})
            stroke = st.get("stroke", "#334155")
            sw = st.get("sw", 0.8)
            fill = st.get("fill", "none")
            dash = st.get("dash")
            dash_attr = f' stroke-dasharray="{dash}"' if dash else ''

            d_combined = " ".join(paths)
            out.write(f'  <!-- Layer: {lay} ({len(paths)} elements) -->\n')
            out.write(f'  <path d="{d_combined}" stroke="{stroke}" stroke-width="{sw}" fill="{fill}"{dash_attr} class="cad-layer" />\n')

        out.write('</svg>\n')

    out_size_kb = os.path.getsize(cfg["output"]) / 1024.0
    print(f"[+] Successfully wrote {cfg['output']} ({out_size_kb:.1f} KB) in {time.time() - t0:.2f}s")

    # Render high-res preview PNG for visual verification
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(16, 9), facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    for lay, paths in paths_by_layer.items():
        if not paths: continue
        st = target_layers.get(lay, {"stroke": "#334155", "sw": 0.8, "fill": "none"})
        stroke = st.get("stroke", "#334155")
        sw = st.get("sw", 0.8)
        fill = st.get("fill", "none")
        for p_str in paths:
            parts = p_str.split(" ")
            pts = []
            for part in parts:
                if "," in part:
                    try:
                        coords = [float(c) for c in part.split(",")]
                        pts.append(coords)
                    except: pass
            if len(pts) >= 2:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                if fill != "none":
                    ax.fill(xs, ys, color=fill, alpha=0.5)
                ax.plot(xs, ys, color=stroke, linewidth=sw * 0.7, alpha=0.9)
    ax.set_xlim(0, SVG_W)
    ax.set_ylim(SVG_H, 0) # Invert Y
    ax.axis("off")
    plt.title(f"IMS 2D Digital Twin CAD Floorplan - {cfg['name']}", color='#94a3b8', fontsize=14, pad=15)
    plt.tight_layout()
    plt.savefig(cfg["preview"], dpi=120, facecolor=BG_COLOR)
    plt.close()
    print(f"[+] Rendered preview: {cfg['preview']}")

for cfg in FLOOR_CONFIGS:
    process_floor(cfg)

print("\n[✓] All floors generated with clean isolated building envelopes!")
