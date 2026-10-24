import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { boot, mapLog, openPanel } from './support';

test('小窗不读取地图配置，首次展开读取一次，收起和切Tab不重复读', async ({ page }) => {
  await boot(page, { configured: true });
  const reads = () =>
    page.evaluate(() => {
      const t = (window as any).rvTest;
      return { handles: t.charHandles, queries: t.charQueries, sdk: t.mapFrames, locations: t.mapQueries.length };
    });
  expect(await reads()).toEqual({ handles: 0, queries: 0, sdk: 0, locations: 0 });
  await page.evaluate(() => (window as any).rvTest.refresh());
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.readStarted)).toBe(12);
  expect(await reads()).toEqual({ handles: 0, queries: 0, sdk: 0, locations: 0 });
  await openPanel(page);
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(1);
  expect(await reads()).toEqual({ handles: 1, queries: 3, sdk: 1, locations: 2 });
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await openPanel(page);
  await page.getByRole('button', { name: '总览', exact: true }).click();
  await expect(page.getByRole('button', { name: '更改地图配置' })).toBeVisible();
  expect(await reads()).toEqual({ handles: 1, queries: 3, sdk: 1, locations: 2 });
});

test('展开总览才创建单个SDK环境，安全配置在SDK前设置，双位置匹配并fitView', async ({ page }) => {
  await boot(page, { configured: true });
  expect(await mapLog(page, 'sdk')).toHaveLength(0);
  await openPanel(page);
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(1);
  expect((await mapLog(page, 'fit'))[0]).toMatchObject({
    count: 2,
    sdkRealmArray: true,
    immediately: false,
    padding: [30, 30, 30, 30],
    maxZoom: 16,
  });
  const sdk = await mapLog(page, 'sdk'),
    adds = await mapLog(page, 'add');
  expect(sdk).toHaveLength(1);
  expect(sdk[0].securityConfigured).toBe(true);
  expect(adds.at(-1).markers.map((marker: any) => marker.title)).toEqual(['主角', '房车']);
  expect(adds.at(-1).markers.map((marker: any) => marker.position)).toEqual([
    [120.15, 30.25],
    [120.16, 30.26],
  ]);
  expect(await page.evaluate(() => 'AMap' in window || '_AMapSecurityConfig' in window)).toBe(false);
  await expect(page.locator('.map-legend .rv-icon[data-icon=traveller]')).toBeVisible();
  await expect(page.locator('.map-legend .rv-icon[data-icon=rv]')).toBeVisible();
  const markerIcons = await page.evaluate(
    (markers: Array<{ content: string }>) =>
      markers.map(marker => {
        const icon = new DOMParser()
          .parseFromString(marker.content, 'text/html')
          .querySelector<HTMLImageElement>('.rv-icon')!;
        return { name: icon.dataset.icon, src: icon.src };
      }),
    adds.at(-1).markers,
  );
  expect(markerIcons.map(({ name }) => ({ name }))).toEqual([{ name: 'traveller' }, { name: 'rv' }]);
  for (const icon of markerIcons) {
    expect(icon.src).toMatch(/^data:image\/svg\+xml;base64,/);
    const legendSrc = await page.locator(`.map-legend .rv-icon[data-icon=${icon.name}]`).getAttribute('src');
    expect(icon.src).toBe(legendSrc);
  }
  await mkdir('.test-data/card-rv/browser/screenshots', { recursive: true });
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/map-icons-light.png' });
  const queries = await page.evaluate(() => (window as any).rvTest.mapQueries.length);
  const legendLight = await page.locator('.map-legend').evaluate(node => getComputedStyle(node).backgroundColor);
  const markerColors = async () =>
    page.evaluate(
      (markers: Array<{ content: string }>) =>
        markers.map(marker => {
          return new DOMParser().parseFromString(marker.content, 'text/html').querySelector<HTMLElement>('span')!.style
            .color;
        }),
      (await mapLog(page, 'add')).at(-1).markers,
    );
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '深色', exact: true })
    .click();
  await expect.poll(markerColors).toEqual(['rgb(33, 77, 71)', 'rgb(33, 77, 71)']);
  const legendDark = await page.locator('.map-legend').evaluate(node => getComputedStyle(node).backgroundColor);
  expect(legendDark, '图例底色随主题变化，图形与地图标记同一 SVG').not.toBe(legendLight);
  expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(queries);
  expect(await mapLog(page, 'fit')).toHaveLength(1);
  await page.screenshot({ path: '.test-data/card-rv/browser/screenshots/map-icons-dark.png' });
  await page
    .getByRole('group', { name: '主题', exact: true })
    .getByRole('button', { name: '浅色', exact: true })
    .click();
  await expect.poll(markerColors).toEqual(['rgb(33, 77, 71)', 'rgb(33, 77, 71)']);
  expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(queries);
  expect(await mapLog(page, 'fit')).toHaveLength(1);
});

for (const mode of ['single', 'none', 'same'])
  test(`地图${mode}结果不伪造坐标，重合仅错开像素`, async ({ page }) => {
    await boot(page, { configured: true });
    await page.evaluate(mode => {
      (window as any).rvTest.mapMode = mode;
    }, mode);
    await openPanel(page);
    await expect.poll(() => mapLog(page, 'add')).toHaveLength(1);
    const markers = (await mapLog(page, 'add'))[0].markers;
    if (mode === 'single') {
      expect(markers).toHaveLength(1);
      expect(await mapLog(page, 'center')).toHaveLength(1);
      expect(await mapLog(page, 'fit')).toHaveLength(0);
    }
    if (mode === 'none') {
      expect(markers).toHaveLength(0);
      expect(await mapLog(page, 'center')).toHaveLength(0);
      expect(await mapLog(page, 'fit')).toHaveLength(0);
    }
    if (mode === 'same') {
      expect(markers.map((marker: any) => marker.position)).toEqual([
        [120.15, 30.25],
        [120.15, 30.25],
      ]);
      expect(markers.map((marker: any) => marker.offset.x)).toEqual([-14, 14]);
    }
  });

test('同地址只查询一次；收起期间位置变化不查询，展开后按新数据同步和resize', async ({ page }) => {
  await boot(page, { configured: true });
  await page.evaluate(() => {
    const test = (window as any).rvTest;
    test.tables.房车信息[0].所在地点 = test.tables.主角信息[0].当前位置;
    test.refresh();
  });
  await openPanel(page);
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(1);
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await page.evaluate(() => {
    const test = (window as any).rvTest;
    test.tables.主角信息[0].当前位置 = '新营地';
    test.refresh();
  });
  await expect(page.locator('.small strong')).toHaveText('杭州市');
  expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(1);
  const before = (await mapLog(page, 'resize')).length;
  await openPanel(page);
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(2);
  await expect.poll(async () => (await mapLog(page, 'resize')).length).toBeGreaterThan(before);
  expect(await mapLog(page, 'create')).toHaveLength(1);
});

test('换聊天取消旧查询，迟到回调不显示旧坐标；新聊天结果正常绘制', async ({ page }) => {
  await boot(page, { configured: true });
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'manual';
  });
  await openPanel(page);
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.pendingMap.length)).toBe(2);
  await page.evaluate(() => {
    const test = (window as any).rvTest;
    test.changeChat();
  });
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.pendingMap.length)).toBe(4);
  await page.evaluate(() => {
    const test = (window as any).rvTest;
    test.resolveMap(0, 'complete', [100, 20]);
    test.resolveMap(1, 'complete', [100, 20]);
  });
  expect((await mapLog(page, 'add')).filter(entry => entry.markers.length)).toHaveLength(0);
  await page.evaluate(() => {
    const test = (window as any).rvTest;
    test.resolveMap(2, 'complete', [121, 31]);
    test.resolveMap(3, 'complete', [122, 32]);
  });
  await expect.poll(async () => (await mapLog(page, 'add')).filter(entry => entry.markers.length)).toHaveLength(1);
  expect((await mapLog(page, 'add')).at(-1).markers.map((marker: any) => marker.position)).toEqual([
    [121, 31],
    [122, 32],
  ]);
});

test('查询失败仍可用其它Tab，手动重加载后恢复，不自动重试', async ({ page }) => {
  await boot(page, { configured: true });
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'error';
  });
  await openPanel(page);
  await expect(page.getByText('地图暂时无法加载，位置文字仍可查看', { exact: true })).toBeVisible();
  await page.getByText('详细错误', { exact: true }).click();
  await expect(page.getByText('模拟地点查询失败', { exact: true })).toBeVisible();
  const queries = await page.evaluate(() => (window as any).rvTest.mapQueries.length);
  await page.getByRole('button', { name: '角色', exact: true }).click();
  await expect(page.locator('.npc')).toHaveCount(3);
  await page.getByRole('button', { name: '总览', exact: true }).click();
  expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(queries);
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'normal';
  });
  await page.getByRole('button', { name: '重新加载地图', exact: true }).click();
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(1);
  expect(await mapLog(page, 'destroy')).toHaveLength(1);
});

test('脚本pagehide销毁地图；迟到查询不重建实例', async ({ page }) => {
  await boot(page, { configured: true });
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'manual';
  });
  await openPanel(page);
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.pendingMap.length)).toBe(2);
  await page.evaluate(() => {
    const test = (window as any).rvTest;
    test.close();
    test.resolveMap(0);
    test.resolveMap(1);
  });
  await expect(page.locator('#rv-statusbar-rv-test')).toHaveCount(0);
  expect(await mapLog(page, 'destroy')).toHaveLength(1);
  expect(await mapLog(page, 'add')).toHaveLength(0);
});

test('六表已暂停时切swipe立即取消旧地图；新数据读完才查询新地址', async ({ page }) => {
  await boot(page, { configured: true });
  await page.evaluate(() => {
    (window as any).rvTest.mapMode = 'manual';
  });
  await openPanel(page);
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.pendingMap.length)).toBe(2);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.pauseReads();
    t.refresh();
  });
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.readStarted)).toBe(12);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.tables.主角信息[0].当前位置 = '新版本营地';
    t.swipe();
    t.resolveMap(0, 'complete', [100, 20]);
    t.resolveMap(1, 'complete', [100, 20]);
  });
  expect((await mapLog(page, 'add')).filter(entry => entry.markers.length)).toHaveLength(0);
  expect(await page.evaluate(() => (window as any).rvTest.pendingMap.length)).toBe(2);
  await page.evaluate(() => (window as any).rvTest.releaseReads());
  await expect.poll(() => page.evaluate(() => (window as any).rvTest.pendingMap.length)).toBe(4);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.resolveMap(2, 'complete', [121, 31]);
    t.resolveMap(3, 'complete', [122, 32]);
  });
  await expect.poll(async () => (await mapLog(page, 'add')).filter(entry => entry.markers.length)).toHaveLength(1);
  expect((await mapLog(page, 'add')).at(-1).markers.map((marker: any) => marker.position)).toEqual([
    [121, 31],
    [122, 32],
  ]);
});

test('同聊天新fid但地址未变使用已取得的缓存，位置不重复联网', async ({ page }) => {
  await boot(page, { configured: true });
  await openPanel(page);
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(1);
  const queries = await page.evaluate(() => (window as any).rvTest.mapQueries.length);
  await page.evaluate(() => {
    const t = (window as any).rvTest;
    t.context.chat[0].variables[0].dvs.fid = '018f4900-0000-7000-8000-000000000009';
    t.refresh();
  });
  await expect.poll(() => mapLog(page, 'fit')).toHaveLength(2);
  expect(await page.evaluate(() => (window as any).rvTest.mapQueries.length)).toBe(queries);
});
