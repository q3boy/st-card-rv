import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, openPanel, readyForScreenshot, rvHost, screenshotContent } from './support';

for (const width of [1280, 390]) {
  test(`角色卡片在${width}px明暗主题中展开显示分组信息且折叠可操作`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    await openPanel(page);
    await page.getByRole('button', { name: '角色', exact: true }).click();
    const card = rvHost(page).locator('.npc').first(),
      summary = card.locator('.card-summary');
    await expect(card.locator('.details')).toHaveCount(0);
    await summary.click();
    const groups = card.locator('.details section h3');
    await expect(groups.first()).toHaveText('外貌与穿着');
    await expect(card.locator('.details section dt').first()).toHaveText('相貌');
    await expect(card.locator('.thought h3')).toContainText('心声');
    await expect(card.locator('.details')).toContainText('NSFW信息');
    await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
    for (const [theme, name] of [
      ['浅色', 'light'],
      ['深色', 'dark'],
    ] as const) {
      await page
        .getByRole('group', { name: '主题', exact: true })
        .getByRole('button', { name: theme, exact: true })
        .click();
      await readyForScreenshot(page);
      expect(
        await rvHost(page)
          .locator('main')
          .evaluate(node => node.scrollWidth <= node.clientWidth + 1),
      ).toBe(true);
      await screenshotContent(
        page,
        '.npc.opened',
        `.test-data/card-rv/browser/screenshots/characters-${width}-${name}.png`,
      );
    }
    await rvHost(page)
      .locator('main')
      .evaluate(node => {
        node.scrollTop = 0;
      });
    await summary.click();
    await expect(card.locator('.details')).toHaveCount(0);
    await readyForScreenshot(page);
    await page.screenshot({ path: `.test-data/card-rv/browser/screenshots/characters-${width}-collapsed.png` });
    await summary.click();
    await expect(card.locator('.details')).toHaveCount(1);
  });
}
