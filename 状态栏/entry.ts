import { createApp, h, shallowReactive } from 'vue';
import App from './App.vue';
import styles from 'virtual:rv-styles';
import { captureRvTarget, sameRvTarget, createStatusbarController, type StatusbarReadState, type RvContext, type RvMessageHelper, type RvReadTarget } from './data';
import type { DvsApi, DvsUpdateStatus } from '../types/sqlite-helper/dvs';
import type { PublicDatabaseApi } from '../types/sqlite-helper/sqlite-helper';

interface CardOwner extends Window { __rvStatusbarInstances?: Map<string, { dispose(): void }>; SillyTavern: { getContext(): RvContext }; }
interface HelperWindow extends Window, RvMessageHelper {
  Vue: { version: string }; DVS: DvsApi; SqliteHelper: PublicDatabaseApi;
  waitGlobalInitialized(name: string): Promise<void>;
  getScriptId(): string;
  substitudeMacros(text: string): string;
  eventOn(name: string, callback: () => void): { stop(): void };
  tavern_events: Record<string, string>;
}

/** One hidden Helper script iframe owns one app in the parent document. */
export async function startStatusbar(helper: HelperWindow) {
  const owner = helper.parent as CardOwner, id = helper.getScriptId();
  const instances = owner.__rvStatusbarInstances ??= new Map();
  instances.get(id)?.dispose();
  let alive = true, app: ReturnType<typeof createApp> | undefined, host: HTMLElement | undefined;
  let controller: ReturnType<typeof createStatusbarController> | undefined;
  const stops: Array<() => void> = [];
  const instance = { dispose() {
    if (!alive) return;
    alive = false; controller?.dispose();
    for (const stop of stops.splice(0)) stop();
    app?.unmount(); host?.remove();
    if (instances.get(id) === instance) instances.delete(id);
  } };
  instances.set(id, instance);
  helper.addEventListener('pagehide', instance.dispose, { once: true });
  stops.push(() => helper.removeEventListener('pagehide', instance.dispose));
  const idleStatus = (): DvsUpdateStatus => ({ phase: 'idle', attempt: 0, maxAttempts: 0, retryDelayMs: 0 });
  let model: (StatusbarReadState & { target: number; active: boolean; mapAvailable: boolean; updateStatus: DvsUpdateStatus }) | undefined;
  let stopUpdateStatus: (() => void) | undefined;
  const unsubscribeStatus = () => { stopUpdateStatus?.(); stopUpdateStatus = undefined; };
  stops.push(unsubscribeStatus);
  const ready = () => {
    if (!alive || !model) return;
    unsubscribeStatus();
    model.updateStatus = helper.DVS.getUpdateStatus();
    stopUpdateStatus = helper.DVS.onUpdateStatus(status => { if (alive && model?.active) model.updateStatus = status; });
    model.active = true; controller?.authorReady();
  };
  const closed = () => { if (alive && model) { unsubscribeStatus(); model.updateStatus = idleStatus(); model.active = false; controller?.authorClosed(); } };
  try {
    await Promise.all([helper.waitGlobalInitialized('DVS'), helper.waitGlobalInitialized('SqliteHelper')]);
    if (!alive) return instance;
    if (!helper.Vue || !/^3\.5\./.test(helper.Vue.version)) throw new Error('旅行手册需要酒馆助手提供兼容的 Vue 3.5 运行环境，请更新酒馆助手后重开角色。');
    model = shallowReactive<StatusbarReadState & { target: number; active: boolean; mapAvailable: boolean; updateStatus: DvsUpdateStatus }>({ data: null, loading: false, message: '暂无可读状态', error: '', target: 0, active: false, mapAvailable: false, updateStatus: idleStatus() });
    const getRole = () => { const context = owner.SillyTavern.getContext(); return context.characters[Number(context.characterId)]?.avatar; };
    let lastTarget: RvReadTarget | null = null;
    const captureTarget = () => {
      const target = captureRvTarget(owner.SillyTavern.getContext(), helper);
      if (model && !sameRvTarget(target, lastTarget)) { model.mapAvailable = false; lastTarget = target; }
      return target;
    };
    controller = createStatusbarController({ dvs: helper.DVS,
      captureTarget,
      getPlayerName: () => helper.substitudeMacros('{{user}}'),
      publish: state => { if (alive && model) { if (state.data && state.data !== model.data) model.mapAvailable = true; Object.assign(model, state); } },
      onClear: () => { if (alive && model) { model.mapAvailable = false; model.target++; } },
    });
    host = owner.document.createElement('div'); host.id = `rv-statusbar-${id}`;
    const shadow = host.attachShadow({ mode: 'open' }), style = owner.document.createElement('style'), root = owner.document.createElement('div');
    style.textContent = styles; shadow.append(style, root); owner.document.body.append(host);
    const display = model;
    app = createApp({ render: () => h(App, { model: display, owner, getChar: () => helper.SqliteHelper.char, getRole, regen: () => helper.DVS.regen(), inject: { get: () => helper.DVS.getInject(), set: flags => helper.DVS.setInject(flags) } }) });
    app.mount(root);
    for (const event of ['CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_RECEIVED', 'MESSAGE_UPDATED']) {
      const name = helper.tavern_events[event]; if (!name) continue;
      const subscription = helper.eventOn(name, () => { if (event === 'CHAT_CHANGED') controller?.chatChanged(); else controller?.requestRefresh(); });
      stops.push(() => subscription.stop());
    }
    stops.push(helper.DVS.onRegistrationChange(registered => { if (registered) ready(); else closed(); }));
  } catch (error) {
    console.error('旅行手册启动失败：', error);
    instance.dispose();
  }
  return instance;
}

void startStatusbar(window as unknown as HelperWindow);
