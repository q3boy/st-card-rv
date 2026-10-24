import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, openPanel, rvHost } from './support';

async function visibleAndHit(page: Page, locator: Locator) {
  await expect
    .poll(async () =>
      locator.evaluate(element => {
        const rect = element.getBoundingClientRect(),
          vv = window.visualViewport;
        const left = vv?.offsetLeft ?? 0,
          top = vv?.offsetTop ?? 0,
          right = left + (vv?.width ?? innerWidth),
          bottom = top + (vv?.height ?? innerHeight);
        const x = rect.x + rect.width / 2,
          y = rect.y + rect.height / 2;
        const root = element.getRootNode() as ShadowRoot;
        const hit = root.elementFromPoint(x, y);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= left - 1 &&
          rect.top >= top - 1 &&
          rect.right <= right + 1 &&
          rect.bottom <= bottom + 1 &&
          !!hit &&
          (hit === element || element.contains(hit))
        );
      }),
    )
    .toBe(true);
}
for (const [width, height] of [
  [1280, 900],
  [900, 640],
  [800, 900],
  [650, 900],
  [520, 900],
  [390, 844],
  [320, 700],
  [320, 568],
  [800, 360],
  [320, 240],
]) {
  test(`${width}×${height} 小框及标题操作区在可见窗口，实点击可展开/收起和标题拖动`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await boot(page);
    const small = rvHost(page).locator('.small'),
      title = rvHost(page).locator('.drag-title');
    await visibleAndHit(page, small);
    await small.click();
    await visibleAndHit(page, title);
    await visibleAndHit(page, page.getByRole('button', { name: '收起', exact: true }));
    const box = (await title.boundingBox())!;
    const book = (await rvHost(page).locator('.book-title').boundingBox())!;
    await page.mouse.move(book.x + 10, book.y + 10);
    await page.mouse.down();
    await page.mouse.move(book.x - 35, book.y + 20, { steps: 4 });
    await page.mouse.up();
    await visibleAndHit(page, title);
    const after = (await title.boundingBox())!;
    expect(after.y).toBeGreaterThanOrEqual(0);
    await page.getByRole('button', { name: '收起', exact: true }).click();
    await visibleAndHit(page, small);
    await small.click();
    const percentages = await rvHost(page)
      .locator('.resource-percent')
      .evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    expect(Math.max(...percentages) - Math.min(...percentages), '三位百分比与其它资源一样保持单行').toBeLessThan(1);
    if (width === 390) {
      await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
      await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/overview-narrow-light.png' });
      await page
        .getByRole('group', { name: '主题', exact: true })
        .getByRole('button', { name: '深色', exact: true })
        .click();
      await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/overview-narrow-dark.png' });
      await page.getByRole('button', { name: '如何获取？' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/map-help-narrow.png' });
      await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.getByRole('button', { name: '如何获取？' })).toBeFocused();
      await rvHost(page)
        .locator('main')
        .evaluate(node => {
          node.scrollTop = node.scrollHeight;
        });
      await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/overview-narrow-lower-dark.png' });
      await page
        .getByRole('group', { name: '主题', exact: true })
        .getByRole('button', { name: '浅色', exact: true })
        .click();
      await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/overview-narrow-lower-light.png' });
      await page
        .getByRole('group', { name: '主题', exact: true })
        .getByRole('button', { name: '深色', exact: true })
        .click();
      for (const [tab, name] of [
        ['角色', 'characters'],
        ['房车物资', 'supplies'],
        ['随身物品', 'belongings'],
      ] as const) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        await rvHost(page)
          .locator('main')
          .evaluate(node => {
            node.scrollTop = 0;
          });
        if (tab === '角色') await page.getByRole('button', { name: /林清.*26岁/ }).click();
        else await expect(rvHost(page).locator(`.${name} .item-description`).first()).toBeVisible();
        await page.screenshot({ path: `.test-data/card-rv/browser/screenshots/${name}-narrow-dark.png` });
      }
    }
    if (height === 240) {
      await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
      await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/title-small-window.png' });
    }
  });
}

test('拖至右下后缩窗，设置面板及高层背景存在仍能点击', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'settings-panel';
    overlay.style.cssText = 'position:fixed;inset:0;background:#34434b;color:white;z-index:2147483000';
    overlay.textContent = '模拟酒馆设置面板（保持打开）';
    document.body.append(overlay);
  });
  const small = rvHost(page).locator('.small'),
    box = (await small.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(1270, 890, { steps: 7 });
  await page.mouse.up();
  await page.setViewportSize({ width: 320, height: 240 });
  await visibleAndHit(page, small);
  await small.click();
  await visibleAndHit(page, rvHost(page).locator('.drag-title'));
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await page.setViewportSize({ width: 900, height: 640 });
  await visibleAndHit(page, small);
  await small.click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/settings-overlay.png' });
});

test('80%/100%/125%/200%对应的布局视口与真实 pinch visualViewport 缩放可操作', async ({ page }) => {
  await boot(page);
  // Equivalent CSS layout viewport changes; this is not browser menu zoom or CSS zoom.
  for (const scale of [0.8, 1, 1.25, 2]) {
    await page.setViewportSize({ width: Math.round(1280 / scale), height: Math.round(900 / scale) });
    await visibleAndHit(page, rvHost(page).locator('.small'));
    await openPanel(page);
    await visibleAndHit(page, rvHost(page).locator('.drag-title'));
    await page.getByRole('button', { name: '收起', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => visualViewport?.scale)).toBe(2);
  await visibleAndHit(page, rvHost(page).locator('.small'));
  await openPanel(page);
  await visibleAndHit(page, rvHost(page).locator('.drag-title'));
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await cdp.detach();
});

test('真实触摸移动与取消，地图手势不拖动外框', async ({ page }) => {
  await boot(page, { configured: true });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const small = rvHost(page).locator('.small'),
    box = (await small.boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 20, y: box.y + 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x - 100, y: box.y + 70 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(small).toBeVisible();
  const moved = (await small.boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: moved.x + 20, y: moved.y + 20 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(small).toBeVisible();
  await small.focus();
  await page.keyboard.press('Enter');
  await expect(rvHost(page).locator('.map-canvas iframe')).toHaveCount(1);
  const before = (await rvHost(page).locator('.large').boundingBox())!,
    mapBox = (await rvHost(page).locator('.map-canvas').boundingBox())!;
  await page.mouse.move(mapBox.x + 30, mapBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + 90, mapBox.y + 70);
  await page.mouse.up();
  const after = (await rvHost(page).locator('.large').boundingBox())!;
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
  await cdp.detach();
});

test('按住小框拖动期间缩窗，继续移动沿修正后的坐标而不会跳回旧位置', async ({ page }) => {
  await boot(page);
  const small = rvHost(page).locator('.small'),
    before = (await small.boundingBox())!;
  await page.mouse.move(before.x + 20, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(290, 120, { steps: 8 });
  await expect.poll(async () => Math.round((await small.boundingBox())!.x)).toBe(270);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => Math.round((await small.boundingBox())!.x)).toBe(182);
  await page.mouse.move(280, 120);
  await expect.poll(async () => Math.round((await small.boundingBox())!.x)).toBe(172);
  await page.mouse.up();
  await expect(small).toBeVisible();
  await small.click();
  await expect(rvHost(page).locator('.large')).toBeVisible();
});
