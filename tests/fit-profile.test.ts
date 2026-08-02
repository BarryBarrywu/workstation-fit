import { describe, expect, it } from 'vitest';
import {
  advanceCalibration,
  createFitProfile,
  parseFitProfile,
  restartCalibration,
  setHeight,
} from '../src/lib/fit-profile';

describe('local fit profile', () => {
  it('restores valid local data and safely replaces damaged data', () => {
    const saved = createFitProfile(180);

    expect(parseFitProfile(JSON.stringify(saved))).toEqual(saved);
    expect(parseFitProfile('{broken')).toEqual(createFitProfile());
    expect(parseFitProfile(JSON.stringify({ version: 999 }))).toEqual(createFitProfile());
  });

  it('migrates the previous profile without retaining numeric offsets', () => {
    const legacy = {
      version: 1,
      height: 180,
      offsets: {
        seat: 8,
        sittingDesk: -4,
        standingDesk: 3,
        sittingMonitorTop: 2,
        standingMonitorTop: -1,
      },
      calibration: {
        sitting: { step: 3, status: 'complete' },
        standing: { step: 1, status: 'in-progress' },
      },
      onboardingSeen: true,
    };

    const profile = parseFitProfile(JSON.stringify(legacy));

    expect(profile).toEqual({
      version: 2,
      height: 180,
      calibration: legacy.calibration,
      onboardingSeen: true,
    });
    expect(profile).not.toHaveProperty('offsets');
  });

  it('only completes a posture after its final physical check', () => {
    let profile = createFitProfile();
    profile = advanceCalibration(profile, 'sitting');
    profile = advanceCalibration(profile, 'sitting');

    expect(profile.calibration.sitting.status).toBe('in-progress');
    profile = advanceCalibration(profile, 'sitting');
    expect(profile.calibration.sitting.status).toBe('complete');
    expect(profile.calibration.standing.status).toBe('not-started');
  });

  it('requests reconfirmation after height changes', () => {
    let profile = createFitProfile(173);
    profile = advanceCalibration(advanceCalibration(advanceCalibration(profile, 'sitting'), 'sitting'), 'sitting');

    profile = setHeight(profile, 180);

    expect(profile.calibration.sitting.status).toBe('reconfirm');
    expect(profile.height).toBe(180);
  });

  it('keeps sitting and standing physical checks independent', () => {
    let profile = restartCalibration(createFitProfile(), 'standing');
    profile = advanceCalibration(profile, 'standing');

    expect(profile.calibration.sitting).toEqual({ step: 0, status: 'not-started' });
    expect(profile.calibration.standing).toEqual({ step: 1, status: 'in-progress' });
  });
});
