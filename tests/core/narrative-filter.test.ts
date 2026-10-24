import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { parse } from 'yaml';
import type { DvsRegistration, DvsTables, DvsUpdateSourceState, DvsValues } from '../../types/sqlite-helper/dvs';
const cardRoot = resolve(import.meta.dir, '../..');
const unusedState: DvsUpdateSourceState = {
  get char(): never {
    throw new Error('正文准备不应访问角色库');
  },
  get chat(): never {
    throw new Error('正文准备不应访问聊天库');
  },
  fid: null,
  table() {
    throw new Error('本次只核对传入数据');
  },
};
function tables(): DvsTables {
  return {
    世界信息: [{ 标识: '世界', 日期时间: '2026-06-05 10:30' }],
    房车信息: [{ 标识: '房车', 所在地点: '停车场', 行车状态: '驻车', 拓展状态: '收起' }],
    主角信息: [{ 标识: '主角', 当前位置: '湖边', 状态: '步行' }],
    角色信息: ['同行', '未加入', '已离开', '未知'].map((status, index) => ({
      姓名: ['林安', '周宁', '许禾', '叶晴'][index]!,
      年龄: 25,
      身份: '旅行者',
      生活背景: '在本地工作',
      好感度: 20,
      对主角观感: '愿意交谈',
      同行状态: status,
      核心特质: '细心',
      穿着: '外套',
      当前位置: '湖边',
      心声: '想继续散步',
      相遇情境: '上轮见面',
      昵称: '未知',
    })),
    房车物资: [
      { 物品名: '饮用水', 数量: 2, 单位: '瓶', 说明: '未知', 状态: '完好', 存放位置: '车内' },
      { 物品名: '维修工具', 数量: 1, 单位: '套', 说明: '未知', 状态: '完好', 存放位置: '外部舱' },
    ],
    随身物品: ['玩家', '林安'].map(owner => ({
      持有人: owner,
      物品名: '手机',
      数量: 1,
      单位: '部',
      说明: '未知',
      状态: '可用',
    })),
  };
}
type TableCall = { name: string; rows: DvsValues[]; operations: Array<[string, ...unknown[]]> };
interface AuthorEntry {
  uid: number;
  name: string;
  enabled: boolean;
  order: number;
  content: string;
}

async function loadAuthor(input: DvsTables) {
  const calls: TableCall[] = [];
  let registration: DvsRegistration | undefined;
  let started: Promise<void> | undefined;
  const jquery = (value: unknown) => {
    if (typeof value === 'function') started = Promise.resolve(value());
    return { one() {} };
  };
  new Function(
    '$',
    'window',
    'waitGlobalInitialized',
    'getScriptId',
    'DVS',
    await Bun.file(resolve(cardRoot, '脚本/DVS.js')).text(),
  )(
    jquery,
    { parent: { Event, dispatchEvent() {} } },
    async () => {},
    () => 'rv-author',
    {
      register: async (value: DvsRegistration) => {
        registration = value;
        return () => {};
      },
      // 只记录作者调用，不复制 DVS 的表转换实现；rows 返回输入以观察作者自己计算的内容。
      table(name: string, rows?: DvsValues[]) {
        const call: TableCall = { name, rows: rows ?? input[name]!, operations: [] };
        calls.push(call);
        const table = {
          excludeFields(...args: unknown[]) {
            call.operations.push(['excludeFields', ...args]);
            return table;
          },
          excludeValues(...args: unknown[]) {
            call.operations.push(['excludeValues', ...args]);
            return table;
          },
          replaceValues(...args: unknown[]) {
            call.operations.push(['replaceValues', ...args]);
            return table;
          },
          rows: () => call.rows,
        };
        return table;
      },
    },
  );
  await started;
  if (!registration) throw new Error('房车作者脚本未完成注册');
  return { author: registration, calls };
}
async function narrativeEntries(): Promise<AuthorEntry[]> {
  const index = parse(await Bun.file(resolve(cardRoot, 'index.yaml')).text());
  const files = await readdir(resolve(cardRoot, '世界书'));
  const names = ['房车基础信息', '房车设定', '当前状态', '旅行与日常规划', '去AI味', '写作规范'];
  return Promise.all(
    index.条目.flatMap(
      (item: { 名称: string; 启用: boolean; 文件: string; 插入位置: { 顺序: number } }, uid: number) => {
        const name = item.名称.replace(/\[DVS_[^\]]+\]/g, '');
        if (!names.includes(name)) return [];
        return [
          (async () => {
            const path = item.文件.replaceAll('\\', '/');
            const matches = files.filter(file =>
              extname(path) ? file === basename(path) : basename(file, extname(file)) === basename(path),
            );
            expect(matches).toHaveLength(1);
            return {
              uid,
              name: item.名称,
              enabled: item.启用,
              order: item.插入位置.顺序,
              content: await Bun.file(resolve(cardRoot, '世界书', matches[0]!)).text(),
            };
          })(),
        ];
      },
    ),
  );
}

test('作者准备已离开角色七项资料，传入字段清理参数且不修改变量输入', async () => {
  const origin = tables(),
    before = structuredClone(origin),
    { author, calls } = await loadAuthor(origin);
  const prepared = await author.narrativePrepare({
    get char() {
      return unusedState.char;
    },
    get chat() {
      return unusedState.chat;
    },
    tables: origin,
  });
  expect(prepared.角色信息).toHaveLength(4);
  expect(prepared.角色信息![2]).toEqual({
    姓名: '许禾',
    年龄: 25,
    身份: '旅行者',
    生活背景: '在本地工作',
    关系阶段: '友善',
    对主角观感: '愿意交谈',
    同行状态: '已离开',
  });
  for (const index of [0, 1, 3]) {
    expect(prepared.角色信息![index]).toMatchObject({
      核心特质: '细心',
      穿着: '外套',
      心声: '想继续散步',
      关系阶段: '友善',
    });
  }
  expect(calls.map(({ name, operations }) => ({ name, operations }))).toEqual([
    {
      name: '角色信息',
      operations: [
        ['excludeFields', ['相遇情境', '好感度']],
        ['excludeValues', '未知'],
      ],
    },
    { name: '房车物资', operations: [['replaceValues', '未知', '']] },
    { name: '随身物品', operations: [['replaceValues', '未知', '']] },
  ]);
  expect(calls[1]!.rows).toBe(origin.房车物资!);
  expect(calls[2]!.rows).toBe(origin.随身物品!);
  expect(await author.beforeGen(unusedState, origin)).toBe(origin);
  expect(origin).toEqual(before);
});

test('实际索引声明物品复合键筛选、正文标签及四字段旅行规划', async () => {
  const { author } = await loadAuthor(tables()),
    entries = await narrativeEntries();
  expect(entries).toHaveLength(6);
  expect(author.uniqueKeys.房车物资).toEqual(['物品名']);
  expect(author.uniqueKeys.随身物品).toEqual(['持有人', '物品名']);
  const state = entries.find(entry => entry.name === '[DVS_NAR]当前状态')!;
  const filters = [...state.content.matchAll(/\[\[DVS_DATA_([^:\]]+):md:([^:\]]+):([\s\S]*?)\]\]/g)];
  expect(filters.map(match => [match[1], match[2]])).toEqual([
    ['房车物资', '本轮相关'],
    ['随身物品', '本轮相关'],
  ]);
  const detail = entries.find(entry => entry.content.includes('<item_豪华房车>'))!;
  expect(detail.content).toStartWith('[[DVS_FILTER:');
  const condition = /^\[\[DVS_FILTER:([\s\S]*?)\]\]/.exec(detail.content)![1]!;
  expect(condition).toContain('本轮已明确安排');
  expect(condition).toContain('返回、进入或使用房车');
  expect(condition).toContain('不能仅因之后可能用到而保留');
  for (const filter of filters) {
    expect(filter[3]).toContain('必要过程');
    expect(filter[3]).toContain('已有具体关联但细节未知');
    expect(filter[3]).toContain('不凭未安排的后续情节保留');
  }
  expect(state.content).toContain('额外的桶装饮用水和备用油桶另见房车物资');
  expect(state.content).not.toContain('| 饮用水 |');
  expect(state.content).not.toContain('维修工具');
  expect(entries.find(entry => entry.content.includes('<item_房车基础信息>'))!.name).toStartWith('[DVS_NAR]');
  const plotEntries = entries.filter(entry => entry.name.startsWith('[DVS_PLOT]'));
  expect(plotEntries).toHaveLength(1);
  const plot = plotEntries[0]!.content;
  expect([...plot.matchAll(/\[\[DVS_PLOT:start:([^\]]+)\]\]/g)].map(match => match[1])).toEqual([
    '本轮方向',
    '情节步骤',
    '事实与边界',
    '结束位置',
  ]);
  const style = entries.find(entry => entry.name.endsWith('去AI味'))!;
  const writing = entries.find(entry => entry.name.endsWith('写作规范'))!;
  expect(style.name).toContain('[DVS_FILTER_SKIP]');
  expect(style.name).toContain('[DVS_NAR]');
  expect(writing.name).toStartWith('[DVS_NAR]');
  expect(writing.name).not.toContain('[DVS_FILTER_SKIP]');
  expect(plot).toContain('不为制造剧情强行加入新人、事故或冲突');
  expect(plot).toContain('先依据完整资料规划至玩家本轮行动的结束位置');
  expect(plot).toContain('不为保留物资扩写剧情');
  const index = parse(await Bun.file(resolve(cardRoot, 'index.yaml')).text());
  const flags = index.扩展字段.酒馆助手.脚本库.find((script: { 名称: string }) => script.名称 === 'DVS').数据;
  expect(flags).toMatchObject({ dvs_enable: true, dvs_input_inject: true, dvs_plot: true });
});
