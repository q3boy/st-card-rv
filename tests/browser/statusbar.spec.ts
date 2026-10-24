import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, openPanel, readyForScreenshot, rvHost, screenshotContent } from './support';

async function screenshot(page: Page, name: string) {
  await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
  await readyForScreenshot(page);
  await page.screenshot({ path: `.test-data/card-rv/browser/screenshots/${name}.png` });
}
test('真实 iframe Vue 预编译脚本挂载 parent ShadowRoot，明暗及四个 Tab 可操作', async ({ page }) => {
  await boot(page);
  await screenshot(page, 'small-light');
  await openPanel(page);
  await expect(rvHost(page).locator('.scene h2')).toHaveText('西湖区');
  await expect(page.getByText('填写高德地图信息后显示地图')).toBeVisible();
  for (const icon of await rvHost(page).locator('.person .rv-icon, .vehicle .rv-icon').all()) {
    await expect(icon).toHaveJSProperty('tagName', 'svg');
    await expect(icon).toHaveAttribute('data-purpose', 'panel');
    const box = (await icon.boundingBox())!;
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  }
  await expect(rvHost(page).locator('img[src^="data:image/svg"]:not(.title-contours)')).toHaveCount(0);
  const border = await rvHost(page)
    .locator('.scene h2')
    .evaluate(node => getComputedStyle(node).borderBottomStyle);
  expect(border, '用 Tailwind border-b 的标题边框在 ShadowRoot 内生效').toBe('solid');
  const backgrounds = () =>
    rvHost(page)
      .locator('.person')
      .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
  const lightBackgrounds = await backgrounds();
  await screenshot(page, 'overview-light');
  await rvHost(page)
    .locator('main')
    .evaluate(node => {
      node.scrollTop = node.scrollHeight;
    });
  await screenshot(page, 'overview-lower-light');
  await screenshotContent(page, '.vehicle', '.test-data/card-rv/browser/screenshots/overview-vehicle-light.png');
  const art = (await rvHost(page).locator('.vehicle-art').boundingBox())!;
  const picture = (await rvHost(page).locator('.rv-image').boundingBox())!;
  expect(Math.abs(picture.x - art.x), '配图贴左边框').toBeLessThan(1);
  expect(Math.abs(picture.width - art.width), '配图宽度等于配图区').toBeLessThan(1);
  await rvHost(page)
    .locator('main')
    .evaluate(node => {
      node.scrollTop = 0;
    });
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '深色', exact: true })
    .click();
  await expect(rvHost(page).locator('.rv-app')).toHaveClass(/dark/);
  const darkBackgrounds = await backgrounds();
  expect(darkBackgrounds[0]).not.toBe(lightBackgrounds[0]);
  await screenshot(page, 'overview-dark');
  await rvHost(page)
    .locator('main')
    .evaluate(node => {
      node.scrollTop = node.scrollHeight;
    });
  await screenshot(page, 'overview-lower-dark');
  await screenshotContent(page, '.vehicle', '.test-data/card-rv/browser/screenshots/overview-vehicle-dark.png');
  await rvHost(page)
    .locator('main')
    .evaluate(node => {
      node.scrollTop = 0;
    });
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await screenshot(page, 'small-dark');
  await openPanel(page);
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await expect(rvHost(page).locator('.npc')).toHaveCount(3);
  await expect(rvHost(page).locator('.npc').nth(1)).toContainText('-12');
  await screenshot(page, 'characters-dark-collapsed');
  await page.getByRole('button', { name: /林清.*26岁/ }).click();
  await expect(rvHost(page).locator('.npc.opened .thought')).toContainText('美好的回忆');
  const grid = await rvHost(page)
    .locator('.npc')
    .evaluateAll(nodes =>
      nodes.map(node => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width };
      }),
    );
  expect(grid[0]!.width).toBeGreaterThan(grid[1]!.width * 1.8);
  expect(grid[1]!.y).toBe(grid[2]!.y);
  await screenshot(page, 'characters-dark-expanded');
  await screenshotContent(
    page,
    '.characters-list',
    '.test-data/card-rv/browser/screenshots/characters-dark-content.png',
  );
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '浅色', exact: true })
    .click();
  await page.getByRole('button', { name: /林清.*26岁/ }).click();
  await screenshot(page, 'characters-light-collapsed');
  await page.getByRole('button', { name: /林清.*26岁/ }).click();
  await screenshot(page, 'characters-light-expanded');
  await screenshotContent(
    page,
    '.characters-list',
    '.test-data/card-rv/browser/screenshots/characters-light-content.png',
  );
  await page.getByRole('button', { name: '房车物资', exact: true }).click();
  await expect(rvHost(page).locator('.items-tab:visible .item')).toHaveCount(3);
  await expect(rvHost(page).locator('.items-tab:visible .item').nth(1)).toContainText('0 瓶');
  await expect(rvHost(page).locator('.supplies .item-description').first()).toBeVisible();
  await screenshot(page, 'supplies-light');
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '深色', exact: true })
    .click();
  await screenshot(page, 'supplies-dark');
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '浅色', exact: true })
    .click();
  await page.getByRole('button', { name: '随身物品', exact: true }).click();
  await expect(rvHost(page).locator('.items-tab:visible .item')).toHaveCount(3);
  await expect(rvHost(page).locator('.belongings .item-description').first()).toBeVisible();
  await screenshot(page, 'belongings-light');
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '深色', exact: true })
    .click();
  await screenshot(page, 'belongings-dark');
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '浅色', exact: true })
    .click();
  await page.getByRole('button', { name: '林清', exact: true }).click();
  await expect(rvHost(page).locator('.items-tab:visible .item')).toHaveCount(1);
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await openPanel(page);
  await expect(rvHost(page).locator('.holders button[aria-pressed=true]')).toHaveText('林清');
  expect(
    await page.evaluate(() => ({
      instances: (window as any).__rvStatusbarInstances.size,
      listeners: (window as any).rvTest.listenerCount,
    })),
  ).toEqual({ instances: 1, listeners: 1 });
});

test('Tab 切换和收起保留角色展开与持有人，物品始终平铺，换聊天清除显示选择', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await page.getByRole('button', { name: /林清.*26岁/ }).click();
  await page.getByRole('button', { name: '随身物品', exact: true }).click();
  await page.getByRole('button', { name: '林清', exact: true }).click();
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await openPanel(page);
  await expect(rvHost(page).locator('.holders button[aria-pressed=true]')).toHaveText('林清');
  await expect(rvHost(page).locator('.belongings .item-description')).toHaveText(['日常使用']);
  await page.getByRole('button', { name: '旅行者', exact: true }).click();
  await expect(rvHost(page).locator('.belongings .item-description')).toHaveText([
    '记录沿途的见闻',
    '备用电池已充电',
    '旅行记录',
  ]);
  await page.getByRole('button', { name: '房车物资', exact: true }).click();
  await expect(rvHost(page).locator('.supplies .item-description')).toHaveText([
    '每袋500克，其中一袋已经开封。',
    '待补充',
    '今日早餐备用',
  ]);
  await expect(rvHost(page).locator('.items-tab .item button')).toHaveCount(0);
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await expect(rvHost(page).locator('.npc.opened')).toHaveCount(1);
  await page.evaluate(() => (window as any).rvTest.changeChat());
  await expect(rvHost(page).locator('.npc')).toHaveCount(3);
  await expect(rvHost(page).locator('.opened')).toHaveCount(0);
  await page.getByRole('button', { name: '随身物品', exact: true }).click();
  await expect(rvHost(page).locator('.holders button[aria-pressed=true]')).toHaveText('旅行者');
});

test('作者晚启动、重新注册仅保留一次订阅，关闭销毁地图，pagehide 清理所有资源', async ({ page }) => {
  await boot(page, { registered: false, configured: true });
  await openPanel(page);
  await expect(rvHost(page).locator('main')).toContainText('暂无可读状态');
  expect(await page.evaluate(() => (window as any).rvTest.registrationListenerCount)).toBe(1);
  expect(await page.evaluate(() => (window as any).rvTest.reads)).toBe(0);
  await page.evaluate(() => {
    (window as any).rvTest.register();
    (window as any).rvTest.register();
  });
  await expect(rvHost(page).locator('.scene h2')).toHaveText('西湖区');
  await expect(rvHost(page).locator('.map-canvas iframe')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).rvTest.listenerCount)).toBe(1);
  await page.evaluate(() => (window as any).rvTest.unregister());
  await expect(rvHost(page).locator('.map-canvas iframe')).toHaveCount(0);
  await expect(rvHost(page).locator('.scene h2')).toHaveText('—');
  await page.evaluate(() => (window as any).rvTest.register());
  await expect(rvHost(page).locator('.scene h2')).toHaveText('西湖区');
  await page.evaluate(() => (window as any).rvTest.close());
  await expect(rvHost(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      instances: (window as any).__rvStatusbarInstances.size,
      listeners: (window as any).rvTest.listenerCount,
      events: (window as any).rvTest.eventListenerCount,
      registration: (window as any).rvTest.registrationListenerCount,
      status: (window as any).rvTest.statusListenerCount,
    })),
  ).toEqual({ instances: 0, listeners: 0, events: 0, registration: 0, status: 0 });
});

test('重执行脚本释放旧实例，保留单个 Vue 应用与自有节点', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).rvTest.reexecute());
  await expect(rvHost(page)).toHaveCount(1);
  await expect(rvHost(page).locator('.small strong')).toHaveText('杭州市');
  expect(
    await page.evaluate(() => [
      (window as any).rvTest.listenerCount,
      (window as any).rvTest.eventListenerCount,
      (window as any).rvTest.registrationListenerCount,
    ]),
  ).toEqual([1, 5, 1]);
});

test('读取已进入后切聊天立即清空，旧批次不发布，最后一批更新可读', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.pauseReads();
    t.refresh();
  });
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.readStarted)).toBe(12);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.tables.世界信息[0].区域 = '新的营地';
    t.changeChat();
  });
  await expect(rvHost(page).locator('.scene h2')).toHaveText('—');
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await expect(rvHost(page).locator('main')).toContainText('暂无角色记录');
  await page.evaluate(() => (window as any).rvTest.releaseReads());
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await expect(rvHost(page).locator('.scene h2')).toHaveText('新的营地');
});

test('同聊天读取失败保留上次值并交付错误；swipe 改变使过时结果失效', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.stateError = '模拟没有当前状态';
    t.refresh();
  });
  await expect(rvHost(page).locator('.notice')).toContainText('显示上次已读取数据');
  await expect(rvHost(page).locator('.scene h2')).toHaveText('西湖区');
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.stateError = null;
    t.pauseReads();
    t.refresh();
  });
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.readStarted)).toBe(12);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.tables.世界信息[0].区域 = '新版本位置';
    t.swipe();
    t.releaseReads();
  });
  await expect(rvHost(page).locator('.scene h2')).toHaveText('新版本位置');
});

test('小框鼠标拖动不展开、键盘可展开、pointercancel不展开', async ({ page }) => {
  await boot(page);
  const small = rvHost(page).locator('.small'),
    box = (await small.boundingBox())!;
  await page.mouse.move(box.x + 25, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x - 160, box.y + 100, { steps: 6 });
  await page.mouse.up();
  await expect(small).toBeVisible();
  await expect(rvHost(page).locator('.large')).toBeHidden();
  await small.focus();
  await page.keyboard.press('Enter');
  await expect(rvHost(page).locator('.large')).toBeVisible();
  await page.getByRole('button', { name: '收起', exact: true }).click();
  const after = (await small.boundingBox())!;
  await page.mouse.move(after.x + 20, after.y + 20);
  await page.mouse.down();
  await small.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  await expect(small).toBeVisible();
  await small.focus();
  await page.keyboard.press('Space');
  await expect(rvHost(page).locator('.large')).toBeVisible();
});

test('长地名、有效未知文本、缺失资源与0在浏览器显示，标题不随正文滚走', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.tables.世界信息[0].城市 = '中华人民共和国旅行途中的一个很长的城市名称';
    t.tables.世界信息[0].区域 = '未知原因仍然可以保留的详细区域'.repeat(5);
    t.tables.房车信息[0].储备水源 = '未知';
    t.tables.房车信息[0].储备电力 = 0;
    t.refresh();
  });
  await expect(rvHost(page).locator('.small .district')).toContainText('未知原因');
  await openPanel(page);
  await expect(rvHost(page).locator('.resource').filter({ hasText: '电力' })).toContainText('0 / 72');
  await expect(rvHost(page).locator('.resource .track.missing')).toHaveCount(1);
  const header = (await rvHost(page).locator('.drag-title').boundingBox())!;
  await rvHost(page)
    .locator('main')
    .evaluate(node => {
      node.scrollTop = node.scrollHeight;
    });
  expect((await rvHost(page).locator('.drag-title').boundingBox())!.y).toBe(header.y);
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await expect(rvHost(page).locator('.small')).toBeVisible();
});
