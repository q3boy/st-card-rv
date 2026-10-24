import { expect, test } from '@playwright/test';
import { boot, openPanel, rvHost } from './support';

test('角色、房车物资、随身物品卡片边框在 ShadowRoot 内生效，好感度正绿负红零不着色', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  const semantic = await rvHost(page)
    .locator('.rv-app')
    .evaluate(node => {
      const probe = (name: string) => {
        const element = document.createElement('i');
        element.style.color = `var(${name})`;
        node.append(element);
        const color = getComputedStyle(element).color;
        element.remove();
        return color;
      };
      return { pos: probe('--pos'), neg: probe('--neg') };
    });
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await expect(rvHost(page).locator('.npc')).toHaveCount(3);
  const disclosure = rvHost(page).locator('.npc .disclosure-icon').first();
  expect(await disclosure.evaluate(node => getComputedStyle(node).translate), 'Tailwind 位移在 ShadowRoot 内生效').toBe(
    '0px -50%',
  );
  await page.getByRole('button', { name: /林清.*26岁/ }).click();
  expect(
    await rvHost(page)
      .locator('.npc.opened .reserve-info')
      .evaluate(node => getComputedStyle(node).borderTopStyle),
    'Tailwind 边框在 ShadowRoot 内生效',
  ).toBe('solid');
  const favor = await rvHost(page)
    .locator('.npc .npc-summary-field b')
    .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color));
  const body = await rvHost(page)
    .locator('.rv-app')
    .evaluate(node => getComputedStyle(node).color);
  expect(favor).toEqual([semantic.pos, semantic.neg, body]);
  for (const [tab, selector] of [
    ['房车物资', '.supplies .item'],
    ['随身物品', '.belongings .item'],
  ] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const item = rvHost(page).locator(`${selector}:visible`).first();
    await expect(item.locator('.item-status')).toBeVisible();
    expect(await item.locator('.item-status').evaluate(node => getComputedStyle(node).borderTopStyle)).toBe('solid');
  }
});
