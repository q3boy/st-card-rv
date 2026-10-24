import { expect, test } from 'bun:test';
import { resourceLevel, rvArtKind, timeOfDay } from '../../状态栏/display';

const at = (time: string) => timeOfDay(`2026-06-05 ${time}`);

test('时段按整点小时划分，边界归属后一时段', () => {
  expect(
    [
      ['05:59', 'night'],
      ['06:00', 'dawn'],
      ['08:59', 'dawn'],
      ['09:00', 'day'],
      ['16:59', 'day'],
      ['17:00', 'dusk'],
      ['19:59', 'dusk'],
      ['20:00', 'night'],
      ['23:59', 'night'],
      ['00:00', 'night'],
      ['02:10', 'night'],
      ['18:40', 'dusk'],
    ].map(([time]) => at(time!)),
  ).toEqual(['night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night', 'night', 'night', 'dusk']);
});
test('未知、格式错误、小时大于 23 或分钟大于 59 时不判断时段', () => {
  for (const value of [
    '未知',
    '',
    '2026-06-05',
    '2026-06-05 6:30',
    '2026-06-05 18:40:00',
    '06-05 18:40',
    ' 2026-06-05 18:40',
    '2026-06-05 25:00',
    '2026-06-05 24:00',
    '2026-06-05 12:60',
    '2026-06-05T12:00',
    undefined,
    null,
    1830,
    {},
  ]) {
    expect(timeOfDay(value)).toBeNull();
  }
});
test('配图与标签三种组合，行车时忽略拓展状态', () => {
  expect(rvArtKind({ 行车状态: '行车', 拓展状态: '收起' })).toEqual({ kind: 'drive', label: '行车' });
  expect(rvArtKind({ 行车状态: '行车', 拓展状态: '展开' })).toEqual({ kind: 'drive', label: '行车' });
  expect(rvArtKind({ 行车状态: '驻车', 拓展状态: '收起' })).toEqual({ kind: 'park', label: '驻车' });
  expect(rvArtKind({ 行车状态: '驻车', 拓展状态: '展开' })).toEqual({ kind: 'expand', label: '拓展展开' });
});
test('资源档位按比例划分，10% 与 30% 归入更高一档，缺失不着色', () => {
  expect([0, 0.0999, 0.1, 0.2999, 0.3, 1, null].map(resourceLevel)).toEqual([
    'bad',
    'bad',
    'warn',
    'warn',
    'ok',
    'ok',
    null,
  ]);
});
