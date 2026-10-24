import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, openPanel, readyForScreenshot, rvHost } from './support';

test('标题按钮调用regen，等待时防重入，收起重开保留等待并在通知后读回', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  const button = page.getByRole('button', { name: '重新更新变量', exact: true });
  await expect(button).toBeEnabled();
  await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
  for (const theme of ['浅色', '深色']) {
    await page
      .getByRole('group', { name: '主题', exact: true })
      .getByRole('button', { name: theme, exact: true })
      .click();
    await readyForScreenshot(page);
    await page.screenshot({ path: `.test-data/card-rv/browser/screenshots/regen-${theme}-wide.png` });
  }
  await button.click();
  const pending = page.getByRole('button', { name: '正在更新变量…', exact: true });
  await expect(pending).toBeDisabled();
  expect(await page.evaluate(() => (window as any).rvTest.regenCalls)).toBe(1);
  await pending.dispatchEvent('click');
  expect(await page.evaluate(() => (window as any).rvTest.regenCalls)).toBe(1);
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await openPanel(page);
  await expect(pending).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pending).toBeVisible();
  await expect(page.getByRole('button', { name: '收起', exact: true })).toBeVisible();
  await readyForScreenshot(page);
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/regen-narrow-pending.png' });
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.tables.世界信息[0].区域 = '变量更新后的地区';
    t.setUpdateStatus({ phase: 'processing', attempt: 1, maxAttempts: 3, retryDelayMs: 0 });
    t.completeRegen();
  });
  await expect(pending).toBeDisabled();
  await page.evaluate(() =>
    (window as any).rvTest.setUpdateStatus({ phase: 'idle', attempt: 0, maxAttempts: 0, retryDelayMs: 0 }),
  );
  await expect(button).toBeEnabled();
  await expect(rvHost(page).locator('.scene h2')).toHaveText('变量更新后的地区');
  await readyForScreenshot(page);
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/regen-narrow-ready.png' });
});

test('DVS未注册时禁用，失败显示原因；换聊天后不显示旧请求错误', async ({ page }) => {
  await boot(page, { registered: false });
  await openPanel(page);
  const button = page.getByRole('button', { name: '重新更新变量', exact: true });
  await expect(button).toBeDisabled();
  await page.evaluate(() => (window as any).rvTest.register());
  await expect(button).toBeEnabled();
  await button.click();
  await page.evaluate(() => (window as any).rvTest.completeRegen('模型请求失败，请检查变量模型配置。'));
  await expect(rvHost(page).getByRole('alert')).toContainText('模型请求失败');
  await expect(button).toBeEnabled();
  await page.evaluate(() =>
    (window as any).rvTest.setUpdateStatus({ phase: 'requesting', attempt: 1, maxAttempts: 3, retryDelayMs: 0 }),
  );
  await expect(rvHost(page).getByRole('alert')).toHaveCount(0);
  await page.evaluate(() =>
    (window as any).rvTest.setUpdateStatus({ phase: 'idle', attempt: 0, maxAttempts: 0, retryDelayMs: 0 }),
  );
  await button.click();
  await expect(rvHost(page).getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.changeChat();
    t.completeRegen('旧聊天已切换');
  });
  await expect(button).toBeEnabled();
  await expect(rvHost(page).getByRole('alert')).toHaveCount(0);
});

test('自动更新各阶段禁用重试按钮，新挂载读取进度，关闭和重注册清理订阅', async ({ page }) => {
  await boot(page, { updateStatus: { phase: 'requesting', attempt: 1, maxAttempts: 3, retryDelayMs: 0 } });
  await openPanel(page);
  const pending = page.getByRole('button', { name: '正在更新变量…', exact: true });
  await expect(pending).toBeDisabled();
  await pending.dispatchEvent('click');
  expect(await page.evaluate(() => (window as any).rvTest.regenCalls)).toBe(0);
  for (const phase of ['preparing', 'processing']) {
    await page.evaluate(
      phase => (window as any).rvTest.setUpdateStatus({ phase, attempt: 1, maxAttempts: 3, retryDelayMs: 0 }),
      phase,
    );
    await expect(pending).toBeDisabled();
  }
  await page.evaluate(() =>
    (window as any).rvTest.setUpdateStatus({ phase: 'retrying', attempt: 1, maxAttempts: 3, retryDelayMs: 1000 }),
  );
  const retrying = page.getByRole('button', { name: '等待重试（第 2/3 次）', exact: true });
  await expect(retrying).toBeDisabled();
  await readyForScreenshot(page);
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/regen-auto-retry-wide.png' });
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开旅行手册', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await openPanel(page);
  await expect(retrying).toBeDisabled();
  await readyForScreenshot(page);
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/regen-auto-retry-narrow.png' });
  await page.evaluate(() => (window as any).rvTest.reexecute());
  await openPanel(page);
  await expect(retrying).toBeDisabled();
  expect(await page.evaluate(() => (window as any).rvTest.statusListenerCount)).toBe(1);
  await page.evaluate(() => (window as any).rvTest.unregister());
  expect(await page.evaluate(() => (window as any).rvTest.statusListenerCount)).toBe(0);
  const available = page.getByRole('button', { name: '重新更新变量', exact: true });
  await expect(available).toBeDisabled();
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.setUpdateStatus({ phase: 'idle', attempt: 0, maxAttempts: 0, retryDelayMs: 0 });
    t.register();
    t.register();
  });
  await expect(available).toBeEnabled();
  expect(await page.evaluate(() => (window as any).rvTest.statusListenerCount)).toBe(1);
  await page.evaluate(() => (window as any).rvTest.close());
  expect(await page.evaluate(() => (window as any).rvTest.statusListenerCount)).toBe(0);
});
