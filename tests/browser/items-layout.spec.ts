import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, openPanel, rvHost } from './support';

test('物品直接展示完整内容，宽屏三列同行等高，窄屏依次减列且长内容不裁切', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.evaluate(() => {
    const env = (window as any).rvTest;
    env.tables.房车物资 = [
      ['冷冻食品', 8, '袋', '冷冻', '分装冷冻食材，供日常烹饪使用。', '冰箱冷冻区'],
      ['备用柴油', 4, '桶', '满桶', '密封备用燃油，供途中应急补充。', '车外储物舱'],
      ['咖啡豆', 6, '袋', '未开封', '中度烘焙咖啡豆，供日常冲煮使用。', '厨房吊柜'],
      ['饮用水', 12, '瓶', '未开封', '瓶装饮用水，外出时可随身携带。', '餐桌下储物柜'],
      ['新鲜蔬菜', 5, '份', '冷藏', '近期采购的蔬菜，优先食用。', '冰箱冷藏区'],
      ['工具箱', 1, '套', '完好', '常用检修工具，集中收纳。', '车外工具舱'],
    ].map(([物品名, 数量, 单位, 状态, 说明, 存放位置]) => ({ 物品名, 数量, 单位, 状态, 说明, 存放位置 }));
    env.tables.随身物品 = [
      ['手机', '部', '正常使用', '日常通讯、拍摄与导航使用。'],
      ['车钥匙', '把', '随身携带', '房车钥匙，出行时随身保管。'],
      ['钱包', '个', '完好', '收纳证件、银行卡与少量现金。'],
    ].map(([物品名, 单位, 状态, 说明]) => ({ 持有人: '旅行者', 物品名, 数量: 1, 单位, 状态, 说明 }));
    env.refresh();
  });
  await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
  for (const [width, columns] of [
    [1280, 3],
    [760, 2],
    [390, 1],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['浅色', '深色'] as const) {
      await page
        .getByRole('group', { name: '主题', exact: true })
        .getByRole('button', { name: theme, exact: true })
        .click();
      for (const [tab, kind, count] of [
        ['房车物资', 'supplies', 6],
        ['随身物品', 'belongings', 3],
      ] as const) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        const list = rvHost(page).locator(`.${kind} .items-list`);
        await expect(list.locator('.item-description')).toHaveCount(count);
        await expect(list.locator('button, [aria-expanded], .item-disclosure, .details')).toHaveCount(0);
        const boxes = await list.locator('.item').evaluateAll(nodes =>
          nodes.map(node => {
            const r = node.getBoundingClientRect();
            return { x: r.x, y: r.y, height: r.height };
          }),
        );
        expect(boxes.filter(box => Math.abs(box.y - boxes[0]!.y) < 1)).toHaveLength(columns);
        for (let row = 0; row < boxes.length; row += columns) {
          const heights = boxes.slice(row, row + columns).map(box => box.height);
          expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
        }
        expect(await list.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await rvHost(page)
          .locator('.large')
          .screenshot({
            path: `.test-data/card-rv/browser/screenshots/items-${kind}-${width}-${theme === '深色' ? 'dark' : 'light'}.png`,
          });
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    const env = (window as any).rvTest;
    env.tables.房车物资[0].物品名 = '用于野外检修与应急维护的多功能工具组合';
    env.tables.房车物资[0].状态 = '检查完毕且所有配件齐全';
    env.tables.房车物资[0].说明 = '较长说明应当完整换行显示，不能为了保持卡片高度隐藏文字。'.repeat(8);
    env.tables.房车物资[0].存放位置 = '车外左侧靠后的独立储物舱';
    env.refresh();
  });
  await page.getByRole('button', { name: '房车物资', exact: true }).click();
  const items = rvHost(page).locator('.supplies .item');
  await expect(items.first()).toContainText('较长说明应当完整换行显示');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const result = await items.evaluateAll(nodes => {
      const first = nodes[0]!,
        card = first.getBoundingClientRect();
      return {
        heights: nodes.slice(0, 3).map(node => node.getBoundingClientRect().height),
        inside: Array.from(
          first.querySelectorAll('h2, .item-quantity, .item-status, .item-description, .item-location'),
        ).every(node => {
          const r = node.getBoundingClientRect();
          return (
            r.left >= card.left &&
            r.right <= card.right &&
            r.bottom <= card.bottom &&
            node.scrollHeight <= node.clientHeight + 1
          );
        }),
      };
    });
    expect(result.inside).toBe(true);
    if (width === 1280) expect(Math.max(...result.heights) - Math.min(...result.heights)).toBeLessThan(1);
  }
});
