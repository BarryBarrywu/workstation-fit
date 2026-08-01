import { calculateWorkstation, roundRange, type MetricKey, type Posture, type Range, type WorkstationResult } from '../lib/ergonomics';

type ResultKey = 'seat' | 'sittingDesk' | 'standingDesk' | 'sittingMonitorTop' | 'standingMonitorTop' | 'monitorDistance';

type CardDefinition = {
  key: ResultKey;
  metric: MetricKey;
  label: string;
  hint: string;
  adjustable?: boolean;
};

const cards: Record<Posture, CardDefinition[]> = {
  sitting: [
    { key: 'seat', metric: 'seat', label: '椅面高度', hint: '脚掌完全着地', adjustable: true },
    { key: 'sittingDesk', metric: 'desk', label: '桌面高度', hint: '接近自然手肘高', adjustable: true },
    { key: 'sittingMonitorTop', metric: 'monitor', label: '屏幕顶部', hint: '不高于眼睛', adjustable: true },
  ],
  standing: [
    { key: 'standingDesk', metric: 'desk', label: '桌面高度', hint: '肩膀放松，手肘自然', adjustable: true },
    { key: 'standingMonitorTop', metric: 'monitor', label: '屏幕顶部', hint: '视线自然向下', adjustable: true },
    { key: 'monitorDistance', metric: 'distance', label: '观看距离', hint: '约一臂距离' },
  ],
};

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing calculator element: ${selector}`);
  return element;
};

const heightNumber = required<HTMLInputElement>('#height-number');
const heightRange = required<HTMLInputElement>('#height-range');
const resultContainer = required<HTMLDivElement>('#results');
const stage = required<HTMLElement>('#stage');
const canvas = required<HTMLCanvasElement>('#workstation-canvas');
const postureCaption = required<HTMLElement>('#posture-caption');
const confidenceNote = required<HTMLElement>('#confidence-note');

let posture: Posture = 'sitting';
let activeMetric: MetricKey = 'desk';
let height = 173;
const adjustments: Record<ResultKey, number> = {
  seat: 0,
  sittingDesk: 0,
  standingDesk: 0,
  sittingMonitorTop: 0,
  standingMonitorTop: 0,
  monitorDistance: 0,
};

let sceneController: { update: (state: { height: number; posture: Posture; activeMetric: MetricKey; result: WorkstationResult }) => void } | undefined;

const loadScene = async () => {
  try {
    const { createWorkstationScene } = await import('../lib/workstation-scene');
    sceneController = await createWorkstationScene(stage, canvas);
    render();
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
    seat: shiftRange(result.seat, adjustments.seat),
    sittingDesk: shiftRange(result.sittingDesk, adjustments.sittingDesk),
    standingDesk: shiftRange(result.standingDesk, adjustments.standingDesk),
    sittingMonitorTop: shiftRange(result.sittingMonitorTop, adjustments.sittingMonitorTop),
    standingMonitorTop: shiftRange(result.standingMonitorTop, adjustments.standingMonitorTop),
    monitorDistance: result.monitorDistance,
  };
}

function formatRange(range: Range) {
  const rounded = roundRange(range);
  return `${rounded.min}–${rounded.max}`;
}

function renderResults(result: WorkstationResult) {
  resultContainer.replaceChildren();
  for (const definition of cards[posture]) {
    const range = result[definition.key] as Range;
    const card = document.createElement('article');
    card.className = `result-card${activeMetric === definition.metric ? ' is-active' : ''}`;
    card.dataset.metric = definition.metric;
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="result-copy">
        <span>${definition.label}</span>
        <strong><b>${formatRange(range)}</b><small>cm</small></strong>
        <p>${definition.hint}</p>
      </div>
      ${definition.adjustable ? `
        <div class="stepper" aria-label="微调${definition.label}">
          <button type="button" data-adjust="-1" aria-label="${definition.label}降低 1 厘米">−</button>
          <span>${adjustments[definition.key] === 0 ? '微调' : `${adjustments[definition.key] > 0 ? '+' : ''}${adjustments[definition.key]}`}</span>
          <button type="button" data-adjust="1" aria-label="${definition.label}升高 1 厘米">+</button>
        </div>` : '<span class="result-arrow" aria-hidden="true">↔</span>'}
    `;

    const select = () => {
      activeMetric = definition.metric;
      render();
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
    card.querySelectorAll<HTMLButtonElement>('[data-adjust]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        adjustments[definition.key] = Math.max(-8, Math.min(8, adjustments[definition.key] + Number(button.dataset.adjust)));
        activeMetric = definition.metric;
        render();
      });
    });
    resultContainer.append(card);
  }
}

function render() {
  const result = adjustedResult(calculateWorkstation(height));
  renderResults(result);
  postureCaption.textContent = posture === 'sitting' ? '坐姿' : '站姿';
  confidenceNote.textContent = result.confidence === 'reference'
    ? '适用于来源数据覆盖的身高范围'
    : '当前为趋势外推，请重点复核身体感受';
  sceneController?.update({ height, posture, activeMetric, result });
}

function setHeight(nextHeight: number) {
  height = Math.max(145, Math.min(205, Math.round(nextHeight)));
  heightNumber.value = String(height);
  heightRange.value = String(height);
  render();
}

heightNumber.addEventListener('input', () => setHeight(Number(heightNumber.value) || 173));
heightRange.addEventListener('input', () => setHeight(Number(heightRange.value)));

document.querySelectorAll<HTMLButtonElement>('[data-posture]').forEach((button) => {
  button.addEventListener('click', () => {
    posture = button.dataset.posture as Posture;
    activeMetric = posture === 'sitting' ? 'desk' : 'desk';
    document.querySelectorAll<HTMLButtonElement>('[data-posture]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('.posture-switch')?.classList.toggle('is-standing', posture === 'standing');
    render();
  });
});

render();
