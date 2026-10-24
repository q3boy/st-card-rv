import { expect, test } from 'bun:test';
import { belongingKey, captureRvTarget, formatDate, formatValue, readRvData, resourceRatio } from '../../状态栏/data';
import { gate } from '../support/database';
import type { DvsState } from '../../types/sqlite-helper/dvs';

test('显示只替换缺失与精确未知，保留零、负值、空串和无', () => {
  expect([undefined, null, '未知', 0, -25, '', '无', '未知原因', false].map(formatValue)).toEqual([
    '—',
    '—',
    '—',
    '0',
    '-25',
    '',
    '无',
    '未知原因',
    'false',
  ]);
  expect(formatDate('2026-06-18 16:40')).toBe('06.18 16:40');
  expect(formatDate('未知')).toBe('—');
});
test('资源条钳制而原值不变，缺失值不当作零', () => {
  expect(resourceRatio(1200, 1000)).toBe(1);
  expect(formatValue(1200)).toBe('1200');
  expect(resourceRatio(-2, 72)).toBe(0);
  expect(resourceRatio(0, 1000)).toBe(0);
  expect(resourceRatio('未知', 1000)).toBeNull();
  expect(resourceRatio(undefined, 72)).toBeNull();
  expect(resourceRatio(36, 72)).toBe(0.5);
});
test('随身物品复合业务键不会因分隔符冲突', () => {
  expect(belongingKey({ 持有人: 'A|B', 物品名: 'C' })).not.toBe(belongingKey({ 持有人: 'A', 物品名: 'B|C' }));
});
// 本地行只准备状态栏消费的公开方法；不模拟 DVS 的数据库或写入实现。
function displayState() {
  const rows: Record<string, Record<string, unknown>[]> = {
    世界信息: [
      {
        rid: new Uint8Array(16),
        日期时间: '2026-06-18 16:40',
        国家: '中国',
        省份: '浙江省',
        城市: '杭州市',
        区域: '西湖区',
        天气: '晴',
        internal: 'hidden',
      },
    ],
    主角信息: [{ 当前位置: '湖畔营地', 状态: '休息', 资金: 100, 粉丝数量: 0 }],
    房车信息: [
      { 油料: 100, 储备电力: 20, 储备水源: 100, 状态: '正常', 行车状态: '驻车', 拓展状态: '收起', 所在地点: '停车场' },
    ],
    角色信息: [
      { rid: new Uint8Array(16), 姓名: 'NPC', 年龄: 20, 好感度: -10, update() {}, remove() {}, internal: 'hidden' },
    ],
    房车物资: [{ 物品名: '饮用水', 数量: 2 }],
    随身物品: [{ 持有人: 'NPC', 物品名: '手机', 数量: 1 }],
  };
  const state = {
    table(name: string) {
      return {
        async row() {
          return rows[name]![0] ?? null;
        },
        async rows() {
          return rows[name]!;
        },
      };
    },
  } as unknown as DvsState;
  return { state, rows };
}

test('六表公开行转为独立显示副本，不包含代理方法、rid 或内部字段', async () => {
  const { state, rows } = displayState();
  const data = await readRvData(state, '实际玩家姓名');
  expect(data.playerName).toBe('实际玩家姓名');
  expect(data.characters[0]?.好感度).toBe(-10);
  expect(Object.keys(data.world)).toEqual(['日期时间', '国家', '省份', '城市', '区域', '天气']);
  expect(Object.keys(data.characters[0]!)).not.toContain('rid');
  expect(Object.keys(data.characters[0]!)).not.toContain('update');
  expect(Object.keys(data.characters[0]!)).not.toContain('internal');
  data.characters[0]!.姓名 = '显示改名';
  expect(rows.角色信息![0]!.姓名).toBe('NPC');
});
test('最新 AI 包含隐藏回复，从当前 Helper 消息范围读取引用、swipe 和 fid', () => {
  const chat = [{}, { is_user: true }, { is_system: true }, { extra: { type: 'narrator' } }];
  const target = captureRvTarget(
    { characterId: 0, chatId: 'chat', characters: [{ avatar: 'rv.png' }], chat },
    {
      getChatMessages(range, options) {
        expect(range).toBe('0-3');
        expect(options).toEqual({ include_swipes: true });
        return chat.map((_, i) => ({
          message_id: i,
          role: i === 1 ? 'user' : 'assistant',
          swipe_id: 0,
          swipes_data: [{ dvs: { fid: 'fixed' } }],
        }));
      },
    },
  );
  expect(target?.messageId).toBe(2);
  expect(target?.chat).toBe(chat);
  expect(target?.message).toBe(chat[2]);
  expect(target?.fid).toBe('fixed');
});
test('部分表失败也等其它表读完，不发布半组新数据', async () => {
  const entered = gate(),
    release = gate();
  let settled = false;
  const state = {
    table(name: string) {
      return {
        async row() {
          if (name === '世界信息') {
            entered.release();
            await release.promise;
            return {};
          }
          throw new Error('其中一表失败');
        },
        async rows() {
          return [];
        },
      };
    },
  } as unknown as DvsState;
  const pending = readRvData(state, '玩家').catch(error => {
    settled = true;
    return error;
  });
  await entered.promise;
  await Promise.resolve();
  expect(settled).toBe(false);
  release.release();
  expect((await pending).message).toBe('其中一表失败');
});
test('世界、主角、房车三张单行表缺行时报错并指出具体表，其它表允许为空', async () => {
  const stateWithout = (missing: string | null) =>
    ({
      table(name: string) {
        return {
          async row() {
            return name === missing ? null : {};
          },
          async rows() {
            return [];
          },
        };
      },
    }) as unknown as DvsState;
  for (const table of ['世界信息', '主角信息', '房车信息']) {
    await expect(readRvData(stateWithout(table), '玩家')).rejects.toThrow(`${table}没有数据行`);
  }
  const data = await readRvData(stateWithout(null), '玩家');
  expect(data.characters).toEqual([]);
  expect(data.supplies).toEqual([]);
  expect(data.belongings).toEqual([]);
});
test('房车信息读取保留公开行中的行车状态和拓展状态', async () => {
  const { state } = displayState();
  const { rv } = await readRvData(state, '玩家');
  expect(rv.行车状态).toBe('驻车');
  expect(rv.拓展状态).toBe('收起');
});
