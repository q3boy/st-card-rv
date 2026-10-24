<script setup lang="ts">
import { reactive, watch } from 'vue';
import Icon from './Icon.vue';
import { characterNsfwFields, formatValue, type CharacterDisplay, type DisplayValue } from './data';

const props = defineProps<{ rows: CharacterDisplay[]; resetKey: number; dark: boolean }>();
const openCards = reactive(new Set<string>());
const keyFor = (row: CharacterDisplay) => JSON.stringify([row.姓名]);
const toggle = (row: CharacterDisplay) => {
  const key = keyFor(row);
  openCards.has(key) ? openCards.delete(key) : openCards.add(key);
};
watch(() => props.resetKey, () => openCards.clear());
const fieldValue = (row: CharacterDisplay, field: string) => (row as Record<string, DisplayValue>)[field];
const favorClass = (value: DisplayValue) => typeof value === 'number' && value > 0 ? 'text-pos' : typeof value === 'number' && value < 0 ? 'text-neg' : '';
const columns = [[
  { title: '外貌与穿着', fields: ['相貌', '身材', '穿着'] },
  { title: '背景与处境', fields: ['生活背景', '当前处境'] },
], [
  { title: '性格与表达', fields: ['核心特质', '行为模式', '在意与反感', '说话风格'] },
  { title: '相遇与关系', fields: ['相遇情境', '对主角观感'] },
]];
</script>

<template>
  <div class="cards characters-list grid items-start gap-3.5 min-[651px]:grid-cols-2">
    <article v-for="row in rows" :key="keyFor(row)" class="npc rv-card min-w-0 overflow-hidden" :class="[{ opened: openCards.has(keyFor(row)) }, openCards.has(keyFor(row)) && 'min-[651px]:col-span-full']">
      <button class="card-summary relative block w-full cursor-pointer border-0 bg-transparent px-4 pt-3.5 pr-12 pb-2.5 text-left text-inherit min-[651px]:px-5 min-[651px]:pt-[15px] min-[651px]:pr-14" :aria-expanded="openCards.has(keyFor(row))" @click="toggle(row)">
        <div class="card-name rv-bar flex min-w-0 items-center gap-[11px] [--bar-x:-16px] min-[651px]:[--bar-x:-20px]">
          <Icon name="person" class="person-icon size-[26px] text-accent" />
          <div class="npc-identity flex min-w-0 flex-wrap items-baseline gap-x-3"><h2 class="m-0 font-serif text-2xl leading-snug font-semibold">{{ formatValue(row.姓名) }} <small v-if="row.昵称 != null && row.昵称 !== '未知'" class="ml-1.5 font-sans text-[13px] font-normal text-subtle">{{ formatValue(row.昵称) }}</small></h2><span class="npc-age-identity text-[13px] whitespace-pre-wrap text-subtle">{{ formatValue(row.年龄) }}岁 · {{ formatValue(row.身份) }}</span></div>
          <Icon :name="openCards.has(keyFor(row)) ? 'chevron-up' : 'chevron-down'" class="disclosure-icon absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-subtle min-[651px]:right-5" />
        </div>
      </button>
      <div class="npc-summary-fields flex flex-col gap-2 px-4 pb-3.5 text-[13.5px] min-[651px]:px-5" :class="openCards.has(keyFor(row)) && 'border-b border-sep'">
        <span class="npc-summary-field flex min-w-0 items-center gap-[9px] [overflow-wrap:anywhere]"><Icon name="companions" class="size-[18px] text-tc" /><span>{{ formatValue(row.同行状态) }} · <span class="subtle text-subtle">好感度</span> <b :class="favorClass(row.好感度)">{{ typeof row.好感度 === 'number' && row.好感度 > 0 ? '+' : '' }}{{ formatValue(row.好感度) }}</b></span></span>
        <span class="npc-summary-field flex min-w-0 items-start gap-[9px] [overflow-wrap:anywhere]"><Icon name="location" class="mt-0.5 size-[18px] text-tc" /><span class="whitespace-pre-wrap"><span class="subtle mr-1.5 text-subtle">位置</span>{{ formatValue(row.当前位置) }}</span></span>
        <span class="npc-summary-field flex min-w-0 items-start gap-[9px] [overflow-wrap:anywhere]"><Icon name="coffee" class="mt-0.5 size-[18px] text-tc" /><span class="whitespace-pre-wrap"><span class="subtle mr-1.5 text-subtle">状态</span>{{ formatValue(row.状态) }}</span></span>
      </div>
      <div v-if="openCards.has(keyFor(row))" class="details grid gap-x-6 px-4 pt-4 pb-[18px] min-[651px]:grid-cols-2 min-[651px]:px-5">
        <div v-for="(column, index) in columns" :key="index" class="detail-column flex min-w-0 flex-col gap-3.5" :class="index === 1 && 'mt-3 border-t border-sep pt-3 min-[651px]:mt-0 min-[651px]:border-t-0 min-[651px]:border-l min-[651px]:pt-0 min-[651px]:pl-6'">
          <section v-for="(group, si) in column" :key="group.title" :class="si === 1 && 'border-t border-sep pt-3'">
            <h3 class="m-0 mb-2 font-serif text-[15px] font-semibold tracking-[.02em] text-accent">{{ group.title }}</h3>
            <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-[5px] text-[13px] leading-[1.65]"><template v-for="field in group.fields" :key="field"><dt class="whitespace-nowrap text-subtle">{{ field }}</dt><dd class="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{{ formatValue(fieldValue(row, field)) }}</dd></template></dl>
          </section>
        </div>
        <section class="reserve-info col-span-full mt-3.5 border-t border-sep pt-3">
          <h3 class="m-0 mb-2 font-serif text-[15px] font-semibold tracking-[.02em] text-accent">NSFW信息</h3>
          <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-[5px] text-[13px] leading-[1.65] min-[651px]:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]"><template v-for="field in characterNsfwFields" :key="field"><dt class="whitespace-nowrap text-subtle">{{ field }}</dt><dd class="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{{ formatValue(fieldValue(row, field)) }}</dd></template></dl>
        </section>
        <section class="thought col-span-full mt-3.5 flex items-start gap-3 rounded-r-lg border-l-[3px] border-accent bg-soft px-3.5 py-[11px]"><h3 class="m-0 flex flex-none items-center gap-2 text-sm font-semibold"><Icon name="thought" class="mt-px size-5 text-tc" />心声</h3><p class="m-0 min-w-0 text-[13px] leading-[1.7] whitespace-pre-wrap">{{ formatValue(row.心声) }}</p></section>
      </div>
    </article>
    <p v-if="!rows.length" class="empty col-span-full p-5 text-subtle">暂无角色记录</p>
  </div>
</template>
