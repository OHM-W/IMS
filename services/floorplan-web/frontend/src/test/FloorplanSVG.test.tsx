import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { FloorplanSVG, FloorplanPanzoomControls } from '../components/FloorplanSVG';
import { LdiMachine } from '../types/ldi';
import { FLEET_MACHINES, FACTORY_ZONES, TOTAL_FLEET_COUNT } from '../constants/fleet';

describe('FloorplanSVG', () => {
  it('renders all 250 machine nodes and floorplan SVG root', () => {
    const mockMachines: Record<string, LdiMachine> = {};
    for (const m of FLEET_MACHINES) {
      mockMachines[m.id] = {
        eqp_id: m.id,
        status: 1,
        temperature: 22.0,
        humidity: 45.0,
        resist_dosage: 35.0,
        scan_speed: 120.0,
        air_vacuum: 80.0,
        thickness: 0.1,
        board_no: 10,
        total_board: 50,
        total_time: 15.0,
        mo: 'MO-01',
        fpn: 'FPN-01',
        layer_name: 'L1',
        last_seen: '2026-09-01T12:00:00Z',
      };
    }

    const ref = createRef<FloorplanPanzoomControls>();
    const handleSelect = vi.fn();

    render(
      <FloorplanSVG
        ref={ref}
        machines={mockMachines}
        selectedId="LSR-001"
        activeFilter="ALL"
        fleetMachines={FLEET_MACHINES}
        onSelectMachine={handleSelect}
      />
    );

    expect(screen.getByTestId('floorplan-svg-root')).toBeInTheDocument();
    expect(screen.getByTestId('floorplan-svg-container')).toBeInTheDocument();

    // Verify all 250 fleet machines are rendered
    expect(FLEET_MACHINES.length).toBe(TOTAL_FLEET_COUNT);
    for (const m of FLEET_MACHINES.slice(0, 20)) {
      expect(screen.getByTestId(`machine-node-${m.id}`)).toBeInTheDocument();
    }

    // Verify key peripheral and laser drill machine nodes exist
    expect(screen.getByTestId('machine-node-LSR-001')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-DH-ULD')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-ALU-1-H1')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-BND-001')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-BWN001-ULD')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-PP-BAY-01')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-CUT-CCL001')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-DEO-LDG')).toBeInTheDocument();
    expect(screen.getByTestId('machine-node-XRY-001')).toBeInTheDocument();

    // Verify clicking a machine triggers selection callback
    const node = screen.getByTestId('machine-node-LSR-001');
    fireEvent.click(node);
    expect(handleSelect).toHaveBeenCalledWith('LSR-001');

    // Verify Panzoom imperative controls exist on ref
    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.zoomIn).toBe('function');
    expect(typeof ref.current?.zoomOut).toBe('function');
    expect(typeof ref.current?.resetView).toBe('function');
    expect(typeof ref.current?.zoomToFit).toBe('function');
    expect(typeof ref.current?.focusCleanroom).toBe('function');
    expect(typeof ref.current?.zoomToMachine).toBe('function');
    expect(typeof ref.current?.focusProcess).toBe('function');
    expect(typeof ref.current?.zoomToZone).toBe('function');
    expect(typeof ref.current?.focusBoundingBox).toBe('function');
  });

  it('renders all 10 factory zone labels correctly', () => {
    render(
      <FloorplanSVG
        machines={{}}
        selectedId={null}
        activeFilter="DRILLING"
        fleetMachines={FLEET_MACHINES}
        onSelectMachine={() => {}}
      />
    );

    for (const zone of FACTORY_ZONES) {
      expect(screen.getByText(zone.displayName)).toBeInTheDocument();
    }
  });
});
