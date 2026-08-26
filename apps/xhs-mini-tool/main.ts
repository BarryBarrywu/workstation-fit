import { calibrationSteps } from '../../src/lib/calibration';
import { calculateWorkstation, evidenceChains, roundRange, type EvidenceKey, type Posture, type ResultKey } from '../../src/lib/ergonomics';
import modelMetadata from '../../src/lib/fit-model-metadata.json';
import toolMetadata from './tool-metadata.json';
import { createMiniProfile, DEFAULT_SELECTION, MINI_PROFILE_KEY, parseMiniProfile, POSTURE_RESULTS, updateMiniHeight } from './profile';

const form = document.querySelector<HTMLFormElement>('#height-form')!;
const input = document.querySelector<HTMLInputElement>('#height-input')!;
const error = document.querySelector<HTMLElement>('#height-error')!;
const app = document.querySelector<HTMLElement>('#fit-app')!;
const buildMeta = document.querySelector<HTMLElement>('#build-meta')!;
let profile = parseMiniProfile(localStorage.getItem(MINI_PROFILE_KEY));

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

function resultKeys(posture: Posture): ResultKey[] {
  return POSTURE_RESULTS[posture];
}

function chainKey(key: ResultKey): EvidenceKey { return key === 'monitorDistance' ? 'distance' : key; }

function render() {
  if (!profile) return;
  const result = calculateWorkstation(profile.confirmedHeight);
  const keys = resultKeys(profile.posture);
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
    ${diagram(result)}
    ${calibration()}`;
  bindEvents();
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

function diagram(result: ReturnType<typeof calculateWorkstation>) {
  const sitting = profile!.posture === 'sitting';
  const height = profile!.confirmedHeight;
  const seat = roundRange(result.seat).reference;
  const desk = roundRange(sitting ? result.sittingDesk : result.standingDesk).reference;
  const monitor = roundRange(sitting ? result.sittingMonitorTop : result.standingMonitorTop).reference;
  const seatY = Math.round(214 - seat);
  const headY = sitting ? Math.round(seatY - height * .52) : Math.round(246 - height * 1.08);
  const neckY = headY + 23;
  const hipY = sitting ? seatY - 8 : Math.round(246 - height * .52);
  const deskY = Math.max(112, 236 - desk);
  const monitorY = Math.max(28, 208 - monitor);
  const selected = profile!.selected;
  const markerX = selected === 'seat' ? 94 : selected.includes('Desk') ? 214 : 237;
  const markerY = selected === 'seat' ? seatY : selected.includes('Desk') ? deskY : monitorY;
  const bodyPath = sitting
    ? `M120 ${neckY} L120 ${hipY} L160 ${seatY + 12} L195 ${seatY + 12} M120 ${hipY} L96 ${seatY + 39} L96 251`
    : `M120 ${neckY} L120 ${hipY} M120 ${hipY} L105 200 L105 251 M120 ${hipY} L136 200 L136 251`;
  const armPath = `M120 ${neckY + 14} L158 ${deskY - 3} L192 ${deskY - 3}`;
  const chair = sitting ? `<g fill="#6c756c"><rect x="55" y="${seatY}" width="86" height="12" rx="6"/><rect x="61" y="${seatY + 12}" width="9" height="${240 - seatY}" rx="4"/><path d="M55 ${seatY} Q45 ${headY + 37} 73 ${headY + 25} L79 ${headY + 31} Q60 ${headY + 53} 66 ${seatY}Z"/></g>` : '';
  return `<section class="diagram-card" aria-labelledby="diagram-title"><header><div><h2 id="diagram-title">二维关系图</h2><p>${sitting ? '坐姿' : '站姿'} · 正在解释${labels[selected]}</p></div><span class="evidence-status">动态示意</span></header>
    <svg data-testid="fit-diagram" data-posture="${profile!.posture}" data-selected="${selected}" data-head-y="${headY}" data-seat-y="${seatY}" data-desk-y="${deskY}" data-monitor-y="${monitorY}" viewBox="0 0 360 280" role="img" aria-label="${sitting ? '坐姿' : '站姿'}人体与桌椅显示器关系示意图">
      <rect x="18" y="252" width="324" height="4" rx="2" fill="#a7aea2" />
      <g fill="none" stroke="#2f4035" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="120" cy="${headY}" r="18" fill="#d8b57f" stroke-width="5" />
        <path d="${bodyPath}" />
        <path d="${armPath}" />
      </g>
      ${chair}
      <g fill="#758678"><rect class="diagram-accent" data-part="desk" x="173" y="${deskY}" width="158" height="11" rx="5"/><rect x="298" y="${deskY + 9}" width="9" height="${247 - deskY}" rx="4"/></g>
      <g class="diagram-accent" data-part="monitor" transform="translate(0 ${monitorY})"><rect x="238" y="0" width="76" height="54" rx="6" fill="#33463a"/><rect x="244" y="6" width="64" height="42" rx="3" fill="#dbe5d8"/><path d="M276 54 V${Math.max(68, deskY - monitorY)}" stroke="#5e6c61" stroke-width="7"/></g>
      <circle cx="${markerX}" cy="${markerY}" r="6" fill="#c77d45" />
    </svg><p class="diagram-note">图形只解释相对关系，最终以你的身体检查为准。</p></section>`;
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
