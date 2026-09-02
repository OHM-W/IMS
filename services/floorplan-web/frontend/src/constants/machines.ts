import { MachineCoordinate } from '../types/ldi';

export const SVG_VIEWBOX = {
  width: 3200,
  height: 1550,
  viewBox: '0 0 3200 1550',
};

export const CLEANROOM_BOUNDS = {
  xMin: 2150,
  xMax: 2870,
  yMin: 480,
  yMax: 800,
  name: 'Cleanroom Photolithography (Bay 1 & Bay 2)',
};

export const MACHINE_NODE_DIMENSIONS = {
  width: 110,
  height: 90,
};

export const LDI_MACHINES: MachineCoordinate[] = [
  // Bay 1: Upper Row (y = 560)
  { eqp_id: 'LDI-01', name: 'LDI Machine 01', svgX: 2210, svgY: 560, width: 110, height: 90, bay: 'Bay 1', zone: 'Cleanroom' },
  { eqp_id: 'LDI-02', name: 'LDI Machine 02', svgX: 2350, svgY: 560, width: 110, height: 90, bay: 'Bay 1', zone: 'Cleanroom' },
  { eqp_id: 'LDI-03', name: 'LDI Machine 03', svgX: 2490, svgY: 560, width: 110, height: 90, bay: 'Bay 1', zone: 'Cleanroom' },
  { eqp_id: 'LDI-04', name: 'LDI Machine 04', svgX: 2630, svgY: 560, width: 110, height: 90, bay: 'Bay 1', zone: 'Cleanroom' },
  { eqp_id: 'LDI-05', name: 'LDI Machine 05', svgX: 2770, svgY: 560, width: 110, height: 90, bay: 'Bay 1', zone: 'Cleanroom' },

  // Bay 2: Lower Row (y = 720)
  { eqp_id: 'LDI-06', name: 'LDI Machine 06', svgX: 2210, svgY: 720, width: 110, height: 90, bay: 'Bay 2', zone: 'Cleanroom' },
  { eqp_id: 'LDI-07', name: 'LDI Machine 07', svgX: 2350, svgY: 720, width: 110, height: 90, bay: 'Bay 2', zone: 'Cleanroom' },
  { eqp_id: 'LDI-08', name: 'LDI Machine 08', svgX: 2490, svgY: 720, width: 110, height: 90, bay: 'Bay 2', zone: 'Cleanroom' },
  { eqp_id: 'LDI-09', name: 'LDI Machine 09', svgX: 2630, svgY: 720, width: 110, height: 90, bay: 'Bay 2', zone: 'Cleanroom' },
  { eqp_id: 'LDI-10', name: 'LDI Machine 10', svgX: 2770, svgY: 720, width: 110, height: 90, bay: 'Bay 2', zone: 'Cleanroom' },
];

export const MACHINE_MAP = new Map<string, MachineCoordinate>(
  LDI_MACHINES.map((m) => [m.eqp_id, m])
);
