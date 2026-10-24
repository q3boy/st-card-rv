import type { RvIconName } from './icons';

/** 显示容量只决定条形长度，不修改作者业务值。 */
export const resourceDisplay = [
  { field: '储备水源', name: '清水', capacity: 1000, unit: 'L', icon: 'water' },
  { field: '储备电力', name: '电力', capacity: 72, unit: 'kWh', icon: 'power' },
  { field: '油料', name: '油料', capacity: 1000, unit: 'L', icon: 'fuel' },
] as const satisfies readonly { field: string; name: string; capacity: number; unit: string; icon: RvIconName }[];

export type ResourceLevel = 'ok' | 'warn' | 'bad';

/** 按储量比例分档：低于 10% 过低，低于 30% 偏低；比例缺失时不着色。 */
export function resourceLevel(ratio: number | null): ResourceLevel | null {
  return ratio === null ? null : ratio < 0.1 ? 'bad' : ratio < 0.3 ? 'warn' : 'ok';
}

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * 按世界信息「日期时间」（YYYY-MM-DD HH:mm）的小时划分时段：清晨 06–09、白天 09–17、傍晚 17–20、夜晚 20–06。
 * 未知、格式错误、小时大于 23 或分钟大于 59 时不判断，返回 null。
 */
export function timeOfDay(value: unknown): TimeOfDay | null {
  const match = typeof value === 'string' ? /^\d{4}-\d{2}-\d{2} (\d{2}):(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour >= 20 || hour < 6 ? 'night' : hour < 9 ? 'dawn' : hour < 17 ? 'day' : 'dusk';
}

export type RvArtKind = 'drive' | 'park' | 'expand';
export type RvArtLabel = '行车' | '驻车' | '拓展展开';

/** 房车配图与标签只看「行车状态」「拓展状态」；行车时忽略拓展状态。字段值直接比较，不另设回退。 */
export function rvArtKind(rv: { 行车状态?: unknown; 拓展状态?: unknown }): { kind: RvArtKind; label: RvArtLabel } {
  if (rv.行车状态 === '行车') return { kind: 'drive', label: '行车' };
  if (rv.拓展状态 === '展开') return { kind: 'expand', label: '拓展展开' };
  return { kind: 'park', label: '驻车' };
}
