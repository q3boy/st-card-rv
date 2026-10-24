import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, mapLog, openPanel, readyForScreenshot, rvHost, screenshotContent } from './support';

const directory = '.test-data/card-rv/browser/screenshots';
async function capture(page: Page, name: string, selector = '.large') {
  await mkdir(directory, { recursive: true });
  await readyForScreenshot(page);
  const path = `${directory}/cabin-${name}.png`;
  if (['.person', '.vehicle'].includes(selector)) await screenshotContent(page, selector, path);
  else await rvHost(page).locator(selector).screenshot({ path });
}
async function theme(page: Page, dark: boolean) {
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: dark ? '深色' : '浅色', exact: true })
    .click();
}

for (const dark of [false, true])
  test(`居住舱${dark ? '深' : '浅'}色同聊天切图不重建应用、地图或清除选择`, async ({ page }) => {
    await boot(page, { configured: true });
    await openPanel(page);
    await theme(page, dark);
    await page.evaluate(() => {
      const t = (window as any).rvTest;
      Object.assign(t.tables.世界信息[0], {
        日期时间: '2026-06-05 13:10',
        省份: '云南省',
        城市: '昆明市',
        区域: '西山区',
        天气: '晴 26°C～17°C\n风力2级 · 降雨0mm/h',
      });
      Object.assign(t.tables.主角信息[0], {
        当前位置: '滇池房车营地，房车内',
        状态: '午间驻车休息，在车内饮水',
        资金: 120000000,
        粉丝数量: 10000000,
      });
      Object.assign(t.tables.房车信息[0], { 油料: 992.9, 储备电力: 71.9, 储备水源: 998.8, 所在地点: '滇池房车营地' });
      t.refresh();
    });
    await expect(rvHost(page).locator('.scene h2')).toHaveText('西山区');
    await expect.poll(() => mapLog(page, 'create')).toHaveLength(1);
    await readyForScreenshot(page);
    const initial = await rvHost(page).evaluate(node => {
      (window as any).cabinHost = node;
      return (window as any).rvTest.mapQueries.length;
    });
    await page.getByRole('button', { name: '角色', exact: true }).click();
    await page.getByRole('button', { name: /林清.*26岁/ }).click();
    await page.getByRole('button', { name: '随身物品', exact: true }).click();
    await page.getByRole('button', { name: '林清', exact: true }).click();
    await page.getByRole('button', { name: '总览', exact: true }).click();
    const pictures: Record<string, string> = {};
    for (const [drive, expand, art, label, name] of [
      ['驻车', '收起', 'park', '驻车', 'parked'],
      ['行车', '收起', 'drive', '行车', 'driving'],
      ['驻车', '展开', 'expand', '拓展展开', 'expanded'],
    ] as const) {
      await page.evaluate(
        ([drive, expand]) => {
          const t = (window as any).rvTest;
          Object.assign(t.tables.房车信息[0], { 行车状态: drive, 拓展状态: expand });
          t.refresh();
        },
        [drive, expand],
      );
      await expect(rvHost(page).locator('.rv-image')).toHaveAttribute('data-art', art);
      await expect(rvHost(page).locator('.rv-art-label')).toHaveText(label);
      await readyForScreenshot(page);
      pictures[name] = (await rvHost(page).locator('.rv-image').getAttribute('src')) ?? '';
      await rvHost(page)
        .locator('main')
        .evaluate(node => {
          node.scrollTop = 0;
        });
      await capture(page, `${dark ? 'dark' : 'light'}-${name}-upper`);
      await rvHost(page)
        .locator('main')
        .evaluate(node => {
          node.scrollTop = node.scrollHeight;
        });
      await capture(page, `${dark ? 'dark' : 'light'}-${name}-lower`);
    }
    expect(new Set(Object.values(pictures)).size).toBe(3);
    await page.evaluate(() => {
      const t = (window as any).rvTest;
      t.tables.主角信息[0].状态 = '行车';
      Object.assign(t.tables.房车信息[0], { 行车状态: '行车', 拓展状态: '展开' });
      t.refresh();
    });
    await expect(rvHost(page).locator('.person')).toContainText('行车');
    await expect(rvHost(page).locator('.rv-image')).toHaveAttribute('data-art', 'drive');
    await expect(rvHost(page).locator('.rv-art-label')).toHaveText('行车');
    expect(await rvHost(page).evaluate(node => node === (window as any).cabinHost)).toBe(true);
    expect(await mapLog(page, 'create')).toHaveLength(1);
    expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(initial);
    await page.getByRole('button', { name: '角色', exact: true }).click();
    await expect(rvHost(page).locator('.npc.opened')).toHaveCount(1);
    await page.getByRole('button', { name: '随身物品', exact: true }).click();
    await expect(rvHost(page).locator('.holders [aria-pressed=true]')).toHaveText('林清');
    await capture(page, `${dark ? 'dark' : 'light'}-second-holder`);
  });

test('居住舱两主题宽中窄布局、长文本与双插画保持正常文档流', async ({ page }) => {
  await boot(page, { configured: true });
  await openPanel(page);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.tables.主角信息[0].状态 = '在营地整理旅行记录，检查桌椅和照明，准备下一段旅途。'.repeat(6);
    t.tables.房车信息[0].状态 = '驻车，检查完毕，车内电器正常工作。'.repeat(7);
    t.tables.房车信息[0].所在地点 = '湖畔营地靠近入口的独立停车区'.repeat(3);
    t.refresh();
  });
  await expect(rvHost(page).locator('.person')).toContainText('整理旅行记录');
  for (const width of [1280, 800, 651, 650, 520, 390, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
    for (const dark of [false, true]) {
      await theme(page, dark);
      await readyForScreenshot(page);
      const result = await rvHost(page)
        .locator('.person, .vehicle')
        .evaluateAll(cards =>
          cards.map(card => {
            const art = card.querySelector('.illustration-art'),
              image = art?.querySelector('img');
            const c = card.getBoundingClientRect(),
              a = art?.getBoundingClientRect(),
              i = image?.getBoundingClientRect();
            return {
              hasArt: !!art,
              artWidth: a?.width ?? 0,
              imageWidth: i?.width ?? 0,
              artBottom: a?.bottom ?? 0,
              imageBottom: i?.bottom ?? 0,
              cardBottom: c.bottom,
              cardWidth: c.width,
              overflow: card.scrollWidth > card.clientWidth,
              x: c.x,
            };
          }),
        );
      for (const card of result) {
        expect(card.overflow).toBe(false);
      }
      const [rvCard, person] = [result[0]!, result[1]!];
      expect(person.hasArt, '主角卡只放文字，没有插画').toBe(false);
      expect(rvCard.imageWidth, '配图宽度等于配图区宽度（贴左右边框）').toBeCloseTo(rvCard.artWidth, 1);
      expect(rvCard.cardWidth - rvCard.artWidth, '配图区贴左右边框，只差卡片两侧 1px 边框').toBeLessThanOrEqual(2.5);
      expect(rvCard.artBottom - rvCard.imageBottom, '图片底边对齐配图区底边').toBeCloseTo(0, 1);
      expect(rvCard.cardBottom - rvCard.artBottom, '配图区贴卡片底边').toBeLessThanOrEqual(2.5);
      expect(Math.abs(rvCard.x - person.x) < 1).toBe(width <= 650);
      for (const [selector, part] of [
        ['.person', 'protagonist'],
        ['.vehicle', 'rv'],
      ] as const) {
        await rvHost(page).locator(selector).scrollIntoViewIfNeeded();
        await capture(page, `${dark ? 'dark' : 'light'}-long-${width}-${part}`, selector);
      }
    }
  }
});

test('居住舱断点两侧按实际卡坐标验证物品列数和角色分组', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  for (const [width, columns] of [
    [801, 3],
    [800, 2],
    [799, 2],
    [521, 2],
    [520, 1],
    [519, 1],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '房车物资', exact: true }).click();
    const positions = await rvHost(page)
      .locator('.supplies .item')
      .evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
    expect(positions.filter(y => Math.abs(y - positions[0]!) < 1)).toHaveLength(columns);
  }
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await page.getByRole('button', { name: /林清.*26岁/ }).click();
  for (const width of [651, 650, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const columns = rvHost(page).locator('.npc.opened .detail-column');
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0).locator('h3')).toHaveText(['外貌与穿着', '背景与处境']);
    await expect(columns.nth(1).locator('h3')).toHaveText(['性格与表达', '相遇与关系']);
    const boxes = await columns.evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x));
    expect(Math.abs(boxes[0]! - boxes[1]!) < 1).toBe(width <= 650);
  }
});

test('居住舱390px两主题四Tab、系统主题及地图错误帮助状态留图', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await openPanel(page);
  for (const dark of [false, true]) {
    await theme(page, dark);
    for (const [tab, name] of [
      ['总览', 'overview'],
      ['角色', 'characters'],
      ['房车物资', 'supplies'],
      ['随身物品', 'belongings'],
    ] as const) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      if (tab === '角色') await page.getByRole('button', { name: /林清.*26岁/ }).click();
      await capture(page, `${dark ? 'dark' : 'light'}-${name}-390`);
    }
    await page.getByRole('button', { name: '总览', exact: true }).click();
    await page.getByRole('button', { name: '如何获取？' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, `${dark ? 'dark' : 'light'}-map-help-390`, '.help-backdrop');
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '收起', exact: true }).click();
    await capture(page, `${dark ? 'dark' : 'light'}-small-390`, '.small');
    await openPanel(page);
  }
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '跟随系统', exact: true })
    .click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(rvHost(page).locator('.rv-app')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(rvHost(page).locator('.rv-app')).not.toHaveClass(/dark/);
});

test('居住舱两主题地图错误与重载控件可见可点', async ({ page }) => {
  await boot(page, { configured: true });
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'error';
  });
  await openPanel(page);
  for (const dark of [false, true]) {
    await theme(page, dark);
    await expect(page.getByText('地图暂时无法加载，位置文字仍可查看', { exact: true })).toBeVisible();
    if (dark === false) await page.getByText('详细错误', { exact: true }).click();
    await expect(page.getByText('模拟地点查询失败', { exact: true })).toBeVisible();
    await capture(page, `${dark ? 'dark' : 'light'}-map-error`);
  }
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'normal';
  });
  await page.getByRole('button', { name: '重新加载地图', exact: true }).click();
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(1);
});
