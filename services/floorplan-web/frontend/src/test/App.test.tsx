import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('App Integration', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          eqp_id: 'LDI-01',
          status: 1,
          temperature: 22.0,
          humidity: 45.0,
          resist_dosage: 35.0,
          scan_speed: 120.0,
          air_vacuum: 80.0,
          thickness: 0.1,
          board_no: 5,
          total_board: 20,
          total_time: 15.0,
          mo: 'MO-TEST',
          fpn: 'FPN-TEST',
          layer_name: 'TOP-1',
          last_seen: '2026-09-01T12:00:00Z',
        },
      ],
    }) as any;
  });

  it('renders topbar, process filter bar, floorplan canvas, and statusbar', async () => {
    render(<App />);

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('process-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('floorplan-svg-root')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();

    // Verify machine nodes exist in the floorplan
    const machineNode = screen.getByTestId('machine-node-LSR-001');
    expect(machineNode).toBeInTheDocument();

    const dhNode = screen.getByTestId('machine-node-DH-ULD');
    expect(dhNode).toBeInTheDocument();

    // Click machine to open detail inspection drawer
    fireEvent.click(machineNode);

    await waitFor(() => {
      expect(screen.getByTestId('machine-detail-drawer')).toBeInTheDocument();
    });

    // Close drawer
    const closeBtn = screen.getByTitle('Close Drawer');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('machine-detail-drawer')).not.toBeInTheDocument();
    });
  });

  it('filters by manufacturing process via toolbar buttons', () => {
    render(<App />);

    // Click DRILLING filter
    const drillBtn = screen.getByTestId('filter-btn-DRILLING');
    fireEvent.click(drillBtn);
    expect(drillBtn.className).toContain('border-[#00F2FE]');

    // Click OXIDE filter
    const oxideBtn = screen.getByTestId('filter-btn-OXIDE');
    fireEvent.click(oxideBtn);
    expect(oxideBtn.className).toContain('border-[#00F2FE]');
  });
});
