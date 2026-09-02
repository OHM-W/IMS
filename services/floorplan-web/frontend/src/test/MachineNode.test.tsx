import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MachineNode } from '../components/MachineNode';
import { MachineCoordinate, LdiMachine } from '../types/ldi';

const mockCoord: MachineCoordinate = {
  eqp_id: 'LDI-01',
  name: 'LDI Machine 01',
  svgX: 2210,
  svgY: 560,
  width: 110,
  height: 90,
  bay: 'Bay 1',
  zone: 'Cleanroom',
};

describe('MachineNode', () => {
  it('renders RUN status correctly with green badge and metrics', () => {
    const telemetry: LdiMachine = {
      eqp_id: 'LDI-01',
      status: 1, // RUN
      temperature: 22.4,
      humidity: 45.2,
      resist_dosage: 35.0,
      scan_speed: 120.0,
      air_vacuum: 82.5,
      thickness: 0.1,
      board_no: 8,
      total_board: 20,
      total_time: 15.0,
      mo: 'MO-101',
      fpn: 'FPN-01',
      layer_name: 'TOP',
      last_seen: '2026-09-01T12:00:00Z',
    };

    const handleSelect = vi.fn();
    render(
      <MachineNode
        coord={mockCoord}
        telemetry={telemetry}
        isSelected={false}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText('LDI-01')).toBeInTheDocument();
    expect(screen.getByText('RUN')).toBeInTheDocument();
    expect(screen.getByText('22.4°C')).toBeInTheDocument();
    expect(screen.getByText('45.2%')).toBeInTheDocument();
    expect(screen.getByText('8/20')).toBeInTheDocument();

    const node = screen.getByTestId('machine-node-LDI-01');
    fireEvent.click(node);
    expect(handleSelect).toHaveBeenCalledWith('LDI-01');
  });

  it('renders ALARM status with pulsing alarm border class', () => {
    const telemetry: LdiMachine = {
      eqp_id: 'LDI-01',
      status: 3, // ALARM
      temperature: 28.0,
      humidity: 70.0,
      resist_dosage: 35.0,
      scan_speed: 120.0,
      air_vacuum: 50.0,
      thickness: 0.1,
      board_no: 1,
      total_board: 20,
      total_time: 15.0,
      mo: 'MO-101',
      fpn: 'FPN-01',
      layer_name: 'TOP',
      last_seen: '2026-09-01T12:00:00Z',
    };

    render(
      <MachineNode
        coord={mockCoord}
        telemetry={telemetry}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('ALARM')).toBeInTheDocument();
    const node = screen.getByTestId('machine-node-LDI-01');
    expect(node.className).toContain('animate-pulse-alarm');
  });

  it('renders fallback dashes when telemetry is null or empty', () => {
    render(
      <MachineNode
        coord={mockCoord}
        telemetry={undefined}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('LDI-01')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
