import { expect, test } from 'bun:test';
import {
  nsfwFields,
  npcResultPrompt,
  parseInitialProfiles,
  applyNpcAdjustment,
  parseNpcResult,
} from '../../生成拦截/npc/profile';
import { npcText } from '../support/npc-profile';

function list(...rows: string[]) {
  return `<npc_list>\n${rows.join('\n')}\n</npc_list>`;
}

test('首次按人数读取顶层人设分组，列表换行并保留完整原文', () => {
  const first = npcText('林清', { 作者自定义: { 附加字段: '保留原文', 身份: '自定义同名字段' } });
  const second = npcText('林秋');
  const [parsed, sister] = parseInitialProfiles('人设如下：\n' + list(first, second), 2);
  expect(parsed!.text).toBe(first);
  expect(parsed!.name).toBe('林清');
  expect(parsed!.age).toBe(26);
  expect(parsed!.fields.行为模式).toBe('先观察再行动\n认真听人说话');
  expect(parsed!.fields.在意与反感).toBe('尊重约定\n反感催促');
  expect(nsfwFields.map(field => parsed!.fields[field])).toEqual(nsfwFields.map((_, i) => `原字段值 ${i + 1}`));
  expect(parsed!.fields.身份).toBe('旅行摄影师');
  expect(sister!.text).toBe(second);
});

test('拒绝损坏的标签和 YAML、姓名不符、非整数年龄、人数不符及重复姓名', () => {
  const good = npcText();
  for (const content of [
    good,
    list(good.replace('</npc>', '</人设>')),
    list('<npc name="林清">基础信息: [</npc>'),
    list(good.replace('姓名: 林清', '姓名: 其他')),
    list(good.replace('年龄: 26', '年龄: "26"')),
    list(npcText('角色名')),
    list(npcText('实际姓名')),
    list(good, good),
    list(good, npcText('林秋')),
  ])
    expect(() => parseInitialProfiles(content, 1)).toThrow();
});

test('按原名单改名并更新相关人物，忽略多余角色且保存后逐名交付正文', () => {
  const original = parseInitialProfiles(list(npcText('林夏'), npcText('林秋')), 2);
  const renamed = npcText('沈夏');
  const linked = npcText('林秋', { 背景设定: { 生活背景: '和妹妹沈夏一起旅行' } });
  const next = applyNpcAdjustment(
    list(linked, renamed.replace('name="沈夏"', 'name="沈夏" oldname="林夏"'), '<npc name="无关新人">无效资料</npc>'),
    original,
  );
  expect(next.map(profile => profile.text)).toEqual([renamed, linked]);
  const result = { profile: next.map(profile => profile.text).join('\n\n') };
  expect(parseNpcResult(result)).toEqual(next);
  const prompt = npcResultPrompt(result);
  expect(prompt).toContain('提供的 <npc name="沈夏">、<npc name="林秋"> 标签');
  expect(prompt.endsWith(result.profile)).toBe(true);
  expect(prompt).not.toMatch(/oldname|npc_list/);
  expect(() => parseNpcResult({ profile: {} })).toThrow('完整标签文本');
});

test('空调整和未命中旧姓名保留原组，拒绝重复修改同一人、改名冲突和匹配人设损坏', () => {
  const original = parseInitialProfiles(list(npcText('林夏'), npcText('林秋')), 2);
  expect(applyNpcAdjustment(list(), original)).toEqual(original);
  const rename = (name: string, oldname: string) =>
    npcText(name).replace(`name="${name}"`, `oldname="${oldname}" name="${name}"`);
  expect(applyNpcAdjustment(list(rename('林夏', '陈青')), original)).toEqual(original);
  expect(() => applyNpcAdjustment(list(rename('沈夏', '林夏'), npcText('林夏')), original)).toThrow('重复修改');
  expect(() => applyNpcAdjustment(list(rename('林秋', '林夏')), original)).toThrow('姓名不能重复');
  expect(() => applyNpcAdjustment(list(rename('沈夏', '林夏'), '<npc name="林秋">无效资料</npc>'), original)).toThrow();
  expect(original.map(profile => profile.name)).toEqual(['林夏', '林秋']);
});
