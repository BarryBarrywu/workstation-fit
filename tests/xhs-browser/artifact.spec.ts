import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const artifactUrl = pathToFileURL(resolve('dist/xhs-mini-tool/unpacked/index.html')).href;

test('requires a valid confirmed height before showing personal fit estimates', async ({ page }) => {
  await page.goto(artifactUrl);

  await expect(page.getByRole('heading', { name: '先确认你的身高' })).toBeVisible();
  await expect(page.getByText('身高和检查进度只保存在这个小工具里，不会上传')).toBeVisible();
  await expect(page.locator('[data-testid="fit-results"]')).toHaveCount(0);

  const height = page.getByLabel('身高（厘米）');
  await height.fill('abc');
  await page.getByRole('button', { name: '查看调节起点' }).click();
  await expect(height).toHaveValue('abc');
  await expect(page.getByText('请输入 145–205 cm 之间的身高')).toBeVisible();

  await height.fill('140');
  await page.getByRole('button', { name: '查看调节起点' }).click();
  await expect(height).toHaveValue('140');
  await expect(page.getByText('请输入 145–205 cm 之间的身高')).toBeVisible();
  await expect(page.locator('[data-testid="fit-results"]')).toHaveCount(0);

  await height.fill('173');
  await page.getByRole('button', { name: '查看调节起点' }).click();
  await expect(page.locator('[data-testid="fit-results"]')).toBeVisible();
  await expect(page.getByText('建议起点', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/参考范围 \d+–\d+ cm/).first()).toBeVisible();
});

test('shows condensed evidence status and updates the 2D diagram', async ({ page }) => {
  await page.goto(artifactUrl);
  await page.getByLabel('身高（厘米）').fill('205');
  await page.getByRole('button', { name: '查看调节起点' }).click();

  await expect(page.getByText('趋势估算', { exact: true })).toHaveCount(3);
  const deskEvidence = page.locator('.evidence-details').filter({ hasText: '桌面高度的精简证据链' });
  await deskEvidence.getByText('桌面高度的精简证据链').click();
  await expect(deskEvidence.getByText(/覆盖：143–186 cm/)).toBeVisible();
  await expect(deskEvidence.getByText(/转换：/)).toBeVisible();
  await expect(deskEvidence.getByText(/限制：/)).toBeVisible();

  const diagram = page.getByTestId('fit-diagram');
  await expect(diagram).toHaveAttribute('data-posture', 'sitting');
  const tallSeatY = await diagram.getAttribute('data-seat-y');
  const tallHeadY = await diagram.getAttribute('data-head-y');
  await page.getByRole('button').filter({ hasText: '屏幕顶部' }).click();
  await expect(diagram).toHaveAttribute('data-selected', 'sittingMonitorTop');
  await page.getByRole('button', { name: /站姿/ }).click();
  await expect(diagram).toHaveAttribute('data-posture', 'standing');
  await expect(page.getByRole('button', { name: /椅面高度/ })).toHaveCount(0);

  await page.getByLabel('身高（厘米）').fill('145');
  await page.getByRole('button', { name: '查看调节起点' }).click();
  await page.getByRole('button', { name: /坐姿/ }).click();
  await expect(diagram).not.toHaveAttribute('data-seat-y', tallSeatY!);
  await expect(diagram).not.toHaveAttribute('data-head-y', tallHeadY!);
});

test('completes sitting and standing independently, restores them, then requests reconfirmation', async ({ page }) => {
  await page.goto(artifactUrl);
  await page.getByLabel('身高（厘米）').fill('173');
  await page.getByRole('button', { name: '查看调节起点' }).click();

  await page.getByRole('button', { name: '开始坐姿检查' }).click();
  await expect(page.getByText('1 / 3')).toBeVisible();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await expect(page.getByText('屏幕观看距离可先从 50–75 cm 检查')).toBeVisible();
  await page.getByRole('button', { name: '完成当前姿势' }).click();
  await expect(page.getByText('坐姿检查已完成')).toBeVisible();

  await page.getByRole('button', { name: '站姿' }).click();
  await expect(page.getByRole('button', { name: '开始站姿检查' })).toBeVisible();
  await page.getByRole('button', { name: '开始站姿检查' }).click();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await expect(page.getByText('屏幕观看距离可先从 50–75 cm 检查')).toBeVisible();
  await page.getByRole('button', { name: '完成当前姿势' }).click();
  await expect(page.getByText('站姿检查已完成')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('身高（厘米）')).toHaveValue('173');
  await expect(page.getByText('站姿检查已完成')).toBeVisible();
  await page.getByRole('button', { name: /坐姿 · 已完成/ }).click();
  await expect(page.getByText('坐姿检查已完成')).toBeVisible();

  await page.getByLabel('身高（厘米）').fill('180');
  await page.getByRole('button', { name: '查看调节起点' }).click();
  await expect(page.getByText('身高变了，请重新确认坐姿的身体位置。')).toBeVisible();
  await expect(page.getByRole('button', { name: /站姿 · 待确认/ })).toBeVisible();
});

test('returns damaged or internally inconsistent local state to the unconfirmed first-use screen', async ({ page }) => {
  await page.goto(artifactUrl);
  await page.evaluate(() => localStorage.setItem('jiuwei:xhs-mini-tool:profile:v1', '{broken'));
  await page.reload();

  await expect(page.getByLabel('身高（厘米）')).toHaveValue('');
  await expect(page.locator('[data-testid="fit-results"]')).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('jiuwei:xhs-mini-tool:profile:v1', JSON.stringify({
    version: 1,
    confirmedHeight: 173,
    posture: 'sitting',
    selected: 'sittingDesk',
    calibration: {
      sitting: { step: 0, status: 'complete' },
      standing: { step: 0, status: 'not-started' },
    },
  })));
  await page.reload();
  await expect(page.getByLabel('身高（厘米）')).toHaveValue('');
  await expect(page.locator('[data-testid="fit-results"]')).toHaveCount(0);
});

test('works without HTTP requests or permissions and honors reduced motion', async ({ page }) => {
  const networkRequests: string[] = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url())) networkRequests.push(request.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(artifactUrl);
  await page.getByLabel('身高（厘米）').fill('145');
  await page.getByRole('button', { name: '查看调节起点' }).click();
  await page.locator('html').evaluate((element) => {
    element.style.setProperty('--safe-area-inset-top', '20px');
    element.style.setProperty('--safe-area-inset-bottom', '16px');
  });

  expect(networkRequests).toEqual([]);
  await expect(page.getByTestId('fit-diagram')).toBeVisible();
  expect(await page.locator('.diagram-accent').first().evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  const shellWidth = await page.locator('.app-shell').evaluate((element) => element.getBoundingClientRect().width);
  expect(shellWidth).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(await page.locator('.app-shell').evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop))).toBe(36);
});
