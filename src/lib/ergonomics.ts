export type Posture = 'sitting' | 'standing';
export type MetricKey = 'seat' | 'desk' | 'monitor' | 'distance';
export type ResultKey = 'seat' | 'sittingDesk' | 'standingDesk' | 'sittingMonitorTop' | 'standingMonitorTop' | 'monitorDistance';
export type EvidenceKey = 'seat' | 'sittingDesk' | 'standingDesk' | 'sittingMonitorTop' | 'standingMonitorTop' | 'distance';
export type EvidenceStatus = 'reference' | 'trend' | 'guidance';
export type EvidenceClass = 'national-standard' | 'occupational-health' | 'professional-guidance' | 'research';

export type Range = {
  min: number;
  max: number;
  reference: number;
};

export type EvidenceSource = {
  organization: string;
  title: string;
  url: string;
  evidenceClass: EvidenceClass;
  role: string;
};

export type EvidenceChain = {
  id: EvidenceKey;
  label: string;
  summary: string;
  population: string;
  sourceCoverage: { minHeight: number; maxHeight: number } | null;
  adoptedData: string;
  transformation: string;
  limitations: string;
  sources: EvidenceSource[];
};

export type WorkstationResult = {
  seat: Range;
  sittingDesk: Range;
  standingDesk: Range;
  sittingMonitorTop: Range;
  standingMonitorTop: Range;
  monitorDistance: Range;
  evidenceStatus: Record<EvidenceKey, EvidenceStatus>;
};

type ModelNode = {
  height: number;
  value: number;
};

const gbStandard: EvidenceSource = {
  organization: '国家市场监督管理总局、国家标准化管理委员会',
  title: 'GB/T 10000—2023《中国成年人人体尺寸》',
  url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=B19DCCA575D9406856ABF87A511EE11F',
  evidenceClass: 'national-standard',
  role: '提供中国 18–70 岁成人身高、坐姿腘高、坐姿眼高与肘高等统计值。',
};

const cnisSurvey: EvidenceSource = {
  organization: '中国标准化研究院',
  title: '中国成年人人体建模及应用关键技术标准研究成果介绍',
  url: 'https://www.cnis.ac.cn/ynbm/jcbzhyjs/kydt/202212/t20221222_54389.html',
  evidenceClass: 'research',
  role: '说明新版中国成人尺寸调查与工作空间回归模型的来源背景。',
};

const cornellChair: EvidenceSource = {
  organization: 'Cornell University Ergonomics Web',
  title: 'Choosing an ergonomic chair',
  url: 'https://ergo.human.cornell.edu/AHTutorials/chairch.html',
  evidenceClass: 'professional-guidance',
  role: '用于身体校准：双脚稳定着地，膝前缘与椅面接近或略高。',
};

const mayoOffice: EvidenceSource = {
  organization: 'Mayo Clinic',
  title: 'Office ergonomics: Your how-to guide',
  url: 'https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/office-ergonomics/art-20046169',
  evidenceClass: 'professional-guidance',
  role: '用于桌面、屏幕高度和观看距离的姿势校准规则。',
};

const oshaMonitor: EvidenceSource = {
  organization: 'U.S. Occupational Safety and Health Administration',
  title: 'Computer Workstations: Monitors',
  url: 'https://www.osha.gov/etools/computer-workstations/components/monitors',
  evidenceClass: 'occupational-health',
  role: '支持屏幕顶部不高于眼睛及 50–100 cm 的一般观看距离。',
};

const ccohsMonitor: EvidenceSource = {
  organization: 'Canadian Centre for Occupational Health and Safety',
  title: 'Office Ergonomics: Positioning the Monitor',
  url: 'https://www.ccohs.ca/oshanswers/ergonomics/office/monitor_positioning.html',
  evidenceClass: 'occupational-health',
  role: '提供 40–74 cm 与自然下视角的另一组专业指南，并强调按个人情况调整。',
};

export const evidenceChains: Record<EvidenceKey, EvidenceChain> = {
  seat: {
    id: 'seat',
    label: '椅面高度',
    summary: '以中国成人坐姿腘高为起点，再用脚掌和膝部位置确认。',
    population: '中国 18–70 岁成年男性与女性；静态人体测量。',
    sourceCoverage: { minHeight: 143, maxHeight: 186 },
    adoptedData: '身高/坐姿腘高节点（cm）：143/34.1、158/38.0、168.7/41.3、186/46.9；由女性与男性百分位节点组成。',
    transformation: '按身高在线性插值；在来源上界外沿最后趋势继续估算；中心值上下各保留 2 cm 校准窗口。',
    limitations: '身高不能准确预测个人腿长；百分位配对也不是个人回归。鞋底、坐垫压缩、腿部比例与脚踏都会改变实际椅面高度。',
    sources: [gbStandard, cnisSurvey, cornellChair],
  },
  sittingDesk: {
    id: 'sittingDesk',
    label: '坐姿桌面高度',
    summary: '由椅面与坐姿肘高合成，让前臂接近桌面且肩膀放松。',
    population: '中国 18–70 岁成人的人体尺寸；普通键鼠办公。',
    sourceCoverage: { minHeight: 143, maxHeight: 186 },
    adoptedData: '由坐姿腘高与坐姿肘高合成的身高/桌面中心节点（cm）：143/55、158/63、168.7/68、186/76。',
    transformation: '将椅面中心值与坐姿肘高合成并线性插值，给中心值上下各 2 cm 起始窗口。',
    limitations: '百分位配对不是个人回归；键盘厚度、扶手、前臂长度、座垫压缩和任务类型会改变合适桌高。',
    sources: [gbStandard, cnisSurvey, mayoOffice],
  },
  standingDesk: {
    id: 'standingDesk',
    label: '站姿桌面高度',
    summary: '以站姿肘高为中心，让肩膀放松、手腕与前臂接近一条直线。',
    population: '中国 18–70 岁成人的人体尺寸；普通键鼠办公。',
    sourceCoverage: { minHeight: 143, maxHeight: 186 },
    adoptedData: '身高/立姿肘高节点（cm）：143/86、158/96、168.7/103.7、186/116.1。',
    transformation: '按身高线性插值立姿肘高，给中心值上下各 2 cm 起始窗口。',
    limitations: '百分位配对不是个人回归；鞋底、键盘厚度、前臂比例和具体任务会造成个体差异。',
    sources: [gbStandard, cnisSurvey, mayoOffice],
  },
  sittingMonitorTop: {
    id: 'sittingMonitorTop',
    label: '坐姿屏幕顶部',
    summary: '从坐姿眼高换算为屏幕顶部不高于眼睛的起始范围。',
    population: '中国 18–70 岁成人的人体尺寸；单个常规显示器。',
    sourceCoverage: { minHeight: 143, maxHeight: 186 },
    adoptedData: '由椅面与坐姿眼高合成的身高/落地眼高节点（cm）：143/99、158/112、168.7/121、186/136；屏幕规则来自 OSHA 与 Mayo。',
    transformation: '椅面中心值加坐姿眼高，再将屏幕顶部放在眼高以下 0–3 cm。',
    limitations: '百分位配对不是个人回归；屏幕尺寸、后仰角度、坐垫压缩以及渐进多焦点眼镜会要求更低的位置。',
    sources: [gbStandard, oshaMonitor, mayoOffice],
  },
  standingMonitorTop: {
    id: 'standingMonitorTop',
    label: '站姿屏幕顶部',
    summary: '从站姿眼高换算为屏幕顶部不高于眼睛的起始范围。',
    population: '中国 18–70 岁成人的人体尺寸；单个常规显示器。',
    sourceCoverage: { minHeight: 143, maxHeight: 186 },
    adoptedData: '身高/立姿眼高节点（cm）：143/132、158/146、168.7/156.6、186/173；屏幕规则来自 OSHA 与 Mayo。',
    transformation: '按身高线性插值站姿眼高，再将屏幕顶部放在眼高以下 0–3 cm。',
    limitations: '百分位配对不是个人回归；鞋底、屏幕尺寸、站姿习惯以及渐进多焦点眼镜会改变最后位置。',
    sources: [gbStandard, oshaMonitor, mayoOffice],
  },
  distance: {
    id: 'distance',
    label: '观看距离',
    summary: '把专业指南的重叠区间作为观察起点，不保存成精确目标。',
    population: '普通电脑显示器使用者；不依赖身高。',
    sourceCoverage: null,
    adoptedData: 'OSHA 建议通常为 50–100 cm；CCOHS 图示为 40–74 cm；Mayo 建议约一臂并给出 50–100 cm。',
    transformation: '取多份指南重叠且易操作的 50–75 cm 作为起始观察范围。',
    limitations: '文字大小、视力、屏幕尺寸和任务会显著影响距离；看不清时应先调整字号，避免身体前探。',
    sources: [oshaMonitor, ccohsMonitor, mayoOffice],
  },
};

const seatNodes: ModelNode[] = [
  { height: 143, value: 34.1 },
  { height: 158, value: 38 },
  { height: 168.7, value: 41.3 },
  { height: 186, value: 46.9 },
];

const sittingDeskNodes: ModelNode[] = [
  { height: 143, value: 55 },
  { height: 158, value: 63 },
  { height: 168.7, value: 68 },
  { height: 186, value: 76 },
];

const standingDeskNodes: ModelNode[] = [
  { height: 143, value: 86 },
  { height: 158, value: 96 },
  { height: 168.7, value: 103.7 },
  { height: 186, value: 116.1 },
];

const sittingEyeFloorNodes: ModelNode[] = [
  { height: 143, value: 99 },
  { height: 158, value: 112 },
  { height: 168.7, value: 121 },
  { height: 186, value: 136 },
];

const standingEyeNodes: ModelNode[] = [
  { height: 143, value: 132 },
  { height: 158, value: 146 },
  { height: 168.7, value: 156.6 },
  { height: 186, value: 173 },
];

function interpolate(value: number, nodes: ModelNode[], upperTrendPerCm?: number): number {
  if (value <= nodes[0].height) {
    const lower = nodes[0];
    const upper = nodes[1];
    return lower.value + ((value - lower.height) / (upper.height - lower.height)) * (upper.value - lower.value);
  }

  const last = nodes[nodes.length - 1];
  if (value >= last.height && upperTrendPerCm !== undefined) {
    return last.value + (value - last.height) * upperTrendPerCm;
  }

  const lowerIndex = value >= last.height
    ? nodes.length - 2
    : nodes.findIndex((node, index) => index < nodes.length - 1 && value <= nodes[index + 1].height);
  const lower = nodes[lowerIndex];
  const upper = nodes[lowerIndex + 1];
  return lower.value + ((value - lower.height) / (upper.height - lower.height)) * (upper.value - lower.value);
}

const centeredRange = (reference: number, radius: number): Range => ({
  min: reference - radius,
  max: reference + radius,
  reference,
});

const monitorTopRange = (eyeHeight: number): Range => ({
  min: eyeHeight - 3,
  max: eyeHeight,
  reference: eyeHeight - 1.5,
});

const statusForHeight = (height: number): EvidenceStatus => height >= 143 && height <= 186 ? 'reference' : 'trend';

export function calculateWorkstation(height: number): WorkstationResult {
  const anthropometricStatus = statusForHeight(height);

  return {
    seat: centeredRange(interpolate(height, seatNodes, 4.1 / 19), 2),
    sittingDesk: centeredRange(interpolate(height, sittingDeskNodes, 0.46), 2),
    standingDesk: centeredRange(interpolate(height, standingDeskNodes, 0.62), 2),
    sittingMonitorTop: monitorTopRange(interpolate(height, sittingEyeFloorNodes, 0.78)),
    standingMonitorTop: monitorTopRange(interpolate(height, standingEyeNodes, 0.93)),
    monitorDistance: { min: 50, max: 75, reference: 62.5 },
    evidenceStatus: {
      seat: anthropometricStatus,
      sittingDesk: anthropometricStatus,
      standingDesk: anthropometricStatus,
      sittingMonitorTop: anthropometricStatus,
      standingMonitorTop: anthropometricStatus,
      distance: 'guidance',
    },
  };
}

export function roundRange(range: Range): Range {
  return {
    min: Math.round(range.min),
    max: Math.round(range.max),
    reference: Math.round(range.reference),
  };
}
