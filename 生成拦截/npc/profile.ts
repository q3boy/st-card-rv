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

function responseList(input: string) {
  const list = /<npc_list>([\s\S]*?)<\/npc_list>/.exec(input);
  if (!list) throw new Error('人设响应缺少完整的 <npc_list> 标签。');
  return list[1]!;
}

function* npcBlocks(input: string) {
  const source = input.trim();
  const tag =
    /\s*<npc\s+((?:name="[^"<>]+"(?:\s+oldname="[^"<>]+")?|oldname="[^"<>]+"\s+name="[^"<>]+"))\s*>([\s\S]*?)<\/npc>/gy;
  while (tag.lastIndex < source.length) {
    const match = tag.exec(source);
    if (!match || /<\/?npc(?:\s|>)/.test(match[2]!))
      throw new Error('人设须为完整的 <npc name="姓名">...</npc> 标签。');
    const attributes = Object.fromEntries(
      Array.from(match[1]!.matchAll(/(name|oldname)="([^"]+)"/g), attr => [attr[1], attr[2]]),
    );
    yield { name: attributes.name!, oldname: attributes.oldname, body: match[2]! };
  }
}

function profileFromBlock(name: string, body: string): NpcProfile {
  const document = parseDocument(body);
  if (document.errors.length) throw new Error(`人设 YAML 解析失败：${document.errors[0]!.message}`);
  const profile: unknown = document.toJS();
  if (name === '角色名' || name === '实际姓名') throw new Error('请将人设标签中的姓名占位文字替换为实际姓名。');
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
  return { text: `<npc name="${name}">${body}</npc>`, name, age: basic.年龄, fields };
}

function validateNames(profiles: readonly NpcProfile[]) {
  if (new Set(profiles.map(profile => profile.name)).size !== profiles.length)
    throw new Error('同组 NPC 姓名不能重复。');
}

function readProfiles(input: string) {
  const profiles = Array.from(npcBlocks(input), block => profileFromBlock(block.name, block.body));
  if (!profiles.length) throw new Error('缺少 NPC 人设。');
  validateNames(profiles);
  return profiles;
}

export function parseInitialProfiles(input: string, count: number): NpcProfile[] {
  const profiles = readProfiles(responseList(input));
  if (profiles.length !== count) throw new Error(`需要 ${count} 位 NPC，实际返回 ${profiles.length} 位。`);
  return profiles;
}

export function applyNpcAdjustment(input: string, current: readonly NpcProfile[]): NpcProfile[] {
  const next = [...current];
  const updated = new Set<number>();
  for (const block of npcBlocks(responseList(input))) {
    const index = current.findIndex(profile => profile.name === (block.oldname ?? block.name));
    if (index < 0) continue;
    if (updated.has(index)) throw new Error(`同一份调整中重复修改了 ${current[index]!.name}。`);
    updated.add(index);
    next[index] = profileFromBlock(block.name, block.body);
  }
  validateNames(next);
  return next;
}

export function parseNpcResult(result: unknown): NpcProfile[] {
  if (!record(result) || typeof result.profile !== 'string') throw new Error('已保存人设缺少完整标签文本。');
  return readProfiles(result.profile);
}

export function npcResultPrompt(result: unknown): string {
  const profiles = parseNpcResult(result);
  const names = profiles.map(profile => `<npc name="${profile.name}">`).join('、');
  return `以下是玩家已经确认的 ${profiles.length} 位 NPC 人设。本轮故事采用这份资料，不另行随机生成或改写这些 NPC 的人设。
请根据本轮用户输入和已有剧情继续正文。
提供的 ${names} 标签以及内容必须在正文最后原样完整输出。

${profiles.map(profile => profile.text).join('\n\n')}`;
}
