import { expect, test } from '@playwright/test';

test('loads the Toy edition beneath its nested platform path', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  const responses = new Map<string, number>();
  page.on('response', (response) => responses.set(new URL(response.url()).pathname, response.status()));

  await page.goto('./index.html');
  await expect(page).toHaveTitle('就位｜桌椅与显示器高度计算器');
  await expect(page.locator('[data-result="seat"]')).toBeVisible();
  await expect(page.locator('#evidence .source-links a').first()).toBeVisible();
  await expect(page.locator('#episode')).toHaveCount(0);
  await expect(page.locator('#related-links')).toHaveCount(0);

  await expect.poll(() => [...responses.keys()].some((path) => path.endsWith('/models/workstation-guide.glb'))).toBe(true);
  const clientAssets = await page.locator('link[rel="stylesheet"], link[rel="icon"], script[src]').evaluateAll((elements) => (
    elements.map((element) => new URL(
      element instanceof HTMLLinkElement ? element.href : (element as HTMLScriptElement).src,
    ).pathname)
  ));
  expect(clientAssets.some((path) => path.endsWith('.css'))).toBe(true);
  expect(clientAssets.some((path) => path.endsWith('.js'))).toBe(true);
  expect(clientAssets.every((path) => path.startsWith('/toy/jiuwei/'))).toBe(true);
  expect(clientAssets.every((path) => responses.get(path) === 200)).toBe(true);
  expect([...responses.entries()].filter(([path]) => /\.(?:css|js|png|glb)$/.test(path))).toEqual(
    expect.arrayContaining([
      expect.arrayContaining(['/toy/jiuwei/icon.png', 200]),
      expect.arrayContaining(['/toy/jiuwei/models/workstation-guide.glb', 200]),
      expect.arrayContaining(['/toy/jiuwei/models/workstation-furniture.glb', 200]),
    ]),
  );
  expect([...responses.entries()].filter(([path]) => path.startsWith('/_astro/') || path.startsWith('/models/'))).toEqual([]);
});

test('keeps calculator, scene selection, calibration, evidence, and local profile behavior', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4322/')) externalRequests.push(request.url());
  });
  await page.goto('./index.html');

  await page.getByRole('link', { name: /椅面高度来源/ }).click();
  await expect(page.locator('#evidence-seat')).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4322/toy/jiuwei/index.html');

  await page.getByRole('button', { name: '站着' }).click();
  const deskCard = page.locator('[data-result="standingDesk"]');
  const monitorCard = page.locator('[data-result="standingMonitorTop"]');
  await expect(deskCard.getByText('建议起点', { exact: true })).toBeVisible();
  await expect(deskCard.getByText(/参考范围 \d+–\d+ cm/)).toBeVisible();
  await monitorCard.getByRole('button', { name: '屏幕顶部，联动查看模型' }).click();
  await expect(monitorCard).toHaveClass(/is-active/);
  await expect(monitorCard.getByRole('button')).toHaveAttribute('aria-pressed', 'true');

  const canvas = page.locator('#workstation-canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.6, canvasBox!.y + canvasBox!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.4, canvasBox!.y + canvasBox!.height * 0.5);
  await page.mouse.up();

  await page.locator('#height-number').fill('180');
  await page.locator('#height-number').press('Enter');
  await page.getByRole('button', { name: '开始站姿检查' }).click();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await page.getByRole('button', { name: '完成检查' }).click();
  await expect(page.getByRole('button', { name: '重新检查站姿' })).toBeVisible();
  await expect(page.getByText('站姿检查已完成，进度保存在当前平台容器中。')).toBeVisible();

  await page.getByRole('button', { name: '下一项' }).click();
  await expect(page.locator('#evidence-tab-sittingDesk')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#evidence-sittingDesk .source-links a').first()).toHaveAttribute('target', '_blank');
  await page.locator('#evidence-tab-sittingDesk').press('ArrowRight');
  await expect(page.locator('#evidence-tab-standingDesk')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByLabel('身高，厘米')).toHaveValue('180');
  let profile = await page.evaluate(() => JSON.parse(localStorage.getItem('workstation-fit:profile:v2')!));
  expect(profile.calibration.standing.status).toBe('complete');

  await page.locator('#height-number').fill('181');
  await page.locator('#height-number').press('Enter');
  await page.getByRole('button', { name: '站着' }).click();
  await expect(page.getByText('身高变了，请重新检查站姿的身体位置。')).toBeVisible();
  await page.reload();
  profile = await page.evaluate(() => JSON.parse(localStorage.getItem('workstation-fit:profile:v2')!));
  expect(profile.height).toBe(181);
  expect(profile.calibration.standing.status).toBe('reconfirm');
  expect(profile).not.toHaveProperty('offsets');
  expect(externalRequests).toEqual([]);
});

test('keeps onboarding replayable and calculator usable without WebGL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*.glb', (route) => route.abort());
  await page.goto('./index.html');

  await expect(page.getByRole('dialog', { name: '先输入身高' })).toBeVisible();
  await page.getByRole('button', { name: '跳过' }).click();
  await expect(page.locator('[data-result="seat"]')).toBeVisible();
  await expect(page.getByText('这台设备暂时无法显示 3D 场景，数值计算和身体检查不受影响。')).toBeVisible();
  await page.getByRole('button', { name: '开始坐姿检查' }).click();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await expect(page.getByRole('heading', { name: '再看手肘' })).toBeVisible();
  await page.getByRole('button', { name: '稍后继续' }).click();
  await page.getByRole('button', { name: '使用说明' }).click();
  await expect(page.getByRole('dialog', { name: '先输入身高' })).toBeVisible();
  const animationDuration = await page.locator('.evidence-card.is-entering').evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).animationDuration)
  ));
  expect(animationDuration).toBeLessThan(0.001);
});
