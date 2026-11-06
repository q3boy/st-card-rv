import { parseDocument, stringify } from 'yaml';

export const profileColumns = [
  [
    { title: '外貌与穿着', fields: ['相貌', '身材', '穿着'] },
    { title: '背景与处境', fields: ['生活背景', '当前处境'] },
  ],
  [
    { title: '性格与表达', fields: ['核心特质', '行为模式', '在意与反感', '说话风格'] },
    { title: '相遇与关系', fields: ['相遇情境', '对主角观感'] },
  ],
];

export const nsfwFields = [
  '胸部特征',
  '私处外观',
  '私处内部构造',
  '性经验',
  '性爱插入体验',
  '性爱技巧与偏好',
  '性爱生理反应',
];

export interface NpcGenerateResult {
  profile: string;
}
export interface NpcProfile {
  text: string;
  name: string;
  age: number;
  fields: Record<string, string>;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function display(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(display).join('\n');
  return record(value) ? stringify(value).trim() : String(value);
}

export function parseNpcProfile(input: string): NpcProfile {
  const text = input.trim();
  const match = /^<npc_([^<>\s]+)>([\s\S]*?)<\/npc_\1>$/.exec(text);
  if (!match || /<\/?npc_[^>]*>/.test(match[2]!))
    throw new Error('人设须为一组完整且同名的 <npc_姓名> 标签，标签外不要附加文字。');
  const document = parseDocument(match[2]!);
  if (document.errors.length) throw new Error(`人设 YAML 解析失败：${document.errors[0]!.message}`);
  const data: unknown = document.toJS();
  const name = match[1]!;
  if (name === '角色名' || name === '实际姓名') throw new Error('请将人设标签中的姓名占位文字替换为实际姓名。');
  const profile: unknown = Object.values(data ?? {})[0];
  if (!record(profile) || !record(profile.基础信息) || profile.基础信息.姓名 !== name)
    throw new Error('基础信息中的姓名须与人设标签一致。');
  const basic = profile.基础信息;
  if (typeof basic.年龄 !== 'number' || !Number.isInteger(basic.年龄) || basic.年龄 < 18)
    throw new Error('基础信息中的年龄须为不小于 18 的整数。');
  const fields: Record<string, string> = {};
  const groups = {
    基础信息: ['姓名', '昵称', '年龄', '身份'],
    背景设定: ['生活背景', '当前处境'],
    外貌特征: ['相貌', '身材', '穿着'],
    性格设定: ['核心特质', '行为模式'],
    关系与互动: ['相遇情境', '在意与反感', '对主角观感'],
    语言特征: ['说话风格'],
    NSFW设定: nsfwFields,
  };
  for (const [name, keys] of Object.entries(groups)) {
    const group = profile[name];
    for (const key of keys) fields[key] = record(group) ? display(group[key]) : '';
  }
  return { text, name, age: basic.年龄, fields };
}

export function parseNpcResult(result: unknown): NpcProfile {
  if (!record(result) || typeof result.profile !== 'string') throw new Error('已保存人设缺少完整标签文本。');
  return parseNpcProfile(result.profile);
}

export function npcResultPrompt(result: unknown): string {
  const profile = parseNpcResult(result);
  return `以下是玩家已经确认的 NPC 人设。本轮故事采用这份资料，不另行随机生成或改写这位 NPC 的人设。
请根据本轮用户输入和已有剧情继续正文。提供的 <npc_xxx> 标签以及内容必须在正文最后原样完整输出。

${profile.text}`;
}
