import type { MetricKey, Posture, ResultKey } from './ergonomics';

export type CalibrationStep = {
  key: ResultKey;
  metric: MetricKey;
  title: string;
  instruction: string;
};

export const calibrationSteps: Record<Posture, CalibrationStep[]> = {
  sitting: [
    { key: 'seat', metric: 'seat', title: '先看脚掌', instruction: '先坐到底并靠住椅背，再调节椅面，直到双脚平稳着地，膝盖接近或略高于椅面。' },
    { key: 'sittingDesk', metric: 'desk', title: '再看手肘', instruction: '放松肩膀，让上臂自然下垂。调节桌面，让键盘和鼠标接近手肘高度。' },
    { key: 'sittingMonitorTop', metric: 'monitor', title: '最后看视线', instruction: '头颈自然放松，平视前方。调节屏幕，让屏幕顶部不高于眼睛。' },
  ],
  standing: [
    { key: 'standingDesk', metric: 'desk', title: '先看手肘', instruction: '自然站直，不要刻意挺胸。放松肩膀，再调节桌面，让键盘和鼠标接近手肘高度。' },
    { key: 'standingMonitorTop', metric: 'monitor', title: '再看视线', instruction: '头颈自然放松。调节屏幕，让屏幕顶部不高于眼睛，并确认自己不需要低头或仰头。' },
  ],
};

export const calibrationStepCount: Record<Posture, number> = {
  sitting: calibrationSteps.sitting.length,
  standing: calibrationSteps.standing.length,
};
