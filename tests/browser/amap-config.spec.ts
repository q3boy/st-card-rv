import { expect, test } from '@playwright/test';
import { boot, mapLog, openPanel } from './support';
import { mkdir } from 'node:fs/promises';

test('地图无配置：密码输入、帮助链接、焦点循环与关闭保留输入', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  const key = page.getByLabel('地图 Key', { exact: true }),
    sec = page.getByLabel('安全密钥', { exact: true });
  await expect(key).toHaveAttribute('type', 'password');
  await expect(sec).toHaveAttribute('type', 'password');
  await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/map-unconfigured.png' });
  await key.fill('draft-key');
  await sec.fill('draft-sec');
  await page.getByRole('button', { name: '如何获取？' }).click();
  const dialog = page.getByRole('dialog', { name: '如何获取' }),
    close = dialog.getByRole('button', { name: '关闭', exact: true });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(dialog.locator('ol')).toHaveCSS('list-style-type', 'decimal');
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/map-help.png' });
  const links = dialog.getByRole('link');
  await expect(links.nth(0)).toHaveAttribute('href', 'https://console.amap.com/dev/key/app');
  await expect(links.nth(1)).toHaveAttribute('href', 'https://lbs.amap.com/api/javascript-api-v2/prerequisites');
  await expect(links.nth(2)).toHaveAttribute('href', 'https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode');
  await expect(links.nth(0)).toHaveAttribute('target', '_blank');
  await page.keyboard.press('Tab');
  await expect(links.nth(0)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(links.nth(2)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '如何获取？' })).toBeFocused();
  await expect(key).toHaveValue('draft-key');
  await expect(sec).toHaveValue('draft-sec');
  expect(await page.evaluate(() => (window as any).rvTest.transactions)).toBe(0);
});

test('缺一项拒绝保存；两值去首尾空白后事务保存、读回、字节重开与重新执行', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  const key = page.getByLabel('地图 Key', { exact: true }),
    sec = page.getByLabel('安全密钥', { exact: true });
  await key.fill('fake-new-key');
  await page.getByRole('button', { name: '保存并显示地图', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请填写');
  expect(await page.evaluate(() => (window as any).rvTest.transactions)).toBe(0);
  await key.fill(" fake ' <key> ");
  await sec.fill(" fake ' <sec> ");
  await page.clock.install();
  await page.getByRole('button', { name: '保存并显示地图', exact: true }).click();
  await expect(page.getByText('配置已写入，文件由助手在后台保存', { exact: true })).toBeVisible();
  await expect.poll(() => mapLog(page, 'create')).toHaveLength(1);
  await mkdir('.test-data/evidence/房车地图提示与标识', { recursive: true });
  await page.getByLabel('主角与房车地图', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-data/evidence/房车地图提示与标识/模拟浏览器-保存后宽屏.png' });
  await page.clock.runFor(5_000);
  await expect(page.getByText('配置已写入，文件由助手在后台保存', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.test-data/evidence/房车地图提示与标识/模拟浏览器-提示消失宽屏.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('主角与房车地图', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-data/evidence/房车地图提示与标识/模拟浏览器-提示消失窄屏.png' });
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开旅行手册', exact: true })).toBeVisible();
  await page.clock.runFor(50);
  await page.screenshot({ path: '.test-data/evidence/房车地图提示与标识/模拟浏览器-收起窄屏.png' });
  await openPanel(page);
  const saved = { key: "fake ' <key>", securityJsCode: "fake ' <sec>" };
  expect(await page.evaluate(() => (window as any).rvTest.config())).toEqual(saved);
  expect(await page.evaluate(() => (window as any).rvTest.reopenChar())).toEqual(saved);
  await page.evaluate(() => (window as any).rvTest.reexecute());
  await openPanel(page);
  await expect(page.getByRole('button', { name: '更改地图配置' })).toBeVisible();
  await page.getByRole('button', { name: '更改地图配置' }).click();
  await expect(key).toHaveValue(saved.key);
  await expect(sec).toHaveValue(saved.securityJsCode);
});

test('更改配置销毁旧地图；新配置保留env其它键', async ({ page }) => {
  await boot(page, { configured: true });
  await openPanel(page);
  await expect.poll(() => mapLog(page, 'create')).toHaveLength(1);
  await page.getByRole('button', { name: '更改地图配置' }).click();
  await expect.poll(() => mapLog(page, 'destroy')).toHaveLength(1);
  await page.getByLabel('地图 Key', { exact: true }).fill('changed-key');
  await page.getByLabel('安全密钥', { exact: true }).fill('changed-sec');
  await page.getByRole('button', { name: '保存并显示地图', exact: true }).click();
  await expect.poll(() => mapLog(page, 'create')).toHaveLength(2);
  expect(await page.evaluate(() => (window as any).rvTest.charRows())).toEqual([
    ['amap_key', 'changed-key'],
    ['amap_sec', 'changed-sec'],
    ['other', 'keep'],
  ]);
  expect(await page.locator('iframe[title="主角与房车位置地图"]').count()).toBe(1);
});

test('明确回滚失败保留输入、可修正重提，两次提交没有自动重发', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.evaluate(() => (window as any).rvTest.setWriteError('SQL_FAILED', 'rolled-back'));
  await page.getByLabel('地图 Key', { exact: true }).fill('draft-key');
  await page.getByLabel('安全密钥', { exact: true }).fill('draft-sec');
  const save = page.getByRole('button', { name: '保存并显示地图', exact: true });
  await page.clock.install();
  await save.click();
  await expect(page.getByRole('alert')).toHaveText('模拟配置写入错误');
  await page.clock.runFor(6_000);
  await expect(page.getByRole('alert')).toHaveText('模拟配置写入错误');
  await expect(page.getByLabel('地图 Key', { exact: true })).toHaveValue('draft-key');
  await expect(save).toBeEnabled();
  expect(await page.evaluate(() => (window as any).rvTest.transactions)).toBe(1);
  expect(await mapLog(page, 'create')).toHaveLength(0);
  await page.evaluate(() => (window as any).rvTest.setWriteError(null));
  await save.click();
  await expect.poll(() => mapLog(page, 'create')).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).rvTest.transactions)).toBe(2);
});

for (const code of ['SQL_COMMITTED', 'SQL_SAVED', 'SQL_UNKNOWN'])
  test(`${code}停止地图加载，禁止重提并提供已存配置读回`, async ({ page }) => {
    await boot(page);
    await openPanel(page);
    await page.evaluate(code => (window as any).rvTest.setWriteError(code, 'unknown'), code);
    await page.getByLabel('地图 Key', { exact: true }).fill('draft-key');
    await page.getByLabel('安全密钥', { exact: true }).fill('draft-sec');
    const save = page.getByRole('button', { name: '保存并显示地图', exact: true });
    await save.click();
    await expect(page.getByRole('alert')).toHaveText('模拟配置写入错误');
    await expect(save).toBeDisabled();
    await expect(page.getByRole('button', { name: '重新读取已存配置' })).toBeVisible();
    expect(await mapLog(page, 'create')).toHaveLength(0);
    expect(await page.evaluate(() => (window as any).rvTest.transactions)).toBe(1);
  });
