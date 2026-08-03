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
import { calibrationSteps } from '../lib/calibration';
import { createOnboarding } from './onboarding';
import {
  advanceCalibration,
  markOnboardingSeen,
  parseFitProfile,
  restartCalibration,
  setHeight as updateProfileHeight,
  type FitProfile,
} from '../lib/fit-profile';

type CardDefinition = {
  key: ResultKey;
  evidence: EvidenceKey;
  metric: MetricKey;
  label: string;
  hint: string;
};

const cards: Record<Posture, CardDefinition[]> = {
  sitting: [
    { key: 'seat', evidence: 'seat', metric: 'seat', label: '椅面高度', hint: '双脚平稳着地，膝盖接近或略高于椅面' },
    { key: 'sittingDesk', evidence: 'sittingDesk', metric: 'desk', label: '桌面高度', hint: '肩膀放松，前臂自然落在桌面附近' },
    { key: 'sittingMonitorTop', evidence: 'sittingMonitorTop', metric: 'monitor', label: '屏幕顶部', hint: '屏幕顶部不高于自然视线' },
  ],
  standing: [
    { key: 'standingDesk', evidence: 'standingDesk', metric: 'desk', label: '桌面高度', hint: '肩膀放松，手腕与前臂自然成一条线' },
    { key: 'standingMonitorTop', evidence: 'standingMonitorTop', metric: 'monitor', label: '屏幕顶部', hint: '屏幕顶部不高于自然视线' },
    { key: 'monitorDistance', evidence: 'distance', metric: 'distance', label: '观看距离', hint: '先保持一臂左右，再按阅读舒适度调整' },
  ],
};

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing calculator element: ${selector}`);
  return element;
};

const storageKey = 'workstation-fit:profile:v2';
const legacyStorageKey = 'workstation-fit:profile:v1';
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
const nextCalibrationButton = required<HTMLButtonElement>('#next-calibration');

const storedProfile = localStorage.getItem(storageKey);
let profile: FitProfile = parseFitProfile(storedProfile ?? localStorage.getItem(legacyStorageKey));
let posture: Posture = 'sitting';
let activeMetric: MetricKey = 'desk';
let activeResult: ResultKey = 'sittingDesk';
let calibrating: Posture | null = null;

let sceneController: {
  update: (state: { height: number; posture: Posture; activeMetric: MetricKey; result: WorkstationResult }) => void;
} | undefined;

const saveProfile = () => {
  localStorage.setItem(storageKey, JSON.stringify(profile));
  localStorage.removeItem(legacyStorageKey);
};

if (!storedProfile && localStorage.getItem(legacyStorageKey)) saveProfile();

const loadScene = async () => {
  try {
    const { createWorkstationScene } = await import('../lib/workstation-scene');
    sceneController = await createWorkstationScene(stage, canvas);
    updateScene(calculateWorkstation(profile.height));
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

function formatRange(range: Range) {
  const rounded = roundRange(range);
  return `${rounded.min}–${rounded.max}`;
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

function renderResults(result: WorkstationResult) {
  resultContainer.replaceChildren();
  const currentCalibrationKey = calibrating
    ? calibrationSteps[calibrating][profile.calibration[calibrating].step]?.key
    : null;

  for (const definition of cards[posture]) {
    const range = result[definition.key];
    if (!range || !('reference' in range)) continue;
    const rounded = roundRange(range);
    const status = result.evidenceStatus[definition.evidence];
    const card = document.createElement('article');
    card.className = [
      'result-card',
      activeResult === definition.key ? 'is-active' : '',
      currentCalibrationKey === definition.key ? 'is-calibration-target' : '',
    ].filter(Boolean).join(' ');
    card.dataset.metric = definition.metric;
    card.dataset.result = definition.key;
    card.tabIndex = 0;
    const valueMarkup = definition.key === 'monitorDistance'
      ? `<strong class="range-line"><b class="range-value">${formatRange(range)}</b><small>cm</small></strong>`
      : `<div class="suggestion-line"><span>建议从</span><strong><b class="range-value">${rounded.reference}</b><small>cm</small></strong><span>开始</span></div>
        <p class="reference-range">参考范围 ${formatRange(range)} cm</p>`;
    card.innerHTML = `
      <div class="result-main">
        <div class="result-copy">
          <span>${definition.label}</span>
          ${valueMarkup}
          <p>${definition.hint}</p>
        </div>
        <div class="result-meta">
          ${status === 'trend' ? '<span class="evidence-status is-trend">趋势估算</span>' : ''}
          <a class="source-footnote" href="#evidence-${definition.evidence}" aria-label="${definition.label}来源">来源 ↘</a>
        </div>
      </div>
    `;

    card.addEventListener('click', (event) => {
      if ((event.target as Element).closest('a')) return;
      selectResult(definition, result);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectResult(definition, result);
      }
    });

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
    ? `${postureLabel}检查已完成，进度保存在当前浏览器中。`
    : state.status === 'reconfirm'
      ? `身高变了，请重新检查${postureLabel}的身体位置。`
      : posture === 'sitting'
        ? '跟着脚掌、手肘和视线，检查坐姿的三个关键位置。'
        : '跟着手肘和视线，检查站姿的两个关键位置。';
  startCalibrationButton.textContent = state.status === 'in-progress'
    ? `继续${postureLabel}检查`
    : state.status === 'complete' || state.status === 'reconfirm'
      ? `重新检查${postureLabel}`
      : `开始${postureLabel}检查`;

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
  nextCalibrationButton.textContent = calibration.step === steps.length - 1 ? '完成检查' : '已调整，下一步';
  document.body.classList.add('is-calibrating');
  activeMetric = step.metric;
  activeResult = step.key;
}

function render() {
  heightNumber.value = String(profile.height);
  heightRange.value = String(profile.height);
  renderCalibration();
  renderPostureControls();
  const result = calculateWorkstation(profile.height);
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

const onboarding = createOnboarding(() => {
  profile = markOnboardingSeen(profile);
  saveProfile();
  localStorage.setItem('workstation-fit:onboarding-seen', 'true');
});

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

required<HTMLButtonElement>('#replay-onboarding').addEventListener('click', onboarding.show);

render();

if (!profile.onboardingSeen && localStorage.getItem('workstation-fit:onboarding-seen') !== 'true') {
  setTimeout(onboarding.show, 450);
}
