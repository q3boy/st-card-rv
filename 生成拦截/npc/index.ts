import type { DvsPreNarrativeRegistration } from '../types';
import { npcResultPrompt, parseNpcResult } from './profile';
import { hasNpcCount } from './count';

function showError(container: HTMLElement, error: unknown) {
  const notice = container.ownerDocument.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.textContent = `无法展示人设资料：${error instanceof Error ? error.message : String(error)}`;
  container.append(notice);
  return () => notice.remove();
}

function mountView(
  container: HTMLElement,
  render: (view: typeof import('./view')) => () => void,
  signal?: AbortSignal,
) {
  let disposed = false;
  let unmount = () => {};
  void import('./view')
    .then(view => {
      if (!disposed && !signal?.aborted) unmount = render(view);
    })
    .catch(error => {
      if (!disposed && !signal?.aborted) unmount = showError(container, error);
    });
  return () => {
    disposed = true;
    unmount();
  };
}

export const npcInteraction: DvsPreNarrativeRegistration = {
  key: 'npc_generate',
  buttonText: '查看/重新生成NPC',
  paramsSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'integer',
        minimum: 1,
        description: '本轮新登场的女性角色人数。按玩家要求确定，未指定时根据剧情和前文合理安排 1 至 4 人。',
      },
    },
    required: ['count'],
    additionalProperties: false,
  },
  validateParams: hasNpcCount,
  insist: '正文最后必须按已确认名单的顺序，原样完整输出每位 NPC 的人设标签及内容。',
  condition: `用户没有明确要求不生成新角色，且满足以下任一条件：
- 当前没有同行女性角色，并且最近一轮正文及本轮输入没有正在延续的已登场女性角色互动。
- 用户表达了希望新女性角色登场的意图。结合本轮输入的语义判断，无需出现“新增角色”等命令字样。
本交互用于确认新 NPC 人设，不用于重新随机生成已经登场的人物。`,
  narrativeEntriesSkip: ['NPC生成机制', '人设生成'],
  component: {
    mount(container, context) {
      return mountView(container, view => view.mountNpcView(container, context), context.signal);
    },
    mountResult(container, result) {
      let profiles: ReturnType<typeof parseNpcResult>;
      try {
        profiles = parseNpcResult(result);
      } catch (error) {
        return showError(container, error);
      }
      const summary = container.ownerDocument.createElement('div');
      for (const profile of profiles) {
        const line = container.ownerDocument.createElement('div');
        line.textContent = `${profile.name} · ${profile.age}岁 · ${profile.fields.身份}`;
        summary.append(line);
      }
      container.append(summary);
      return () => summary.remove();
    },
    toPrompt: npcResultPrompt,
  },
};
