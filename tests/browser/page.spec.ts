import { expect, test } from '@playwright/test';

test('presents the independent calculator before evidence and related content', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  const sections = page.locator('main > section');
  await expect(sections).toHaveCount(5);
  await expect(sections.nth(0)).toHaveAttribute('id', 'calculator');
  await expect(sections.nth(1)).toHaveAttribute('id', 'evidence');
  await expect(sections.nth(2)).toHaveAttribute('id', 'episode');
  await expect(sections.nth(3)).toHaveAttribute('id', 'related-links');
  await expect(sections.nth(4)).toHaveAttribute('id', 'independent-footer');

  await expect(page.getByText('西昊', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '按身高，调桌椅。' })).toBeVisible();
  await expect(page.getByText('输入身高，拿到适合你的椅子、桌子和屏幕高度。')).toBeVisible();
  await expect(page.getByText('实时联动', { exact: false })).toHaveCount(0);
  await expect(page.getByText('滚轮缩放', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /椅面高度来源/ })).toHaveAttribute('href', '#evidence-seat');
  await expect(page.locator('#episode').getByText('待发布', { exact: true })).toHaveCount(5);
  await expect(page.locator('#episode .brand-icon')).toHaveCount(6);
  await expect(page.locator('#episode .platform-links')).toHaveAttribute('aria-label', '视频发布平台与本期商品链接');
  await expect(page.locator('#episode .platform-links > span').filter({ hasText: '小红书' })).toBeVisible();
  await expect(page.locator('#episode .platform-links > span')).toHaveCount(6);
  const productLinkPlaceholder = page.locator('#episode .platform-links > span').filter({ hasText: '本期商品链接' });
  await expect(productLinkPlaceholder).toBeVisible();
  await expect(productLinkPlaceholder).toContainText('待补充');
  await expect(page.locator('#episode').getByRole('link')).toHaveCount(0);
  await expect(page.locator('#related-links a[href="https://github.com/BarryBarrywu/workstation-fit"]')).toContainText('暂未公开');
  await expect(page.locator('#related-links a[href="https://tutti.barrybarrywu.com/zh/"]')).toContainText('了解 Tutti');

  await page.getByRole('link', { name: /屏幕顶部来源/ }).click();
  await expect(page.locator('#evidence-sittingMonitorTop')).toBeVisible();
  await expect(page.locator('#evidence-tab-sittingMonitorTop')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/#evidence-sittingMonitorTop$/);
});

test('shows suggested starts and reference ranges without numeric adjustment controls', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4321')) externalRequests.push(request.url());
  });
  await page.goto('/');

  const seatCard = page.locator('[data-result="seat"]');
  const deskCard = page.locator('[data-result="sittingDesk"]');
  const monitorCard = page.locator('[data-result="sittingMonitorTop"]');
  const seatViewButton = seatCard.getByRole('button', { name: '椅面高度，联动查看模型' });
  const deskViewButton = deskCard.getByRole('button', { name: '桌面高度，联动查看模型' });
  await expect(seatCard.getByText('建议起点', { exact: true })).toBeVisible();
  await expect(seatCard.getByText(/参考范围 \d+–\d+ cm/)).toBeVisible();
  await expect(seatViewButton).toHaveAttribute('aria-pressed', 'false');
  await expect(seatViewButton).toContainText('查看模型');
  await expect(deskViewButton).toHaveAttribute('aria-pressed', 'true');
  await expect(deskViewButton).toContainText('正在查看');
  await seatViewButton.click();
  await expect(seatCard).toHaveClass(/is-active/);
  await expect(seatViewButton).toHaveAttribute('aria-pressed', 'true');
  await expect(deskViewButton).toHaveAttribute('aria-pressed', 'false');
  await monitorCard.locator('.result-copy').click();
  await expect(monitorCard).toHaveClass(/is-active/);
  await expect(page.getByText('身体微调', { exact: true })).toHaveCount(0);
  await expect(page.locator('#results').getByRole('slider')).toHaveCount(0);
  await expect(page.locator('.dimension-label.is-active')).toHaveText(/建议 \d+ cm/);
  const visibleLabels = await page.locator('.dimension-label').evaluateAll((labels) => labels.filter((label) => {
    const style = getComputedStyle(label);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }).length);
  expect(visibleLabels).toBe(testInfo.project.name === 'mobile' ? 1 : 3);

  await page.locator('#height-number').fill('180');
  await page.locator('#height-number').press('Enter');

  await page.reload();
  await expect(page.getByLabel('身高，厘米')).toHaveValue('180');
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('workstation-fit:profile:v2')!));
  expect(profile.height).toBe(180);
  expect(profile).not.toHaveProperty('offsets');
  expect(externalRequests).toEqual([]);
});

test('recovers safely from damaged local profile data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('workstation-fit:onboarding-seen', 'true');
    localStorage.setItem('workstation-fit:profile:v1', '{broken');
  });
  await page.goto('/');

  await expect(page.getByLabel('身高，厘米')).toHaveValue('173');
  await expect(page.locator('[data-result="seat"]').getByText('建议起点', { exact: true })).toBeVisible();
});

test('completes physical checks and requests reconfirmation after height changes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');

  await page.getByRole('button', { name: '开始坐姿检查' }).click();
  await expect(page.getByText('1 / 3')).toBeVisible();
  await expect(page.getByRole('heading', { name: '先看脚掌' })).toBeVisible();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await expect(page.getByRole('heading', { name: '再看手肘' })).toBeVisible();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await expect(page.getByRole('heading', { name: '最后看视线' })).toBeVisible();
  await page.getByRole('button', { name: '完成检查' }).click();
  await expect(page.getByText('坐姿检查已完成，进度保存在当前浏览器中。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新检查坐姿' })).toBeVisible();

  await page.locator('#height-number').fill('180');
  await page.locator('#height-number').press('Enter');
  await expect(page.getByText('身高变了，请重新检查坐姿的身体位置。')).toBeVisible();

  await expect(page.getByRole('button', { name: '重新检查坐姿' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重置校准' })).toHaveCount(0);
});

test('supports pausing and completing standing checks independently', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: '站着' }).click();
  await page.getByRole('button', { name: '开始站姿检查' }).click();
  await expect(page.getByText('1 / 2')).toBeVisible();
  await page.getByRole('button', { name: '稍后继续' }).click();
  await expect(page.getByRole('button', { name: '继续站姿检查' })).toBeVisible();
  await page.getByRole('button', { name: '继续站姿检查' }).click();
  await expect(page.getByRole('button', { name: '跳过校准' })).toHaveCount(0);
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await page.getByRole('button', { name: '完成检查' }).click();
  await expect(page.getByRole('button', { name: '重新检查站姿' })).toBeVisible();
});

test('onboarding is skippable, replayable, and leaves fit values unchanged', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: '先输入身高' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByRole('dialog', { name: '坐姿与站姿分开' })).toBeVisible();
  await expect(page.getByText('坐姿和站姿的检查进度分别保存，切换时互不影响。')).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByRole('dialog', { name: '直接拖动机器人' })).toBeVisible();
  await page.getByRole('button', { name: '开始使用' }).click();

  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('workstation-fit:profile:v2')!));
  expect(profile).not.toHaveProperty('offsets');
  await page.reload();
  await expect(page.locator('#onboarding-dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '使用说明' }).click();
  await expect(page.getByRole('dialog', { name: '先输入身高' })).toBeVisible();
  await page.getByRole('button', { name: '跳过' }).click();
});

test('uses a compact top 3D viewport during mobile calibration', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: '开始坐姿检查' }).click();

  const stage = page.locator('#stage');
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(2);
  expect(box!.height).toBeGreaterThan(290);
  expect(box!.height).toBeLessThan(330);
  await expect(page.getByRole('heading', { name: '先看脚掌' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText('先坐到底并靠住椅背', { exact: false })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '稍后继续' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '已调整，下一步' })).toBeInViewport({ ratio: 1 });
});

test('keeps calculation and calibration available without WebGL and with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*.glb', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');

  await expect(page.getByText('这台设备暂时无法显示 3D 场景，数值计算和身体检查不受影响。')).toBeVisible();
  await page.getByRole('button', { name: '开始坐姿检查' }).click();
  await page.getByRole('button', { name: '已调整，下一步' }).click();
  await expect(page.getByRole('heading', { name: '再看手肘' })).toBeVisible();
  await page.getByRole('button', { name: '稍后继续' }).click();
  await expect(page.getByRole('button', { name: '继续坐姿检查' })).toBeVisible();
});
