import { describe, expect, it } from 'vitest';
import { calculateChairAssembly } from '../../apps/xhs-mini-tool/fixed-scene';

describe('Xiaohongshu fixed scene chair assembly', () => {
  it.each([0.315, 0.43, 0.555])('keeps the complete chair upper connected at a %s model-unit seat surface', (seatSurface) => {
    const assembly = calculateChairAssembly(seatSurface);

    expect(assembly.chairUpper + 0.0425).toBeCloseTo(seatSurface, 6);
    expect(assembly.gasInner + 0.14).toBeGreaterThanOrEqual(assembly.gasMiddle - 0.065);
  });
});
