import type { DvsPreNarrativeContext, DvsPreNarrativeModelRequest } from '../types';

type SubstituteMacros = (text: string) => string;
export type NpcHistoryMessage = { role: 'ai' | 'user'; content: string };

export function resolveNpcRequirement(requirement: string): string {
  return requirement.trim() || '请重新构思另一位符合本轮情境的 NPC，遵守本轮用户输入中的明确要求。';
}

export const npcSystemPrompt = `你负责为房车旅行故事准备一位新的NPC候选，供玩家在界面中查看和调整。

本次任务只生成人设资料，不生成后续故事。

根据本轮 last_user_input、last_narrative和plot_plan，生成新npc数据。
不得将上下文中已登场角色改名后冒充新人。

<npc_generate> 中提供本次使用的世界书资料和人设格式。
先写故事、再在 AI 回复末尾附加人设的叙事流程不适用于本次请求；本次直接返回人设标签及内容，分组和字段格式采用<npc_template> 中的模板。

有剧情规划时采用其中的相遇方向，但尚待界面确认的姓名、外貌和性格由本次任务确定。
没有剧情规划时直接根据最近正文和本轮输入构思，不虚构一份已经确认的规划。

严格只输出一组完整的 <npc_实际姓名>...</npc_实际姓名> 标签及其中的人设内容。
- 不输出故事正文、分析、解释、开场白、Markdown 代码围栏、JSON 或 <npc_generate> 包装。
- 标签之前和结束标签之后都不得输出其他文字。`;

async function materials(context: DvsPreNarrativeContext, substitute: SubstituteMacros): Promise<string> {
  const names = ['NPC生成机制', '人设生成'];
  const entries = await context.worldbook.getEntries(names);
  const groups = names.map(name => {
    const matched = entries.filter(entry => entry.name.replace(/\[DVS(?::|_)[^\]]*\]/gi, '').trim() === name);
    if (!matched.length) throw new Error(`当前角色绑定的世界书缺少“${name}”条目。`);
    return matched.map(entry => substitute(entry.content.replace(/\[\[DVS_FILTER:[\s\S]*?\]\]/gi, ''))).join('\n\n');
  });
  return `请为本轮即将出现的新角色生成一份完整候选人设。

<npc_generate>
${groups.join('\n\n')}
</npc_generate>

<last_narrative>
[[DVS_PREV_NARRATIVE]]
</last_narrative>

<last_user_input>
[[DVS_USER_INPUT]]
</last_user_input>

<plot_plan>
本轮剧情规划；空白表示没有规划
[[DVS_PLOT_PLAN]]
</plot_plan>`;
}

function request(content: string): DvsPreNarrativeModelRequest {
  return {
    outputFormat: 'text',
    messages: [
      { role: 'system', content: npcSystemPrompt },
      { role: 'user', content },
    ],
  };
}

export const npcPrompts = {
  async initial(context: DvsPreNarrativeContext, substitute: SubstituteMacros): Promise<DvsPreNarrativeModelRequest> {
    return request(`${await materials(context, substitute)}

结合 last_narrative/last_user_input/plot_plan 构思这个角色，再按 npc_generate 内要求的格式填写完整资料。
用户已经明确指定的设定应当体现在候选中，其余部分保持合理且具有辨识度。

严格只输出一组使用实际姓名的 <npc_角色名>...</npc_角色名> 标签及其中的完整人设内容，不输出任何其他文字。`);
  },
  async regenerate(
    context: DvsPreNarrativeContext,
    input: { candidate: string; requirement: string; history?: readonly NpcHistoryMessage[] },
    substitute: SubstituteMacros,
  ): Promise<DvsPreNarrativeModelRequest> {
    return request(`${await materials(context, substitute)}

<messages>
${(input.history ?? []).map(message => `<message role="${message.role}">\n${message.content}\n</message>`).join('\n')}
</messages>
<last_npc_data>
${input.candidate}
</last_npc_data>
<last_npc_generate_input>
${resolveNpcRequirement(input.requirement)}
</last_npc_generate_input>

调整规则：
1. 执行 last_npc_generate_input 中的生成要求；有具体调整要求时，以 last_npc_data 为当前候选修改。messages 中用户此前明确提出、且未被后续要求修改或撤销的要求继续有效；要求冲突时以较新的用户要求为准。没有涉及的内容尽量保持，仅为消除新旧设定之间的矛盾进行必要联动调整。
2. 返回完整的新角色人设标签及内容，不省略未修改的人设内容，不同时输出旧候选或多个人物。

严格只输出一组使用实际姓名的 <npc_角色名>...</npc_角色名> 标签及其中的完整人设内容，不输出任何其他文字。`);
  },
};

export async function requestNpc(
  context: DvsPreNarrativeContext,
  candidate: string | undefined,
  requirement: string,
  substitute: SubstituteMacros,
  history: readonly NpcHistoryMessage[] = [],
) {
  const built =
    candidate === undefined
      ? await npcPrompts.initial(context, substitute)
      : await npcPrompts.regenerate(context, { candidate, requirement, history }, substitute);
  return context.requestModel({
    ...built,
    messages: built.messages.map(message => ({ ...message, content: context.prompt.expand(message.content) })),
  });
}
