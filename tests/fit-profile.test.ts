import { describe, expect, it } from 'vitest';
import {
  advanceCalibration,
  createFitProfile,
  parseFitProfile,
  restartCalibration,
  setHeight,
  setOffset,
  skipCalibration,
  type AdjustableResultKey,
} from '../src/lib/fit-profile';

describe('local fit profile', () => {
  it.each([
    ['seat', -8, -8],
    ['sittingDesk', 0, 0],
    ['standingMonitorTop', 8, 8],
    ['standingDesk', 99, 8],
    ['sittingMonitorTop', -99, -8],
  ] as [AdjustableResultKey, number, number][])('stores %s offsets inside the calibration envelope', (key, input, expected) => {
    const profile = setOffset(createFitProfile(), key, input);

    expect(profile.offsets[key]).toBe(expected);
  });

  it('keeps sitting and standing calibration independent', () => {
    let profile = createFitProfile();
    profile = setOffset(profile, 'sittingDesk', 4);
    profile = setOffset(profile, 'standingDesk', -3);

    expect(profile.offsets.sittingDesk).toBe(4);
    expect(profile.offsets.standingDesk).toBe(-3);
  });

  it('restores valid local data and safely replaces damaged data', () => {
    const saved = setOffset(createFitProfile(180), 'seat', 3);

    expect(parseFitProfile(JSON.stringify(saved))).toEqual(saved);
    expect(parseFitProfile('{broken')).toEqual(createFitProfile());
    expect(parseFitProfile(JSON.stringify({ version: 999 }))).toEqual(createFitProfile());
  });

  it('only completes a posture after its final calibration step', () => {
    let profile = createFitProfile();
    profile = advanceCalibration(profile, 'sitting');
    profile = advanceCalibration(profile, 'sitting');

    expect(profile.calibration.sitting.status).toBe('in-progress');
    profile = advanceCalibration(profile, 'sitting');
    expect(profile.calibration.sitting.status).toBe('complete');
    expect(profile.calibration.standing.status).toBe('not-started');
  });

  it('preserves offsets but requests reconfirmation after height changes', () => {
    let profile = setOffset(createFitProfile(173), 'seat', 2);
    profile = advanceCalibration(advanceCalibration(advanceCalibration(profile, 'sitting'), 'sitting'), 'sitting');

    profile = setHeight(profile, 180);

    expect(profile.offsets.seat).toBe(2);
    expect(profile.calibration.sitting.status).toBe('reconfirm');
    expect(profile.height).toBe(180);
  });

  it('never stores a viewing-distance offset', () => {
    expect(createFitProfile().offsets).not.toHaveProperty('monitorDistance');
  });

  it('lets a user skip the active posture calibration without affecting the other posture', () => {
    let profile = restartCalibration(createFitProfile(), 'sitting');
    profile = advanceCalibration(profile, 'sitting');
    profile = skipCalibration(profile, 'sitting');

    expect(profile.calibration.sitting).toEqual({ step: 0, status: 'not-started' });
    expect(profile.calibration.standing).toEqual({ step: 0, status: 'not-started' });
  });
});
