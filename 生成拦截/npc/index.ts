import type { DvsPreNarrativeRegistration } from '../types';
import { npcResultPrompt, parseNpcResult } from './profile';

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
  insist: '提供的 <npc_xxx> 标签以及内容必须在正文最后原样完整输出。',
  condition: `用户没有明确要求不生成新角色，且满足以下任一条件：
- 当前没有同行人员，并且最近一轮正文及本轮输入没有正在延续的已登场角色互动。
- 用户明确要求新增角色。
本交互用于确认新 NPC 人设，不用于重新随机生成已经登场的人物。`,
  narrativeEntriesSkip: ['NPC生成机制', '人设生成'],
  component: {
    mount(container, context) {
      return mountView(container, view => view.mountNpcView(container, context), context.signal);
    },
    mountResult(container, result) {
      let profile: ReturnType<typeof parseNpcResult>;
      try {
        profile = parseNpcResult(result);
      } catch (error) {
        return showError(container, error);
      }
      const summary = container.ownerDocument.createElement('div');
      summary.textContent = `${profile.name} · ${profile.age}岁 · ${profile.fields.身份}`;
      container.append(summary);
      return () => summary.remove();
    },
    toPrompt: npcResultPrompt,
  },
};
