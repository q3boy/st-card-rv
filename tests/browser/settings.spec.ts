import { expect, test } from '@playwright/test';
import { boot, openPanel, rvHost } from './support';

test('设置弹窗读取并联动输入增强与剧情规划', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await rvHost(page).getByRole('button', { name: '设置', exact: true }).click();
  const dialog = rvHost(page).getByRole('dialog', { name: '设置' });
  const filter = dialog.getByRole('switch', { name: /^输入增强/ }),
    plot = dialog.getByRole('switch', { name: /^剧情规划/ });
  await expect(filter).toBeChecked();
  await expect(plot).toBeChecked();
  await expect(dialog).toContainText('额外请求一次输入增强模型');
  await filter.click();
  await expect(filter).not.toBeChecked();
  await expect(plot).not.toBeChecked();
  await expect(plot).toBeDisabled();
  expect(await page.evaluate(() => (window as any).rvTest.injectSets)).toEqual([{ filter: false, plot: false }]);
  await filter.click();
  await expect(plot).toBeEnabled();
  await plot.click();
  await expect(plot).toBeChecked();
  expect(await page.evaluate(() => (window as any).rvTest.inject)).toEqual({ filter: true, plot: true });
  await dialog.getByRole('button', { name: '关闭' }).click();
  await expect(dialog).toHaveCount(0);
});

test('开关读取失败时显示原因且不出现开关', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => ((window as any).rvTest.injectError = 'DVS 注册已关闭'));
  await openPanel(page);
  await rvHost(page).getByRole('button', { name: '设置', exact: true }).click();
  const dialog = rvHost(page).getByRole('dialog', { name: '设置' });
  await expect(dialog.getByRole('alert')).toContainText('DVS 注册已关闭');
  await expect(dialog.getByRole('switch')).toHaveCount(0);
});
