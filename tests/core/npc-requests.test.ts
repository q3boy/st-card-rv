import { expect, test } from 'bun:test';
import type { DvsPreNarrativeContext, DvsPreNarrativeModelRequest } from '../../生成拦截/types';
import { npcPrompts, requestNpc } from '../../生成拦截/npc/requests';
import { npcText } from '../support/npc-profile';

function setup() {
  const requests: DvsPreNarrativeModelRequest[] = [];
  const expanded: string[] = [];
  const entries = [
    {
      book: '不可作为标题',
      uid: 2,
      name: '[DVS:正文]人设生成',
      content: '[[DVS_FILTER:第二条件]]\n人设格式 {{user}}',
      enabled: false,
      order: 98,
    },
    {
      book: '不可作为标题',
      uid: 1,
      name: '[DVS:正文;可筛选]NPC生成机制',
      content: '[[dvs_filter:第一条件\n第二行]]\n生成规则 [[DVS_PREV_NARRATIVE]]',
      enabled: true,
      order: 97,
    },
  ];
  const context: DvsPreNarrativeContext = {
    userInput: '本轮输入',
    plotPlan: null,
    prompt: {
      userInput: () => '本轮输入',
      prevNarrative: () => '最近正文',
      historyNarrative: () => '',
      plotPlan: () => '',
      expand(text) {
        expanded.push(text);
        return text
          .replaceAll('[[DVS_USER_INPUT]]', '本轮输入')
          .replaceAll('[[DVS_PREV_NARRATIVE]]', '最近正文')
          .replaceAll('[[DVS_PLOT_PLAN]]', '');
      },
    },
    worldbook: {
      getEntries: async names => {
        expect(names).toEqual(['NPC生成机制', '人设生成']);
        return entries;
      },
    },
    requestModel: async request => {
      requests.push(request);
      return { content: npcText(), finishReason: 'stop' };
    },
    complete() {},
    cancel() {},
    signal: new AbortController().signal,
  };
  const substitute = (text: string) => text.replaceAll('{{user}}', '玩家');
  return { context, requests, expanded, entries, substitute };
}

test('首次请求按条目名称分组且无标题和筛选声明，返回后才统一展开宏', async () => {
  const f = setup();
  const built = await npcPrompts.initial(f.context, 2, f.substitute);
  expect(f.expanded).toEqual([]);
  const before = built.messages[1]!.content;
  expect(before.indexOf('生成规则')).toBeLessThan(before.indexOf('人设格式'));
  expect(before).toContain('[[DVS_PREV_NARRATIVE]]');
  expect(before).not.toMatch(/DVS_FILTER|第一条件|第二条件|不可作为标题|DVS_DATA/i);
  expect(before).toContain('<npc_generate>\n');
  expect(before).toContain('人设格式 玩家');
  expect(before).toContain('本轮已确定生成 2 位新女性角色');
  await requestNpc(f.context, 2, f.substitute);
  expect(f.expanded).toHaveLength(2);
  expect(f.requests[0]!.outputFormat).toBe('text');
  expect(f.requests[0]!.schema).toBeUndefined();
  expect(f.requests[0]!.messages[1]!.content).toContain('生成规则 最近正文');
  expect(f.requests[0]!.messages[1]!.content).toContain('本轮输入');
  expect(f.requests[0]!.messages[1]!.content).not.toMatch(/\[\[DVS_/);
  expect(f.entries[1]!.content).toContain('[[dvs_filter:');
});

test('再生成附带当前完整标签和新要求，空要求使用换人要求', async () => {
  const f = setup();
  const text = npcText();
  await requestNpc(
    f.context,
    { candidate: text, others: [npcText('林秋')], requirement: '保留姓名，穿蓝外套' },
    f.substitute,
  );
  const user = f.requests[0]!.messages[1]!.content;
  expect(user).toContain(text);
  expect(user).toContain(npcText('林秋'));
  expect(user).toContain('保留姓名，穿蓝外套');
  expect(user).toContain('最近正文');
  expect(user).toContain('本轮输入');
  expect(user).not.toMatch(/差异补丁|当前候选尚未成为|DVS_DATA/);
  const reroll = await npcPrompts.regenerate(
    f.context,
    { candidate: text, others: [], requirement: ' ' },
    f.substitute,
  );
  expect(reroll.messages[1]!.content).toContain('请重新构思另一位');
});

test('缺少必需条目时明确报错，不发送空资料请求', async () => {
  const f = setup();
  f.entries.splice(0, 1);
  await expect(requestNpc(f.context, 2, f.substitute)).rejects.toThrow('缺少“人设生成”');
  expect(f.requests).toEqual([]);
});

test('首次和再生成的 system 及情境前缀完全相同，变化内容放在规划之后', async () => {
  const f = setup();
  const initial = await npcPrompts.initial(f.context, 2, f.substitute);
  const regenerated = await npcPrompts.regenerate(
    f.context,
    { candidate: npcText(), others: [], requirement: '保留姓名' },
    f.substitute,
  );
  expect(initial.messages).toHaveLength(2);
  expect(regenerated.messages).toHaveLength(2);
  expect(initial.messages[0]).toEqual(regenerated.messages[0]);
  const first = initial.messages[1]!.content;
  const prefix = first.slice(0, first.indexOf('</plot_plan>') + '</plot_plan>'.length);
  expect(regenerated.messages[1]!.content.startsWith(prefix)).toBe(true);
  for (const tag of ['npc_generate', 'last_narrative', 'last_user_input', 'plot_plan']) {
    expect(prefix).toContain(`<${tag}>`);
    expect(prefix).toContain(`</${tag}>`);
  }
  expect(regenerated.messages[1]!.content).toContain('<messages>\n\n</messages>');
});

test('再生成完整保留历史顺序，最新人设和要求不在历史重复，组装后才展开宏', async () => {
  const f = setup();
  const first = npcText('第一人设');
  const second = npcText('第二人设');
  const latest = npcText('当前人设');
  const history = [
    { role: 'ai' as const, content: first },
    { role: 'user' as const, content: '保留职业 [[DVS_USER_INPUT]]' },
    { role: 'ai' as const, content: second },
    { role: 'user' as const, content: '改为短发' },
  ];
  await requestNpc(f.context, { candidate: latest, others: [], requirement: '穿蓝外套', history }, f.substitute);
  const text = f.requests[0]!.messages[1]!.content;
  const messages = text.split('<messages>\n')[1]!.split('\n</messages>')[0];
  expect(messages).toBe(
    [
      `<message role="ai">\n${first}\n</message>`,
      '<message role="user">\n保留职业 本轮输入\n</message>',
      `<message role="ai">\n${second}\n</message>`,
      '<message role="user">\n改为短发\n</message>',
    ].join('\n'),
  );
  expect(messages).not.toContain(latest);
  expect(messages).not.toContain('穿蓝外套');
  expect(text).toContain(`<last_npc_data>\n${latest}\n</last_npc_data>`);
  expect(text).toContain('<last_npc_generate_input>\n穿蓝外套\n</last_npc_generate_input>');
  expect(history[1]!.content).toContain('[[DVS_USER_INPUT]]');
  expect(f.expanded).toHaveLength(2);
});
