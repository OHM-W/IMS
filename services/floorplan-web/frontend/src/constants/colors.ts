/**
 * ISA-101 Canonical Color Tokens and Helpers for IMS Floorplan
 * Standard SCADA 6-State Legend & Tolerance Rules
 * Path: services/floorplan-web/frontend/src/constants/colors.ts
 */

import { StatusToken } from '../types/fleet';

export interface StatusTheme {
  code: number;
  label: string;
  hex: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  glow: string;
  badgeClass: string;
  borderClass: string;
  pulse: boolean;
}

export const ISA_STATUS_TOKENS = {
  RUN: { code: 1, label: 'Run', color: '#10B981', glow: 'none' },
  IDLE: { code: 2, label: 'Idle', color: '#F59E0B', glow: 'none' },
  ALARM: { code: 3, label: 'Down / Alarm', color: '#EF4444', glow: 'none' },
  STOP: { code: 4, label: 'Initial / PM / Stop', color: '#06B6D4', glow: 'none' },
  OFF: { code: 0, label: 'Off', color: '#64748B', glow: 'none' },
  UNDEFINE: { code: 5, label: 'Undefine', color: '#475569', glow: 'none' },
} as const;

export const STATUS_COLORS: Record<
  StatusToken,
  { hex: string; glow: string; label: string; code: number }
> = {
  RUN:      { hex: '#10B981', glow: 'none', label: 'Run', code: 1 },
  IDLE:     { hex: '#F59E0B', glow: 'none', label: 'Idle', code: 2 },
  ALARM:    { hex: '#EF4444', glow: 'none', label: 'Down / Alarm', code: 3 },
  STOP:     { hex: '#06B6D4', glow: 'none', label: 'Initial / PM / Stop', code: 4 },
  OFF:      { hex: '#64748B', glow: 'none', label: 'Off', code: 0 },
  UNDEFINE: { hex: '#475569', glow: 'none', label: 'Undefine', code: 5 },
};

export const ISA_STATUS_COLORS: Record<
  'RUN' | 'IDLE' | 'ALARM' | 'STOP' | 'LOTO' | 'OFF' | 'UNDEFINE',
  StatusTheme
> = {
  RUN: {
    code: 1,
    label: 'RUN',
    hex: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
    textColor: '#34D399',
    glow: 'none',
    badgeClass: 'bg-emerald-950/70 text-emerald-400 border border-emerald-600/60 font-mono text-[11px] font-semibold',
    borderClass: 'border-emerald-500',
    pulse: false,
  },
  IDLE: {
    code: 2,
    label: 'IDLE',
    hex: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
    textColor: '#FBBF24',
    glow: 'none',
    badgeClass: 'bg-amber-950/70 text-amber-400 border border-amber-600/60 font-mono text-[11px] font-semibold',
    borderClass: 'border-amber-500',
    pulse: false,
  },
  ALARM: {
    code: 3,
    label: 'ALARM',
    hex: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.20)',
    borderColor: '#EF4444',
    textColor: '#F87171',
    glow: 'none',
    badgeClass: 'bg-red-950/80 text-red-300 border border-red-500 font-mono text-[11px] font-bold animate-pulse',
    borderClass: 'border-red-500 animate-pulse-alarm',
    pulse: true,
  },
  STOP: {
    code: 4,
    label: 'STOP',
    hex: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: '#06B6D4',
    textColor: '#22D3EE',
    glow: 'none',
    badgeClass: 'bg-cyan-950/70 text-cyan-400 border border-cyan-600/60 font-mono text-[11px] font-semibold',
    borderClass: 'border-cyan-500',
    pulse: false,
  },
  LOTO: {
    code: 4,
    label: 'LOTO',
    hex: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: '#06B6D4',
    textColor: '#22D3EE',
    glow: 'none',
    badgeClass: 'bg-cyan-950/70 text-cyan-400 border border-cyan-600/60 font-mono text-[11px] font-semibold',
    borderClass: 'border-cyan-500',
    pulse: false,
  },
  OFF: {
    code: 0,
    label: 'OFF',
    hex: '#64748B',
    bgColor: 'rgba(100, 116, 139, 0.10)',
    borderColor: '#475569',
    textColor: '#94A3B8',
    glow: 'none',
    badgeClass: 'bg-slate-900 text-slate-400 border border-slate-700/80 font-mono text-[11px]',
    borderClass: 'border-slate-700/60',
    pulse: false,
  },
  UNDEFINE: {
    code: 5,
    label: 'UNDEFINE',
    hex: '#475569',
    bgColor: 'transparent',
    borderColor: '#334155',
    textColor: '#64748B',
    glow: 'none',
    badgeClass: 'bg-slate-950 text-slate-500 border border-slate-800 font-mono text-[11px]',
    borderClass: 'border-slate-800',
    pulse: false,
  },
};

/**
 * Standard Status Theme resolver supporting 6-state SCADA codes (0..5)
 */
export function getStatusTheme(status: number | undefined | null): StatusTheme {
  switch (status) {
    case 1:
      return ISA_STATUS_COLORS.RUN;
    case 2:
      return ISA_STATUS_COLORS.IDLE;
    case 3:
      return ISA_STATUS_COLORS.ALARM;
    case 4:
      return ISA_STATUS_COLORS.STOP;
    case 5:
      return ISA_STATUS_COLORS.UNDEFINE;
    case 0:
    default:
      return ISA_STATUS_COLORS.OFF;
  }
}

/**
 * 6-State SCADA Status Theme resolver by token name or numeric code
 */
export function getScadaStatusTheme(
  status: StatusToken | number | undefined | null
): StatusTheme {
  if (typeof status === 'string') {
    switch (status) {
      case 'RUN':
        return ISA_STATUS_COLORS.RUN;
      case 'IDLE':
        return ISA_STATUS_COLORS.IDLE;
      case 'ALARM':
        return ISA_STATUS_COLORS.ALARM;
      case 'STOP':
        return ISA_STATUS_COLORS.STOP;
      case 'OFF':
        return ISA_STATUS_COLORS.OFF;
      case 'UNDEFINE':
        return ISA_STATUS_COLORS.UNDEFINE;
      default:
        return ISA_STATUS_COLORS.OFF;
    }
  }

  return getStatusTheme(status);
}

export type ToleranceLevel = 'ok' | 'warn' | 'crit';

export function getTemperatureTolerance(temp: number | null | undefined): ToleranceLevel {
  if (temp === null || temp === undefined) return 'ok';
  if (temp < 19.0 || temp > 25.0) return 'crit';
  if (temp < 21.0 || temp > 23.0) return 'warn';
  return 'ok';
}

export function getHumidityTolerance(hum: number | null | undefined): ToleranceLevel {
  if (hum === null || hum === undefined) return 'ok';
  if (hum < 35.0 || hum > 55.0) return 'crit';
  if (hum < 40.0 || hum > 50.0) return 'warn';
  return 'ok';
}
