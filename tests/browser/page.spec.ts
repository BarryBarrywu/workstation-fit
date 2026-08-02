import { expect, test } from '@playwright/test';

test('presents the independent calculator before evidence and related content', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');

  const sections = page.locator('main > section');
  await expect(sections).toHaveCount(5);
  await expect(sections.nth(0)).toHaveAttribute('id', 'calculator');
  await expect(sections.nth(1)).toHaveAttribute('id', 'credibility');
  await expect(sections.nth(2)).toHaveAttribute('id', 'evidence');
  await expect(sections.nth(3)).toHaveAttribute('id', 'episode');
  await expect(sections.nth(4)).toHaveAttribute('id', 'independent-footer');

  await expect(page.getByText('西昊', { exact: false })).toHaveCount(0);
  await expect(page.getByText('实时联动', { exact: false })).toHaveCount(0);
  await expect(page.getByText('滚轮缩放', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /椅面高度来源/ })).toHaveAttribute('href', '#evidence-seat');
  await expect(page.locator('#episode').getByText('待发布', { exact: true })).toHaveCount(4);
  await expect(page.locator('#episode').getByRole('link')).toHaveCount(0);
});

test('persists slider offsets locally and keeps sitting and standing separate', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4321')) externalRequests.push(request.url());
  });
  await page.goto('/');

  const seatSlider = page.getByRole('slider', { name: '微调椅面高度，厘米' });
  await seatSlider.focus();
  await seatSlider.press('End');
  await expect(seatSlider).toHaveValue('8');
  await expect(page.getByText('高 8 cm', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '站着' }).click();
  const standingDesk = page.getByRole('slider', { name: '微调桌面高度，厘米' });
  await standingDesk.focus();
  await standingDesk.press('Home');
  await expect(standingDesk).toHaveValue('-8');
  await expect(page.getByText('观看距离').locator('..').locator('..').getByRole('slider')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('slider', { name: '微调椅面高度，厘米' })).toHaveValue('8');
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('workstation-fit:profile:v1')!));
  expect(profile.offsets.seat).toBe(8);
  expect(profile.offsets.standingDesk).toBe(-8);
  expect(externalRequests).toEqual([]);
});

test('recovers safely from damaged local profile data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('workstation-fit:onboarding-seen', 'true');
    localStorage.setItem('workstation-fit:profile:v1', '{broken');
  });
  await page.goto('/');

  await expect(page.getByLabel('身高，厘米')).toHaveValue('173');
  await expect(page.getByRole('slider', { name: '微调椅面高度，厘米' })).toHaveValue('0');
});

test('completes calibration, requests reconfirmation after height changes, and resets explicitly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');

  await page.getByRole('button', { name: '开始坐姿校准' }).click();
  await expect(page.getByText('1 / 3')).toBeVisible();
  await expect(page.getByRole('heading', { name: '先看脚掌' })).toBeVisible();
  await page.getByRole('button', { name: '这一步好了' }).click();
  await expect(page.getByRole('heading', { name: '再看手肘' })).toBeVisible();
  await page.getByRole('button', { name: '这一步好了' }).click();
  await expect(page.getByRole('heading', { name: '最后看视线' })).toBeVisible();
  await page.getByRole('button', { name: '这一步好了' }).click();
  await expect(page.getByText('坐姿已校准。数值已保存在当前浏览器。')).toBeVisible();

  await page.locator('#height-number').fill('180');
  await page.locator('#height-number').press('Enter');
  await expect(page.getByText('身高已改变，请重新确认坐姿的身体接触点。')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置校准' }).click();
  await expect(page.getByRole('button', { name: '开始坐姿校准' })).toBeVisible();
});

test('onboarding is skippable, replayable, and leaves fit values unchanged', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: '先输入身高' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByRole('dialog', { name: '坐姿与站姿分开' })).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByRole('dialog', { name: '直接拖动机器人' })).toBeVisible();
  await page.getByRole('button', { name: '开始使用' }).click();

  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('workstation-fit:profile:v1')!));
  expect(profile.offsets).toEqual({
    seat: 0,
    sittingDesk: 0,
    standingDesk: 0,
    sittingMonitorTop: 0,
    standingMonitorTop: 0,
  });
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
  await page.getByRole('button', { name: '开始坐姿校准' }).click();

  const stage = page.locator('#stage');
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(2);
  expect(box!.height).toBeGreaterThan(290);
  expect(box!.height).toBeLessThan(330);
});

test('keeps calculation and calibration available without WebGL and with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*.glb', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('workstation-fit:onboarding-seen', 'true'));
  await page.goto('/');

  await expect(page.getByText('当前设备无法显示 3D 场景，数值计算与身体校准仍可正常使用。')).toBeVisible();
  await page.getByRole('button', { name: '开始坐姿校准' }).click();
  await page.getByRole('slider', { name: '微调椅面高度，厘米' }).focus();
  await page.getByRole('slider', { name: '微调椅面高度，厘米' }).press('ArrowRight');
  await expect(page.getByText('高 1 cm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '稍后继续' }).click();
  await expect(page.getByRole('button', { name: '继续坐姿校准' })).toBeVisible();
});
