import { stringify } from 'yaml';
import { nsfwFields } from '../../生成拦截/npc/profile';

/** 全部分组只使用中性测试文本，不编写字段的实际内容。 */
export function npcText(name = '林清', changes: Record<string, unknown> = {}): string {
  return `<npc_${name}>\n${stringify({
    [name]: {
      基础信息: { 姓名: name, 昵称: '阿清', 年龄: 26, 身份: '旅行摄影师' },
      背景设定: { 生活背景: '在杭州生活，平时记录沿途风景。', 当前处境: '正在湖边整理拍摄器材。' },
      外貌特征: { 相貌: '齐肩黑发，眉眼清秀。', 身材: '中等体态。', 穿着: '衬衫、长裤和相机包。' },
      性格设定: { 核心特质: '温和、独立', 行为模式: ['先观察再行动', '认真听人说话'] },
      关系与互动: {
        相遇情境: '在湖边停车区初次见面。',
        在意与反感: ['尊重约定', '反感催促'],
        对主角观感: '愿意先聊聊旅途。',
      },
      语言特征: { 说话风格: '表达自然清楚。' },
      NSFW设定: Object.fromEntries(nsfwFields.map((field, index) => [field, `原字段值 ${index + 1}`])),
      ...changes,
    },
  })}</npc_${name}>`;
}
