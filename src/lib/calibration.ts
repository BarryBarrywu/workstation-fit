import type { MetricKey, Posture } from './ergonomics';

export const adjustableResultKeys = [
  'seat',
  'sittingDesk',
  'standingDesk',
  'sittingMonitorTop',
  'standingMonitorTop',
] as const;

export type AdjustableResultKey = typeof adjustableResultKeys[number];

export const createDefaultOffsets = (): Record<AdjustableResultKey, number> => Object.fromEntries(
  adjustableResultKeys.map((key) => [key, 0]),
) as Record<AdjustableResultKey, number>;

export type CalibrationStep = {
  key: AdjustableResultKey;
  metric: MetricKey;
  title: string;
  instruction: string;
};

export const calibrationSteps: Record<Posture, CalibrationStep[]> = {
  sitting: [
    { key: 'seat', metric: 'seat', title: '先看脚掌', instruction: '坐到底并靠住椅背。上下微调椅面，直到双脚稳定着地，膝盖接近或略高于椅面。' },
    { key: 'sittingDesk', metric: 'desk', title: '再看手肘', instruction: '肩膀完全放松，让上臂自然下垂。微调桌面，使键鼠接近手肘高度。' },
    { key: 'sittingMonitorTop', metric: 'monitor', title: '最后看视线', instruction: '头颈保持自然，平视前方。微调屏幕，让顶部不高于眼睛。' },
  ],
  standing: [
    { key: 'standingDesk', metric: 'desk', title: '先看手肘', instruction: '站直但不要刻意挺胸，肩膀放松。微调桌面，使键鼠接近自然手肘高度。' },
    { key: 'standingMonitorTop', metric: 'monitor', title: '再看视线', instruction: '头颈保持自然。微调屏幕，让顶部不高于眼睛，再确认不需要低头或仰头。' },
  ],
};

export const calibrationStepCount: Record<Posture, number> = {
  sitting: calibrationSteps.sitting.length,
  standing: calibrationSteps.standing.length,
};
