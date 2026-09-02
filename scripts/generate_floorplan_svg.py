#!/usr/bin/env python3
"""
IMS CAD Floorplan Extraction to Clean Vector SVG
════════════════════════════════════════════════
High-efficiency streaming DXF parser that processes AutoCAD Floor1.dxf
line-by-line in latin-1 with minimal memory (<25 MB RAM) and renders
an ISA-101 industrial dark themed SVG floorplan for the IMS Factory Digital Twin.

Usage:
    python scripts/generate_floorplan_svg.py [--dxf PATH] [--output PATH]
"""

import sys
import os
import math
import time
import argparse

# Force UTF-8 stdout for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ─── Default Paths & Bounds ──────────────────────────────────
DEFAULT_DXF_PATH = r"C:\Users\ohmat\OneDrive - Rajamangala University of Technology Phranakhon\เอกสาร\Floor1.dxf"
DEFAULT_OUTPUT_SVG = r"c:\IMS\services\floorplan-web\frontend\public\floorplan.svg"

# Verified CAD Extents
CAD_X_MIN = -935000.0
CAD_X_MAX = -560000.0
CAD_Y_MIN = -105000.0
CAD_Y_MAX = 75000.0

CAD_W = CAD_X_MAX - CAD_X_MIN  # 375,000.0 mm
CAD_H = CAD_Y_MAX - CAD_Y_MIN  # 180,000.0 mm

# SVG ViewBox Dimensions
SVG_W = 3200.0
SVG_H = 1550.0

SCALE_X = SVG_W / CAD_W  # 3200 / 375000 = 0.008533333333333333
SCALE_Y = SVG_H / CAD_H  # 1550 / 180000 = 0.008611111111111111

# Target Architectural Layers
TARGET_LAYERS = {
    "00-WALL",
    "00.Wall FCD",
    "00.Wall IN",
    "00.Wall Clean room",
    "00.Area",
    "00.Area Line",
    "COL",
    "DOOR",
    "DOOR-SW",
    "F1-layout$0$D-DOOR",
    "F1-layout$0$D-Emergency Door",
    "D-Emergency Door"
}

# ISA-101 Industrial Dark Theme Styles by Layer
LAYER_STYLES = {
    "00.Wall FCD": {
        "stroke": "#64748B",
        "stroke-width": "1.2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "00.Wall IN": {
        "stroke": "#0284C7",
        "stroke-width": "1.0",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "00-WALL": {
        "stroke": "#0284C7",
        "stroke-width": "1.0",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "00.Wall Clean room": {
        "stroke": "#00FF87",
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "COL": {
        "stroke": "#F59E0B",
        "stroke-width": "1.5",
        "fill": "#F59E0B33"
    },
    "DOOR": {
        "stroke": "#38BDF8",
        "stroke-width": "0.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "DOOR-SW": {
        "stroke": "#38BDF8",
        "stroke-width": "0.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "F1-layout$0$D-DOOR": {
        "stroke": "#38BDF8",
        "stroke-width": "0.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "F1-layout$0$D-Emergency Door": {
        "stroke": "#38BDF8",
        "stroke-width": "0.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "D-Emergency Door": {
        "stroke": "#38BDF8",
        "stroke-width": "0.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "fill": "none"
    },
    "00.Area": {
        "stroke": "#334155",
        "stroke-width": "0.6",
        "stroke-dasharray": "4 4",
        "fill": "none"
    },
    "00.Area Line": {
        "stroke": "#334155",
        "stroke-width": "0.6",
        "stroke-dasharray": "6 3",
        "fill": "none"
    }
}


def cad_to_svg(x: float, y: float) -> tuple[float, float]:
    """Transform Cartesian CAD coords (Right: +X, Up: +Y) to SVG Screen coords (Right: +X, Down: +Y)."""
    sx = (x - CAD_X_MIN) * SCALE_X
    sy = (CAD_Y_MAX - y) * SCALE_Y
    # Ensure strict clamping within canvas bounds
    sx = max(0.0, min(SVG_W, sx))
    sy = max(0.0, min(SVG_H, sy))
    return round(sx, 2), round(sy, 2)


def is_stray_origin(x: float, y: float) -> bool:
    """Detect AutoCAD stray origin vertices or direction unit vectors near (0, 0)."""
    return abs(x) < 50000.0 and abs(y) < 50000.0


def is_point_in_bounds(x: float, y: float, margin: float = 0.0) -> bool:
    """Check if point is strictly within CAD building boundary."""
    if is_stray_origin(x, y):
        return False
    return ((CAD_X_MIN - margin) <= x <= (CAD_X_MAX + margin) and
            (CAD_Y_MIN - margin) <= y <= (CAD_Y_MAX + margin))


def clip_line(x1: float, y1: float, x2: float, y2: float) -> tuple[float, float, float, float] | None:
    """Liang-Barsky 2D line clipping algorithm against CAD bounding box."""
    if is_stray_origin(x1, y1) or is_stray_origin(x2, y2):
        return None

    dx = x2 - x1
    dy = y2 - y1
    p = [-dx, dx, -dy, dy]
    q = [x1 - CAD_X_MIN, CAD_X_MAX - x1, y1 - CAD_Y_MIN, CAD_Y_MAX - y1]

    u1 = 0.0
    u2 = 1.0

    for i in range(4):
        if p[i] == 0:
            if q[i] < 0:
                return None
        else:
            t = q[i] / p[i]
            if p[i] < 0:
                if t > u2:
                    return None
                if t > u1:
                    u1 = t
            else:
                if t < u1:
                    return None
                if t < u2:
                    u2 = t

    if u1 > u2:
        return None

    cx1 = x1 + u1 * dx
    cy1 = y1 + u1 * dy
    cx2 = x1 + u2 * dx
    cy2 = y1 + u2 * dy

    if math.hypot(cx2 - cx1, cy2 - cy1) < 1.0:
        return None

    return cx1, cy1, cx2, cy2


def render_entity(ent_type: str, layer: str, xs: list[float], ys: list[float],
                  closed: bool, radius: float, start_ang: float, end_ang: float,
                  rotation: float = 0.0, block_name: str = "") -> str | None:
    """Render a single DXF entity to an SVG vector element string."""
    if not xs or not ys:
        return None

    if ent_type == "LINE" and len(xs) >= 2 and len(ys) >= 2:
        clipped = clip_line(xs[0], ys[0], xs[1], ys[1])
        if not clipped:
            return None
        x1, y1 = cad_to_svg(clipped[0], clipped[1])
        x2, y2 = cad_to_svg(clipped[2], clipped[3])
        return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" />'

    elif ent_type in ("LWPOLYLINE", "POLYLINE", "MLINE"):
        n = min(len(xs), len(ys))
        if n < 2:
            return None

        # Filter out stray origin vertices and points strictly outside bounds
        valid_pts = []
        for i in range(n):
            px, py = xs[i], ys[i]
            if not is_stray_origin(px, py) and is_point_in_bounds(px, py):
                valid_pts.append((px, py))

        if len(valid_pts) < 2:
            return None

        pts = [f"{cad_to_svg(p[0], p[1])[0]},{cad_to_svg(p[0], p[1])[1]}" for p in valid_pts]
        pts_str = " ".join(pts)
        if closed and len(valid_pts) >= 3:
            return f'<polygon points="{pts_str}" />'
        return f'<polyline points="{pts_str}" />'

    elif ent_type == "CIRCLE" and radius > 0 and len(xs) >= 1 and len(ys) >= 1:
        cx, cy = xs[0], ys[0]
        if (cx - radius < CAD_X_MIN or cx + radius > CAD_X_MAX or
            cy - radius < CAD_Y_MIN or cy + radius > CAD_Y_MAX):
            return None
        scx, scy = cad_to_svg(cx, cy)
        r = round(radius * SCALE_X, 2)
        return f'<circle cx="{scx}" cy="{scy}" r="{r}" />'

    elif ent_type == "ARC" and radius > 0 and len(xs) >= 1 and len(ys) >= 1:
        cx_cad, cy_cad = xs[0], ys[0]
        if is_stray_origin(cx_cad, cy_cad):
            return None
        r_cad = radius
        rad_start = math.radians(start_ang)
        rad_end = math.radians(end_ang)

        x1_cad = cx_cad + r_cad * math.cos(rad_start)
        y1_cad = cy_cad + r_cad * math.sin(rad_start)
        x2_cad = cx_cad + r_cad * math.cos(rad_end)
        y2_cad = cy_cad + r_cad * math.sin(rad_end)

        if not is_point_in_bounds(x1_cad, y1_cad) or not is_point_in_bounds(x2_cad, y2_cad):
            return None

        x1, y1 = cad_to_svg(x1_cad, y1_cad)
        x2, y2 = cad_to_svg(x2_cad, y2_cad)
        r_svg = round(r_cad * SCALE_X, 2)

        delta_deg = (end_ang - start_ang) % 360.0
        large_arc = 1 if delta_deg > 180.0 else 0
        sweep = 0  # In Y-down SVG, Cartesian CCW corresponds to sweep=0
        return f'<path d="M {x1} {y1} A {r_svg} {r_svg} 0 {large_arc} {sweep} {x2} {y2}" />'

    elif ent_type in ("SOLID", "3DFACE") and len(xs) >= 3 and len(ys) >= 3:
        n = min(len(xs), len(ys))
        valid_pts = [(xs[i], ys[i]) for i in range(n) if is_point_in_bounds(xs[i], ys[i])]
        if len(valid_pts) < 3:
            return None
        pts = [f"{cad_to_svg(p[0], p[1])[0]},{cad_to_svg(p[0], p[1])[1]}" for p in valid_pts]
        pts_str = " ".join(pts)
        return f'<polygon points="{pts_str}" />'

    elif ent_type == "INSERT" and ("DOOR" in layer.upper()):
        # Render architectural door swing for door block inserts
        x0_cad, y0_cad = xs[0], ys[0]
        if not is_point_in_bounds(x0_cad, y0_cad):
            return None
        door_w = 900.0  # Standard 900mm door leaf in CAD
        rad = math.radians(rotation)

        x1_cad = x0_cad + door_w * math.cos(rad)
        y1_cad = y0_cad + door_w * math.sin(rad)
        x2_cad = x0_cad + door_w * math.cos(rad + math.pi / 2)
        y2_cad = y0_cad + door_w * math.sin(rad + math.pi / 2)

        sx0, sy0 = cad_to_svg(x0_cad, y0_cad)
        sx1, sy1 = cad_to_svg(x1_cad, y1_cad)
        sx2, sy2 = cad_to_svg(x2_cad, y2_cad)
        r_svg = round(door_w * SCALE_X, 2)

        return (f'<g class="door-symbol">'
                f'<line x1="{sx0}" y1="{sy0}" x2="{sx1}" y2="{sy1}" />'
                f'<path d="M {sx1} {sy1} A {r_svg} {r_svg} 0 0 0 {sx2} {sy2}" stroke-dasharray="2 2" />'
                f'</g>')

    return None


def generate_svg(dxf_path: str = DEFAULT_DXF_PATH, output_svg_path: str = DEFAULT_OUTPUT_SVG):
    """
    Streaming DXF parser and SVG builder.
    Reads line-by-line to avoid loading 412 MB file into memory DOM.
    """
    if not os.path.isfile(dxf_path):
        raise FileNotFoundError(f"DXF file not found at: {dxf_path}")

    print(f"[*] Starting streaming parse of: {dxf_path}")
    print(f"[*] Target bounds: X:[{CAD_X_MIN}, {CAD_X_MAX}], Y:[{CAD_Y_MIN}, {CAD_Y_MAX}]")
    print(f"[*] SVG ViewBox: 0 0 {int(SVG_W)} {int(SVG_H)}")

    svg_paths_by_layer = {layer: [] for layer in TARGET_LAYERS}
    
    t0 = time.time()
    in_entities = False
    
    curr_ent = None
    curr_layer = None
    curr_block = None
    curr_xs = []
    curr_ys = []
    curr_closed = False
    curr_radius = 0.0
    curr_start_ang = 0.0
    curr_end_ang = 0.0
    curr_rot = 0.0
    
    entity_count = 0
    extracted_count = 0

    with open(dxf_path, "r", encoding="latin-1", errors="ignore") as f:
        while True:
            c_line = f.readline()
            if not c_line:
                break
            v_line = f.readline()
            if not v_line:
                break

            code = c_line.strip()
            val = v_line.strip()

            if code == "2" and val == "ENTITIES":
                in_entities = True
                continue
            elif code == "0" and val == "ENDSEC":
                if in_entities:
                    break

            if in_entities:
                if code == "0":
                    if curr_ent and curr_layer and (curr_layer in TARGET_LAYERS or "DOOR" in curr_layer.upper()):
                        layer_key = curr_layer if curr_layer in TARGET_LAYERS else "DOOR"
                        elem = render_entity(
                            curr_ent, layer_key, curr_xs, curr_ys,
                            curr_closed, curr_radius, curr_start_ang, curr_end_ang,
                            curr_rot, curr_block or ""
                        )
                        if elem:
                            svg_paths_by_layer[layer_key].append(elem)
                            extracted_count += 1

                    curr_ent = val
                    curr_layer = None
                    curr_block = None
                    curr_xs = []
                    curr_ys = []
                    curr_closed = False
                    curr_radius = 0.0
                    curr_start_ang = 0.0
                    curr_end_ang = 0.0
                    curr_rot = 0.0
                    entity_count += 1

                elif code == "8":
                    curr_layer = val
                elif code == "2":
                    curr_block = val
                elif curr_ent == "MLINE":
                    # For MLINE, codes 10/11 and 20/21 are vertex coordinates; 12/13/22/23 are direction vectors
                    if code in ("10", "11"):
                        try:
                            curr_xs.append(float(val))
                        except ValueError:
                            pass
                    elif code in ("20", "21"):
                        try:
                            curr_ys.append(float(val))
                        except ValueError:
                            pass
                elif curr_ent in ("SOLID", "3DFACE"):
                    if code in ("10", "11", "12", "13"):
                        try:
                            curr_xs.append(float(val))
                        except ValueError:
                            pass
                    elif code in ("20", "21", "22", "23"):
                        try:
                            curr_ys.append(float(val))
                        except ValueError:
                            pass
                elif curr_ent == "LINE":
                    if code in ("10", "11"):
                        try:
                            curr_xs.append(float(val))
                        except ValueError:
                            pass
                    elif code in ("20", "21"):
                        try:
                            curr_ys.append(float(val))
                        except ValueError:
                            pass
                else:
                    if code == "10":
                        try:
                            curr_xs.append(float(val))
                        except ValueError:
                            pass
                    elif code == "20":
                        try:
                            curr_ys.append(float(val))
                        except ValueError:
                            pass
                if code == "40":
                    try:
                        curr_radius = float(val)
                    except ValueError:
                        pass
                elif code == "50":
                    try:
                        curr_start_ang = float(val)
                        curr_rot = float(val)
                    except ValueError:
                        pass
                elif code == "51":
                    try:
                        curr_end_ang = float(val)
                    except ValueError:
                        pass
                elif code == "70":
                    try:
                        flag = int(val)
                        curr_closed = bool(flag & 1)
                    except ValueError:
                        pass

        # Final entity check
        if curr_ent and curr_layer and (curr_layer in TARGET_LAYERS or "DOOR" in curr_layer.upper()):
            layer_key = curr_layer if curr_layer in TARGET_LAYERS else "DOOR"
            elem = render_entity(
                curr_ent, layer_key, curr_xs, curr_ys,
                curr_closed, curr_radius, curr_start_ang, curr_end_ang,
                curr_rot, curr_block or ""
            )
            if elem:
                svg_paths_by_layer[layer_key].append(elem)
                extracted_count += 1

    t1 = time.time()
    print(f"[+] DXF streaming parse complete in {t1 - t0:.2f}s.")
    print(f"[+] Scanned {entity_count:,} entities, extracted {extracted_count:,} target architectural elements.")

    # Ensure parent output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_svg_path)), exist_ok=True)

    # Write ISA-101 formatted vector SVG
    with open(output_svg_path, "w", encoding="utf-8") as out:
        out.write('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n')
        out.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {int(SVG_W)} {int(SVG_H)}" '
                  f'width="{int(SVG_W)}" height="{int(SVG_H)}" style="background-color: #0B0F19;">\n')
        
        # Embedded SVG styles & Grid defs
        out.write('  <defs>\n')
        out.write('    <pattern id="industrial-grid" width="40" height="40" patternUnits="userSpaceOnUse">\n')
        out.write('      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" stroke-width="0.5" opacity="0.35"/>\n')
        out.write('    </pattern>\n')
        out.write('    <pattern id="major-grid" width="200" height="200" patternUnits="userSpaceOnUse">\n')
        out.write('      <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#334155" stroke-width="0.8" opacity="0.25"/>\n')
        out.write('    </pattern>\n')
        out.write('  </defs>\n\n')

        # Background grid rects
        out.write('  <!-- Background Canvas Grid -->\n')
        out.write('  <rect width="100%" height="100%" fill="url(#industrial-grid)" />\n')
        out.write('  <rect width="100%" height="100%" fill="url(#major-grid)" />\n\n')

        # Architectural Layers
        for layer, items in svg_paths_by_layer.items():
            if not items:
                continue
            st = LAYER_STYLES.get(layer, {"stroke": "#64748B", "stroke-width": "1.0", "fill": "none"})
            style_str = " ".join([f'{k}="{v}"' for k, v in st.items()])
            clean_id = layer.replace(".", "_").replace(" ", "_").replace("$", "_").replace("-", "_")
            out.write(f'  <!-- Layer: {layer} ({len(items)} elements) -->\n')
            out.write(f'  <g id="layer_{clean_id}" data-layer="{layer}" {style_str}>\n')
            for item in items:
                out.write(f'    {item}\n')
            out.write('  </g>\n\n')

        # Cleanroom Photolithography Process Zone
        out.write('  <!-- Cleanroom Photolithography Process Zone (Interface Contract 1) -->\n')
        out.write('  <g id="zone_cleanroom_photolithography" data-zone="cleanroom">\n')
        out.write('    <rect x="2150" y="480" width="720" height="320" rx="8" '
                  'fill="#00FF87" fill-opacity="0.03" stroke="#00FF87" stroke-width="1.2" '
                  'stroke-dasharray="8 4" opacity="0.85" />\n')
        out.write('    <text x="2165" y="506" fill="#00FF87" font-family="system-ui, -apple-system, sans-serif" '
                  'font-size="12" font-weight="700" letter-spacing="1.2" opacity="0.9">'
                  'CLEANROOM PHOTOLITHOGRAPHY (BAY 1 &amp; BAY 2)</text>\n')
        out.write('  </g>\n\n')

        # Floorplan Coordinate Grid Legend / Border
        out.write('  <!-- Floorplan Frame & Navigation Overlay -->\n')
        out.write('  <rect x="2" y="2" width="3196" height="1546" fill="none" stroke="#1E293B" stroke-width="2" rx="4" />\n')
        out.write('  <text x="24" y="38" fill="#475569" font-family="system-ui, -apple-system, sans-serif" '
                  'font-size="14" font-weight="700" letter-spacing="2">IMS FACTORY FLOOR 1 — DIGITAL TWIN</text>\n')
        out.write('  <text x="24" y="56" fill="#334155" font-family="monospace" font-size="10">'
                  'CAD EXTENTS: [-935000, -560000] x [-105000, +75000] | VIEWBOX: 3200x1550</text>\n')

        out.write('</svg>\n')

    file_size_kb = os.path.getsize(output_svg_path) / 1024.0
    print(f"[+] Output SVG written: {output_svg_path} ({file_size_kb:.1f} KB)")
    return output_svg_path


def main():
    parser = argparse.ArgumentParser(description="Generate clean vector SVG from AutoCAD Floor1.dxf")
    parser.add_argument("--dxf", "-d", default=DEFAULT_DXF_PATH, help="Path to input AutoCAD DXF file")
    parser.add_argument("--output", "-o", default=DEFAULT_OUTPUT_SVG, help="Path to output SVG file")
    args = parser.parse_args()

    try:
        generate_svg(args.dxf, args.output)
    except Exception as e:
        print(f"[!] Error generating SVG: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
