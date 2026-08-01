export type Posture = 'sitting' | 'standing';
export type MetricKey = 'seat' | 'desk' | 'monitor' | 'distance';

export type Range = {
  min: number;
  max: number;
  reference: number;
};

export type WorkstationResult = {
  seat: Range;
  sittingDesk: Range;
  standingDesk: Range;
  sittingMonitorTop: Range;
  standingMonitorTop: Range;
  monitorDistance: Range;
  confidence: 'reference' | 'extrapolated';
};

type DeskNode = {
  height: number;
  sitting: [number, number];
  standing: [number, number];
};

type BodyNode = {
  height: number;
  sittingEye: number;
  standingEye: number;
  seat: number;
};

const deskNodes: DeskNode[] = [
  { height: 155, sitting: [60, 64], standing: [94, 98] },
  { height: 160, sitting: [62, 66], standing: [96, 100] },
  { height: 165, sitting: [64, 68], standing: [99, 103] },
  { height: 170, sitting: [66, 70], standing: [101, 105] },
  { height: 175, sitting: [68, 72], standing: [104, 108] },
  { height: 180, sitting: [70, 74], standing: [106, 110] },
];

const inches = (value: number) => value * 2.54;

const bodyNodes: BodyNode[] = [
  [60, 41.5, 55.5, 14],
  [61, 42, 56.5, 14.5],
  [62, 43, 57.5, 15],
  [63, 44, 58, 15],
  [64, 44.5, 59.5, 15.5],
  [65, 45, 60.5, 15.5],
  [66, 46, 61.5, 16],
  [67, 46.5, 62.5, 16.5],
  [68, 47.5, 63.5, 16.5],
  [69, 48, 64.5, 17],
  [70, 48.5, 65, 17],
  [71, 49, 66, 17.5],
  [72, 50, 67.5, 18],
  [73, 50.5, 68, 18],
  [74, 51.5, 69, 19],
  [75, 52.5, 70, 19],
  [76, 53, 71.5, 19.5],
].map(([height, sittingEye, standingEye, seat]) => ({
  height: inches(height),
  sittingEye: inches(sittingEye),
  standingEye: inches(standingEye),
  seat: inches(seat),
}));

function interpolate<T>(
  value: number,
  nodes: T[],
  getX: (node: T) => number,
  getY: (node: T) => number,
): number {
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const lowerIndex = value <= getX(first)
    ? 0
    : value >= getX(last)
      ? nodes.length - 2
      : nodes.findIndex((node, index) => index < nodes.length - 1 && value <= getX(nodes[index + 1]));
  const lower = nodes[lowerIndex];
  const upper = nodes[lowerIndex + 1];
  const progress = (value - getX(lower)) / (getX(upper) - getX(lower));
  return getY(lower) + (getY(upper) - getY(lower)) * progress;
}

const makeRange = (min: number, max: number): Range => ({
  min,
  max,
  reference: (min + max) / 2,
});

const centeredRange = (reference: number, radius: number): Range => ({
  min: reference - radius,
  max: reference + radius,
  reference,
});

export function calculateWorkstation(height: number): WorkstationResult {
  const sittingDesk = makeRange(
    interpolate(height, deskNodes, (node) => node.height, (node) => node.sitting[0]),
    interpolate(height, deskNodes, (node) => node.height, (node) => node.sitting[1]),
  );
  const standingDesk = makeRange(
    interpolate(height, deskNodes, (node) => node.height, (node) => node.standing[0]),
    interpolate(height, deskNodes, (node) => node.height, (node) => node.standing[1]),
  );
  const seatReference = interpolate(height, bodyNodes, (node) => node.height, (node) => node.seat);
  const sittingEye = interpolate(height, bodyNodes, (node) => node.height, (node) => node.sittingEye);
  const standingEye = interpolate(height, bodyNodes, (node) => node.height, (node) => node.standingEye);

  return {
    seat: centeredRange(seatReference, 2.5),
    sittingDesk,
    standingDesk,
    sittingMonitorTop: makeRange(sittingEye - 3, sittingEye),
    standingMonitorTop: makeRange(standingEye - 3, standingEye),
    monitorDistance: makeRange(50, 75),
    confidence: height >= 155 && height <= 180 ? 'reference' : 'extrapolated',
  };
}

export function roundRange(range: Range): Range {
  return {
    min: Math.round(range.min),
    max: Math.round(range.max),
    reference: Math.round(range.reference),
  };
}
