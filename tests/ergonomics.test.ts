import { describe, expect, it } from 'vitest';
import { calculateWorkstation, evidenceChains, evidenceStatusFor, roundRange } from '../src/lib/ergonomics';

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
    expect(calculateWorkstation(145).evidenceStatus[evidenceKey]).toBe(evidenceStatusFor(evidenceKey, 145));
    expect(calculateWorkstation(186).evidenceStatus[evidenceKey]).toBe(evidenceStatusFor(evidenceKey, 186));
    expect(calculateWorkstation(205).evidenceStatus[evidenceKey]).toBe(evidenceStatusFor(evidenceKey, 205));
  });
});

describe('evidence chains', () => {
  it.each(Object.entries(evidenceChains))('exposes a complete auditable chain for %s', (_, chain) => {
    expect(chain.id).toBeTruthy();
    expect(chain.adoptedData).toBeTruthy();
    expect(chain.transformation).toBeTruthy();
    expect(chain.extrapolation).toBeTruthy();
    expect(chain.limitations).toBeTruthy();
    expect(chain.sources.length).toBeGreaterThan(0);
    expect(chain.sources.every((source) => new URL(source.url).protocol === 'https:')).toBe(true);
    expect(chain.sources.every((source) => source.versionOrPublished.length > 0)).toBe(true);
    expect(chain.sources.every((source) => source.verifiedAt === '2026-08-02')).toBe(true);
  });

  it('labels project extrapolation separately from source data', () => {
    expect(evidenceChains.seat.extrapolation).toContain('0.216 cm');
    expect(evidenceChains.seat.extrapolation).toContain('不是国家标准');
    expect(evidenceChains.distance.extrapolation).toBe('不按身高插值或外推。');
  });
});
