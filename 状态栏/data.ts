import type { DvsApi, DvsState } from '../types/sqlite-helper/dvs';

export type DisplayValue = string | number | boolean | null | undefined;
export const worldFields = ['日期时间', '国家', '省份', '城市', '区域', '天气'] as const;
export const protagonistFields = ['当前位置', '状态', '资金', '粉丝数量'] as const;
export const rvFields = ['油料', '储备电力', '储备水源', '状态', '行车状态', '拓展状态', '所在地点'] as const;
export const characterNsfwFields = ['胸部特征', '私处外观', '私处内部构造', '性经验', '性爱插入体验', '性爱技巧与偏好', '性爱生理反应'] as const;
export const characterFields = ['姓名', '昵称', '年龄', '身份', '生活背景', '当前处境', '相貌', '身材', '穿着', ...characterNsfwFields, '核心特质', '行为模式', '相遇情境', '在意与反感', '对主角观感', '说话风格', '好感度', '当前位置', '同行状态', '状态', '心声'] as const;
export const supplyFields = ['物品名', '数量', '单位', '说明', '状态', '存放位置'] as const;
export const belongingFields = ['持有人', '物品名', '数量', '单位', '说明', '状态'] as const;
type DisplayRow<T extends readonly string[]> = { [K in T[number]]: DisplayValue };
export type WorldDisplay = DisplayRow<typeof worldFields>;
export type ProtagonistDisplay = DisplayRow<typeof protagonistFields>;
export type RvDisplay = DisplayRow<typeof rvFields>;
export type CharacterDisplay = DisplayRow<typeof characterFields>;
export type SupplyDisplay = DisplayRow<typeof supplyFields>;
export type BelongingDisplay = DisplayRow<typeof belongingFields>;
export interface RvDisplayData {
  playerName: string;
  world: WorldDisplay;
  protagonist: ProtagonistDisplay;
  rv: RvDisplay;
  characters: CharacterDisplay[];
  supplies: SupplyDisplay[];
  belongings: BelongingDisplay[];
}
export function formatValue(value: DisplayValue): string {
  return value === undefined || value === null || value === '未知' ? '—' : String(value);
}
export function formatDate(value: DisplayValue): string {
  if (typeof value !== 'string') return formatValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value);
  return match ? `${match[2]}.${match[3]} ${match[4]}` : formatValue(value);
}
export function resourceRatio(value: DisplayValue, capacity: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && capacity > 0 ? Math.min(1, Math.max(0, value / capacity)) : null;
}
/** JSON encodes the two business keys without collisions from separator characters. */
export function belongingKey(row: Pick<BelongingDisplay, '持有人' | '物品名'>): string {
  return JSON.stringify([row.持有人, row.物品名]);
}
function copy<T extends readonly string[]>(source: Record<string, unknown> | null, fields: T): DisplayRow<T> {
  const result: Record<string, DisplayValue> = {};
  for (const field of fields) {
    const value = source?.[field];
    result[field] = value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value) ? value as DisplayValue : undefined;
  }
  return result as DisplayRow<T>;
}
export async function readRvData(state: DvsState, playerName: string): Promise<RvDisplayData> {
  // Wait for all six operations even if one fails, before the controller starts another batch.
  const results = await Promise.allSettled([
    state.table('世界信息').row(), state.table('主角信息').row(), state.table('房车信息').row(),
    state.table('角色信息').rows(), state.table('房车物资').rows(), state.table('随身物品').rows(),
  ] as const);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  const value = <T>(result: PromiseSettledResult<T>): T => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  };
  // These three tables hold one INIT row each; a missing row means initialization failed, not empty fields.
  const [world, protagonist, rv] = [value(results[0]), value(results[1]), value(results[2])];
  for (const [table, row] of [['世界信息', world], ['主角信息', protagonist], ['房车信息', rv]] as const) {
    if (!row) throw new Error(`${table}没有数据行，请检查开场白变量初始化`);
  }
  return { playerName,
    world: copy(world, worldFields), protagonist: copy(protagonist, protagonistFields), rv: copy(rv, rvFields),
    characters: value(results[3]).map(row => copy(row, characterFields)), supplies: value(results[4]).map(row => copy(row, supplyFields)),
    belongings: value(results[5]).map(row => copy(row, belongingFields)),
  };
}

/** Object references distinguish reopened chats and replaced replies with the same numeric IDs. */
export interface RvReadTarget {
  character: string; chatId: string; chat: object; message: object; messageId: number; swipeId: number; fid: string | null;
}
export interface RvContext {
  characterId?: number | string; groupId?: number | string | null; chatId?: string;
  characters: Array<{ avatar: string }>;
  chat: Array<{ is_user?: boolean; is_system?: boolean; swipe_id?: number; extra?: { type?: string } }>;
}
export interface RvMessageHelper {
  getChatMessages(range: string, options: { include_swipes: true }): Array<{
    message_id: number; role: string; swipe_id: number; swipes_data: Array<Record<string, any>>;
  }>;
}
export function captureRvTarget(context: RvContext, helper: RvMessageHelper): RvReadTarget | null {
  if (context.groupId != null && context.groupId !== '' || context.characterId === undefined || context.characterId === '') return null;
  const character = context.characters[Number(context.characterId)]?.avatar;
  if (!character || !context.chatId || !context.chat.length) return null;
  const messages = helper.getChatMessages(`0-${context.chat.length - 1}`, { include_swipes: true });
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i]!, message = context.chat[row.message_id];
    if (!message || row.role !== 'assistant' || message.is_user || message.extra?.type === 'narrator') continue;
    const swipeId = message.swipe_id ?? 0, fid = row.swipes_data[swipeId]?.dvs?.fid;
    return { character, chatId: context.chatId, chat: context.chat, message, messageId: row.message_id, swipeId, fid: typeof fid === 'string' ? fid : null };
  }
  return null;
}
function sameChat(a: RvReadTarget | null, b: RvReadTarget | null): boolean {
  return !!a && !!b && a.character === b.character && a.chatId === b.chatId && a.chat === b.chat;
}
export function sameRvTarget(a: RvReadTarget | null, b: RvReadTarget | null): boolean {
  if (a === b) return true;
  return sameChat(a, b) && a!.message === b!.message && a!.messageId === b!.messageId && a!.swipeId === b!.swipeId && a!.fid === b!.fid;
}
export interface StatusbarReadState { data: RvDisplayData | null; loading: boolean; message: string; error: string; }
export interface StatusbarControllerOptions {
  dvs: Pick<DvsApi, 'getState' | 'onUpdate'>;
  captureTarget(): RvReadTarget | null;
  getPlayerName(): string;
  publish(state: StatusbarReadState): void;
  onClear?(): void;
}
export function createStatusbarController(options: StatusbarControllerOptions) {
  let alive = true, registered = false, serial = 0, dirty = false;
  let unsubscribe: (() => void) | undefined, work: Promise<void> | undefined;
  let displayedTarget: RvReadTarget | null = null;
  let view: StatusbarReadState = { data: null, loading: false, message: '暂无可读状态', error: '' };
  const publish = (next: Partial<StatusbarReadState>) => { view = { ...view, ...next }; if (alive) options.publish(view); };
  const clear = () => { displayedTarget = null; options.onClear?.(); publish({ data: null, loading: false, message: '暂无可读状态', error: '' }); };
  const capture = () => options.captureTarget();
  const drain = async () => {
    while (alive && registered && dirty) {
      dirty = false;
      const request = serial;
      let target: RvReadTarget | null = null;
      try {
        target = capture();
        if (displayedTarget && !sameChat(displayedTarget, target)) clear();
        if (!target) { publish({ loading: false, message: view.data ? '当前状态暂不可读，显示上次已读取数据' : '暂无可读状态', error: '' }); continue; }
        publish({ loading: true, error: '' });
        const state = await options.dvs.getState({ messageId: target.messageId, swipeId: target.swipeId });
        const data = await readRvData(state, options.getPlayerName());
        if (!alive || !registered || request !== serial) continue;
        if (!sameRvTarget(target, capture())) { dirty = true; serial++; continue; }
        displayedTarget = target;
        publish({ data, loading: false, message: '', error: '' });
      } catch (error) {
        if (!alive || !registered || request !== serial) continue;
        // A target changed during a failed query also invalidates its error message.
        if (target && !sameRvTarget(target, capture())) { dirty = true; serial++; continue; }
        publish({ loading: false, message: view.data ? '当前状态暂不可读，显示上次已读取数据' : '暂无可读状态',
          error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  const start = () => {
    if (!alive || !registered || work) return;
    // Defer once so same-stack notifications merge into one batch.
    work = Promise.resolve().then(drain).finally(() => { work = undefined; if (dirty && alive && registered) start(); });
  };
  const requestRefresh = () => {
    if (!alive) return;
    serial++; dirty = true;
    // Inspect the latest target now, even while the previous six-table batch is pending.
    // A failed inspection is reported by drain; it does not prove that the target changed.
    try { capture(); } catch { /* The read path delivers this error. */ }
    start();
  };
  return {
    requestRefresh,
    authorReady() {
      if (!alive) return;
      unsubscribe?.(); registered = true;
      try { unsubscribe = options.dvs.onUpdate(requestRefresh); requestRefresh(); }
      catch (error) { registered = false; publish({ loading: false, error: error instanceof Error ? error.message : String(error) }); }
    },
    authorClosed() { if (!alive) return; registered = false; unsubscribe?.(); unsubscribe = undefined; serial++; dirty = false; clear(); },
    chatChanged() { if (!alive) return; serial++; clear(); dirty = true; start(); },
    async whenIdle() { while (work) await work; },
    dispose() { if (!alive) return; alive = false; registered = false; serial++; dirty = false; unsubscribe?.(); unsubscribe = undefined; },
  };
}
