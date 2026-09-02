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
  RUN: { code: 1, label: 'Run', color: '#00FF87', glow: 'rgba(0, 255, 135, 0.4)' },
  IDLE: { code: 2, label: 'Idle', color: '#FFB800', glow: 'rgba(255, 184, 0, 0.4)' },
  ALARM: { code: 3, label: 'Down / Alarm', color: '#FF003C', glow: 'rgba(255, 0, 60, 0.6)' },
  STOP: { code: 4, label: 'Initial / PM / Stop', color: '#00F2FE', glow: 'rgba(0, 242, 254, 0.4)' },
  OFF: { code: 0, label: 'Off', color: '#64748B', glow: 'rgba(100, 116, 139, 0.2)' },
  UNDEFINE: { code: 5, label: 'Undefine', color: '#ECEFF1', glow: 'rgba(236, 239, 241, 0.2)' },
} as const;

export const STATUS_COLORS: Record<
  StatusToken,
  { hex: string; glow: string; label: string; code: number }
> = {
  RUN:      { hex: '#00FF87', glow: 'rgba(0, 255, 135, 0.4)', label: 'Run', code: 1 },
  IDLE:     { hex: '#FFB800', glow: 'rgba(255, 184, 0, 0.4)', label: 'Idle', code: 2 },
  ALARM:    { hex: '#FF003C', glow: 'rgba(255, 0, 60, 0.6)',  label: 'Down / Alarm', code: 3 },
  STOP:     { hex: '#00F2FE', glow: 'rgba(0, 242, 254, 0.4)', label: 'Initial / PM / Stop', code: 4 },
  OFF:      { hex: '#64748B', glow: 'rgba(100, 116, 139, 0.2)', label: 'Off', code: 0 },
  UNDEFINE: { hex: '#ECEFF1', glow: 'rgba(236, 239, 241, 0.2)', label: 'Undefine', code: 5 },
};

export const ISA_STATUS_COLORS: Record<
  'RUN' | 'IDLE' | 'ALARM' | 'STOP' | 'LOTO' | 'OFF' | 'UNDEFINE',
  StatusTheme
> = {
  RUN: {
    code: 1,
    label: 'RUN',
    hex: '#00FF87',
    bgColor: 'rgba(0, 255, 135, 0.12)',
    borderColor: '#00FF87',
    textColor: '#00FF87',
    glow: '0 0 16px rgba(0, 255, 135, 0.45)',
    badgeClass: 'bg-[#00FF87]/20 text-[#00FF87] border border-[#00FF87]/60 shadow-[0_0_8px_rgba(0,255,135,0.3)]',
    borderClass: 'border-[#00FF87]',
    pulse: false,
  },
  IDLE: {
    code: 2,
    label: 'IDLE',
    hex: '#FFB800',
    bgColor: 'rgba(255, 184, 0, 0.12)',
    borderColor: '#FFB800',
    textColor: '#FFB800',
    glow: '0 0 12px rgba(255, 184, 0, 0.35)',
    badgeClass: 'bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/60 shadow-[0_0_6px_rgba(255,184,0,0.25)]',
    borderClass: 'border-[#FFB800]',
    pulse: false,
  },
  ALARM: {
    code: 3,
    label: 'ALARM',
    hex: '#FF003C',
    bgColor: 'rgba(255, 0, 60, 0.22)',
    borderColor: '#FF003C',
    textColor: '#FF003C',
    glow: '0 0 22px rgba(255, 0, 60, 0.75)',
    badgeClass: 'bg-[#FF003C]/30 text-[#FF003C] border border-[#FF003C] shadow-[0_0_12px_rgba(255,0,60,0.6)] animate-pulse',
    borderClass: 'border-[#FF003C] animate-pulse-alarm',
    pulse: true,
  },
  STOP: {
    code: 4,
    label: 'STOP',
    hex: '#00F2FE',
    bgColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
    textColor: '#00F2FE',
    glow: '0 0 12px rgba(0, 242, 254, 0.35)',
    badgeClass: 'bg-[#00F2FE]/20 text-[#00F2FE] border border-[#00F2FE]/60 shadow-[0_0_6px_rgba(0,242,254,0.25)]',
    borderClass: 'border-[#00F2FE]',
    pulse: false,
  },
  LOTO: {
    code: 4,
    label: 'LOTO',
    hex: '#00F2FE',
    bgColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00F2FE',
    textColor: '#00F2FE',
    glow: '0 0 12px rgba(0, 242, 254, 0.35)',
    badgeClass: 'bg-[#00F2FE]/20 text-[#00F2FE] border border-[#00F2FE]/60 shadow-[0_0_6px_rgba(0,242,254,0.25)]',
    borderClass: 'border-[#00F2FE]',
    pulse: false,
  },
  OFF: {
    code: 0,
    label: 'OFF',
    hex: '#64748B',
    bgColor: 'rgba(100, 116, 139, 0.10)',
    borderColor: '#64748B',
    textColor: '#94A3B8',
    glow: 'none',
    badgeClass: 'bg-[#64748B]/20 text-[#94A3B8] border border-[#64748B]/40',
    borderClass: 'border-[#64748B]/50 opacity-70',
    pulse: false,
  },
  UNDEFINE: {
    code: 5,
    label: 'UNDEFINE',
    hex: '#ECEFF1',
    bgColor: 'rgba(236, 239, 241, 0.06)',
    borderColor: 'rgba(236, 239, 241, 0.4)',
    textColor: '#ECEFF1',
    glow: 'rgba(236, 239, 241, 0.2)',
    badgeClass: 'bg-[#ECEFF1]/10 text-[#ECEFF1] border border-[#ECEFF1]/30',
    borderClass: 'border-[#ECEFF1]/40',
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
