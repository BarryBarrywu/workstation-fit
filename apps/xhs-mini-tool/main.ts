import { calibrationSteps } from '../../src/lib/calibration';
import { calculateWorkstation, evidenceChains, roundRange, type EvidenceKey, type Posture, type ResultKey } from '../../src/lib/ergonomics';
import modelMetadata from '../../src/lib/fit-model-metadata.json';
import toolMetadata from './tool-metadata.json';
import { createFixedWorkstationScene } from './fixed-scene';
import { createMiniProfile, DEFAULT_SELECTION, MINI_PROFILE_KEY, parseMiniProfile, POSTURE_RESULTS, updateMiniHeight } from './profile';

const form = document.querySelector<HTMLFormElement>('#height-form')!;
const input = document.querySelector<HTMLInputElement>('#height-input')!;
const error = document.querySelector<HTMLElement>('#height-error')!;
const app = document.querySelector<HTMLElement>('#fit-app')!;
const buildMeta = document.querySelector<HTMLElement>('#build-meta')!;
let profile = parseMiniProfile(localStorage.getItem(MINI_PROFILE_KEY));
let sceneController: ReturnType<typeof createFixedWorkstationScene> | null = null;

const labels: Record<ResultKey, string> = {
  seat: '椅面高度', sittingDesk: '桌面高度', standingDesk: '桌面高度',
  sittingMonitorTop: '屏幕顶部', standingMonitorTop: '屏幕顶部', monitorDistance: '观看距离',
};

buildMeta.innerHTML = `工具 ${toolMetadata.toolVersion} · Fit model ${modelMetadata.fitModelVersion} · 来源核验 ${modelMetadata.evidenceVerifiedAt}<br>这是调节起点，不是医疗建议。`;
if (profile) { input.value = String(profile.confirmedHeight); render(); }

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const height = Number(input.value);
  if (input.value.trim() === '' || !Number.isFinite(height) || height < 145 || height > 205) {
    error.textContent = '请输入 145–205 cm 之间的身高';
    input.setAttribute('aria-invalid', 'true');
    return;
  }
  error.textContent = '';
  input.removeAttribute('aria-invalid');
  profile = profile ? updateMiniHeight(profile, height) : createMiniProfile(height);
  saveAndRender();
});

function saveAndRender() {
  if (!profile) return;
  localStorage.setItem(MINI_PROFILE_KEY, JSON.stringify(profile));
  render();
}

function chainKey(key: ResultKey): EvidenceKey { return key === 'monitorDistance' ? 'distance' : key; }

function render() {
  if (!profile) return;
  sceneController?.dispose();
  sceneController = null;
  const result = calculateWorkstation(profile.confirmedHeight);
  const keys = POSTURE_RESULTS[profile.posture];
  if (!keys.includes(profile.selected)) profile.selected = DEFAULT_SELECTION[profile.posture];
  app.innerHTML = `
    <section class="fit-panel" data-testid="fit-results" aria-labelledby="results-title">
      <div class="panel-heading"><div><h2 id="results-title">${profile.confirmedHeight} cm 的调节起点</h2><p>先选姿势，再选一个位置看图确认。</p></div><button class="edit-height" type="button">修改身高</button></div>
      <div class="posture-tabs" role="group" aria-label="选择姿势">
        <button class="posture-tab" type="button" data-posture="sitting" aria-pressed="${profile.posture === 'sitting'}">坐姿${statusSuffix('sitting')}</button>
        <button class="posture-tab" type="button" data-posture="standing" aria-pressed="${profile.posture === 'standing'}">站姿${statusSuffix('standing')}</button>
      </div>
      <div class="result-list">${keys.map((key) => resultCard(key, result)).join('')}</div>
    </section>
    ${sceneCard()}
    ${calibration()}`;
  bindEvents();
  initializeScene(result);
}

function resultCard(key: ResultKey, result: ReturnType<typeof calculateWorkstation>) {
  const range = roundRange(result[key]);
  const evidenceKey = chainKey(key);
  const chain = evidenceChains[evidenceKey];
  const status = result.evidenceStatus[evidenceKey];
  const coverage = chain.sourceCoverage ? `${chain.sourceCoverage.minHeight}–${chain.sourceCoverage.maxHeight} cm` : '不依赖身高';
  const organizations = [...new Set(chain.sources.map((source) => source.organization))].join('、');
  return `<article>
    <button class="metric-button" type="button" data-metric="${key}" aria-pressed="${profile!.selected === key}">
      <span class="metric-top"><span class="metric-label">${labels[key]}</span><span class="evidence-status ${status}">${status === 'trend' ? '趋势估算' : '来源覆盖'}</span></span>
      <span class="metric-value"><strong>${range.reference} cm</strong><span>建议起点</span></span>
      <span class="metric-range">参考范围 ${range.min}–${range.max} cm</span>
    </button>
    <details class="evidence-details"><summary>${labels[key]}的精简证据链</summary><div class="evidence-copy">
      <p><b>来源：</b>${organizations}</p><p><b>覆盖：</b>${coverage}</p><p><b>转换：</b>${chain.transformation}</p><p><b>限制：</b>${chain.limitations}</p>
    </div></details>
  </article>`;
}

function sceneCard() {
  const postureLabel = profile!.posture === 'sitting' ? '坐姿' : '站姿';
  return `<section class="diagram-card" aria-labelledby="diagram-title"><header><div><h2 id="diagram-title">3D 关系图</h2><p>${postureLabel} · 正在解释${labels[profile!.selected]}</p></div></header>
    <div class="fixed-scene-stage"><canvas data-testid="fit-scene" aria-label="${postureLabel}机器人与桌椅显示器模型"></canvas><img class="scene-fallback" src="./assets/scene-fallback.png" alt="机器人与工位模型预览" hidden /></div>
    <p class="diagram-note" data-scene-status hidden></p></section>`;
}

function initializeScene(result: ReturnType<typeof calculateWorkstation>) {
  const stage = app.querySelector<HTMLElement>('.fixed-scene-stage')!;
  const canvas = app.querySelector<HTMLCanvasElement>('[data-testid="fit-scene"]')!;
  const fallback = app.querySelector<HTMLImageElement>('.scene-fallback')!;
  const status = app.querySelector<HTMLElement>('[data-scene-status]')!;
  try {
    sceneController = createFixedWorkstationScene(stage, canvas);
    sceneController.update({ height: profile!.confirmedHeight, posture: profile!.posture, selected: profile!.selected, result });
  } catch {
    canvas.hidden = true;
    fallback.hidden = false;
    status.hidden = false;
    status.textContent = '3D 场景不可用，数值和身体检查不受影响。';
  }
}

function calibration() {
  const posture = profile!.posture;
  const state = profile!.calibration[posture];
  const steps = calibrationSteps[posture];
  const stepIndex = Math.min(state.step, steps.length - 1);
  const step = steps[stepIndex];
  const postureLabel = posture === 'sitting' ? '坐姿' : '站姿';
  const active = state.status === 'in-progress';
  return `<section class="calibration-card" aria-labelledby="calibration-title"><header><h2 id="calibration-title">${postureLabel}身体检查</h2><p>${posture === 'sitting' ? '脚掌 → 手肘 → 视线' : '手肘 → 视线'}，每个姿势单独完成。</p></header>
    ${state.status === 'complete' ? `<p class="completion">${postureLabel}检查已完成，进度保存在当前小工具中。</p>` : ''}
    ${state.status === 'reconfirm' ? `<p class="completion">身高变了，请重新确认${postureLabel}的身体位置。</p>` : ''}
    ${active ? `<div class="calibration-step"><p class="step-count">${stepIndex + 1} / ${steps.length}</p><h3>${step.title}</h3><p>${step.instruction}</p>${step.metric === 'monitor' ? distanceEvidence() : ''}<button class="secondary-button" type="button" data-action="advance">${stepIndex === steps.length - 1 ? '完成当前姿势' : '已调整，下一步'}</button></div>` : `<button class="secondary-button" type="button" data-action="start">${state.status === 'complete' || state.status === 'reconfirm' ? `重新检查${postureLabel}` : `开始${postureLabel}检查`}</button>`}
  </section>`;
}

function distanceEvidence() {
  const chain = evidenceChains.distance;
  const organizations = [...new Set(chain.sources.map((source) => source.organization))].join('、');
  return `<p class="distance-note">屏幕观看距离可先从 50–75 cm 检查；它不是按身高计算的结果。</p><details class="evidence-details"><summary>观看距离的精简证据链</summary><div class="evidence-copy"><p><b>来源：</b>${organizations}</p><p><b>覆盖：</b>一般电脑显示器，不依赖身高</p><p><b>转换：</b>${chain.transformation}</p><p><b>限制：</b>${chain.limitations}</p></div></details>`;
}

function statusSuffix(posture: Posture) {
  const status = profile!.calibration[posture].status;
  return status === 'complete' ? ' · 已完成' : status === 'reconfirm' ? ' · 待确认' : '';
}

function bindEvents() {
  app.querySelector<HTMLButtonElement>('.edit-height')?.addEventListener('click', () => { input.focus(); input.select(); });
  app.querySelectorAll<HTMLButtonElement>('[data-posture]').forEach((button) => button.addEventListener('click', () => {
    if (!profile) return;
    profile.posture = button.dataset.posture as Posture;
    profile.selected = DEFAULT_SELECTION[profile.posture];
    saveAndRender();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((button) => button.addEventListener('click', () => {
    if (!profile) return;
    profile.selected = button.dataset.metric as ResultKey;
    saveAndRender();
  }));
  app.querySelector<HTMLButtonElement>('[data-action="start"]')?.addEventListener('click', () => {
    if (!profile) return;
    profile.calibration[profile.posture] = { step: 0, status: 'in-progress' };
    saveAndRender();
  });
  app.querySelector<HTMLButtonElement>('[data-action="advance"]')?.addEventListener('click', () => {
    if (!profile) return;
    const posture = profile.posture;
    const current = profile.calibration[posture];
    const count = calibrationSteps[posture].length;
    const nextStep = current.step + 1;
    profile.calibration[posture] = nextStep >= count ? { step: count, status: 'complete' } : { step: nextStep, status: 'in-progress' };
    saveAndRender();
  });
}
