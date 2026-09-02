import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MachineDetailPopup } from '../components/MachineDetailPopup';
import { LdiMachine } from '../types/ldi';

const mockMachine: LdiMachine = {
  eqp_id: 'LDI-02',
  status: 1, // RUN
  temperature: 22.5,
  humidity: 46.1,
  resist_dosage: 36.8,
  scan_speed: 125.0,
  air_vacuum: 84.2,
  thickness: 0.102,
  board_no: 15,
  total_board: 30,
  total_time: 17.4,
  mo: 'MO-2026-LDI02',
  fpn: 'FPN-PCB-X1',
  layer_name: 'SIGNAL-L3',
  last_seen: '2026-09-01T12:30:00Z',
};

describe('MachineDetailPopup', () => {
  it('renders all 15 telemetry and order fields correctly', () => {
    const handleClose = vi.fn();
    const handleFocus = vi.fn();

    render(
      <MachineDetailPopup
        machine={mockMachine}
        onClose={handleClose}
        onFocusMachine={handleFocus}
      />
    );

    // 1. eqp_id
    expect(screen.getByText('LDI-02')).toBeInTheDocument();
    // 2. status
    expect(screen.getByText('RUN')).toBeInTheDocument();
    // 3. temperature
    expect(screen.getByText('22.5°C')).toBeInTheDocument();
    // 4. humidity
    expect(screen.getByText('46.1%')).toBeInTheDocument();
    // 5. resist_dosage
    expect(screen.getByText('36.80')).toBeInTheDocument();
    // 6. scan_speed
    expect(screen.getByText('125.0')).toBeInTheDocument();
    // 7. air_vacuum
    expect(screen.getByText('84.2 kPa')).toBeInTheDocument();
    // 8. thickness
    expect(screen.getByText('0.102 mm')).toBeInTheDocument();
    // 9 & 10. board_no / total_board
    expect(screen.getByText('15 / 30 boards (50%)')).toBeInTheDocument();
    // 11. total_time
    expect(screen.getByText('17.4 s')).toBeInTheDocument();
    // 12. mo
    expect(screen.getByText('MO-2026-LDI02')).toBeInTheDocument();
    // 13. fpn
    expect(screen.getByText('FPN-PCB-X1')).toBeInTheDocument();
    // 14. layer_name
    expect(screen.getByText('SIGNAL-L3')).toBeInTheDocument();

    // Grafana link
    const grafanaLink = screen.getByText('Grafana Drill-Down').closest('a');
    expect(grafanaLink).toHaveAttribute(
      'href',
      '/d/ims-engineering/ims-engineering-drill-down?var-machine_id=LDI-02'
    );

    // Test Focus button
    const focusBtn = screen.getByText('Focus Camera');
    fireEvent.click(focusBtn);
    expect(handleFocus).toHaveBeenCalled();

    // Test Close button
    const closeBtn = screen.getByTitle('Close Drawer');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
