import { describe, expect, test } from 'bun:test';
import {
  buildAmapAddress,
  createAmapController,
  createAmapFrame,
  type AmapFrame,
  type AmapMap,
  type AmapSdk,
  type AmapStatus,
  type AmapView,
} from '../../状态栏/amap';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => {
    resolve = accept;
  });
  return { promise, resolve };
}
const flush = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
const location = (lng: number, lat: number) => ({ info: 'OK', geocodes: [{ location: { lng, lat } }] });
const config = { key: 'fake-key', securityJsCode: 'fake-security' };
const visible: AmapView = {
  target: 'chat-a',
  visible: true,
  theme: 'light',
  protagonistAddress: '主角地址',
  rvAddress: '房车地址',
};

function prepare(timeoutMs = 15_000) {
  const queries: { address: string; callback: (status: string, value: unknown) => void }[] = [];
  const maps: SimulatedMap[] = [];
  const frames: {
    frame: AmapFrame;
    loaded: ReturnType<typeof deferred<{ sdk: AmapSdk; root: HTMLElement }>>;
    destroyed: number;
    resized: number;
  }[] = [];
  const statuses: AmapStatus[] = [];
  class SimulatedMap implements AmapMap {
    markers: Record<string, unknown>[] = [];
    fits = 0;
    centers: number[][] = [];
    styles: string[] = [];
    destroyed = 0;
    constructor(
      _root: HTMLElement,
      public options: Record<string, unknown>,
    ) {
      maps.push(this);
    }
    add(markers: Record<string, unknown>[]) {
      this.markers.push(...markers);
    }
    remove(markers: Record<string, unknown>[]) {
      this.markers = this.markers.filter(value => !markers.includes(value));
    }
    setCenter(value: [number, number]) {
      this.centers.push(value);
    }
    setFitView() {
      this.fits++;
    }
    setMapStyle(style: string) {
      this.styles.push(style);
    }
    destroy() {
      this.destroyed++;
    }
  }
  const sdk: AmapSdk = {
    Map: SimulatedMap,
    Marker: class {
      constructor(options: Record<string, unknown>) {
        Object.assign(this, options);
      }
    },
    Pixel: class {
      constructor(
        public x: number,
        public y: number,
      ) {}
    },
    Geocoder: class {
      getLocation(address: string, callback: (status: string, value: unknown) => void) {
        queries.push({ address, callback });
      }
    },
  };
  const container = {
    ownerDocument: { defaultView: { Array } },
    isConnected: true,
    getBoundingClientRect: () => ({ width: 500, height: 260 }),
  } as unknown as HTMLElement;
  const controller = createAmapController({
    container,
    timeoutMs,
    onStatus: value => statuses.push(value),
    createFrame() {
      const loaded = deferred<{ sdk: AmapSdk; root: HTMLElement }>();
      const record = { loaded, destroyed: 0, resized: 0, frame: undefined as unknown as AmapFrame };
      record.frame = {
        ready: loaded.promise,
        resize() {
          record.resized++;
        },
        destroy() {
          record.destroyed++;
        },
      };
      frames.push(record);
      return record.frame;
    },
  });
  async function boot(view = visible) {
    controller.setConfig(config);
    controller.sync(view);
    frames.at(-1)!.loaded.resolve({ sdk, root: container });
    await flush();
  }
  return { controller, boot, frames, maps, queries, statuses, sdk, container };
}

describe('房车状态栏高德地图', () => {
  test('只有具体位置有效时组合地址，精确未知不影响未知原因和数值零', () => {
    expect(buildAmapAddress(['中国', '未知', '杭州', undefined, 0], '停车场')).toBe('中国 杭州 0 停车场');
    expect(buildAmapAddress(['中国', '杭州'], '未知')).toBe('');
    expect(buildAmapAddress(['中国', '杭州'], '')).toBe('');
    expect(buildAmapAddress(['中国'], '未知原因')).toBe('中国 未知原因');
  });

  test('两个标记先添加再调整视野，一个和零个结果不伪造坐标', async () => {
    const env = prepare();
    await env.boot();
    expect(env.queries.map(value => value.address)).toEqual(['主角地址', '房车地址']);
    env.queries[0]!.callback('complete', location(120, 30));
    env.queries[1]!.callback('complete', location(121, 31));
    await flush();
    const map = env.maps[0]!;
    expect(map.markers).toHaveLength(2);
    expect(map.fits).toBe(1);
    expect(map.markers.map(marker => marker.position)).toEqual([
      [120, 30],
      [121, 31],
    ]);
    expect(map.markers.every(marker => marker.clickable === false)).toBe(true);
    env.controller.sync({ ...visible, rvAddress: '没有结果' });
    expect(map.markers).toHaveLength(0);
    env.queries[2]!.callback('no_data', { info: 'NO_DATA' });
    await flush();
    expect(map.markers).toHaveLength(1);
    expect(map.centers).toEqual([[120, 30]]);
    env.controller.sync({ ...visible, protagonistAddress: '', rvAddress: '' });
    await flush();
    expect(map.markers).toHaveLength(0);
    expect(map.centers).toHaveLength(1);
    expect(map.fits).toBe(1);
    env.controller.dispose();
  });

  test('同地址只查询一次且坐标重合只偏移标记像素，缓存成功和无结果', async () => {
    const env = prepare();
    await env.boot({ ...visible, rvAddress: visible.protagonistAddress });
    expect(env.queries).toHaveLength(1);
    env.queries[0]!.callback('complete', {
      geocodes: [{ location: { lng: NaN, lat: 30 } }, { location: { getLng: () => 120, getLat: () => 30 } }],
    });
    await flush();
    expect(env.maps[0]!.markers.map(marker => marker.position)).toEqual([
      [120, 30],
      [120, 30],
    ]);
    expect(env.maps[0]!.markers.map(marker => marker.offset)).toEqual([
      { x: -14, y: 0 },
      { x: 14, y: 0 },
    ]);
    env.controller.sync({ ...visible, protagonistAddress: '空结果', rvAddress: '空结果' });
    env.queries[1]!.callback('complete', { geocodes: [{ location: { lng: 181, lat: 90 } }] });
    await flush();
    env.controller.sync({ ...visible, rvAddress: visible.protagonistAddress });
    await flush();
    env.controller.sync({ ...visible, protagonistAddress: '空结果', rvAddress: '空结果' });
    await flush();
    expect(env.queries).toHaveLength(2);
    env.controller.dispose();
  });

  test('收起时不创建或查询，回到总览更新尺寸和主题', async () => {
    const env = prepare();
    env.controller.setConfig(config);
    env.controller.sync({ ...visible, visible: false });
    expect(env.frames).toHaveLength(0);
    env.controller.sync(visible);
    env.frames[0]!.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    env.queries[0]!.callback('complete', location(120, 30));
    env.queries[1]!.callback('no_data', {});
    await flush();
    const resizeBefore = env.frames[0]!.resized;
    env.controller.sync({ ...visible, visible: false, protagonistAddress: '新地址', theme: 'dark' });
    expect(env.queries).toHaveLength(2);
    expect(env.frames).toHaveLength(1);
    expect(env.maps[0]!.styles.at(-1)).toBe('amap://styles/fresh');
    env.controller.sync({ ...visible, protagonistAddress: '新地址', theme: 'dark' });
    expect(env.frames[0]!.resized).toBeGreaterThan(resizeBefore);
    expect(env.queries.at(-1)!.address).toBe('新地址');
    env.controller.dispose();
  });

  test('旧聊天回调不渲染，换聊天清除标记和地址缓存', async () => {
    const env = prepare();
    await env.boot();
    const old = [...env.queries];
    env.controller.sync({ ...visible, target: 'chat-b' });
    expect(env.queries).toHaveLength(4);
    old[0]!.callback('complete', location(99, 9));
    old[1]!.callback('complete', location(98, 8));
    await flush();
    expect(env.maps[0]!.markers).toHaveLength(0);
    env.queries[2]!.callback('complete', location(120, 30));
    env.queries[3]!.callback('no_data', {});
    await flush();
    expect(env.maps[0]!.markers[0]!.position).toEqual([120, 30]);
    env.controller.clear('chat-c');
    expect(env.maps[0]!.markers).toHaveLength(0);
    env.controller.sync({ ...visible, target: 'chat-c' });
    expect(env.queries).toHaveLength(6);
    env.controller.dispose();
  });

  test('当前聊天地址改变后旧地址回调也不渲染', async () => {
    const env = prepare();
    await env.boot();
    const old = [...env.queries];
    env.controller.sync({ ...visible, protagonistAddress: '新地点', rvAddress: '' });
    old[0]!.callback('complete', location(99, 9));
    old[1]!.callback('complete', location(98, 8));
    await flush();
    expect(env.maps[0]!.markers).toHaveLength(0);
    env.queries[2]!.callback('complete', location(120, 30));
    await flush();
    expect(env.maps[0]!.markers[0]!.position).toEqual([120, 30]);
    env.controller.dispose();
  });

  test('改配置销毁旧 SDK，迟到加载不能创建旧地图，dispose 可重复', async () => {
    const env = prepare();
    env.controller.setConfig(config);
    env.controller.sync(visible);
    const oldFrame = env.frames[0]!;
    env.controller.setConfig({ key: 'new-fake', securityJsCode: 'new-fake-sec' });
    expect(oldFrame.destroyed).toBe(1);
    expect(env.frames).toHaveLength(2);
    oldFrame.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    expect(env.maps).toHaveLength(0);
    env.frames[1]!.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    expect(env.maps).toHaveLength(1);
    env.controller.dispose();
    env.controller.dispose();
    for (const query of env.queries) query.callback('complete', location(120, 30));
    await flush();
    expect(env.maps[0]!.destroyed).toBe(1);
    expect(env.maps[0]!.markers).toHaveLength(0);
    expect(env.frames[1]!.destroyed).toBe(1);
  });

  test('SDK 加载期间隐藏，再显示只创建一个地图且查询最新聊天', async () => {
    const env = prepare();
    env.controller.setConfig(config);
    env.controller.sync(visible);
    env.controller.sync({ ...visible, visible: false, target: 'chat-b', protagonistAddress: '新位置' });
    env.frames[0]!.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    expect(env.maps).toHaveLength(0);
    expect(env.queries).toHaveLength(0);
    env.controller.sync({ ...visible, target: 'chat-b', protagonistAddress: '新位置' });
    await flush();
    expect(env.maps).toHaveLength(1);
    expect(env.frames).toHaveLength(1);
    expect(env.queries[0]!.address).toBe('新位置');
    env.controller.dispose();
  });

  test('查询失败不永久缓存，详细错误隐藏配置，手动重新加载后可查询', async () => {
    const env = prepare();
    await env.boot();
    env.queries[0]!.callback('error', { info: 'fake-key fake-security INVALID_USER_KEY' });
    env.queries[1]!.callback('no_data', {});
    await flush();
    expect(env.statuses.at(-1)).toEqual({
      state: 'error',
      message: '地图暂时无法加载，位置文字仍可查看',
      detail: '[已隐藏] [已隐藏] INVALID_USER_KEY',
    });
    env.controller.sync(visible);
    expect(env.queries).toHaveLength(2);
    env.controller.reload();
    env.frames[1]!.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    expect(env.queries).toHaveLength(4);
    env.controller.dispose();
  });

  test('SDK 和地点查询均有有限等待，迟到结果不恢复成功', async () => {
    const env = prepare(8);
    env.controller.setConfig(config);
    env.controller.sync(visible);
    await Bun.sleep(25);
    expect(env.statuses.at(-1)!.state).toBe('error');
    expect(env.frames[0]!.destroyed).toBe(1);
    env.frames[0]!.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    expect(env.maps).toHaveLength(0);
    env.controller.reload();
    env.frames[1]!.loaded.resolve({ sdk: env.sdk, root: env.container });
    await flush();
    expect(env.queries).toHaveLength(2);
    await Bun.sleep(25);
    expect(env.statuses.at(-1)!.detail).toContain('地点查询等待超时');
    for (const query of env.queries) query.callback('complete', location(120, 30));
    await flush();
    expect(env.maps[0]!.markers).toHaveLength(0);
    env.controller.dispose();
  });

  test('独立 iframe 先设置安全密钥再加载 SDK，主页面全局不受影响', async () => {
    const parentAmap = { untouched: true },
      frameWindow: Record<string, unknown> = {};
    const order: string[] = [];
    let iframe: {
      onload: (() => void) | null;
      srcdoc: string;
      title: string;
      style: { cssText: string };
      contentDocument: unknown;
      contentWindow: unknown;
      remove(): void;
    };
    const root = {} as HTMLElement;
    const frameDocument = {
      getElementById: () => root,
      createElement: () => ({ src: '', async: false, onerror: null }),
      head: {
        appendChild(script: { src: string }) {
          expect(frameWindow._AMapSecurityConfig).toEqual({ securityJsCode: config.securityJsCode });
          expect(typeof frameWindow.rvAmapReady).toBe('function');
          expect(script.src).toContain('plugin=AMap.Geocoder');
          expect(script.src).toContain('key=fake-key');
          order.push('sdk');
        },
      },
    };
    const parentDocument = {
      defaultView: { AMap: parentAmap },
      createElement: () => {
        iframe = {
          onload: null,
          srcdoc: '',
          title: '',
          style: { cssText: '' },
          contentDocument: frameDocument,
          contentWindow: frameWindow,
          remove() {
            order.push('removed');
          },
        };
        return iframe;
      },
    };
    const container = {
      ownerDocument: parentDocument,
      appendChild() {
        order.push('frame');
      },
    } as unknown as HTMLElement;
    const frame = createAmapFrame(container, config);
    expect(iframe!.srcdoc).not.toContain(config.key);
    expect(iframe!.srcdoc).not.toContain(config.securityJsCode);
    iframe!.onload!();
    const sdk = prepare().sdk;
    frameWindow.AMap = sdk;
    (frameWindow.rvAmapReady as () => void)();
    expect(await frame.ready).toEqual({ sdk, root });
    expect(parentDocument.defaultView.AMap).toBe(parentAmap);
    expect(order).toEqual(['frame', 'sdk']);
    frame.destroy();
    expect(frameWindow.rvAmapReady).toBeUndefined();
    expect(frameWindow._AMapSecurityConfig).toBeUndefined();
    expect(order.at(-1)).toBe('removed');
  });
});
