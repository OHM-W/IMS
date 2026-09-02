#!/usr/bin/env python3
"""
IMS CAD Floorplan Extraction & Machine Normalization Pipeline
════════════════════════════════════════════════════════════════
Extracts 2D architectural geometry and machine entity coordinates from AutoCAD
Floor1.dxf drawing, renders high-resolution dark-themed background PNG, and exports
normalized Canvas percentages (0-100%) to JSON for Grafana Canvas Panel.

Usage:
    python scripts/extract_cad_floorplan.py
"""

import os
import sys
import time
import math
import json
import shutil
import argparse
from collections import defaultdict
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

# Force UTF-8 output encoding for Windows PowerShell / cmd
sys.stdout.reconfigure(encoding='utf-8')

# ─── Constant Geometry Bounds (Primary Building Boundary) ────
BUILDING_X_MIN = -931055.0
BUILDING_X_MAX = -564063.0
BUILDING_Y_MIN = -99570.0
BUILDING_Y_MAX = 68645.0

SPAN_X = BUILDING_X_MAX - BUILDING_X_MIN  # 366,992.0 mm
SPAN_Y = BUILDING_Y_MAX - BUILDING_Y_MIN  # 168,215.0 mm
ASPECT_RATIO = SPAN_X / SPAN_Y           # 2.181684

# Target architectural layers for 2D floorplan rendering
ARCHITECTURAL_LAYERS = {
    "00-WALL",
    "00.Wall FCD",
    "00.Wall IN",
    "00.Wall Clean room",
    "00.Area",
    "00.Area Line",
    "COL"
}

# ISA-101 Industrial Dark Design System Palette
LAYER_STYLES = {
    "00-WALL": {
        "color": "#38BDF8",     # Light sky blue interior walls
        "lw": 1.2,
        "alpha": 0.95,
        "zorder": 4
    },
    "00.Wall FCD": {
        "color": "#64748B",     # Perimeter facade / outer envelope slate
        "lw": 1.0,
        "alpha": 0.85,
        "zorder": 3
    },
    "00.Wall IN": {
        "color": "#0284C7",     # Interior wall partitions ocean blue
        "lw": 1.1,
        "alpha": 0.90,
        "zorder": 4
    },
    "00.Wall Clean room": {
        "color": "#00FF87",     # Cleanroom boundary Canonical Neon Green
        "lw": 2.0,
        "alpha": 1.0,
        "zorder": 6
    },
    "00.Area": {
        "color": "#1E293B",     # Zone boundaries subtle dark slate
        "lw": 0.6,
        "alpha": 0.60,
        "zorder": 1
    },
    "00.Area Line": {
        "color": "#334155",     # Area division lines
        "lw": 0.8,
        "alpha": 0.70,
        "zorder": 2
    },
    "COL": {
        "color": "#F59E0B",     # Structural columns Amber
        "lw": 2.0,
        "alpha": 1.0,
        "zorder": 5
    }
}

# 10 LDI Exposure Machines Master Configuration
LDI_FLEET_CONFIG = [
    {
        "eqp_id": "LDI-01",
        "name": "LDI Exposure Unit 01",
        "process": "DF INNER",
        "factory": "2",
        "zone": "Site A - Zone 1",
        "dxf_x": -759080.3,
        "dxf_y": -75111.4,
        "block_name": "PE3000",
        "description": "Inner Layer Direct Imaging Photolithography Bay 1"
    },
    {
        "eqp_id": "LDI-02",
        "name": "LDI Exposure Unit 02",
        "process": "DF INNER",
        "factory": "2",
        "zone": "Site A - Zone 1",
        "dxf_x": -752752.3,
        "dxf_y": -75111.4,
        "block_name": "PE3000",
        "description": "Inner Layer Direct Imaging Photolithography Bay 2"
    },
    {
        "eqp_id": "LDI-03",
        "name": "LDI Exposure Unit 03",
        "process": "DF INNER",
        "factory": "3",
        "zone": "Site B - Zone 1",
        "dxf_x": -749875.3,
        "dxf_y": -75111.4,
        "block_name": "PE3000",
        "description": "Inner Layer Direct Imaging Photolithography Bay 3"
    },
    {
        "eqp_id": "LDI-04",
        "name": "LDI Exposure Unit 04",
        "process": "DF INNER",
        "factory": "3",
        "zone": "Site B - Zone 1",
        "dxf_x": -741675.1,
        "dxf_y": -74959.6,
        "block_name": "PE3000",
        "description": "Inner Layer Direct Imaging Photolithography Bay 4"
    },
    {
        "eqp_id": "LDI-05",
        "name": "LDI Exposure Unit 05",
        "process": "DF OUTER",
        "factory": "2",
        "zone": "Site A - Zone 2",
        "dxf_x": -736479.8,
        "dxf_y": -75111.4,
        "block_name": "PE3000",
        "description": "Outer Layer Direct Imaging Photolithography Bay 5"
    },
    {
        "eqp_id": "LDI-06",
        "name": "LDI Exposure Unit 06",
        "process": "DF OUTER",
        "factory": "2",
        "zone": "Site A - Zone 2",
        "dxf_x": -747440.1,
        "dxf_y": -97577.2,
        "block_name": "laser drilling 605GTW",
        "description": "Outer Layer Direct Imaging & Laser Micro-via Station 6"
    },
    {
        "eqp_id": "LDI-07",
        "name": "LDI Exposure Unit 07",
        "process": "SM",
        "factory": "2",
        "zone": "Site A - Zone 3",
        "dxf_x": -741046.2,
        "dxf_y": -34602.6,
        "block_name": "Auto Layup-Inner",
        "description": "Solder Mask Direct Imaging Cleanroom Station 7"
    },
    {
        "eqp_id": "LDI-08",
        "name": "LDI Exposure Unit 08",
        "process": "SM",
        "factory": "2",
        "zone": "Site A - Zone 3",
        "dxf_x": -734889.3,
        "dxf_y": -35000.6,
        "block_name": "00.X-Ray",
        "description": "Solder Mask Direct Imaging Alignment X-Ray Station 8"
    },
    {
        "eqp_id": "LDI-09",
        "name": "LDI Exposure Unit 09",
        "process": "SM",
        "factory": "3",
        "zone": "Site B - Zone 2",
        "dxf_x": -739933.0,
        "dxf_y": -41607.5,
        "block_name": "PQC Brown-Inner",
        "description": "Solder Mask Direct Imaging PQC Station 9"
    },
    {
        "eqp_id": "LDI-10",
        "name": "LDI Exposure Unit 10",
        "process": "SM",
        "factory": "3",
        "zone": "Site B - Zone 2",
        "dxf_x": -722666.5,
        "dxf_y": -16767.2,
        "block_name": "Auto Layup-Inner",
        "description": "Solder Mask Direct Imaging Cleanroom Station 10"
    }
]


def dxf_to_canvas(x: float, y: float) -> tuple[float, float]:
    """
    Transforms AutoCAD Cartesian coordinates (Right: +X, Up: +Y)
    to Grafana Canvas Panel percentage coordinates (Right: +X%, Down: +Y%).
    
    X_pct = ((X - X_min) / Span_X) * 100.0
    Y_pct = ((Y_max - Y) / Span_Y) * 100.0
    """
    pct_x = ((x - BUILDING_X_MIN) / SPAN_X) * 100.0
    pct_y = ((BUILDING_Y_MAX - y) / SPAN_Y) * 100.0
    return round(pct_x, 4), round(pct_y, 4)


def parse_dxf_streaming(dxf_path: str):
    """
    Fast streaming DXF group-code parser.
    Reads 393MB DXF sequentially in a single pass without building an in-memory DOM.
    Returns:
        lines_by_layer: dict mapping architectural layer to list of line segments [(x1,y1), (x2,y2)]
        machine_inserts: list of dicts for machine INSERT entities inside building bounds
        machine_texts: list of dicts for machine TEXT/MTEXT entities inside building bounds
    """
    print(f"[*] Parsing DXF drawing via fast streaming scanner: {dxf_path}")
    t0 = time.time()
    
    lines_by_layer = {layer: [] for layer in ARCHITECTURAL_LAYERS}
    machine_inserts = []
    machine_texts = []
    
    in_entities = False
    current_entity = None
    
    with open(dxf_path, 'r', encoding='utf-8', errors='ignore') as f:
        while True:
            code_line = f.readline()
            if not code_line:
                break
            val_line = f.readline()
            if not val_line:
                break
                
            code = code_line.strip()
            val = val_line.strip()
            
            if code == '0':
                if val == 'SECTION':
                    c2 = f.readline().strip()
                    v2 = f.readline().strip()
                    if v2 == 'ENTITIES':
                        in_entities = True
                    continue
                elif val == 'ENDSEC':
                    in_entities = False
                    continue
                elif val == 'EOF':
                    break
                
                # Process completed entity
                if in_entities and current_entity:
                    layer = current_entity.get('layer', '')
                    etype = current_entity.get('type')
                    
                    # 1. Collect architectural geometry
                    if layer in ARCHITECTURAL_LAYERS:
                        if etype == 'LINE':
                            x1 = current_entity.get('x1')
                            y1 = current_entity.get('y1')
                            x2 = current_entity.get('x2')
                            y2 = current_entity.get('y2')
                            if None not in (x1, y1, x2, y2):
                                if (min(x1, x2) <= BUILDING_X_MAX and max(x1, x2) >= BUILDING_X_MIN and
                                    min(y1, y2) <= BUILDING_Y_MAX and max(y1, y2) >= BUILDING_Y_MIN):
                                    lines_by_layer[layer].append([(x1, y1), (x2, y2)])
                                    
                        elif etype == 'LWPOLYLINE':
                            pts = current_entity.get('lw_pts', [])
                            is_closed = current_entity.get('closed', False)
                            if len(pts) >= 2:
                                for i in range(len(pts) - 1):
                                    p1 = pts[i]
                                    p2 = pts[i + 1]
                                    if (min(p1[0], p2[0]) <= BUILDING_X_MAX and max(p1[0], p2[0]) >= BUILDING_X_MIN and
                                        min(p1[1], p2[1]) <= BUILDING_Y_MAX and max(p1[1], p2[1]) >= BUILDING_Y_MIN):
                                        lines_by_layer[layer].append([p1, p2])
                                if is_closed and len(pts) >= 3:
                                    p1 = pts[-1]
                                    p2 = pts[0]
                                    if (min(p1[0], p2[0]) <= BUILDING_X_MAX and max(p1[0], p2[0]) >= BUILDING_X_MIN and
                                        min(p1[1], p2[1]) <= BUILDING_Y_MAX and max(p1[1], p2[1]) >= BUILDING_Y_MIN):
                                        lines_by_layer[layer].append([p1, p2])
                                        
                        elif etype == 'ARC':
                            cx = current_entity.get('x1')
                            cy = current_entity.get('y1')
                            r = current_entity.get('radius')
                            a1 = current_entity.get('start_angle', 0.0)
                            a2 = current_entity.get('end_angle', 360.0)
                            if None not in (cx, cy, r) and r > 0:
                                if a2 < a1:
                                    a2 += 360.0
                                num_segs = max(8, int((a2 - a1) / 15.0))
                                angles = np.radians(np.linspace(a1, a2, num_segs))
                                arc_pts = [(cx + r * np.cos(a), cy + r * np.sin(a)) for a in angles]
                                for i in range(len(arc_pts) - 1):
                                    p1 = arc_pts[i]
                                    p2 = arc_pts[i + 1]
                                    if (min(p1[0], p2[0]) <= BUILDING_X_MAX and max(p1[0], p2[0]) >= BUILDING_X_MIN and
                                        min(p1[1], p2[1]) <= BUILDING_Y_MAX and max(p1[1], p2[1]) >= BUILDING_Y_MIN):
                                        lines_by_layer[layer].append([p1, p2])
                                        
                        elif etype == 'CIRCLE':
                            cx = current_entity.get('x1')
                            cy = current_entity.get('y1')
                            r = current_entity.get('radius')
                            if None not in (cx, cy, r) and r > 0:
                                angles = np.radians(np.linspace(0, 360, 24))
                                c_pts = [(cx + r * np.cos(a), cy + r * np.sin(a)) for a in angles]
                                for i in range(len(c_pts) - 1):
                                    p1 = c_pts[i]
                                    p2 = c_pts[i + 1]
                                    if (min(p1[0], p2[0]) <= BUILDING_X_MAX and max(p1[0], p2[0]) >= BUILDING_X_MIN and
                                        min(p1[1], p2[1]) <= BUILDING_Y_MAX and max(p1[1], p2[1]) >= BUILDING_Y_MIN):
                                        lines_by_layer[layer].append([p1, p2])
                    
                    # 2. Collect machine entities
                    if layer == '00.Machine':
                        x = current_entity.get('x1')
                        y = current_entity.get('y1')
                        if x is not None and y is not None:
                            if (BUILDING_X_MIN <= x <= BUILDING_X_MAX and BUILDING_Y_MIN <= y <= BUILDING_Y_MAX):
                                if etype == 'INSERT':
                                    machine_inserts.append(current_entity)
                                elif etype in ('TEXT', 'MTEXT'):
                                    machine_texts.append(current_entity)
                
                # Start new entity
                current_entity = {'type': val, 'layer': '', 'lw_pts': []}
                continue
            
            if current_entity and in_entities:
                if code == '8':
                    current_entity['layer'] = val
                elif code == '2':
                    current_entity['block_name'] = val
                elif code == '10':
                    try:
                        val_f = float(val)
                        current_entity['x1'] = val_f
                        current_entity['lw_pts'].append((val_f, 0.0))
                    except ValueError:
                        pass
                elif code == '20':
                    try:
                        val_f = float(val)
                        current_entity['y1'] = val_f
                        if current_entity['lw_pts']:
                            px, _ = current_entity['lw_pts'][-1]
                            current_entity['lw_pts'][-1] = (px, val_f)
                    except ValueError:
                        pass
                elif code == '11':
                    try:
                        current_entity['x2'] = float(val)
                    except ValueError:
                        pass
                elif code == '21':
                    try:
                        current_entity['y2'] = float(val)
                    except ValueError:
                        pass
                elif code == '1':
                    current_entity['text'] = val
                elif code == '3':
                    current_entity['text3'] = val
                elif code == '40':
                    try:
                        current_entity['radius'] = float(val)
                    except ValueError:
                        pass
                elif code == '41':
                    try:
                        current_entity['scale_x'] = float(val)
                    except ValueError:
                        pass
                elif code == '42':
                    try:
                        current_entity['scale_y'] = float(val)
                    except ValueError:
                        pass
                elif code == '50':
                    try:
                        current_entity['start_angle'] = float(val)
                        current_entity['rotation'] = float(val)
                    except ValueError:
                        pass
                elif code == '51':
                    try:
                        current_entity['end_angle'] = float(val)
                    except ValueError:
                        pass
                elif code == '70':
                    try:
                        flags = int(val)
                        if flags & 1:
                            current_entity['closed'] = True
                    except ValueError:
                        pass

    elapsed = time.time() - t0
    total_segs = sum(len(segs) for segs in lines_by_layer.values())
    print(f"[+] DXF parsed successfully in {elapsed:.2f}s:")
    print(f"    - Extracted {total_segs} architectural vector line segments across {len(lines_by_layer)} layers")
    print(f"    - Extracted {len(machine_inserts)} machine INSERT blocks in building bounds")
    print(f"    - Extracted {len(machine_texts)} machine TEXT/MTEXT tags in building bounds")
    
    return lines_by_layer, machine_inserts, machine_texts


def render_floorplan_png(lines_by_layer: dict, output_png_path: str, dpi: int = 160):
    """
    Renders high-resolution 4K dark-themed architectural floorplan PNG.
    Uses Matplotlib LineCollection with Anti-Aliasing and ISA-101 design system colors.
    """
    print(f"[*] Rendering high-resolution floorplan image to {output_png_path}...")
    t0 = time.time()
    
    os.makedirs(os.path.dirname(os.path.abspath(output_png_path)), exist_ok=True)
    
    # 24 inches wide at 160 DPI -> 3840 x 1760 pixels
    fig_w = 24.0
    fig_h = fig_w / ASPECT_RATIO
    
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=dpi, facecolor='#0B0F19')
    ax.set_facecolor('#0B0F19')
    
    for layer, segs in lines_by_layer.items():
        if segs:
            style = LAYER_STYLES.get(layer, {"color": "#64748B", "lw": 1.0, "alpha": 0.8, "zorder": 3})
            lc = LineCollection(
                segs,
                colors=style["color"],
                linewidths=style["lw"],
                alpha=style["alpha"],
                zorder=style["zorder"],
                antialiased=True
            )
            ax.add_collection(lc)
            
    ax.set_xlim(BUILDING_X_MIN, BUILDING_X_MAX)
    ax.set_ylim(BUILDING_Y_MIN, BUILDING_Y_MAX)
    ax.axis('off')
    
    # Tight subplots with 0 margin
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    
    fig.savefig(output_png_path, facecolor='#0B0F19', dpi=dpi, pad_inches=0)
    plt.close(fig)
    
    file_size = os.path.getsize(output_png_path)
    print(f"[+] Rendered floorplan PNG in {time.time() - t0:.2f}s: {file_size:,} bytes ({file_size / 1024:.1f} KB)")


def export_machines_json(machine_inserts: list, machine_texts: list, output_json_path: str):
    """
    Normalizes DXF machine coordinates to Canvas percentages (0-100%) and exports to JSON.
    Includes:
    - 10 LDI Cleanroom Exposure Stations (`LDI-01` .. `LDI-10`)
    - All 361 extracted machine entities with Canvas coordinate mappings
    - Machine bays (DC bays, PAH units, drilling clusters)
    """
    print(f"[*] Normalizing machine coordinates and exporting JSON to {output_json_path}...")
    t0 = time.time()
    
    os.makedirs(os.path.dirname(os.path.abspath(output_json_path)), exist_ok=True)
    
    # 1. Process 10 LDI Machines
    cleanroom_ldi_machines = []
    for ldi in LDI_FLEET_CONFIG:
        cx, cy = dxf_to_canvas(ldi["dxf_x"], ldi["dxf_y"])
        cleanroom_ldi_machines.append({
            "eqp_id": ldi["eqp_id"],
            "name": ldi["name"],
            "process": ldi["process"],
            "factory": ldi["factory"],
            "zone": ldi["zone"],
            "description": ldi["description"],
            "block_name": ldi["block_name"],
            "dxf_x": ldi["dxf_x"],
            "dxf_y": ldi["dxf_y"],
            "canvas_x_pct": cx,
            "canvas_y_pct": cy,
            "canvas_left_px_1920": round((cx / 100.0) * 1920, 1),
            "canvas_top_px_1080": round((cy / 100.0) * 1080, 1)
        })
        
    # 2. Process all extracted machine INSERT entities
    all_machines = []
    for idx, ins in enumerate(machine_inserts):
        x = ins.get('x1', 0.0)
        y = ins.get('y1', 0.0)
        bname = ins.get('block_name', 'UNKNOWN')
        cx, cy = dxf_to_canvas(x, y)
        
        all_machines.append({
            "id": f"M-{idx + 1:04d}",
            "block_name": bname,
            "dxf_x": round(x, 2),
            "dxf_y": round(y, 2),
            "canvas_x_pct": cx,
            "canvas_y_pct": cy,
            "rotation": ins.get('rotation', 0.0),
            "scale_x": ins.get('scale_x', 1.0),
            "scale_y": ins.get('scale_y', 1.0)
        })
        
    # 3. Process text annotations on 00.Machine layer
    extracted_texts = []
    for idx, txt_ent in enumerate(machine_texts):
        raw_text = txt_ent.get('text') or txt_ent.get('text3') or ''
        clean_text = raw_text.replace('\\P', '\n').strip()
        x = txt_ent.get('x1', 0.0)
        y = txt_ent.get('y1', 0.0)
        cx, cy = dxf_to_canvas(x, y)
        extracted_texts.append({
            "id": f"T-{idx + 1:04d}",
            "text": clean_text,
            "dxf_x": round(x, 2),
            "dxf_y": round(y, 2),
            "canvas_x_pct": cx,
            "canvas_y_pct": cy
        })

    # Assemble master JSON document
    payload = {
        "metadata": {
            "source_dxf": "Floor1.dxf",
            "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "building_bounds": {
                "x_min": BUILDING_X_MIN,
                "x_max": BUILDING_X_MAX,
                "y_min": BUILDING_Y_MIN,
                "y_max": BUILDING_Y_MAX,
                "span_x": SPAN_X,
                "span_y": SPAN_Y,
                "aspect_ratio": round(ASPECT_RATIO, 6)
            },
            "total_machine_inserts": len(all_machines),
            "total_machine_texts": len(extracted_texts),
            "total_ldi_machines": len(cleanroom_ldi_machines)
        },
        "cleanroom_ldi_machines": cleanroom_ldi_machines,
        "all_machines": all_machines,
        "machine_texts": extracted_texts
    }
    
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        
    print(f"[+] Exported machines JSON in {time.time() - t0:.2f}s: {len(all_machines)} entities, {len(cleanroom_ldi_machines)} LDI stations")


def sync_assets_to_grafana(source_png_path: str, repo_root: str):
    """
    Copies rendered floorplan PNG to Grafana 3D plugin static directories
    so it can be served via /public/plugins/3d-panel/img/floorplan_1F.png.
    """
    dest_paths = [
        os.path.join(repo_root, "monitoring", "grafana", "plugins", "3d-panel", "img", "floorplan_1F.png"),
        os.path.join(repo_root, "monitoring", "grafana", "plugins", "3d-panel", "dist", "img", "floorplan_1F.png")
    ]
    
    print("[*] Synchronizing floorplan assets to Grafana plugin directories...")
    for dest in dest_paths:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(source_png_path, dest)
        size = os.path.getsize(dest)
        print(f"    -> Copied to: {dest} ({size:,} bytes)")


def main():
    parser = argparse.ArgumentParser(description="IMS CAD Floorplan & Machine Normalization Pipeline")
    parser.add_argument(
        "--dxf",
        default=r"C:\Users\ohmat\OneDrive - Rajamangala University of Technology Phranakhon\เอกสาร\Floor1.dxf",
        help="Path to AutoCAD Floor1.dxf file"
    )
    parser.add_argument(
        "--output-png",
        default=None,
        help="Output PNG path (defaults to assets/floorplan_1F.png)"
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help="Output JSON path (defaults to assets/machines_1F.json)"
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=160,
        help="Output PNG DPI (default 160 -> 3840x1760 px)"
    )
    args = parser.parse_args()
    
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    output_png = args.output_png or os.path.join(repo_root, "assets", "floorplan_1F.png")
    output_json = args.output_json or os.path.join(repo_root, "assets", "machines_1F.json")
    
    if not os.path.isfile(args.dxf):
        print(f"[!] Error: DXF file not found at: {args.dxf}")
        sys.exit(1)
        
    start_total = time.time()
    print("═" * 70)
    print(" IMS Factory Floorplan & Machine Geometry Extraction Pipeline ")
    print("═" * 70)
    
    # Step 1: Parse DXF
    lines_by_layer, machine_inserts, machine_texts = parse_dxf_streaming(args.dxf)
    
    # Step 2: Render Floorplan PNG
    render_floorplan_png(lines_by_layer, output_png, dpi=args.dpi)
    
    # Step 3: Export Machines JSON
    export_machines_json(machine_inserts, machine_texts, output_json)
    
    # Step 4: Synchronize to Grafana Plugin Directories
    sync_assets_to_grafana(output_png, repo_root)
    
    total_time = time.time() - start_total
    print("═" * 70)
    print(f"[✓] Pipeline complete in {total_time:.2f}s")
    print(f"    - Floorplan Asset: {output_png}")
    print(f"    - Machines Dataset: {output_json}")
    print("═" * 70)


if __name__ == "__main__":
    main()
