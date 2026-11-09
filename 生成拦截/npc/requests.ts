import type { DvsPreNarrativeContext, DvsPreNarrativeModelRequest } from '../types';

type SubstituteMacros = (text: string) => string;
export type NpcHistoryMessage = { role: 'ai' | 'user'; content: string };
interface Adjustment {
  candidate: string;
  others: readonly string[];
  requirement: string;
  history?: readonly NpcHistoryMessage[];
}

export function resolveNpcRequirement(requirement: string): string {
  return (
    requirement.trim() ||
    '请重新构思另一位符合本轮情境的 NPC，保留其在同组人物中的关系和相遇背景，其余设定可以重新构思。'
  );
}

export const npcSystemPrompt = `你负责为房车旅行故事准备本轮新登场 NPC 的候选人设，供玩家查看和调整。

本次任务只生成人设资料，不生成后续故事。

根据本轮 last_user_input、last_narrative和plot_plan，生成新npc数据。
不得将上下文中已登场角色改名后冒充新人。

<npc_generate> 中提供本次使用的世界书资料和人设格式。
先写故事、再在 AI 回复末尾附加人设的叙事流程不适用于本次请求；本次直接返回人设标签及内容，分组和字段格式采用<npc_template> 中的模板。

有剧情规划时采用其中的相遇方向，但尚待界面确认的姓名、外貌和性格由本次任务确定。
没有剧情规划时直接根据最近正文和本轮输入构思，不虚构一份已经确认的规划。

每位 NPC 按 <npc_template> 要求完整填写在 <npc name="实际姓名">...</npc> 标签中，name 属性与基础信息中的姓名一致。
多个 npc 标签逐个完整输出，整体用 <npc_list>...</npc_list> 包裹。
- 不输出故事正文、分析、解释、开场白、Markdown 代码围栏、JSON 或其它标签包裹。
- <npc_list> 标签之前和结束标签之后都不得输出其他文字。`;

async function materials(context: DvsPreNarrativeContext, substitute: SubstituteMacros): Promise<string> {
  const names = ['NPC生成机制', '人设生成'];
  const entries = await context.worldbook.getEntries(names);
  const groups = names.map(name => {
    const matched = entries.filter(entry => entry.name.replace(/\[DVS(?::|_)[^\]]*\]/gi, '').trim() === name);
    if (!matched.length) throw new Error(`当前角色绑定的世界书缺少“${name}”条目。`);
    return matched.map(entry => substitute(entry.content.replace(/\[\[DVS_FILTER:[\s\S]*?\]\]/gi, ''))).join('\n\n');
  });
  return `<npc_generate>
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
  async initial(
    context: DvsPreNarrativeContext,
    count: number,
    substitute: SubstituteMacros,
  ): Promise<DvsPreNarrativeModelRequest> {
    return request(`${await materials(context, substitute)}

本轮已确定生成 ${count} 位新女性角色。根据 last_narrative/last_user_input/plot_plan 为每位角色生成一份完整候选人设。
遵守玩家指定的身份和人物关系，已登场的角色不计入人数。
多人共同登场时，每个人都要有自己的姓名和完整资料。涉及彼此的称呼、关系、共同经历和本次相遇缘由，在各自人设中应当吻合。`);
  },
  async regenerate(
    context: DvsPreNarrativeContext,
    input: Adjustment,
    substitute: SubstituteMacros,
  ): Promise<DvsPreNarrativeModelRequest> {
    return request(`${await materials(context, substitute)}

<messages>
${(input.history ?? []).map(message => `<message role="${message.role}">\n${message.content}\n</message>`).join('\n')}
</messages>
<last_npc_data>
${input.candidate}
</last_npc_data>
<other_npcs>
${input.others.join('\n\n')}
</other_npcs>
<last_npc_generate_input>
${resolveNpcRequirement(input.requirement)}
</last_npc_generate_input>

调整规则：
1. 执行 last_npc_generate_input 中的生成要求；有具体调整要求时，以 last_npc_data 为当前候选修改。messages 中用户此前明确提出、且未被后续要求修改或撤销的要求继续有效；要求冲突时以较新的用户要求为准。没有涉及的内容尽量保持，仅为消除新旧设定之间的矛盾进行必要联动调整。
2. other_npcs 是同组其他人的当前人设。仅当本次调整影响其现有人设内容时才对应修改，无变化的人物不输出。
3. 返回有变化的人物，每人输出含全部字段的完整人设。改名时写为 <npc name="新姓名" oldname="调整前姓名">，人设中的姓名也改为新姓名。
4. 全部无变化时返回 <npc_list></npc_list>。`);
  },
};

export async function requestNpc(
  context: DvsPreNarrativeContext,
  input: number | Adjustment,
  substitute: SubstituteMacros,
) {
  const built =
    typeof input === 'number'
      ? await npcPrompts.initial(context, input, substitute)
      : await npcPrompts.regenerate(context, input, substitute);
  return context.requestModel({
    ...built,
    messages: built.messages.map(message => ({ ...message, content: context.prompt.expand(message.content) })),
  });
}
