import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProcessFilterBar, PROCESS_FILTER_OPTIONS } from '../components/ProcessFilterBar';
import { FleetFilterOption } from '../types/fleet';

describe('ProcessFilterBar', () => {
  it('renders all 7 process filter buttons with count badges', () => {
    const handleSelect = vi.fn();
    const mockCounts: Partial<Record<FleetFilterOption, number>> = {
      ALL: 250,
      DRILLING: 203,
      AUTO_LAY_UP: 8,
      OXIDE: 12,
      CUTTING: 11,
      LASER_DRILLING: 5,
      XRY: 3,
    };

    render(
      <ProcessFilterBar
        activeFilter="ALL"
        onSelectFilter={handleSelect}
        counts={mockCounts}
      />
    );

    expect(screen.getByTestId('process-filter-bar')).toBeInTheDocument();

    // Verify all 7 buttons are rendered
    expect(PROCESS_FILTER_OPTIONS.length).toBe(7);
    for (const opt of PROCESS_FILTER_OPTIONS) {
      const btn = screen.getByTestId(`filter-btn-${opt.id}`);
      expect(btn).toBeInTheDocument();
      expect(within(btn).getByText(opt.label)).toBeInTheDocument();
    }

    // Verify counts are displayed
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('203')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clicking a filter button invokes onSelectFilter with correct category ID', () => {
    const handleSelect = vi.fn();

    render(
      <ProcessFilterBar
        activeFilter="ALL"
        onSelectFilter={handleSelect}
      />
    );

    // Click DRILLING
    const drillBtn = screen.getByTestId('filter-btn-DRILLING');
    fireEvent.click(drillBtn);
    expect(handleSelect).toHaveBeenCalledWith('DRILLING');

    // Click LASER_DRILLING
    const laserBtn = screen.getByTestId('filter-btn-LASER_DRILLING');
    fireEvent.click(laserBtn);
    expect(handleSelect).toHaveBeenCalledWith('LASER_DRILLING');

    // Click OXIDE
    const oxideBtn = screen.getByTestId('filter-btn-OXIDE');
    fireEvent.click(oxideBtn);
    expect(handleSelect).toHaveBeenCalledWith('OXIDE');
  });

  it('highlights the active filter button with active styles', () => {
    const { rerender } = render(
      <ProcessFilterBar
        activeFilter="DRILLING"
        onSelectFilter={() => {}}
      />
    );

    const drillBtn = screen.getByTestId('filter-btn-DRILLING');
    expect(drillBtn.className).toContain('bg-slate-800');

    rerender(
      <ProcessFilterBar
        activeFilter="CUTTING"
        onSelectFilter={() => {}}
      />
    );

    const cutBtn = screen.getByTestId('filter-btn-CUTTING');
    expect(cutBtn.className).toContain('bg-slate-800');
  });
});
