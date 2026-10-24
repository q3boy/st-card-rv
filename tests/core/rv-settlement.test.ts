import { describe, expect, test } from 'bun:test';
import type { DvsPromptTables, DvsPromptValues } from '../../types/sqlite-helper/dvs';
import { sqlJs } from '../support/database';

interface RvRegistration {
  uniqueKeys: Record<string, string[]>;
  virtualTables: Record<string, { keys: string[]; fields: Record<string, string> }>;
  preUpdate(state: unknown, newTables: DvsPromptTables, oldTables: DvsPromptTables): DvsPromptTables;
}

// 执行卡片原脚本，取得实际注册的回调；只模拟脚本启动所需的酒馆接口。
async function loadCard() {
  const source = await Bun.file(new URL('../../脚本/DVS.js', import.meta.url)).text();
  let registration: RvRegistration | undefined, started: Promise<void> | undefined;
  const jquery = (value: unknown) => {
    if (typeof value === 'function') started = Promise.resolve(value());
    return { one() {} };
  };
  new Function('$', 'window', 'waitGlobalInitialized', 'getScriptId', 'DVS', source)(
    jquery,
    { parent: { Event, dispatchEvent() {} } },
    async () => {},
    () => 'rv-card',
    {
      register: async (value: RvRegistration) => {
        registration = value;
        return () => {};
      },
    },
  );
  await started;
  if (!registration) throw new Error('房车脚本没有注册DVS');
  return registration;
}

function tables(oil = 100, power = 20, water = 100): DvsPromptTables {
  return {
    世界信息: [{ 标识: '世界', 日期时间: '2026-06-05 10:30' }],
    房车信息: [{ 标识: '房车', 油料: oil, 储备电力: power, 储备水源: water, 所在地点: '停车场' }],
    主角信息: [{ 标识: '主角', 当前位置: '车内' }],
    角色信息: [],
    房车物资: [{ 物品名: '备用柴油', 数量: 4 }],
    随身物品: [],
  };
}

async function run(origin: DvsPromptTables, itinerary: DvsPromptValues[], ongoing: DvsPromptValues = {}) {
  const card = await loadCard(),
    next = structuredClone(origin);
  next.本轮结算 = [{ 行程: itinerary, 持续补充: ongoing }];
  return card.preUpdate({}, next, origin);
}

describe('房车卡本轮资源结算', () => {
  test('房车物资按非负整数存储，初值、合法更新及拒绝小数后的保存读回正确', async () => {
    const SQL = await sqlJs(),
      database = new SQL.Database();
    let reopened: InstanceType<typeof SQL.Database> | undefined;
    try {
      database.run(await Bun.file(new URL('../../世界书/DVS-DDL.sql', import.meta.url)).text());
      database.run(await Bun.file(new URL('../../世界书/DVS-INIT.sql', import.meta.url)).text());
      const quantity = () =>
        database.exec("SELECT 数量, typeof(数量) FROM 房车物资 WHERE 物品名='备用柴油'")[0]!.values;
      expect(database.exec('SELECT count(*) FROM 房车物资')[0]!.values).toEqual([[24]]);
      expect(
        database.exec("SELECT count(*) FROM 房车物资 WHERE typeof(数量) != 'integer' OR 数量 < 0")[0]!.values,
      ).toEqual([[0]]);
      expect(quantity()).toEqual([[4, 'integer']]);
      for (const value of [0.5, -1]) {
        expect(() => database.run("UPDATE 房车物资 SET 数量=? WHERE 物品名='备用柴油'", [value])).toThrow();
        expect(quantity()).toEqual([[4, 'integer']]);
      }
      database.run("UPDATE 房车物资 SET 数量=0 WHERE 物品名='备用柴油'");
      expect(quantity()).toEqual([[0, 'integer']]);
      database.run("UPDATE 房车物资 SET 数量=3 WHERE 物品名='备用柴油'");
      reopened = new SQL.Database(database.export());
      expect(reopened.exec("SELECT 数量, typeof(数量) FROM 房车物资 WHERE 物品名='备用柴油'")[0]!.values).toEqual([
        [3, 'integer'],
      ]);
    } finally {
      reopened?.close();
      database.close();
    }
  });
  test('声明无键单行虚拟表，六张真实表的业务键不变', async () => {
    const card = await loadCard();
    expect(card.virtualTables).toEqual({ 本轮结算: { keys: [], fields: { 行程: 'array', 持续补充: 'object' } } });
    expect(card.uniqueKeys).toEqual({
      世界信息: ['标识'],
      房车信息: ['标识'],
      主角信息: ['标识'],
      角色信息: ['姓名'],
      房车物资: ['物品名'],
      随身物品: ['持有人', '物品名'],
    });
  });
  test('按方案行程先补满再行车驻车，轮末补入太阳能、风电与雨水', async () => {
    const origin = tables(800, 30, 500),
      before = structuredClone(origin);
    const result = await run(
      origin,
      [
        { 类型: '补给', 来源: '家附近的加油站', 资源: '油', 数量: 'FULL' },
        { 类型: '行车', 起点: '加油站', 终点: '湖边营地', 道路类型: '铺装', 距离: 120, 时间: 150 },
        { 类型: '驻车', 地点: '湖边营地', 时间: 180 },
        { 类型: '额外消耗', 行为: '洗车', 资源: '水', 数量: 100 },
        { 类型: '补给', 来源: '营地加水', 资源: '水', 数量: 'FULL' },
        { 类型: '外出', 地点: '步道', 时间: 240 },
      ],
      { 太阳能时长: 300, 风电时长: 120, 雨水收集: { 时长: 90, 平均降雨强度: 2 } },
    );
    expect(result.房车信息![0]).toMatchObject({ 油料: 957.7, 储备电力: 37.15, 储备水源: 1000 });
    expect(result).not.toHaveProperty('本轮结算');
    expect(origin).toEqual(before);
    expect(result.房车物资).toEqual(origin.房车物资);
  });
  test('铺装与非铺装分别按距离耗油，三种活动按整车时长结算并在末尾取精度', async () => {
    const result = await run(tables(), [
      { 类型: '行车', 道路类型: '铺装', 距离: 10, 时间: 60 },
      { 类型: '行车', 道路类型: '非铺装', 距离: 2, 时间: 30 },
      { 类型: '驻车', 时间: 120 },
      { 类型: '外出', 时间: 60 },
    ]);
    expect(result.房车信息![0]).toMatchObject({ 油料: 95.3, 储备电力: 19.05, 储备水源: 91.3 });
  });
  test('消耗限制下限、补给限制容量，补满后继续消耗仍被扣除', async () => {
    const result = await run(tables(1, 1, 1), [
      { 类型: '额外消耗', 行为: '大量使用', 资源: '油', 数量: 20 },
      { 类型: '额外消耗', 行为: '大量使用', 资源: '电', 数量: 20 },
      { 类型: '额外消耗', 行为: '大量使用', 资源: '水', 数量: 20 },
      { 类型: '补给', 来源: '补给点', 资源: '油', 数量: 2000 },
      { 类型: '补给', 来源: '补给点', 资源: '电', 数量: 200 },
      { 类型: '补给', 来源: '补给点', 资源: '水', 数量: 2000 },
      { 类型: '驻车', 时间: 60 },
    ]);
    expect(result.房车信息![0]).toMatchObject({ 油料: 999.9, 储备电力: 71.2, 储备水源: 997.5 });
    const emptied = await run(tables(1, 1, 1), [
      { 类型: '额外消耗', 行为: '大量使用', 资源: '油', 数量: 20 },
      { 类型: '额外消耗', 行为: '大量使用', 资源: '电', 数量: 20 },
      { 类型: '额外消耗', 行为: '大量使用', 资源: '水', 数量: 20 },
    ]);
    expect(emptied.房车信息![0]).toMatchObject({ 油料: 0, 储备电力: 0, 储备水源: 0 });
  });
  test('行车耗电与充电合并计算；持续补充采用轮末合计并限制容量', async () => {
    const driving = await run(tables(100, 71.9, 100), [{ 类型: '行车', 道路类型: '铺装', 距离: 0, 时间: 60 }]);
    expect(driving.房车信息![0]!.储备电力).toBe(72);
    const ongoing = await run(tables(100, 0, 10), [{ 类型: '额外消耗', 行为: '洗车', 资源: '水', 数量: 100 }], {
      太阳能时长: 6000,
      风电时长: 6000,
      雨水收集: { 时长: 120, 平均降雨强度: 2 },
    });
    expect(ongoing.房车信息![0]).toMatchObject({ 油料: 100, 储备电力: 72, 储备水源: 56 });
    const full = await run(tables(1, 1, 1), [
      { 类型: '补给', 资源: '油', 数量: 'FULL' },
      { 类型: '补给', 资源: '电', 数量: 'FULL' },
      { 类型: '补给', 资源: '水', 数量: 'FULL' },
    ]);
    expect(full.房车信息![0]).toMatchObject({ 油料: 1000, 储备电力: 72, 储备水源: 1000 });
  });
  test('补给与额外消耗按资源只修改对应储量，支持小数及零数量', async () => {
    for (const [resource, field] of [
      ['油', '油料'],
      ['电', '储备电力'],
      ['水', '储备水源'],
    ] as const) {
      for (const type of ['补给', '额外消耗']) {
        const origin = tables(),
          expected = { ...origin.房车信息![0] };
        expected[field] = Number(expected[field]) + (type === '补给' ? 1.25 : -1.25);
        // 油、水在本轮末保留一位小数；电保留两位。
        if (resource !== '电') expected[field] = type === '补给' ? 101.3 : 98.8;
        const result = await run(origin, [{ 类型: type, 资源: resource, 数量: 1.25 }]);
        expect(result.房车信息![0]).toEqual(expected);
        const unchanged = await run(origin, [{ 类型: type, 资源: resource, 数量: 0 }]);
        expect(unchanged.房车信息).toEqual(origin.房车信息);
      }
    }
  });
  test('FULL只补满指定资源，不改变其它两项储量', async () => {
    for (const [resource, field, capacity] of [
      ['油', '油料', 1000],
      ['电', '储备电力', 72],
      ['水', '储备水源', 1000],
    ] as const) {
      const origin = tables(),
        expected = { ...origin.房车信息![0], [field]: capacity };
      const result = await run(origin, [{ 类型: '补给', 资源: resource, 数量: 'FULL' }]);
      expect(result.房车信息![0]).toEqual(expected);
    }
  });
  test('保留位置与其它业务表变更，原生输入不变且最终被删除', async () => {
    const card = await loadCard(),
      origin = tables(),
      next = structuredClone(origin);
    const input = { 行程: [{ 类型: '外出', 时间: 60 }], 持续补充: {} };
    next.本轮结算 = [input];
    next.房车信息![0]!.油料 = 999;
    next.房车信息![0]!.所在地点 = '营地';
    next.主角信息![0]!.当前位置 = '步道';
    next.房车物资![0]!.数量 = 3;
    const result = card.preUpdate({}, next, origin);
    expect(result).toBe(next);
    expect(result.房车信息![0]).toMatchObject({ 油料: 100, 储备电力: 19.9, 储备水源: 100, 所在地点: '营地' });
    expect(result.主角信息![0]!.当前位置).toBe('步道');
    expect(result.房车物资![0]!.数量).toBe(3);
    expect(input).toEqual({ 行程: [{ 类型: '外出', 时间: 60 }], 持续补充: {} });
    expect(result).not.toHaveProperty('本轮结算');
  });
  test('缺少本轮输入时不重复结算，空起点没有凭空创建房车行', async () => {
    const card = await loadCard(),
      origin = tables();
    const result = await run(origin, [{ 类型: '外出', 时间: 60 }]);
    expect(card.preUpdate({}, structuredClone(result), result)).toEqual(result);
    const empty: DvsPromptTables = { 房车信息: [], 本轮结算: [] };
    expect(card.preUpdate({}, empty, { 房车信息: [] })).toEqual({ 房车信息: [] });
  });
  test('只在轮末四舍五入，十进制中点不因浮点误差向下取整', async () => {
    const result = await run(tables(1000, 1.005, 1000), [{ 类型: '行车', 道路类型: '铺装', 距离: 1, 时间: 0 }]);
    expect(result.房车信息![0]).toMatchObject({ 油料: 999.7, 储备电力: 1.01, 储备水源: 1000 });
  });
  test('未发生的行程或持续补充允许省略，提供了错误类型仍报错', async () => {
    const card = await loadCard();
    const examples: [DvsPromptValues, number][] = [
      [{ 行程: [{ 类型: '外出', 时间: 60 }] }, 19.9],
      [{ 持续补充: { 太阳能时长: 60 } }, 21.5],
      [{}, 20],
    ];
    for (const [input, expectedPower] of examples) {
      const next = tables();
      next.本轮结算 = [input];
      expect(card.preUpdate({}, next, tables()).房车信息![0]!.储备电力).toBe(expectedPower);
      expect(next).not.toHaveProperty('本轮结算');
    }
    const invalid: DvsPromptValues[] = [{ 行程: null }, { 行程: {} }, { 持续补充: null }, { 持续补充: [] }];
    for (const input of invalid) {
      const next = tables();
      next.本轮结算 = [input];
      expect(() => card.preUpdate({}, next, tables())).toThrow();
    }
  });
  test('错误输入明确拒绝，不把错误类型、负数或非数值当作零消耗', async () => {
    const events: DvsPromptValues[] = [
      { 类型: '行车', 道路类型: '高速', 距离: 10, 时间: 60 },
      { 类型: '驻车', 时间: -1 },
      { 类型: '外出', 时间: '60' },
      { 类型: '额外消耗', 行为: '洗车', 资源: '水', 数量: -10 },
      { 类型: '未知' },
      { 类型: '补给', 资源: '柴油', 数量: 10 },
      { 类型: '额外消耗', 资源: '储备水源', 数量: 10 },
      { 类型: '补给', 数量: 10 },
      { 类型: '额外消耗', 资源: '水' },
      { 类型: '补给', 资源: '电', 数量: '10' },
      { 类型: '补给', 资源: '水', 数量: null },
      { 类型: '补给', 资源: '油', 数量: -1 },
      { 类型: '额外消耗', 资源: '水', 数量: 'FULL' },
      { 类型: '补给', 资源: '电', 数量: Infinity },
      { 类型: '额外消耗', 资源: '油', 数量: NaN },
    ];
    for (const event of events) await expect(run(tables(), [event])).rejects.toThrow();
    const card = await loadCard(),
      next = tables();
    next.本轮结算 = [
      { 行程: [], 持续补充: {} },
      { 行程: [], 持续补充: {} },
    ];
    expect(() => card.preUpdate({}, next, tables())).toThrow('只能有一行');
    await expect(run({ 房车信息: [] }, [{ 类型: '驻车', 时间: 60 }])).rejects.toThrow('缺少房车');
  });
});

describe('房车信息的行车状态与拓展状态', () => {
  test('DDL 用 CHECK 限定两个取值，INIT 写入驻车与收起，非法值被拒绝，保存后读回', async () => {
    const SQL = await sqlJs(),
      database = new SQL.Database();
    let reopened: InstanceType<typeof SQL.Database> | undefined;
    try {
      database.run(await Bun.file(new URL('../../世界书/DVS-DDL.sql', import.meta.url)).text());
      database.run(await Bun.file(new URL('../../世界书/DVS-INIT.sql', import.meta.url)).text());
      const read = () => database.exec('SELECT 行车状态, 拓展状态 FROM 房车信息')[0]!.values;
      expect(read()).toEqual([['驻车', '收起']]);
      for (const [field, value] of [
        ['行车状态', '停车'],
        ['行车状态', ''],
        ['拓展状态', '半收起'],
        ['拓展状态', '全部收起'],
      ] as const) {
        expect(() => database.run(`UPDATE 房车信息 SET ${field}=?`, [value])).toThrow();
        expect(read()).toEqual([['驻车', '收起']]);
      }
      database.run("UPDATE 房车信息 SET 行车状态='行车'");
      database.run("UPDATE 房车信息 SET 行车状态='驻车', 拓展状态='展开'");
      reopened = new SQL.Database(database.export());
      expect(reopened.exec('SELECT 行车状态, 拓展状态 FROM 房车信息')[0]!.values).toEqual([['驻车', '展开']]);
      database.run('DELETE FROM 房车信息');
      database.run('INSERT INTO 房车信息 (油料, 储备电力, 储备水源) VALUES (1, 1, 1)');
      expect(read()).toEqual([['驻车', '收起']]);
    } finally {
      reopened?.close();
      database.close();
    }
  });
  test('变量规则写明可用值和判断标准', async () => {
    const rules = await Bun.file(new URL('../../世界书/DVS-RULES_房车信息.yaml', import.meta.url)).text();
    for (const text of ['“行车”或“驻车”', '“收起”或“展开”', '任一机构展开即为展开']) expect(rules).toContain(text);
  });
});
