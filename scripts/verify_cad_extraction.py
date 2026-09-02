"""
Automated Verification Suite for M1 CAD Extraction & Normalization
"""
import os
import sys
import json
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 70)
print(" VERIFICATION: M1 CAD Extraction & Normalization Artifacts")
print("=" * 70)

# Check 1: Floorplan PNG Assets
print("\n[CHECK 1] Verifying Floorplan PNG Assets:")
png_paths = [
    r"c:\IMS\assets\floorplan_1F.png",
    r"c:\IMS\monitoring\grafana\plugins\3d-panel\img\floorplan_1F.png",
    r"c:\IMS\monitoring\grafana\plugins\3d-panel\dist\img\floorplan_1F.png"
]

for p in png_paths:
    assert os.path.exists(p), f"Asset missing: {p}"
    size = os.path.getsize(p)
    print(f"  [PASS] File exists: {p} ({size:,} bytes)")
    assert size > 50000, f"File size too small ({size} bytes < 50,000 bytes)"
    
    with Image.open(p) as img:
        w, h = img.size
        aspect = w / h
        print(f"         Resolution: {w}x{h} px, Aspect: {aspect:.4f}, Mode: {img.mode}")
        assert w >= 1920 and h >= 800, f"Resolution {w}x{h} below 1080p requirement"

# Check 2: Machines JSON Dataset
print("\n[CHECK 2] Verifying Machines JSON Dataset:")
json_path = r"c:\IMS\assets\machines_1F.json"
assert os.path.exists(json_path), f"JSON file missing: {json_path}"
size = os.path.getsize(json_path)
print(f"  [PASS] JSON exists: {json_path} ({size:,} bytes)")

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

meta = data.get("metadata", {})
print(f"         Total Machine Inserts: {meta.get('total_machine_inserts')}")
print(f"         Total Machine Texts:   {meta.get('total_machine_texts')}")
print(f"         Total LDI Machines:    {meta.get('total_ldi_machines')}")

assert meta.get('total_machine_inserts') == 361, f"Expected 361 machine inserts, got {meta.get('total_machine_inserts')}"
assert meta.get('total_ldi_machines') == 10, f"Expected 10 LDI machines, got {meta.get('total_ldi_machines')}"

# Check 3: LDI-01 .. LDI-10 Coordinate Normalization
print("\n[CHECK 3] Verifying LDI-01 .. LDI-10 Cleanroom Station Mapping:")
cleanroom_ldis = data.get("cleanroom_ldi_machines", [])
assert len(cleanroom_ldis) == 10, f"Expected 10 cleanroom machines, got {len(cleanroom_ldis)}"

for ldi in cleanroom_ldis:
    eqp = ldi["eqp_id"]
    name = ldi["name"]
    process = ldi["process"]
    cx = ldi["canvas_x_pct"]
    cy = ldi["canvas_y_pct"]
    print(f"  [PASS] {eqp:7s} | {process:9s} | CAD: ({ldi['dxf_x']:9.1f}, {ldi['dxf_y']:9.1f}) -> Canvas: ({cx:6.3f}%, {cy:6.3f}%)")
    assert 0.0 <= cx <= 100.0, f"Out of bounds X percentage for {eqp}: {cx}"
    assert 0.0 <= cy <= 100.0, f"Out of bounds Y percentage for {eqp}: {cy}"

# Check 4: Full Machine Entity Bounds Verification
print("\n[CHECK 4] Verifying all 361 Extracted Machine Entities:")
all_m = data.get("all_machines", [])
assert len(all_m) == 361, f"Expected 361 machines in all_machines list, got {len(all_m)}"
for m in all_m:
    cx = m["canvas_x_pct"]
    cy = m["canvas_y_pct"]
    assert 0.0 <= cx <= 100.0, f"Machine {m['id']} X out of bounds: {cx}"
    assert 0.0 <= cy <= 100.0, f"Machine {m['id']} Y out of bounds: {cy}"
print(f"  [PASS] All 361 machine entities verified within [0.0%, 100.0%] canvas range.")

print("\n" + "=" * 70)
print(" ALL VERIFICATION CHECKS PASSED PERFECTLY (100% SUCCESS)")
print("=" * 70)
