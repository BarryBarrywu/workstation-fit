import type { Posture } from './ergonomics';
import { adjustableResultKeys, calibrationStepCount, createDefaultOffsets, type AdjustableResultKey } from './calibration';

export type { AdjustableResultKey } from './calibration';
export type CalibrationStatus = 'not-started' | 'in-progress' | 'complete' | 'reconfirm';

export type PostureCalibration = {
  step: number;
  status: CalibrationStatus;
};

export type FitProfile = {
  version: 1;
  height: number;
  offsets: Record<AdjustableResultKey, number>;
  calibration: Record<Posture, PostureCalibration>;
  onboardingSeen: boolean;
};

const clampHeight = (height: number) => Math.max(145, Math.min(205, Math.round(height)));
const clampOffset = (offset: number) => Math.max(-8, Math.min(8, Math.round(offset)));

export function createFitProfile(height = 173): FitProfile {
  return {
    version: 1,
    height: clampHeight(height),
    offsets: createDefaultOffsets(),
    calibration: {
      sitting: { step: 0, status: 'not-started' },
      standing: { step: 0, status: 'not-started' },
    },
    onboardingSeen: false,
  };
}

function isOffsetRecord(value: unknown): value is FitProfile['offsets'] {
  if (!value || typeof value !== 'object') return false;
  return adjustableResultKeys
    .every((key) => typeof (value as Record<string, unknown>)[key] === 'number');
}

function isCalibrationRecord(value: unknown): value is FitProfile['calibration'] {
  if (!value || typeof value !== 'object') return false;
  return ['sitting', 'standing'].every((posture) => {
    const calibration = (value as Record<string, unknown>)[posture];
    if (!calibration || typeof calibration !== 'object') return false;
    const item = calibration as Record<string, unknown>;
    return typeof item.step === 'number'
      && ['not-started', 'in-progress', 'complete', 'reconfirm'].includes(String(item.status));
  });
}

export function parseFitProfile(serialized: string | null): FitProfile {
  if (!serialized) return createFitProfile();
  try {
    const value = JSON.parse(serialized) as Partial<FitProfile>;
    if (value.version !== 1
      || typeof value.height !== 'number'
      || typeof value.onboardingSeen !== 'boolean'
      || !isOffsetRecord(value.offsets)
      || !isCalibrationRecord(value.calibration)) return createFitProfile();

    return {
      ...value,
      height: clampHeight(value.height),
      offsets: Object.fromEntries(
        Object.entries(value.offsets).map(([key, offset]) => [key, clampOffset(offset)]),
      ) as FitProfile['offsets'],
      calibration: {
        sitting: {
          step: Math.max(0, Math.min(calibrationStepCount.sitting, Math.round(value.calibration.sitting.step))),
          status: value.calibration.sitting.status,
        },
        standing: {
          step: Math.max(0, Math.min(calibrationStepCount.standing, Math.round(value.calibration.standing.step))),
          status: value.calibration.standing.status,
        },
      },
    } as FitProfile;
  } catch {
    return createFitProfile();
  }
}

export function setOffset(profile: FitProfile, key: AdjustableResultKey, offset: number): FitProfile {
  return {
    ...profile,
    offsets: { ...profile.offsets, [key]: clampOffset(offset) },
  };
}

export function setHeight(profile: FitProfile, height: number): FitProfile {
  const nextHeight = clampHeight(height);
  if (nextHeight === profile.height) return profile;

  const reconfirm = (calibration: PostureCalibration): PostureCalibration => calibration.status === 'complete'
    ? { ...calibration, status: 'reconfirm' }
    : calibration;

  return {
    ...profile,
    height: nextHeight,
    calibration: {
      sitting: reconfirm(profile.calibration.sitting),
      standing: reconfirm(profile.calibration.standing),
    },
  };
}

export function advanceCalibration(profile: FitProfile, posture: Posture): FitProfile {
  const current = profile.calibration[posture];
  const nextStep = Math.min(calibrationStepCount[posture], current.step + 1);
  const next: PostureCalibration = {
    step: nextStep,
    status: nextStep === calibrationStepCount[posture] ? 'complete' : 'in-progress',
  };

  return {
    ...profile,
    calibration: { ...profile.calibration, [posture]: next },
  };
}

export function restartCalibration(profile: FitProfile, posture: Posture): FitProfile {
  return {
    ...profile,
    calibration: { ...profile.calibration, [posture]: { step: 0, status: 'in-progress' } },
  };
}

export function skipCalibration(profile: FitProfile, posture: Posture): FitProfile {
  return {
    ...profile,
    calibration: { ...profile.calibration, [posture]: { step: 0, status: 'not-started' } },
  };
}

export function markOnboardingSeen(profile: FitProfile): FitProfile {
  return { ...profile, onboardingSeen: true };
}
