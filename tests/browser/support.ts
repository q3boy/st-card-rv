import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { DvsUpdateStatus } from '../../types/sqlite-helper/dvs';

export const rvHost = (page: Page) => page.locator('#rv-statusbar-rv-test');
const errors = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? [], '脚本与真实Vue不得产生未处理异常').toEqual([]);
});
export async function openPanel(page: Page) {
  await page.getByRole('button', { name: '打开旅行手册', exact: true }).click();
}

/** 截图前等待当前生产图片和字体实际可用，再跨过一次布局提交。 */
export async function readyForScreenshot(page: Page) {
  await rvHost(page).evaluate(async host => {
    await document.fonts.ready;
    await Promise.all(Array.from(host.shadowRoot!.querySelectorAll('img')).map(image => image.decode()));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** 按真实滚动位置分段拍摄内容，避免元素截图被固定标题遮住或裁掉下半部。 */
export async function screenshotContent(page: Page, selector: string, path: string) {
  const main = rvHost(page).locator('main'),
    target = rvHost(page).locator(selector);
  await readyForScreenshot(page);
  const originalScroll = await main.evaluate(node => node.scrollTop);
  const area = await main.boundingBox(),
    box = await target.boundingBox();
  if (!area || !box) throw new Error(`截图区域不可见：${selector}`);
  const start = Math.round(box.y - area.y + originalScroll),
    height = Math.round(box.height),
    width = Math.floor(box.width);
  const tiles: Array<{ input: Buffer; top: number; left: number }> = [];
  const slices: Array<{ scrollTop: number; top: number; height: number }> = [];
  for (let offset = 0; offset < height; ) {
    await main.evaluate((node, top) => {
      node.scrollTop = top;
    }, start + offset);
    await readyForScreenshot(page);
    const actualScroll = await main.evaluate(node => node.scrollTop);
    const y = area.y + start + offset - actualScroll;
    const sliceHeight = Math.min(height - offset, Math.floor(area.y + area.height - y));
    if (sliceHeight <= 0) throw new Error(`截图无法继续滚动：${selector}`);
    const input = await page.screenshot({
      path: path.replace(/\.png$/, `-slice-${slices.length}.png`),
      clip: { x: box.x, y, width, height: sliceHeight },
    });
    tiles.push({ input, top: offset, left: 0 });
    slices.push({ scrollTop: actualScroll, top: offset, height: sliceHeight });
    offset += sliceHeight;
  }
  await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite(tiles)
    .png()
    .toFile(path);
  await writeFile(
    path.replace(/\.png$/, '-capture.json'),
    JSON.stringify({ selector, width, height, slices }, null, 2),
  );
  await main.evaluate((node, top) => {
    node.scrollTop = top;
  }, originalScroll);
}

/** Fake network boundary only: production map iframe, SDK loader and callback handling still run. */
const amapSdk = `(() => {
  const test = window.parent.rvTest;
  const frame = ++test.mapFrames;
  test.mapLog.push({type:'sdk',frame,securityConfigured:!!window._AMapSecurityConfig?.securityJsCode});
  class Pixel { constructor(x,y) { this.x=x;this.y=y; } }
  class Marker { constructor(options) { this.options=options; } getBounds() { return {}; } }
  class Map {
    constructor(root,options) { this.frame=frame;this.markers=[];test.mapLog.push({type:'create',frame,options});root.textContent='模拟高德地图'; }
    add(markers) { this.markers=markers;test.mapLog.push({type:'add',frame,markers:markers.map(m=>m.options)}); }
    remove(markers) { this.markers=[];test.mapLog.push({type:'remove',frame,count:markers.length}); }
    setCenter(position) { test.mapLog.push({type:'center',frame,position}); }
    setFitView(markers,immediately,padding,maxZoom) {
      // 高德 2.0 在此使用 instanceof Array；外部窗口数组会被当成单个覆盖物。
      const overlays = markers instanceof Array ? markers : [markers];
      for (let index = 0; index < overlays.length; index++) overlays[index].getBounds();
      test.mapLog.push({type:'fit',frame,count:overlays.length,sdkRealmArray:markers instanceof Array,immediately,padding,maxZoom});
    }
    setMapStyle(style) { test.mapLog.push({type:'style',frame,style}); }
    destroy() { test.mapLog.push({type:'destroy',frame}); }
  }
  class Geocoder {
    getLocation(address,callback) {
      test.mapQueries.push(address);
      test.mapLog.push({type:'query',frame,address});
      if(test.mapMode==='manual') { test.pendingMap.push({address,callback,frame});return; }
      if(test.mapMode==='error') { callback('error',{info:'模拟地点查询失败'});return; }
      if(test.mapMode==='none'||test.mapMode==='single'&&address.includes('停车')) { callback('no_data',{});return; }
      const point=test.mapMode==='same'?[120.15,30.25]:address.includes('停车')?[120.16,30.26]:[120.15,30.25];
      callback('complete',{geocodes:[{location:{lng:'invalid',lat:0}},{location:{lng:point[0],lat:point[1]}}]});
    }
  }
  window.addEventListener('resize',()=>test.mapLog.push({type:'resize',frame}));
  window.AMap={Pixel,Marker,Map,Geocoder}; window.rvAmapReady();
})();`;

export async function boot(
  page: Page,
  options: { registered?: boolean; configured?: boolean; updateStatus?: DvsUpdateStatus } = {},
): Promise<void> {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') messages.push(message.text());
  });
  await page.route('**/node_modules/sql.js/dist/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (!['sql-wasm.js', 'sql-wasm.wasm'].includes(name)) {
      await route.abort();
      return;
    }
    await route.fulfill({
      body: readFileSync(resolve('node_modules/sql.js/dist', name)),
      contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
    });
  });
  await page.route('https://webapi.amap.com/maps?**', route =>
    route.fulfill({ contentType: 'text/javascript', body: amapSdk }),
  );
  await page.goto('/');
  await page.addScriptTag({ url: '/node_modules/sql.js/dist/sql-wasm.js' });
  await page.evaluate(
    async ({ registered, configured, initialUpdateStatus }) => {
      const owner = window as any;
      const SQL = await owner.initSqlJs({ locateFile: (file: string) => '/node_modules/sql.js/dist/' + file });
      let database = new SQL.Database();
      if (configured)
        database.run(
          "CREATE TABLE env (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL); INSERT INTO env VALUES ('amap_key','fake-key'),('amap_sec','fake-sec'),('other','keep')",
        );
      const charDatabases = new Map([[0, database]]);
      let iframe: HTMLIFrameElement | undefined, helper: any;
      const subscribers = new Set<() => void>(),
        events = new Map<string, Set<() => void>>();
      const registrationSubscribers = new Set<(ready: boolean) => void>();
      const statusSubscribers = new Set<(status: DvsUpdateStatus) => void>();
      let updateStatus: DvsUpdateStatus = initialUpdateStatus ?? {
        phase: 'idle',
        attempt: 0,
        maxAttempts: 0,
        retryDelayMs: 0,
      };
      let paused = false,
        releaseRead: (() => void) | undefined,
        hold: Promise<void> = Promise.resolve();
      let roleId = 0;
      const context: any = {
        characterId: 0,
        groupId: null,
        chatId: 'rv-chat',
        characters: [{ avatar: 'rv-test.png' }, { avatar: 'other.png' }],
        chat: [{ is_user: false, swipe_id: 0, variables: [{ dvs: { fid: '018f4900-0000-7000-8000-000000000001' } }] }],
      };
      const npc = (name: string, affection: number) => ({
        姓名: name,
        昵称: '未知',
        年龄: 26,
        身份: '旅途朋友',
        生活背景: '在杭州生活，喜欢远行。',
        当前处境: '旅途中休息',
        相貌: '眉眼清秀',
        身材: '匀称',
        穿着: '浅色衬衫',
        核心特质: '温和而独立',
        行为模式: '先观察再行动',
        相遇情境: '湖边露营',
        在意与反感: '尊重彼此',
        对主角观感: '值得信赖',
        说话风格: '自然清楚',
        好感度: affection,
        当前位置: '湖畔营地',
        同行状态: '同行',
        状态: '平静',
        心声: '这次旅行会留下美好的回忆。',
      });
      const tables: Record<string, any[]> = {
        世界信息: [
          {
            日期时间: '2026-06-18 16:40',
            国家: '中国',
            省份: '浙江省',
            城市: '杭州市',
            区域: '西湖区',
            天气: '晴，微风',
          },
        ],
        主角信息: [{ 当前位置: '湖畔营地', 状态: '正在休息', 资金: 128600, 粉丝数量: 12000 }],
        房车信息: [
          {
            油料: 957.7,
            储备电力: 37.15,
            储备水源: 1000,
            状态: '正常',
            行车状态: '驻车',
            拓展状态: '收起',
            所在地点: '营地停车场',
          },
        ],
        角色信息: [npc('林清', 35), npc('周雨', -12), npc('许晨', 0)],
        房车物资: [
          {
            物品名: '咖啡豆',
            数量: 4,
            单位: '袋',
            说明: '每袋500克，其中一袋已经开封。',
            状态: '正常',
            存放位置: '厨房柜子',
          },
          { 物品名: '矿泉水', 数量: 0, 单位: '瓶', 说明: '待补充', 状态: '无', 存放位置: '储物柜' },
          { 物品名: '面包', 数量: 3, 单位: '份', 说明: '今日早餐备用', 状态: '新鲜', 存放位置: '厨房' },
        ],
        随身物品: [
          { 持有人: '旅行者', 物品名: '手机', 数量: 1, 单位: '部', 说明: '记录沿途的见闻', 状态: '正常满电' },
          { 持有人: '旅行者', 物品名: '相机', 数量: 1, 单位: '台', 说明: '备用电池已充电', 状态: '正常' },
          { 持有人: '旅行者', 物品名: '手帐', 数量: 1, 单位: '本', 说明: '旅行记录', 状态: '无' },
          { 持有人: '林清', 物品名: '手机', 数量: 1, 单位: '部', 说明: '日常使用', 状态: '正常' },
        ],
      };
      const test: any = (owner.rvTest = {
        tables,
        context,
        reads: 0,
        readStarted: 0,
        regenCalls: 0,
        inject: { filter: true, plot: true },
        injectSets: [] as unknown[],
        injectError: '',
        completeRegen: null,
        charHandles: 0,
        charQueries: 0,
        transactions: 0,
        mapMode: 'normal',
        mapFrames: 0,
        mapLog: [],
        mapQueries: [],
        pendingMap: [],
        writeError: null,
        queryError: null,
        stateError: null,
        get listenerCount() {
          return subscribers.size;
        },
        get registrationListenerCount() {
          return registrationSubscribers.size;
        },
        get statusListenerCount() {
          return statusSubscribers.size;
        },
        setUpdateStatus(status: DvsUpdateStatus) {
          updateStatus = status;
          for (const callback of [...statusSubscribers]) callback({ ...status });
        },
        get eventListenerCount() {
          return [...events.values()].reduce((sum, set) => sum + set.size, 0);
        },
        emit(name: string) {
          for (const callback of [...(events.get(name) ?? [])]) callback();
        },
        refresh() {
          for (const callback of [...subscribers]) callback();
        },
        register() {
          registered = true;
          for (const callback of [...registrationSubscribers]) callback(true);
        },
        unregister() {
          registered = false;
          for (const callback of [...registrationSubscribers]) callback(false);
        },
        changeChat(id = 'rv-chat-new') {
          context.chatId = id;
          context.chat = structuredClone(context.chat);
          test.emit('CHAT_CHANGED');
        },
        changeRole() {
          roleId = roleId === 0 ? 1 : 0;
          context.characterId = roleId;
          test.close();
          database = charDatabases.get(roleId);
          if (!database) {
            database = new SQL.Database();
            charDatabases.set(roleId, database);
          }
        },
        swipe(id = 1) {
          context.chat[0].swipe_id = id;
          context.chat[0].variables[id] = { dvs: { fid: '018f4900-0000-7000-8000-000000000002' } };
          test.emit('MESSAGE_SWIPED');
        },
        setTable(name: string, rows: any[]) {
          tables[name] = rows;
          test.refresh();
        },
        pauseReads() {
          paused = true;
          hold = new Promise(resolve => {
            releaseRead = resolve;
          });
        },
        releaseReads() {
          paused = false;
          releaseRead?.();
        },
        config() {
          const rows = test.charRows();
          return {
            key: rows.find((row: any[]) => row[0] === 'amap_key')?.[1] ?? '',
            securityJsCode: rows.find((row: any[]) => row[0] === 'amap_sec')?.[1] ?? '',
          };
        },
        charRows() {
          return database.exec('SELECT key,value FROM env ORDER BY key')[0]?.values ?? [];
        },
        exportChar() {
          return Array.from(database.export());
        },
        reopenChar() {
          const bytes = database.export();
          database.close();
          database = new SQL.Database(bytes);
          charDatabases.set(roleId, database);
          return test.config();
        },
        setWriteError(code: string | null, state = 'rolled-back') {
          test.writeError = code ? { code, message: '模拟配置写入错误', executionState: state } : null;
        },
        resolveMap(index: number, status = 'complete', point = [121, 31]) {
          const pending = test.pendingMap[index];
          if (!pending) throw new Error('指定地点查询尚未进入');
          pending.callback(
            status,
            status === 'complete'
              ? { geocodes: [{ location: { lng: point[0], lat: point[1] } }] }
              : { info: '模拟地点查询失败' },
          );
        },
        close() {
          helper?.dispatchEvent(new Event('pagehide'));
          iframe?.remove();
          iframe = undefined;
        },
        async reexecute() {
          // Execute again in the same Helper iframe: entry.ts itself must dispose the prior instance.
          const node = helper.document.createElement('script');
          node.src = '/.test-data/card-rv/build/状态栏.js?run=' + Math.random();
          const loaded = new Promise<void>((resolve, reject) => {
            node.onload = () => resolve();
            node.onerror = () => reject(new Error('重执行脚本加载失败'));
          });
          helper.document.head.appendChild(node);
          await loaded;
        },
      });
      const charHandle = () => {
        test.charHandles++;
        // A captured proxy retains its database object, even if the visible role changes.
        const fixed = database;
        return {
          debounce() {
            return this;
          },
          async query(sql: string, binds?: any[]) {
            test.charQueries++;
            if (test.queryError) throw test.queryError;
            const result = fixed.exec(sql, binds)[0];
            return { columns: result?.columns ?? [], rows: result?.values ?? [] };
          },
          async transaction(commands: any[]) {
            test.transactions++;
            if (test.writeError) throw test.writeError;
            fixed.run('BEGIN');
            try {
              for (const command of commands) fixed.run(command.sql, command.binds);
              fixed.run('COMMIT');
              return { committed: true, persisted: false };
            } catch (error) {
              fixed.run('ROLLBACK');
              throw { code: 'SQL_FAILED', message: String(error), executionState: 'rolled-back' };
            }
          },
        };
      };
      owner.SillyTavern = { getContext: () => context };
      async function mount() {
        if (iframe) {
          helper.dispatchEvent(new Event('pagehide'));
          iframe.remove();
        }
        iframe = document.createElement('iframe');
        iframe.id = 'helper-script-rv';
        iframe.hidden = true;
        iframe.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
        const loaded = new Promise<void>(resolve => {
          iframe!.onload = () => resolve();
        });
        document.body.append(iframe);
        await loaded;
        helper = iframe.contentWindow as any;
        helper.getScriptId = () => 'rv-test';
        helper.substitudeMacros = () => '旅行者';
        helper.waitGlobalInitialized = async () => {};
        helper.tavern_events = Object.fromEntries(
          ['CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_RECEIVED', 'MESSAGE_UPDATED'].map(event => [
            event,
            event,
          ]),
        );
        helper.eventOn = (name: string, callback: () => void) => {
          const set = events.get(name) ?? new Set();
          events.set(name, set);
          set.add(callback);
          return {
            stop() {
              set.delete(callback);
            },
          };
        };
        helper.getChatMessages = () =>
          context.chat.map((message: any, message_id: number) => ({
            message_id,
            role: message.is_user ? 'user' : 'assistant',
            swipe_id: message.swipe_id ?? 0,
            swipes_data: message.variables,
          }));
        helper.SqliteHelper = {
          get char() {
            return charHandle();
          },
        };
        helper.DVS = {
          onRegistrationChange(callback: (ready: boolean) => void) {
            registrationSubscribers.add(callback);
            callback(registered);
            return () => registrationSubscribers.delete(callback);
          },
          getUpdateStatus() {
            return { ...updateStatus };
          },
          onUpdateStatus(callback: (status: DvsUpdateStatus) => void) {
            statusSubscribers.add(callback);
            return () => statusSubscribers.delete(callback);
          },
          async getInject() {
            if (test.injectError) throw new Error(test.injectError);
            return { ...test.inject };
          },
          async setInject(flags: { filter: boolean; plot: boolean }) {
            test.injectSets.push({ ...flags });
            test.inject = { ...flags };
            return { ...test.inject };
          },
          async regen() {
            test.regenCalls++;
            await new Promise<void>((resolve, reject) => {
              test.completeRegen = (error?: string) => {
                test.completeRegen = null;
                error ? reject(new Error(error)) : resolve();
              };
            });
            test.refresh();
          },
          onUpdate(callback: () => void) {
            subscribers.add(callback);
            return () => subscribers.delete(callback);
          },
          async getState() {
            test.reads++;
            const copied = structuredClone(tables);
            if (test.stateError) throw new Error(test.stateError);
            return {
              table(name: string) {
                return {
                  async row() {
                    test.readStarted++;
                    if (paused) await hold;
                    return copied[name]?.[0] ?? null;
                  },
                  async rows() {
                    test.readStarted++;
                    if (paused) await hold;
                    return copied[name] ?? [];
                  },
                };
              },
            };
          },
        };
        const script = (url: string) =>
          new Promise<void>((resolve, reject) => {
            const node = helper.document.createElement('script');
            node.src = url;
            node.onload = () => resolve();
            node.onerror = () => reject(new Error('模拟脚本加载失败：' + url));
            helper.document.head.appendChild(node);
          });
        await script('/node_modules/vue/dist/vue.runtime.global.prod.js');
        await script('/.test-data/card-rv/build/状态栏.js');
      }
      await mount();
    },
    {
      registered: options.registered ?? true,
      configured: options.configured ?? false,
      initialUpdateStatus: options.updateStatus,
    },
  );
  await expect(page.getByRole('button', { name: '打开旅行手册', exact: true })).toBeVisible();
  if (options.registered !== false) await expect(page.locator('.small strong')).toHaveText('杭州市');
}

export async function mapLog(page: Page, type: string): Promise<any[]> {
  return page.evaluate(type => (window as any).rvTest.mapLog.filter((entry: any) => entry.type === type), type);
}
