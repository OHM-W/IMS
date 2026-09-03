import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MachineDetailPopup } from '../components/MachineDetailPopup';
import App from '../App';
import { FloorplanSVG } from '../components/FloorplanSVG';
import { LdiMachine } from '../types/ldi';
import { MachineDef } from '../types/fleet';

describe('Empirical Challenge 1: MachineDetailPopup Fallbacks & Data Cells', () => {
  const baseDrillDef: MachineDef = {
    id: 'DRL-TEST-01',
    name: 'DRL-01',
    process: 'DRILLING_MAIN',
    svgX: 500,
    svgY: 500,
    bay: 'BAY-1',
    zoneId: 'DRILLING_MAIN',
    hasLiveFeed: true,
  };

  it('renders "—" fallback for program_name and tool_info when null, undefined, or empty', () => {
    // 1. null values
    const drillMachineNull: LdiMachine = {
      eqp_id: 'DRL-TEST-01',
      status: 1,
      process_type: 'DRILLING',
      program_name: null,
      tool_info: null,
    };

    const { rerender } = render(
      <MachineDetailPopup
        machine={drillMachineNull}
        machineDef={baseDrillDef}
        onClose={vi.fn()}
      />
    );

    // Both program_name and tool_info should render "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
    // Ensure old fake sample strings do NOT appear
    expect(screen.queryByText(/A220A-107BJ-FA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/T200 tool diameter/)).not.toBeInTheDocument();

    // 2. empty strings
    const drillMachineEmpty: LdiMachine = {
      eqp_id: 'DRL-TEST-01',
      status: 1,
      process_type: 'DRILLING',
      program_name: '',
      tool_info: '',
    };
    rerender(
      <MachineDetailPopup
        machine={drillMachineEmpty}
        machineDef={baseDrillDef}
        onClose={vi.fn()}
      />
    );
    const dashesEmpty = screen.getAllByText('—');
    expect(dashesEmpty.length).toBeGreaterThanOrEqual(2);

    // 3. undefined properties
    const drillMachineUndef: LdiMachine = {
      eqp_id: 'DRL-TEST-01',
      status: 1,
      process_type: 'DRILLING',
    };
    rerender(
      <MachineDetailPopup
        machine={drillMachineUndef}
        machineDef={baseDrillDef}
        onClose={vi.fn()}
      />
    );
    const dashesUndef = screen.getAllByText('—');
    expect(dashesUndef.length).toBeGreaterThanOrEqual(2);
  });

  it('renders actual program_name and tool_info strings when provided', () => {
    const drillMachineActive: LdiMachine = {
      eqp_id: 'DRL-TEST-01',
      status: 1,
      process_type: 'DRILLING',
      program_name: 'ACTUAL_PROG_V99.TLP',
      tool_info: '6 HEAD DRILL SPINDLE T300',
    };

    render(
      <MachineDetailPopup
        machine={drillMachineActive}
        machineDef={baseDrillDef}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('ACTUAL_PROG_V99.TLP')).toBeInTheDocument();
    expect(screen.getByText('6 HEAD DRILL SPINDLE T300')).toBeInTheDocument();
    expect(screen.getByText('COPY')).toBeInTheDocument();
  });

  it('renders air_vacuum and thickness formatted cells for laser machine with null, numbers, and boundary zero', () => {
    const laserDef: MachineDef = {
      id: 'LDI-TEST-01',
      name: 'LDI-01',
      process: 'LASER_DRILLING',
      svgX: 2200,
      svgY: 560,
      bay: 'CLEANROOM',
      zoneId: 'LASER_DRILLING',
      hasLiveFeed: true,
    };

    // 1. null values -> both should display '--'
    const laserNull: LdiMachine = {
      eqp_id: 'LDI-TEST-01',
      status: 1,
      air_vacuum: null,
      thickness: null,
    };

    const { rerender } = render(
      <MachineDetailPopup
        machine={laserNull}
        machineDef={laserDef}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('AIR VACUUM')).toBeInTheDocument();
    expect(screen.getByText('THICKNESS')).toBeInTheDocument();

    // Check cells with '--'
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);

    // 2. present valid values
    const laserPresent: LdiMachine = {
      eqp_id: 'LDI-TEST-01',
      status: 1,
      air_vacuum: 84.2,
      thickness: 0.102,
    };

    rerender(
      <MachineDetailPopup
        machine={laserPresent}
        machineDef={laserDef}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('84.2 kPa')).toBeInTheDocument();
    expect(screen.getByText('0.102 mm')).toBeInTheDocument();

    // 3. boundary zero: 0 is a valid measurement and should format as 0.0 kPa and 0.000 mm, NOT '--'
    const laserZero: LdiMachine = {
      eqp_id: 'LDI-TEST-01',
      status: 1,
      air_vacuum: 0,
      thickness: 0,
    };

    rerender(
      <MachineDetailPopup
        machine={laserZero}
        machineDef={laserDef}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('0.0 kPa')).toBeInTheDocument();
    expect(screen.getByText('0.000 mm')).toBeInTheDocument();
  });
});

describe('Empirical Challenge 2: App.tsx Telemetry Binding & Collision Resistance', () => {
  const mockLiveTelemetry: LdiMachine = {
    eqp_id: 'LDI-01',
    status: 1, // RUN
    temperature: 23.4,
    humidity: 47.8,
    resist_dosage: 38.5,
    scan_speed: 130.0,
    air_vacuum: 85.0,
    thickness: 0.105,
    board_no: 10,
    total_board: 50,
    total_time: 20.0,
    mo: 'MO-LDI01-LIVE',
    fpn: 'FPN-LDI01-LIVE',
    layer_name: 'L1-LIVE',
    last_seen: '2026-09-03T10:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prevents name-based collision: card named LDI-01 does NOT hijack LDI-01 telemetry in App detail drawer', async () => {
    // Machine with id 'DRILL-01', name 'LDI-01', and no telemetryId
    const collisionMachine: MachineDef = {
      id: 'DRILL-01',
      name: 'LDI-01', // Name collides with live telemetry eqp_id
      process: 'DRILLING_MAIN',
      svgX: 600,
      svgY: 600,
      bay: 'BAY-DRILL',
      zoneId: 'DRILLING_MAIN',
      hasLiveFeed: false,
      telemetryId: undefined, // No telemetryId
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/layout')) {
        return {
          ok: true,
          json: async () => ({
            custom: true,
            machines: [collisionMachine],
            deletedIds: [],
          }),
        };
      }
      if (url.includes('/api/snapshot')) {
        return {
          ok: true,
          json: async () => [mockLiveTelemetry],
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    }) as any;

    render(<App />);

    // Wait for collision machine node to be in document
    await waitFor(() => {
      expect(screen.getByTestId('machine-node-DRILL-01')).toBeInTheDocument();
    });

    // Click DRILL-01 machine node
    fireEvent.click(screen.getByTestId('machine-node-DRILL-01'));

    // Verify detail drawer opened
    await waitFor(() => {
      expect(screen.getByTestId('machine-detail-drawer')).toBeInTheDocument();
    });

    const drawer = screen.getByTestId('machine-detail-drawer');
    const drawerScope = within(drawer);

    // CRUCIAL: DRILL-01 detail drawer must NOT have hijacked LDI-01's telemetry!
    // It should NOT display LDI-01 MO number or temperature inside drawer
    expect(drawerScope.queryByText('MO-LDI01-LIVE')).not.toBeInTheDocument();
    expect(drawerScope.queryByText('23.4°C')).not.toBeInTheDocument();
    // Status must be unmonitored / fallback (status 5 = UNDEFINE)
    expect(drawerScope.getByText('UNDEFINE')).toBeInTheDocument();
  });

  it('allows telemetry binding when explicit telemetryId is configured', async () => {
    const boundMachine: MachineDef = {
      id: 'DRILL-01',
      name: 'CUSTOM-DRILL',
      process: 'DRILLING_MAIN',
      svgX: 600,
      svgY: 600,
      bay: 'BAY-DRILL',
      zoneId: 'DRILLING_MAIN',
      hasLiveFeed: true,
      telemetryId: 'LDI-01', // Explicit binding to live telemetry
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/layout')) {
        return {
          ok: true,
          json: async () => ({
            custom: true,
            machines: [boundMachine],
            deletedIds: [],
          }),
        };
      }
      if (url.includes('/api/snapshot')) {
        return {
          ok: true,
          json: async () => [mockLiveTelemetry],
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    }) as any;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('machine-node-DRILL-01')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('machine-node-DRILL-01'));

    await waitFor(() => {
      expect(screen.getByTestId('machine-detail-drawer')).toBeInTheDocument();
    });

    const drawer = screen.getByTestId('machine-detail-drawer');
    const drawerScope = within(drawer);

    // With explicit telemetryId, drawer receives LDI-01 telemetry (status 1 = RUN)
    expect(drawerScope.getByText('RUN')).toBeInTheDocument();
  });

  it('evaluates FloorplanSVG overlay telemetry resolution: reveals lingering name fallback in SVG node overlay', () => {
    // Machine with name="LDI-01" but NO telemetryId
    const collisionCard: MachineDef = {
      id: 'DRILL-COLLISION',
      name: 'LDI-01',
      process: 'DRILLING_MAIN',
      svgX: 100,
      svgY: 100,
      bay: 'BAY-1',
      zoneId: 'DRILLING_MAIN',
      isCompact: false,
    };

    const liveTelemetryMap: Record<string, LdiMachine> = {
      'LDI-01': mockLiveTelemetry,
    };

    render(
      <FloorplanSVG
        machines={liveTelemetryMap}
        fleetMachines={[collisionCard]}
        selectedId={null}
        onSelectMachine={vi.fn()}
      />
    );

    const node = screen.getByTestId('machine-node-DRILL-COLLISION');
    expect(node).toBeInTheDocument();

    const nodeScope = within(node);
    // In FloorplanSVG.tsx line 588:
    // const telemetry = (machine.telemetryId ? machines[machine.telemetryId] : undefined) ||
    //                   machines[machine.id] ||
    //                   (machine.name ? machines[machine.name] : undefined);
    // Because machine.name === 'LDI-01', the SVG node binds to liveTelemetryMap['LDI-01']!
    // Thus the SVG card renders RUN and 23.4°C even though App.tsx detail drawer does not!
    const svgCardBadge = nodeScope.getByText('RUN');
    expect(svgCardBadge).toBeInTheDocument();
    const svgCardTemp = nodeScope.getByText('23.4°C');
    expect(svgCardTemp).toBeInTheDocument();
  });
});

describe('Empirical Challenge 3: handleSaveMachineMapping Payload Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends updated machine name and telemetryId with payload integrity via POST /api/layout', async () => {
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/layout') && init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    }) as any;

    const initialMachine: MachineDef = {
      id: 'LSR-001',
      name: 'ORIGINAL_NAME',
      process: 'LASER_DRILLING',
      svgX: 2210,
      svgY: 560,
      bay: 'CLEANROOM',
      zoneId: 'LASER_DRILLING',
    };

    // Render MachineDetailPopup with onSaveMapping
    const onSaveMappingMock = vi.fn().mockImplementation(async (id: string, newName: string, newTelemetryId?: string) => {
      // Simulate App.tsx handleSaveMachineMapping logic directly
      const fleetMachines = [initialMachine];
      const updatedMachines = fleetMachines.map((m) =>
        m.id === id
          ? {
              ...m,
              name: newName,
              telemetryId: newTelemetryId || undefined,
              hasLiveFeed: Boolean(newTelemetryId),
            }
          : m
      );

      await fetch('/api/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machines: updatedMachines, deletedIds: [] }),
      });
    });

    render(
      <MachineDetailPopup
        machine={null}
        machineDef={initialMachine}
        onClose={vi.fn()}
        onSaveMapping={onSaveMappingMock}
      />
    );

    // Open database config form
    const configBtn = screen.getByText('CONFIG DATABASE MAPPING');
    fireEvent.click(configBtn);

    // Change Card Display Label
    const nameInput = screen.getByPlaceholderText('e.g. 054');
    fireEvent.change(nameInput, { target: { value: 'UPDATED_LABEL' } });

    // Change Database Equipment ID
    const telemInput = screen.getByPlaceholderText('e.g. DRL054-M or LDI-01');
    fireEvent.change(telemInput, { target: { value: 'LDI-01' } });

    // Submit form
    const saveBtn = screen.getByText('APPLY & SAVE MAPPING');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaveMappingMock).toHaveBeenCalledWith('LSR-001', 'UPDATED_LABEL', 'LDI-01');
    });

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    // Verify payload integrity
    expect(Array.isArray(capturedBody.machines)).toBe(true);
    expect(Array.isArray(capturedBody.deletedIds)).toBe(true);
    expect(capturedBody.deletedIds).toEqual([]);

    const savedMachine = capturedBody.machines.find((m: any) => m.id === 'LSR-001');
    expect(savedMachine).toBeDefined();
    expect(savedMachine.name).toBe('UPDATED_LABEL');
    expect(savedMachine.telemetryId).toBe('LDI-01');
    expect(savedMachine.hasLiveFeed).toBe(true);
  });

  it('verifies App.tsx handleSaveMachineMapping updates state and issues POST payload in one go', async () => {
    let capturedBody: any = null;
    let postCallCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/layout')) {
        if (init?.method === 'POST') {
          postCallCount++;
          capturedBody = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            custom: true,
            machines: [
              {
                id: 'LSR-001',
                name: 'OLD_NAME',
                process: 'LASER_DRILLING',
                svgX: 2210,
                svgY: 560,
                bay: 'CLEANROOM',
                zoneId: 'LASER_DRILLING',
              },
            ],
            deletedIds: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    }) as any;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('machine-node-LSR-001')).toBeInTheDocument();
    });

    // Open detail drawer
    fireEvent.click(screen.getByTestId('machine-node-LSR-001'));

    await waitFor(() => {
      expect(screen.getByTestId('machine-detail-drawer')).toBeInTheDocument();
    });

    // Open config form
    const configBtn = screen.getByText('CONFIG DATABASE MAPPING');
    fireEvent.click(configBtn);

    // Change label and telemetry ID
    const nameInput = screen.getByPlaceholderText('e.g. 054');
    fireEvent.change(nameInput, { target: { value: 'REFINED_LABEL' } });

    const telemInput = screen.getByPlaceholderText('e.g. DRL054-M or LDI-01');
    fireEvent.change(telemInput, { target: { value: 'NEW_TELEM_ID' } });

    // Submit form
    const saveBtn = screen.getByText('APPLY & SAVE MAPPING');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(postCallCount).toBe(1);
    });

    expect(capturedBody).not.toBeNull();
    const target = capturedBody.machines.find((m: any) => m.id === 'LSR-001');
    expect(target).toBeDefined();
    expect(target.name).toBe('REFINED_LABEL');
    expect(target.telemetryId).toBe('NEW_TELEM_ID');
    expect(target.hasLiveFeed).toBe(true);
  });
});
