const steps = [
  { target: 'height', placement: 'right', title: '先输入身高', copy: '身高决定可追溯的建议起点。腿、躯干和手臂比例的差异，需要再按真实身体检查实际摆位。' },
  { target: 'posture', placement: 'right', title: '坐姿与站姿分开', copy: '两种姿态的桌面与屏幕位置独立保存，切换时不会互相覆盖。' },
  { target: 'scene', placement: 'inside', title: '直接拖动机器人', copy: '拖动可旋转，滚轮或双指可缩放。选中一个数值时，对应部位和尺寸线会高亮。' },
];

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing onboarding element: ${selector}`);
  return element;
};

export function createOnboarding(onComplete: () => void) {
  const dialog = required<HTMLDialogElement>('#onboarding-dialog');
  const title = required<HTMLElement>('#onboarding-title');
  const copy = required<HTMLElement>('#onboarding-copy');
  const progress = required<HTMLElement>('#onboarding-progress');
  const nextButton = required<HTMLButtonElement>('#next-onboarding');
  let currentStep = 0;

  const activeTarget = () => document.querySelector<HTMLElement>(`[data-onboarding-target="${steps[currentStep].target}"]`);

  const clearTarget = () => {
    document.querySelector('.onboarding-target')?.classList.remove('onboarding-target');
    document.body.classList.remove('is-onboarding');
  };

  const positionDialog = () => {
    if (!dialog.open || window.innerWidth <= 680) {
      dialog.style.removeProperty('left');
      dialog.style.removeProperty('top');
      dialog.dataset.placement = 'mobile';
      return;
    }
    const target = activeTarget();
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const gap = 18;
    const edge = 24;
    const requestedPlacement = steps[currentStep].placement;
    let placement = requestedPlacement;
    let left = targetRect.right + gap;
    let top = targetRect.top + targetRect.height / 2 - dialogRect.height / 2;

    if (requestedPlacement === 'inside') {
      left = targetRect.left + edge;
      top = targetRect.top + edge;
    } else if (left + dialogRect.width > window.innerWidth - edge) {
      placement = 'left';
      left = targetRect.left - dialogRect.width - gap;
    }

    dialog.dataset.placement = placement;
    dialog.style.left = `${Math.max(edge, Math.min(left, window.innerWidth - dialogRect.width - edge))}px`;
    dialog.style.top = `${Math.max(edge, Math.min(top, window.innerHeight - dialogRect.height - edge))}px`;
  };

  const render = () => {
    clearTarget();
    const step = steps[currentStep];
    title.textContent = step.title;
    copy.textContent = step.copy;
    progress.textContent = `${currentStep + 1} / ${steps.length}`;
    nextButton.textContent = currentStep === steps.length - 1 ? '开始使用' : '下一步';
    const target = activeTarget();
    target?.classList.add('onboarding-target');
    document.body.classList.add('is-onboarding');
    target?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: step.target === 'scene' ? 'center' : 'nearest',
    });
    requestAnimationFrame(positionDialog);
  };

  const finish = () => {
    clearTarget();
    onComplete();
    dialog.close();
  };

  const show = () => {
    currentStep = 0;
    if (!dialog.open) dialog.show();
    render();
  };

  required<HTMLButtonElement>('#skip-onboarding').addEventListener('click', finish);
  nextButton.addEventListener('click', () => {
    if (currentStep === steps.length - 1) finish();
    else {
      currentStep += 1;
      render();
    }
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish();
  });
  window.addEventListener('resize', positionDialog);
  window.addEventListener('scroll', positionDialog, { passive: true });

  return { show };
}
