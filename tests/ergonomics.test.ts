import { describe, expect, it } from 'vitest';
import { calculateWorkstation, evidenceChains, roundRange } from '../src/lib/ergonomics';

describe('height-only fit estimates', () => {
  it.each([
    { height: 145, seat: [33, 37], status: 'reference' },
    { height: 168.7, seat: [39, 43], status: 'reference' },
    { height: 205, seat: [49, 53], status: 'trend' },
  ] as const)('maps $height cm through the sourced seat curve', ({ height, seat, status }) => {
    const result = calculateWorkstation(height);

    expect([roundRange(result.seat).min, roundRange(result.seat).max]).toEqual(seat);
    expect(result.evidenceStatus.seat).toBe(status);
  });

  it('interpolates between source nodes without collapsing the starting range', () => {
    const lower = calculateWorkstation(158).seat;
    const middle = calculateWorkstation(163.35).seat;
    const upper = calculateWorkstation(168.7).seat;

    expect(middle.reference).toBeCloseTo((lower.reference + upper.reference) / 2, 5);
    expect(middle.max - middle.min).toBe(4);
  });

  it('keeps sitting and standing desk estimates independent', () => {
    const result = calculateWorkstation(173);

    expect(result.sittingDesk.reference).not.toBe(result.standingDesk.reference);
    expect(result.standingDesk.reference).toBeGreaterThan(result.sittingDesk.reference);
  });

  it('treats viewing distance as guidance rather than a calibrated body estimate', () => {
    const result = calculateWorkstation(205);

    expect(roundRange(result.monitorDistance)).toEqual({ min: 50, max: 75, reference: 63 });
    expect(result.evidenceStatus.distance).toBe('guidance');
  });

  it.each([
    ['seat', 'seat'],
    ['sittingDesk', 'sittingDesk'],
    ['standingDesk', 'standingDesk'],
    ['sittingMonitorTop', 'sittingMonitorTop'],
    ['standingMonitorTop', 'standingMonitorTop'],
  ] as const)('reports source coverage independently for %s', (_, evidenceKey) => {
    expect(calculateWorkstation(145).evidenceStatus[evidenceKey]).toBe('reference');
    expect(calculateWorkstation(186).evidenceStatus[evidenceKey]).toBe('reference');
    expect(calculateWorkstation(205).evidenceStatus[evidenceKey]).toBe('trend');
  });
});

describe('evidence chains', () => {
  it('exposes an auditable seat-height chain', () => {
    const chain = evidenceChains.seat;

    expect(chain.sourceCoverage).toEqual({ minHeight: 143, maxHeight: 186 });
    expect(chain.sources.some((source) => source.evidenceClass === 'national-standard')).toBe(true);
    expect(chain.sources.every((source) => new URL(source.url).protocol === 'https:')).toBe(true);
    expect(chain.adoptedData).toContain('坐姿腘高');
    expect(chain.transformation).toContain('线性插值');
    expect(chain.limitations).toContain('身高不能准确预测个人腿长');
  });
});
