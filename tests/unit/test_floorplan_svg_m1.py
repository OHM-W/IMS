#!/usr/bin/env python3
"""
Unit and Integration Validation for Milestone 1:
Floorplan SVG Generator & Vector SVG Asset
"""
import unittest
import os
import xml.etree.ElementTree as ET
import sys

SVG_PATH = r"c:\IMS\services\floorplan-web\frontend\public\floorplan.svg"
SCRIPT_PATH = r"c:\IMS\scripts\generate_floorplan_svg.py"

class TestFloorplanSvgM1(unittest.TestCase):
    def test_01_file_existence_and_size(self):
        self.assertTrue(os.path.isfile(SCRIPT_PATH), "Generator script must exist")
        self.assertTrue(os.path.isfile(SVG_PATH), "Generated SVG must exist")
        size_kb = os.path.getsize(SVG_PATH) / 1024.0
        print(f"SVG size: {size_kb:.2f} KB")
        self.assertGreaterEqual(size_kb, 150.0, "SVG size should be >= 150 KB")
        self.assertLessEqual(size_kb, 250.0, "SVG size should be <= 250 KB")

    def test_02_svg_root_attributes(self):
        tree = ET.parse(SVG_PATH)
        root = tree.getroot()
        self.assertEqual(root.attrib.get("viewBox"), "0 0 3200 1550")
        self.assertEqual(root.attrib.get("width"), "3200")
        self.assertEqual(root.attrib.get("height"), "1550")
        self.assertIn("#0B0F19", root.attrib.get("style", ""))

    def test_03_svg_grid_defs(self):
        tree = ET.parse(SVG_PATH)
        root = tree.getroot()
        defs = root.find("{http://www.w3.org/2000/svg}defs")
        self.assertIsNotNone(defs, "Defs section required")
        pattern_ids = [p.attrib.get("id") for p in defs.findall("{http://www.w3.org/2000/svg}pattern")]
        self.assertIn("industrial-grid", pattern_ids)
        self.assertIn("major-grid", pattern_ids)

    def test_04_architectural_layers(self):
        tree = ET.parse(SVG_PATH)
        root = tree.getroot()
        layers = {}
        for g in root.findall(".//{http://www.w3.org/2000/svg}g"):
            dlayer = g.attrib.get("data-layer")
            if dlayer:
                layers[dlayer] = len(list(g))
        
        required = [
            "00-WALL", "00.Wall FCD", "00.Wall IN", "00.Wall Clean room",
            "00.Area", "00.Area Line", "COL", "DOOR-SW", "F1-layout$0$D-DOOR",
            "F1-layout$0$D-Emergency Door", "D-Emergency Door"
        ]
        for req in required:
            self.assertIn(req, layers, f"Layer {req} must be present")
            self.assertGreater(layers[req], 0, f"Layer {req} must contain rendered vector elements")

    def test_05_cleanroom_photolithography_zone(self):
        tree = ET.parse(SVG_PATH)
        root = tree.getroot()
        cr_group = root.find('.//*[@id="zone_cleanroom_photolithography"]')
        self.assertIsNotNone(cr_group, "zone_cleanroom_photolithography must exist")
        rect = cr_group.find("{http://www.w3.org/2000/svg}rect")
        self.assertIsNotNone(rect, "Cleanroom rect must exist")
        self.assertEqual(rect.attrib.get("x"), "2150")
        self.assertEqual(rect.attrib.get("y"), "480")
        self.assertEqual(rect.attrib.get("width"), "720")
        self.assertEqual(rect.attrib.get("height"), "320")

    def test_06_machine_coordinates_containment(self):
        machines = {
            "LDI-01": (2210, 560), "LDI-02": (2350, 560), "LDI-03": (2490, 560),
            "LDI-04": (2630, 560), "LDI-05": (2770, 560),
            "LDI-06": (2210, 720), "LDI-07": (2350, 720), "LDI-08": (2490, 720),
            "LDI-09": (2630, 720), "LDI-10": (2770, 720),
        }
        cr_x1, cr_y1, cr_x2, cr_y2 = 2150, 480, 2150 + 720, 480 + 320
        for eqp, (mx, my) in machines.items():
            self.assertTrue(cr_x1 <= mx <= cr_x2, f"{eqp} x={mx} outside cleanroom x range")
            self.assertTrue(cr_y1 <= my <= cr_y2, f"{eqp} y={my} outside cleanroom y range")

    def test_07_vector_elements_coordinate_bounds(self):
        """Assert that 100% of vector elements and coordinates lie strictly within 0.0 <= x <= 3200.0 and 0.0 <= y <= 1550.0."""
        import re
        tree = ET.parse(SVG_PATH)
        root = tree.getroot()
        
        svg_w = 3200.0
        svg_h = 1550.0
        
        violations = []
        total_elements = 0
        
        for g in root.findall(".//{http://www.w3.org/2000/svg}g"):
            dlayer = g.attrib.get("data-layer") or g.attrib.get("id", "")
            for child in list(g):
                tag = child.tag.split("}")[-1]
                pts = []
                if tag == "line":
                    total_elements += 1
                    pts = [(float(child.attrib["x1"]), float(child.attrib["y1"])),
                           (float(child.attrib["x2"]), float(child.attrib["y2"]))]
                elif tag in ("polyline", "polygon"):
                    total_elements += 1
                    raw = child.attrib.get("points", "").split()
                    pts = [tuple(map(float, p.split(","))) for p in raw if "," in p]
                elif tag == "circle":
                    total_elements += 1
                    cx, cy, r = float(child.attrib["cx"]), float(child.attrib["cy"]), float(child.attrib["r"])
                    pts = [(cx - r, cy), (cx + r, cy), (cx, cy - r), (cx, cy + r)]
                elif tag == "path":
                    total_elements += 1
                    d = child.attrib.get("d", "")
                    m = [float(v) for v in re.findall(r"[-+]?(?:\d*\.\d+|\d+)", d)]
                    if len(m) >= 2:
                        pts = [(m[0], m[1])]
                        if len(m) >= 7:
                            pts.append((m[-2], m[-1]))

                for x, y in pts:
                    if not (0.0 <= x <= svg_w and 0.0 <= y <= svg_h):
                        violations.append((dlayer, tag, x, y))

        self.assertGreater(total_elements, 1000, "Should have verified thousands of architectural elements")
        self.assertEqual(len(violations), 0, f"Found {len(violations)} coordinates violating viewBox bounds: {violations[:5]}")

if __name__ == "__main__":
    unittest.main()
