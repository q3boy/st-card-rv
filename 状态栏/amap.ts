import { iconMarker } from './icons';

export interface AmapConfig { key: string; securityJsCode: string }
export type AmapTheme = 'light' | 'dark';
export interface AmapView {
  /** 换聊天或清空数据时更换此值，使旧地点查询失效。 */
  target: unknown;
  visible: boolean;
  theme: AmapTheme;
  protagonistAddress: string;
  rvAddress: string;
}
export interface AmapStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  detail?: string;
}
type Coordinates = [number, number];
export interface AmapMap {
  add(markers: AmapMarker[]): void;
  remove(markers: AmapMarker[]): void;
  setCenter(position: Coordinates): void;
  setFitView(markers: AmapMarker[], immediately?: boolean, padding?: number[], maxZoom?: number): void;
  setMapStyle(style: string): void;
  destroy(): void;
}
export interface AmapMarker {}
export interface AmapSdk {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AmapMap;
  Marker: new (options: Record<string, unknown>) => AmapMarker;
  Pixel: new (x: number, y: number) => unknown;
  Geocoder: new () => { getLocation(address: string, callback: (status: string, result: unknown) => void): void };
}
export interface AmapFrame {
  ready: Promise<{ sdk: AmapSdk; root: HTMLElement }>;
  resize(): void;
  destroy(): void;
}
export interface AmapControllerOptions {
  container: HTMLElement;
  onStatus(status: AmapStatus): void;
  timeoutMs?: number;
  /** 测试只替换 SDK 环境；查询和标记流程仍执行本模块。 */
  createFrame?: (container: HTMLElement, config: AmapConfig) => AmapFrame;
}

interface MapWindow extends Window {
  AMap?: AmapSdk;
  _AMapSecurityConfig?: { securityJsCode: string };
  rvAmapReady?: () => void;
}

/** SDK 全局只存在于此同源 srcdoc 内，不修改酒馆的 AMap。 */
export function createAmapFrame(container: HTMLElement, config: AmapConfig): AmapFrame {
  const iframe = container.ownerDocument.createElement('iframe');
  iframe.title = '主角与房车位置地图';
  iframe.style.cssText = 'display:block;width:100%;height:100%;border:0';
  iframe.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden}#map div.amap-copyright{display:none!important}#map a.amap-logo{display:none!important}</style></head><body><div id="map"></div></body></html>';
  let disposed = false, initialized = false;
  let script: HTMLScriptElement | undefined;
  let frameWindow: MapWindow | undefined;
  let rejectReady: (reason: Error) => void = () => {};
  const ready = new Promise<{ sdk: AmapSdk; root: HTMLElement }>((resolve, reject) => {
    rejectReady = reject;
    iframe.onload = () => {
      if (disposed || initialized) return;
      initialized = true;
      const document = iframe.contentDocument;
      frameWindow = iframe.contentWindow as MapWindow | undefined;
      const root = document?.getElementById('map');
      if (!document || !frameWindow || !root) { reject(new Error('地图独立页面未能打开')); return; }
      frameWindow._AMapSecurityConfig = { securityJsCode: config.securityJsCode };
      frameWindow.rvAmapReady = () => {
        if (disposed) return;
        const sdk = frameWindow?.AMap;
        if (!sdk?.Map || !sdk.Geocoder || !sdk.Marker || !sdk.Pixel) {
          reject(new Error('高德地图组件未完整加载')); return;
        }
        resolve({ sdk, root });
      };
      script = document.createElement('script');
      script.async = true;
      script.onerror = () => { if (!disposed) reject(new Error('高德地图脚本加载失败')); };
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&plugin=AMap.Geocoder&callback=rvAmapReady`;
      document.head.appendChild(script);
    };
  });
  container.appendChild(iframe);
  return {
    ready,
    resize() {
      if (disposed || !frameWindow || !iframe.contentDocument) return;
      // resizeEnable 由 SDK 监听其自身窗口，重新显示后通知实际容器尺寸。
      const event = iframe.contentDocument.createEvent('Event');
      event.initEvent('resize', false, false);
      frameWindow.dispatchEvent(event);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      iframe.onload = null;
      if (script) script.onerror = null;
      if (frameWindow) {
        delete frameWindow.rvAmapReady;
        delete frameWindow._AMapSecurityConfig;
      }
      iframe.remove();
      rejectReady(new Error('地图已关闭'));
    },
  };
}

function coordinate(value: unknown): Coordinates | null {
  if (!value || typeof value !== 'object') return null;
  const location = value as { lng?: unknown; lat?: unknown; getLng?: () => number; getLat?: () => number };
  const lng = typeof location.getLng === 'function' ? location.getLng() : location.lng;
  const lat = typeof location.getLat === 'function' ? location.getLat() : location.lat;
  return typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
    && typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 ? [lng, lat] : null;
}

function resultLocation(status: string, result: unknown): Coordinates | null {
  if (status === 'no_data') return null;
  const data = result && typeof result === 'object' ? result as { info?: unknown; geocodes?: unknown } : {};
  if (status !== 'complete') throw new Error(typeof data.info === 'string' ? data.info : '地点查询失败');
  if (!Array.isArray(data.geocodes)) return null;
  for (const entry of data.geocodes) {
    const point = coordinate(entry && typeof entry === 'object' ? entry.location : null);
    if (point) return point;
  }
  return null;
}

/** 位置为空或精确未知时不能退回到城市中心。 */
export function buildAmapAddress(hierarchy: unknown[], position: unknown): string {
  if (position == null || position === '' || position === '未知') return '';
  return [...hierarchy, position].filter(value => value != null && value !== '' && value !== '未知').map(String).join(' ');
}

export function createAmapController(options: AmapControllerOptions) {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const frameFactory = options.createFrame ?? createAmapFrame;
  let config: AmapConfig | null = null;
  let view: AmapView = { target: null, visible: false, theme: 'light', protagonistAddress: '', rvAddress: '' };
  let frame: AmapFrame | undefined, sdk: AmapSdk | undefined, map: AmapMap | undefined, root: HTMLElement | undefined;
  let loading = false, failed = false, disposed = false, instance = 0, request = 0;
  let markers: AmapMarker[] = [];
  let appliedAddresses: string | undefined;
  let appliedTheme: AmapTheme | undefined;
  const cache = new Map<string, Coordinates | null>();
  const pending = new Map<string, Promise<Coordinates | null>>();
  const cancelWaits = new Set<() => void>();
  const cancelQueries = new Set<() => void>();

  function report(state: AmapStatus['state'], detail?: string) {
    if (disposed) return;
    if (detail && config) for (const secret of [config.key, config.securityJsCode]) {
      if (secret) detail = detail.split(secret).join('[已隐藏]');
    }
    options.onStatus({ state, message: state === 'error' ? '地图暂时无法加载，位置文字仍可查看' : state === 'loading' ? '正在加载地图' : '', ...(detail ? { detail } : {}) });
  }
  function canShow() {
    const rect = options.container.getBoundingClientRect();
    return view.visible && options.container.isConnected && rect.width > 0 && rect.height > 0;
  }
  function wait<T>(start: (resolve: (value: T) => void, reject: (reason: unknown) => void) => void, message: string, isQuery = false): Promise<T> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error: unknown, value?: T) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cancelWaits.delete(cancel);
        cancelQueries.delete(cancel);
        if (error) reject(error); else resolve(value as T);
      };
      const cancel = () => finish(new Error('地图请求已取消'));
      const timer = setTimeout(() => finish(new Error(message)), timeoutMs);
      cancelWaits.add(cancel);
      if (isQuery) cancelQueries.add(cancel);
      try { start(value => finish(null, value), error => finish(error)); } catch (error) { finish(error); }
    });
  }
  function clearMarkers() {
    if (markers.length) map?.remove(markers);
    markers = [];
    appliedAddresses = undefined;
    appliedTheme = undefined;
  }
  function invalidate() {
    request++;
    for (const cancel of [...cancelQueries]) cancel();
    pending.clear();
  }
  function destroy() {
    instance++;
    invalidate();
    for (const cancel of [...cancelWaits]) cancel();
    clearMarkers();
    map?.destroy();
    frame?.destroy();
    frame = undefined; map = undefined; sdk = undefined; root = undefined;
    loading = false; failed = false;
    cache.clear();
  }
  function style() { return 'amap://styles/fresh'; }
  function locate(address: string, geocoder: InstanceType<AmapSdk['Geocoder']>) {
    if (!address) return Promise.resolve(null);
    if (cache.has(address)) return Promise.resolve(cache.get(address)!);
    const existing = pending.get(address);
    if (existing) return existing;
    const promise = wait<Coordinates | null>((resolve, reject) => {
      geocoder.getLocation(address, (status, result) => {
        try { resolve(resultLocation(status, result)); } catch (error) { reject(error); }
      });
    }, '地点查询等待超时，请重新加载地图', true);
    pending.set(address, promise);
    void promise.finally(() => { if (pending.get(address) === promise) pending.delete(address); }).catch(() => {});
    return promise;
  }
  async function updateLocations() {
    if (!map || !sdk || !root || !canShow() || failed) return;
    const addresses = [view.protagonistAddress, view.rvAddress];
    const key = JSON.stringify(addresses);
    if (appliedAddresses === key && appliedTheme === view.theme) return;
    const keepView = appliedAddresses === key;
    const currentInstance = instance, currentRequest = ++request, target = view.target;
    const activeMap = map, activeSdk = sdk, activeRoot = root;
    clearMarkers();
    report('loading');
    try {
      const geocoder = new activeSdk.Geocoder();
      const points = await Promise.all(addresses.map(address => locate(address, geocoder)));
      if (disposed || currentInstance !== instance || currentRequest !== request || target !== view.target || !canShow()) return;
      for (let i = 0; i < addresses.length; i++) if (addresses[i]) cache.set(addresses[i]!, points[i]!);
      const same = points[0] && points[1] && points[0][0] === points[1][0] && points[0][1] === points[1][1];
      markers = points.flatMap((point, index) => point ? [new activeSdk.Marker({
        position: point, title: index === 0 ? '主角' : '房车', clickable: false,
        anchor: 'bottom-center', offset: new activeSdk.Pixel(same ? index === 0 ? -14 : 14 : 0, 0),
        content: `<span style="display:block;color:#214D47;filter:drop-shadow(0 0 1px white)">${iconMarker(index === 0 ? 'traveller' : 'rv')}</span>`,
      })] : []);
      activeMap.add(markers);
      if (!keepView) {
        if (markers.length === 2) {
          // 高德在此用 instanceof Array，标记列表须由 SDK 所在窗口创建。
          const MapArray = (activeRoot.ownerDocument.defaultView as Window & typeof globalThis).Array;
          activeMap.setFitView(MapArray.from(markers), false, [30, 30, 30, 30], 16);
        }
        else if (markers.length === 1) activeMap.setCenter(points.find(point => point !== null)!);
      }
      appliedAddresses = key;
      appliedTheme = view.theme;
      report('ready');
    } catch (error) {
      if (disposed || currentInstance !== instance || currentRequest !== request || target !== view.target) return;
      failed = true;
      report('error', error instanceof Error ? error.message : String(error));
    }
  }
  async function start() {
    if (disposed || !config || !canShow() || loading || failed) return;
    if (map) { void updateLocations(); return; }
    if (sdk && root) {
      try {
        map = new sdk.Map(root, { zoom: 13, resizeEnable: true, isHotspot: false, mapStyle: style(), viewMode: '2D' });
        frame?.resize(); void updateLocations();
      } catch (error) {
        failed = true;
        report('error', error instanceof Error ? error.message : String(error));
      }
      return;
    }
    loading = true;
    report('loading');
    const currentInstance = instance;
    try {
      frame = frameFactory(options.container, config);
      const currentFrame = frame;
      const loaded = await wait<{ sdk: AmapSdk; root: HTMLElement }>((resolve, reject) => { void currentFrame.ready.then(resolve, reject); }, '地图加载等待超时，请重新加载地图');
      if (disposed || currentInstance !== instance || frame !== currentFrame) return;
      sdk = loaded.sdk; root = loaded.root;
      loading = false;
      void start();
    } catch (error) {
      if (disposed || currentInstance !== instance) return;
      frame?.destroy(); frame = undefined;
      loading = false; failed = true;
      report('error', error instanceof Error ? error.message : String(error));
    }
  }
  return {
    setConfig(next: AmapConfig | null) {
      if (disposed) return;
      const normalized = next?.key && next.securityJsCode ? { ...next } : null;
      if (config?.key === normalized?.key && config?.securityJsCode === normalized?.securityJsCode) return;
      destroy(); config = normalized;
      report('idle');
      void start();
    },
    sync(next: AmapView) {
      if (disposed) return;
      const changed = next.target !== view.target || next.protagonistAddress !== view.protagonistAddress || next.rvAddress !== view.rvAddress;
      if (changed || next.visible !== view.visible) invalidate();
      if (next.target !== view.target) cache.clear();
      if (changed) clearMarkers();
      view = { ...next };
      map?.setMapStyle(style());
      if (canShow()) { frame?.resize(); void start(); }
    },
    clear(target: unknown = view.target) {
      if (disposed) return;
      invalidate(); clearMarkers(); cache.clear();
      view = { ...view, target, protagonistAddress: '', rvAddress: '' };
      report('idle');
    },
    resize() { if (!disposed && canShow()) { frame?.resize(); void start(); } },
    reload() { if (!disposed) { destroy(); report('idle'); void start(); } },
    dispose() { if (!disposed) { disposed = true; destroy(); } },
  };
}
