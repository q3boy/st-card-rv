import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { parse } from 'yaml';
interface AuthorEntry {
  name: string;
  enabled: boolean;
  order: number;
  content: string;
}

test('房车索引单独声明七项变量核对，实际业务规则内容与顺序完整', async () => {
  const index = parse(await Bun.file('index.yaml').text()) as {
    条目: Array<{ 名称: string; 启用: boolean; 插入位置: { 顺序: number } } & ({ 内容: string } | { 文件: string })>;
  };
  const files = await readdir('世界书');
  const entries: AuthorEntry[] = await Promise.all(
    index.条目.map(async item => {
      let content: string;
      if ('内容' in item) {
        content = item.内容;
      } else {
        const path = item.文件.replaceAll('\\', '/');
        const matches = files.filter(file =>
          extname(path) ? file === basename(path) : file.slice(0, -extname(file).length) === basename(path),
        );
        expect(matches).toHaveLength(1);
        content = await Bun.file(resolve('世界书', matches[0]!)).text();
      }
      return {
        name: item.名称,
        enabled: item.启用,
        order: item.插入位置.顺序,
        content,
      };
    }),
  );
  const cotEntry = entries.find(entry => entry.name === '[DVS_VAR_COT]本轮变量核对')!;
  expect(cotEntry.enabled).toBe(true);
  expect(cotEntry.order).toBe(116);
  expect(entries.slice(entries.indexOf(cotEntry) + 1).some(entry => entry.name.includes('[DVS_RULES]'))).toBe(false);
  expect(entries.indexOf(cotEntry)).toBeLessThan(entries.findIndex(entry => entry.name.includes('[DVS_DATA]')));
  expect(cotEntry.content.match(/^\d+\. /gm)).toHaveLength(7);
  for (const check of [
    '跨日、跨周、跨月、跨年',
    '外出不把房车移到主角所在处',
    '活动中途补给前后的分段',
    '跨持有人或公共与个人之间转移',
  ]) {
    expect(cotEntry.content).toContain(check);
  }
  const ruleEntries = entries.filter(entry => entry.name.startsWith('[DVS_RULES]'));
  expect(ruleEntries.every(entry => entry.enabled)).toBe(true);
  const rules = ruleEntries.map(entry => entry.content).join('\n');
  expect(rules).toContain('行车/驻车/外出时长互不重复，覆盖本轮经过时间');
  expect(rules).toContain('玩家决定的行动以玩家输入为依据');
  expect(rules).toContain('储备电力: 单位kWh，容量72，只读');
  expect(rules).toContain('按该项单位计，为非负整数');
  expect(cotEntry.content).toContain('心声可依据本轮剧情合理推测');
  expect(cotEntry.content).not.toContain('未写出的心声不补造');
  expect(rules).not.toContain('7. 输出核对');
});
