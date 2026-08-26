import type { Posture, ResultKey } from '../../src/lib/ergonomics';

export type MiniCalibrationStatus = 'not-started' | 'in-progress' | 'complete' | 'reconfirm';
export type MiniProfile = {
  version: 1;
  confirmedHeight: number;
  posture: Posture;
  selected: ResultKey;
  calibration: Record<Posture, { step: number; status: MiniCalibrationStatus }>;
};

export const MINI_PROFILE_KEY = 'jiuwei:xhs-mini-tool:profile:v1';

export function createMiniProfile(confirmedHeight: number): MiniProfile {
  return {
    version: 1,
    confirmedHeight,
    posture: 'sitting',
    selected: 'sittingDesk',
    calibration: {
      sitting: { step: 0, status: 'not-started' },
      standing: { step: 0, status: 'not-started' },
    },
  };
}

export function parseMiniProfile(serialized: string | null): MiniProfile | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<MiniProfile>;
    if (value.version !== 1 || typeof value.confirmedHeight !== 'number' || value.confirmedHeight < 145 || value.confirmedHeight > 205) return null;
    if (value.posture !== 'sitting' && value.posture !== 'standing') return null;
    if (!value.calibration || typeof value.calibration !== 'object') return null;
    const sitting = value.calibration.sitting;
    const standing = value.calibration.standing;
    if (!isCalibration(sitting, 3) || !isCalibration(standing, 2)) return null;
    return {
      version: 1,
      confirmedHeight: value.confirmedHeight,
      posture: value.posture,
      selected: validSelection(value.selected, value.posture),
      calibration: { sitting, standing },
    };
  } catch {
    return null;
  }
}

function isCalibration(value: unknown, maxStep: number): value is MiniProfile['calibration']['sitting'] {
  if (!value || typeof value !== 'object') return false;
  const item = value as { step?: unknown; status?: unknown };
  return Number.isInteger(item.step) && Number(item.step) >= 0 && Number(item.step) <= maxStep
    && ['not-started', 'in-progress', 'complete', 'reconfirm'].includes(String(item.status));
}

function validSelection(value: unknown, posture: Posture): ResultKey {
  const allowed: ResultKey[] = posture === 'sitting' ? ['seat', 'sittingDesk', 'sittingMonitorTop'] : ['standingDesk', 'standingMonitorTop'];
  return allowed.includes(value as ResultKey) ? value as ResultKey : posture === 'sitting' ? 'sittingDesk' : 'standingDesk';
}

export function updateMiniHeight(profile: MiniProfile, confirmedHeight: number): MiniProfile {
  if (profile.confirmedHeight === confirmedHeight) return profile;
  const reconfirm = (item: MiniProfile['calibration']['sitting']) => item.status === 'complete' ? { ...item, status: 'reconfirm' as const } : item;
  return {
    ...profile,
    confirmedHeight,
    calibration: { sitting: reconfirm(profile.calibration.sitting), standing: reconfirm(profile.calibration.standing) },
  };
}
