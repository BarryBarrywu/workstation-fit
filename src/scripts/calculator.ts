import {
  calculateWorkstation,
  roundRange,
  type EvidenceKey,
  type MetricKey,
  type Posture,
  type Range,
  type ResultKey,
  type WorkstationResult,
} from '../lib/ergonomics';
import {
  advanceCalibration,
  createFitProfile,
  markOnboardingSeen,
  parseFitProfile,
  restartCalibration,
  setHeight as updateProfileHeight,
  setOffset,
  type AdjustableResultKey,
  type FitProfile,
} from '../lib/fit-profile';

type CardDefinition = {
  key: ResultKey;
  evidence: EvidenceKey;
  metric: MetricKey;
  label: string;
  hint: string;
  adjustable?: AdjustableResultKey;
};

type CalibrationStep = {
  key: AdjustableResultKey;
  metric: MetricKey;
  title: string;
  instruction: string;
};

const cards: Record<Posture, CardDefinition[]> = {
  sitting: [
    { key: 'seat', evidence: 'seat', metric: 'seat', label: '椅面高度', hint: '脚掌完全着地，膝盖接近或略高于椅面', adjustable: 'seat' },
    { key: 'sittingDesk', evidence: 'sittingDesk', metric: 'desk', label: '桌面高度', hint: '肩膀放松，前臂自然接近桌面', adjustable: 'sittingDesk' },
    { key: 'sittingMonitorTop', evidence: 'sittingMonitorTop', metric: 'monitor', label: '屏幕顶部', hint: '不高于自然眼线', adjustable: 'sittingMonitorTop' },
  ],
  standing: [
    { key: 'standingDesk', evidence: 'standingDesk', metric: 'desk', label: '桌面高度', hint: '肩膀放松，手腕与前臂接近一条线', adjustable: 'standingDesk' },
    { key: 'standingMonitorTop', evidence: 'standingMonitorTop', metric: 'monitor', label: '屏幕顶部', hint: '不高于自然眼线', adjustable: 'standingMonitorTop' },
    { key: 'monitorDistance', evidence: 'distance', metric: 'distance', label: '观看距离', hint: '观察起点，不保存为精确目标' },
  ],
};

const calibrationSteps: Record<Posture, CalibrationStep[]> = {
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

const onboardingSteps = [
  { target: 'height', title: '先输入身高', copy: '身高只决定可追溯的起始范围。腿、躯干和手臂比例的差异，会在身体校准里处理。' },
  { target: 'posture', title: '坐姿与站姿分开', copy: '两种姿态的桌面与屏幕位置独立保存，切换时不会互相覆盖。' },
  { target: 'scene', title: '直接拖动机器人', copy: '拖动可旋转，滚轮或双指可缩放。选中一个数值时，对应部位和尺寸线会高亮。' },
];

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing calculator element: ${selector}`);
  return element;
};

const storageKey = 'workstation-fit:profile:v1';
const heightNumber = required<HTMLInputElement>('#height-number');
const heightRange = required<HTMLInputElement>('#height-range');
const resultContainer = required<HTMLDivElement>('#results');
const stage = required<HTMLElement>('#stage');
const canvas = required<HTMLCanvasElement>('#workstation-canvas');
const postureCaption = required<HTMLElement>('#posture-caption');
const calibrationSummary = required<HTMLElement>('#calibration-summary');
const startCalibrationButton = required<HTMLButtonElement>('#start-calibration');
const calibrationPanel = required<HTMLElement>('#calibration-panel');
const calibrationProgress = required<HTMLElement>('#calibration-progress');
const calibrationTitle = required<HTMLElement>('#calibration-title');
const calibrationInstruction = required<HTMLElement>('#calibration-instruction');
const onboardingDialog = required<HTMLDialogElement>('#onboarding-dialog');

let profile: FitProfile = parseFitProfile(localStorage.getItem(storageKey));
let posture: Posture = 'sitting';
let activeMetric: MetricKey = 'desk';
let activeResult: ResultKey = 'sittingDesk';
let calibrating: Posture | null = null;
let onboardingStep = 0;

let sceneController: {
  update: (state: { height: number; posture: Posture; activeMetric: MetricKey; result: WorkstationResult }) => void;
} | undefined;

const saveProfile = () => localStorage.setItem(storageKey, JSON.stringify(profile));

const loadScene = async () => {
  try {
    const { createWorkstationScene } = await import('../lib/workstation-scene');
    sceneController = await createWorkstationScene(stage, canvas);
    updateScene(adjustedResult(calculateWorkstation(profile.height)));
  } catch {
    canvas.hidden = true;
    stage.querySelector<HTMLElement>('.stage-fallback')?.removeAttribute('hidden');
  }
};

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => void loadScene(), { timeout: 900 });
} else {
  setTimeout(() => void loadScene(), 0);
}

const shiftRange = (range: Range, amount: number): Range => ({
  min: range.min + amount,
  max: range.max + amount,
  reference: range.reference + amount,
});

function adjustedResult(result: WorkstationResult): WorkstationResult {
  return {
    ...result,
    seat: shiftRange(result.seat, profile.offsets.seat),
    sittingDesk: shiftRange(result.sittingDesk, profile.offsets.sittingDesk),
    standingDesk: shiftRange(result.standingDesk, profile.offsets.standingDesk),
    sittingMonitorTop: shiftRange(result.sittingMonitorTop, profile.offsets.sittingMonitorTop),
    standingMonitorTop: shiftRange(result.standingMonitorTop, profile.offsets.standingMonitorTop),
  };
}

function formatRange(range: Range) {
  const rounded = roundRange(range);
  return `${rounded.min}–${rounded.max}`;
}

function offsetCopy(offset: number) {
  if (offset === 0) return '原始范围';
  return `${offset > 0 ? '高' : '低'} ${Math.abs(offset)} cm`;
}

function statusCopy(status: 'reference' | 'trend' | 'guidance') {
  if (status === 'trend') return '趋势估算';
  if (status === 'guidance') return '通用指南';
  return '来源覆盖';
}

function updateScene(result: WorkstationResult) {
  sceneController?.update({ height: profile.height, posture, activeMetric, result });
}

function selectResult(definition: CardDefinition, result: WorkstationResult) {
  activeMetric = definition.metric;
  activeResult = definition.key;
  resultContainer.querySelectorAll('.result-card').forEach((card) => card.classList.toggle('is-active', card.getAttribute('data-result') === activeResult));
  updateScene(result);
}

function applyOffset(definition: CardDefinition, nextOffset: number) {
  if (!definition.adjustable) return;
  profile = setOffset(profile, definition.adjustable, nextOffset);
  saveProfile();
  activeMetric = definition.metric;
  activeResult = definition.key;

  const result = adjustedResult(calculateWorkstation(profile.height));
  const card = resultContainer.querySelector<HTMLElement>(`[data-result="${definition.key}"]`);
  const range = result[definition.key] as Range;
  if (card) {
    const value = card.querySelector<HTMLElement>('.range-value');
    const offset = card.querySelector<HTMLElement>('.offset-copy');
    const slider = card.querySelector<HTMLInputElement>('input[type="range"]');
    if (value) value.textContent = formatRange(range);
    if (offset) offset.textContent = offsetCopy(profile.offsets[definition.adjustable]);
    if (slider) slider.value = String(profile.offsets[definition.adjustable]);
  }
  selectResult(definition, result);
}

function renderResults(result: WorkstationResult) {
  resultContainer.replaceChildren();
  const currentCalibrationKey = calibrating
    ? calibrationSteps[calibrating][profile.calibration[calibrating].step]?.key
    : null;

  for (const definition of cards[posture]) {
    const range = result[definition.key] as Range;
    const status = result.evidenceStatus[definition.evidence];
    const card = document.createElement('article');
    card.className = [
      'result-card',
      activeResult === definition.key ? 'is-active' : '',
      currentCalibrationKey === definition.adjustable ? 'is-calibration-target' : '',
    ].filter(Boolean).join(' ');
    card.dataset.metric = definition.metric;
    card.dataset.result = definition.key;
    card.tabIndex = 0;
    const currentOffset = definition.adjustable ? profile.offsets[definition.adjustable] : 0;
    card.innerHTML = `
      <div class="result-main">
        <div class="result-copy">
          <span>${definition.label}</span>
          <strong><b class="range-value">${formatRange(range)}</b><small>cm</small></strong>
          <p>${definition.hint}</p>
        </div>
        <div class="result-meta">
          <span class="evidence-status is-${status}">${statusCopy(status)}</span>
          <a class="source-footnote" href="#evidence-${definition.evidence}" aria-label="${definition.label}来源">来源 ↘</a>
        </div>
      </div>
      ${definition.adjustable ? `
        <div class="offset-control">
          <div class="offset-heading"><span>身体微调</span><strong class="offset-copy">${offsetCopy(currentOffset)}</strong></div>
          <div class="offset-row">
            <button type="button" data-adjust="-1" aria-label="${definition.label}降低 1 厘米">−</button>
            <input type="range" min="-8" max="8" step="1" value="${currentOffset}" aria-label="微调${definition.label}，厘米" />
            <button type="button" data-adjust="1" aria-label="${definition.label}升高 1 厘米">+</button>
          </div>
          <div class="offset-ends" aria-hidden="true"><span>−8</span><span>0</span><span>+8</span></div>
        </div>` : '<p class="observation-note">结合屏幕尺寸和文字大小观察，不保存偏移。</p>'}
    `;

    card.addEventListener('click', (event) => {
      if ((event.target as Element).closest('a, button, input')) return;
      selectResult(definition, result);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectResult(definition, result);
      }
    });

    if (definition.adjustable) {
      card.querySelector<HTMLInputElement>('input[type="range"]')?.addEventListener('input', (event) => {
        applyOffset(definition, Number((event.currentTarget as HTMLInputElement).value));
      });
      card.querySelectorAll<HTMLButtonElement>('[data-adjust]').forEach((button) => {
        button.addEventListener('click', () => {
          applyOffset(definition, profile.offsets[definition.adjustable!] + Number(button.dataset.adjust));
        });
      });
    }
    resultContainer.append(card);
  }
}

function renderPostureControls() {
  document.querySelectorAll<HTMLButtonElement>('[data-posture]').forEach((button) => {
    const selected = button.dataset.posture === posture;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = calibrating !== null;
  });
  required<HTMLElement>('.posture-switch').classList.toggle('is-standing', posture === 'standing');
  postureCaption.textContent = posture === 'sitting' ? '坐姿' : '站姿';
}

function renderCalibration() {
  const state = profile.calibration[posture];
  const postureLabel = posture === 'sitting' ? '坐姿' : '站姿';
  calibrationSummary.textContent = state.status === 'complete'
    ? `${postureLabel}已校准。数值已保存在当前浏览器。`
    : state.status === 'reconfirm'
      ? `身高已改变，请重新确认${postureLabel}的身体接触点。`
      : posture === 'sitting'
        ? '按脚掌、手肘和视线，确认坐姿的三个关键位置。'
        : '按手肘和视线，确认站姿的两个关键位置。';
  startCalibrationButton.textContent = state.status === 'in-progress'
    ? `继续${postureLabel}校准`
    : state.status === 'complete'
      ? `重新校准${postureLabel}`
      : `开始${postureLabel}校准`;

  if (!calibrating) {
    calibrationPanel.hidden = true;
    document.body.classList.remove('is-calibrating');
    return;
  }

  const calibration = profile.calibration[calibrating];
  const steps = calibrationSteps[calibrating];
  const step = steps[Math.min(calibration.step, steps.length - 1)];
  calibrationPanel.hidden = false;
  calibrationProgress.textContent = `${calibration.step + 1} / ${steps.length}`;
  calibrationTitle.textContent = step.title;
  calibrationInstruction.textContent = step.instruction;
  document.body.classList.add('is-calibrating');
  activeMetric = step.metric;
  activeResult = step.key;
}

function render() {
  heightNumber.value = String(profile.height);
  heightRange.value = String(profile.height);
  renderCalibration();
  renderPostureControls();
  const result = adjustedResult(calculateWorkstation(profile.height));
  renderResults(result);
  updateScene(result);
}

function setHeight(nextHeight: number) {
  profile = updateProfileHeight(profile, nextHeight);
  saveProfile();
  render();
}

function startCalibration() {
  const state = profile.calibration[posture];
  if (state.status !== 'in-progress') profile = restartCalibration(profile, posture);
  calibrating = posture;
  saveProfile();
  render();
  calibrationPanel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

function exitCalibration() {
  calibrating = null;
  render();
}

function nextCalibration() {
  if (!calibrating) return;
  const currentPosture = calibrating;
  profile = advanceCalibration(profile, currentPosture);
  saveProfile();
  if (profile.calibration[currentPosture].status === 'complete') calibrating = null;
  render();
}

function clearOnboardingTarget() {
  document.querySelector('.onboarding-target')?.classList.remove('onboarding-target');
}

function renderOnboardingStep() {
  clearOnboardingTarget();
  const step = onboardingSteps[onboardingStep];
  required<HTMLElement>('#onboarding-title').textContent = step.title;
  required<HTMLElement>('#onboarding-copy').textContent = step.copy;
  required<HTMLElement>('#onboarding-progress').textContent = `${onboardingStep + 1} / ${onboardingSteps.length}`;
  required<HTMLButtonElement>('#next-onboarding').textContent = onboardingStep === onboardingSteps.length - 1 ? '开始使用' : '下一步';
  document.querySelector(`[data-onboarding-target="${step.target}"]`)?.classList.add('onboarding-target');
}

function showOnboarding() {
  onboardingStep = 0;
  renderOnboardingStep();
  if (!onboardingDialog.open) onboardingDialog.show();
}

function finishOnboarding() {
  clearOnboardingTarget();
  profile = markOnboardingSeen(profile);
  saveProfile();
  localStorage.setItem('workstation-fit:onboarding-seen', 'true');
  onboardingDialog.close();
}

heightNumber.addEventListener('change', () => setHeight(Number(heightNumber.value) || profile.height));
heightNumber.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') heightNumber.blur();
});
heightRange.addEventListener('input', () => setHeight(Number(heightRange.value)));

document.querySelectorAll<HTMLButtonElement>('[data-posture]').forEach((button) => {
  button.addEventListener('click', () => {
    posture = button.dataset.posture as Posture;
    activeMetric = 'desk';
    activeResult = posture === 'sitting' ? 'sittingDesk' : 'standingDesk';
    render();
  });
});

startCalibrationButton.addEventListener('click', startCalibration);
required<HTMLButtonElement>('#exit-calibration').addEventListener('click', exitCalibration);
required<HTMLButtonElement>('#next-calibration').addEventListener('click', nextCalibration);

required<HTMLButtonElement>('#reset-profile').addEventListener('click', () => {
  if (!window.confirm('清除坐姿与站姿的全部微调和校准进度？身高会保留。')) return;
  const onboardingSeen = profile.onboardingSeen;
  profile = { ...createFitProfile(profile.height), onboardingSeen };
  calibrating = null;
  saveProfile();
  render();
});

required<HTMLButtonElement>('#replay-onboarding').addEventListener('click', showOnboarding);
required<HTMLButtonElement>('#skip-onboarding').addEventListener('click', finishOnboarding);
required<HTMLButtonElement>('#next-onboarding').addEventListener('click', () => {
  if (onboardingStep === onboardingSteps.length - 1) {
    finishOnboarding();
  } else {
    onboardingStep += 1;
    renderOnboardingStep();
  }
});
onboardingDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  finishOnboarding();
});

render();

if (!profile.onboardingSeen && localStorage.getItem('workstation-fit:onboarding-seen') !== 'true') {
  setTimeout(showOnboarding, 450);
}
