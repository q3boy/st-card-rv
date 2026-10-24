import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, openPanel, readyForScreenshot, rvHost } from './support';

const directory = '.test-data/card-rv/browser/screenshots';
async function setData(page: Page, world: Record<string, unknown>, rv: Record<string, unknown> = {}) {
  await page.evaluate(
    ([world, rv]) => {
      const t = (window as any).rvTest;
      Object.assign(t.tables.世界信息[0], world);
      Object.assign(t.tables.房车信息[0], rv);
      t.refresh();
    },
    [world, rv] as const,
  );
}
async function theme(page: Page, name: '浅色' | '深色') {
  await page.getByRole('group', { name: '主题', exact: true }).getByRole('button', { name, exact: true }).click();
}
async function capture(page: Page, name: string) {
  await mkdir(directory, { recursive: true });
  await readyForScreenshot(page);
  await rvHost(page)
    .locator('main')
    .evaluate(node => (node.scrollTop = 0));
  await rvHost(page)
    .locator('.large')
    .screenshot({ path: `${directory}/overview-${name}.png` });
}
const art = (page: Page) => rvHost(page).locator('.rv-image');
const label = (page: Page) => rvHost(page).locator('.rv-art-label');
const periodTag = (page: Page) => rvHost(page).locator('.period-tag');

const periods = [
  ['dawn', '清晨', '2026-06-05 06:30', '洱海西岸'],
  ['day', '白天', '2026-06-05 13:10', '大理市'],
  ['dusk', '傍晚', '2026-06-05 18:40', '大理市'],
  ['night', '夜晚', '2026-06-05 23:20', '才村营地'],
] as const;

test('浅色按日期时间的小时切换时段类、时段标签和配图，配图随行车与拓展状态变化', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await theme(page, '浅色');
  const sources = new Set<string>();
  for (const [period, name, time, area] of periods) {
    await setData(page, { 日期时间: time, 区域: area }, { 行车状态: '行车', 拓展状态: '收起' });
    await expect(rvHost(page).locator('.rv-app')).toHaveClass(new RegExp(`tod-${period}`));
    await expect(periodTag(page)).toHaveText(name);
    await expect(rvHost(page).locator('.scene-time strong')).toHaveText(time.slice(11));
    await expect(label(page)).toHaveText('行车');
    await capture(page, `${period}-drive`);
    sources.add((await art(page).getAttribute('src'))!);
  }
  expect(sources.size, '四个时段的行车图各不相同').toBe(4);
  for (const [drive, expand, kind, text] of [
    ['驻车', '收起', 'park', '驻车'],
    ['驻车', '展开', 'expand', '拓展展开'],
    ['行车', '展开', 'drive', '行车'],
  ] as const) {
    await setData(page, { 日期时间: '2026-06-05 18:40' }, { 行车状态: drive, 拓展状态: expand });
    await expect(art(page)).toHaveAttribute('data-art', kind);
    await expect(label(page)).toHaveText(text);
    await capture(page, `dusk-${kind}`);
  }
});

test('时段边界：05:59 夜晚，06:00 清晨，20:00 夜晚；无法判断时用白天配色、白天图且不显示时段标签', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await theme(page, '浅色');
  for (const [time, period] of [
    ['2026-06-05 05:59', 'night'],
    ['2026-06-05 06:00', 'dawn'],
    ['2026-06-05 16:59', 'day'],
    ['2026-06-05 17:00', 'dusk'],
    ['2026-06-05 19:59', 'dusk'],
    ['2026-06-05 20:00', 'night'],
  ] as const) {
    await setData(page, { 日期时间: time });
    await expect(rvHost(page).locator('.rv-app')).toHaveClass(new RegExp(`tod-${period}`));
  }
  await setData(page, { 日期时间: '2026-06-05 13:10' });
  const daySrc = await art(page).getAttribute('src');
  for (const value of ['未知', '2026-06-05 25:00', '2026-06-05 12:60', '乱写']) {
    await setData(page, { 日期时间: value });
    await expect(rvHost(page).locator('.rv-app')).toHaveClass(/tod-day/);
    await expect(periodTag(page)).toHaveCount(0);
    expect(await art(page).getAttribute('src')).toBe(daySrc);
    await expect(rvHost(page).locator('.scene-time strong')).toHaveText('—');
  }
  await setData(page, { 日期时间: '未知' });
  await capture(page, 'unknown-time');
});

test('深色一套配色，配图固定用夜晚图，标签仍随行车状态变化，时段标签保持显示', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await theme(page, '浅色');
  await setData(page, { 日期时间: '2026-06-05 23:20' }, { 行车状态: '驻车', 拓展状态: '展开' });
  const nightSrc = await art(page).getAttribute('src');
  await theme(page, '深色');
  await setData(page, { 日期时间: '2026-06-05 13:10' });
  await expect(rvHost(page).locator('.rv-app')).toHaveClass(/theme-dark/);
  await expect(rvHost(page).locator('.rv-app')).not.toHaveClass(/tod-/);
  expect(await art(page).getAttribute('src')).toBe(nightSrc);
  await expect(periodTag(page)).toHaveText('白天');
  await expect(label(page)).toHaveText('拓展展开');
  const colors = new Set<string>();
  for (const time of ['2026-06-05 06:30', '2026-06-05 18:40']) {
    await setData(page, { 日期时间: time });
    colors.add(
      await rvHost(page)
        .locator('.large')
        .evaluate(node => getComputedStyle(node).backgroundColor),
    );
  }
  expect(colors.size, '深色下背景不随时段变化').toBe(1);
  await capture(page, 'dark');
  await setData(page, {}, { 行车状态: '行车', 拓展状态: '收起' });
  await expect(label(page)).toHaveText('行车');
  await capture(page, 'dark-drive');
});

test('宽屏配图像素宽度约为显示宽度的 2 倍，窄屏单列时配图仍贴卡片边框', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await theme(page, '浅色');
  for (const kind of ['park', 'expand'] as const) {
    await setData(page, {}, { 行车状态: '驻车', 拓展状态: kind === 'expand' ? '展开' : '收起' });
    await expect(art(page)).toHaveAttribute('data-art', kind);
    const wide = await art(page).evaluate(async node => {
      const image = node as HTMLImageElement;
      await image.decode();
      return { natural: image.naturalWidth, shown: image.getBoundingClientRect().width };
    });
    expect(wide.natural).toBeGreaterThanOrEqual(wide.shown * 2);
    expect(wide.natural).toBeLessThanOrEqual(wide.shown * 2 * 1.02);
  }
  await page.setViewportSize({ width: 430, height: 900 });
  await expect(rvHost(page).locator('.overview > div').first()).toBeVisible();
  const narrow = await rvHost(page).evaluate(host => {
    const root = host.shadowRoot!;
    const card = root.querySelector('.vehicle')!.getBoundingClientRect();
    const img = root.querySelector('.rv-image')!.getBoundingClientRect();
    const person = root.querySelector('.person')!.getBoundingClientRect();
    return {
      cardLeft: card.left,
      cardRight: card.right,
      imgLeft: img.left,
      imgRight: img.right,
      same: card.left === person.left,
    };
  });
  expect(narrow.imgLeft - narrow.cardLeft).toBeLessThanOrEqual(1.5);
  expect(narrow.cardRight - narrow.imgRight).toBeLessThanOrEqual(1.5);
  expect(narrow.same, '窄屏总览为单列').toBe(true);
  await setData(page, { 日期时间: '2026-06-05 18:40', 区域: '西湖区' });
  await capture(page, 'narrow-dusk');
  await theme(page, '深色');
  await capture(page, 'narrow-dark');
});

test('资源条按比例而非四舍五入后的百分比分档着色，缺值显示间断底槽和「—」', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  const percents = rvHost(page).locator('.resource-percent');
  const colors = () => percents.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color));
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
      return { pos: probe('--pos'), warn: probe('--warn'), neg: probe('--neg') };
    });
  // 显示顺序：油料、电力、清水。99.9/1000 显示 10% 但低于 10% 属过低；21.5/72 显示 30% 但低于 30% 属偏低。
  await setData(page, {}, { 油料: 99.9, 储备电力: 21.5, 储备水源: 600 });
  await expect(percents).toHaveText(['10%', '30%', '60%']);
  expect(await colors()).toEqual([semantic.neg, semantic.warn, semantic.pos]);
  const tracks = await rvHost(page)
    .locator('.resource .track')
    .evaluateAll(nodes =>
      nodes.map(node => ({ left: node.getBoundingClientRect().left, width: node.getBoundingClientRect().width })),
    );
  expect(new Set(tracks.map(track => track.left)).size, '三根条左端对齐').toBe(1);
  expect(new Set(tracks.map(track => track.width)).size, '三根条总宽度一致').toBe(1);
  const fills = await rvHost(page)
    .locator('.resource .track i')
    .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundImage));
  expect(fills[0], '过低为红色渐变').toContain('rgb(217, 115, 90)');
  expect(fills[1], '偏低为橙色渐变').toContain('rgb(230, 178, 79)');
  expect(fills[2], '正常为绿色渐变').toContain('rgb(111, 163, 127)');
  await setData(page, {}, { 油料: 100, 储备电力: 21.6, 储备水源: 1000 });
  await expect(percents).toHaveText(['10%', '30%', '100%']);
  expect(await colors()).toEqual([semantic.warn, semantic.pos, semantic.pos]);
  await setData(page, {}, { 油料: '未知' });
  await expect(percents.nth(0)).toHaveText('—');
  await expect(rvHost(page).locator('.resource .track.missing')).toHaveCount(1);
});
