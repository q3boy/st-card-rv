import { expect, test } from '@playwright/test';
import { boot, openPanel, rvHost } from './support';

test('标题栏「重新更新变量」与「收起」颜色可区分，深浅色都成立', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  for (const name of ['浅色', '深色']) {
    await page.getByRole('group', { name: '主题', exact: true }).getByRole('button', { name, exact: true }).click();
    const style = (selector: string) =>
      rvHost(page)
        .locator(selector)
        .evaluate(node => {
          const c = getComputedStyle(node);
          return `${c.backgroundColor}|${c.borderTopColor}|${c.color}`;
        });
    const [regen, collapse] = [await style('.regen'), await style('.collapse-button')];
    expect(regen, name).not.toBe(collapse);
    expect(regen.split('|')[1], `${name}：重新更新变量用强调色边框`).not.toBe(collapse.split('|')[1]);
  }
});
