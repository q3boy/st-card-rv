import { expect, test } from 'bun:test';
import { nsfwFields, npcResultPrompt, parseNpcProfile, parseNpcResult } from '../../生成拦截/npc/profile';
import { npcText } from '../support/npc-profile';

test('标签内 YAML 映射全部原型分组，列表换行，保留原文和附加字段', () => {
  const text = npcText('林清', { 作者自定义: { 附加字段: '保留原文', 身份: '自定义同名字段' } });
  const parsed = parseNpcProfile(`\n${text}\n`);
  expect(parsed.text).toBe(text);
  expect(parsed.name).toBe('林清');
  expect(parsed.age).toBe(26);
  expect(parsed.fields.行为模式).toBe('先观察再行动\n认真听人说话');
  expect(parsed.fields.在意与反感).toBe('尊重约定\n反感催促');
  expect(nsfwFields.map(field => parsed.fields[field])).toEqual(nsfwFields.map((_, i) => `原字段值 ${i + 1}`));
  expect(parsed.fields.身份).toBe('旅行摄影师');
  expect(parsed.text).toContain('附加字段: 保留原文');
  expect(parsed.text).toContain('身份: 自定义同名字段');
});

test('解析错误标签、非 YAML、身份不一致和非整数年龄，拒绝将错误响应确认为候选', () => {
  const good = npcText();
  for (const text of [
    '说明\n' + good,
    good + good,
    good.replace('</npc_林清>', '</npc_其他>'),
    '<npc_林清>林清: [</npc_林清>',
    good.replace('姓名: 林清', '姓名: 其他'),
    good.replace('年龄: 26', '年龄: "26"'),
    npcText('角色名'),
    npcText('实际姓名'),
  ])
    expect(() => parseNpcProfile(text)).toThrow();
});

test('保存结果再次解析和正文交付采用同一份完整标签，不重新生成或裁切字段', () => {
  const text = npcText('林清', { 作者自定义: { 其他: '完整保留' } });
  const result = JSON.parse(JSON.stringify({ profile: text }));
  expect(parseNpcResult(result).text).toBe(text);
  const prompt = npcResultPrompt(result);
  expect(prompt.endsWith(text)).toBe(true);
  expect(prompt).toContain('提供的 <npc_xxx> 标签以及内容必须在正文最后原样完整输出。');
  expect(() => parseNpcResult({ profile: {} })).toThrow('完整标签文本');
});

test('跳过第一层标题及数量校验，取第一项人设并保留完整原文交付', () => {
  for (const title of ['角色名', '任意标题']) {
    const text = npcText().replace('\n林清:', `\n${title}:`).replace('</npc_', '附加顶层字段: 保留\n</npc_');
    const result = JSON.parse(JSON.stringify({ profile: text }));
    const parsed = parseNpcResult(result);
    expect(parsed.name).toBe('林清');
    expect(parsed.age).toBe(26);
    expect(parsed.fields.身份).toBe('旅行摄影师');
    expect(parsed.text).toBe(text);
    expect(npcResultPrompt(result).endsWith(text)).toBe(true);
    expect(() => parseNpcProfile(text.replace('姓名: 林清', '姓名: 其他'))).toThrow('姓名须与人设标签');
  }
});
