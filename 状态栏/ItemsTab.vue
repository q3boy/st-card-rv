<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Icon from './Icon.vue';
import { belongingKey, formatValue, type BelongingDisplay, type DisplayValue, type RvDisplayData, type SupplyDisplay } from './data';

const props = defineProps<{ kind: 'supplies' | 'belongings'; data: RvDisplayData | null; resetKey: number }>();
const holder = ref<string | null>(null);
const holders = computed(() => [...new Set([props.data?.playerName ?? '', ...(props.data?.belongings ?? []).map(row => String(row.持有人))])].filter(Boolean));
const selectedHolder = computed(() => holder.value ?? props.data?.playerName ?? '');
const rows = computed(() => props.kind === 'supplies' ? props.data?.supplies ?? [] : (props.data?.belongings ?? []).filter(row => row.持有人 === selectedHolder.value));
const keyFor = (row: SupplyDisplay | BelongingDisplay) => props.kind === 'belongings' ? belongingKey(row as BelongingDisplay) : JSON.stringify([row.物品名]);
const fieldValue = (row: SupplyDisplay | BelongingDisplay, field: string) => (row as Record<string, DisplayValue>)[field];
watch(() => props.resetKey, () => { holder.value = null; });
</script>

<template>
  <div class="items-tab" :class="kind">
    <div v-if="kind === 'belongings'" class="holders mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5" aria-label="持有人">
      <span class="holder-label font-serif text-[15px] font-semibold">持有人</span>
      <div class="holder-segments flex max-w-full flex-wrap rounded-full border border-edge bg-card p-[3px]"><button v-for="name in holders" :key="name" class="max-w-full min-w-[72px] cursor-pointer rounded-full border-0 px-4 py-[5px] text-[13px] [overflow-wrap:anywhere] min-[651px]:min-w-[84px] min-[651px]:px-[18px]" :class="selectedHolder === name ? 'bg-accent text-(--on-accent)' : 'bg-transparent text-subtle'" :aria-pressed="selectedHolder === name" @click="holder = name">{{ name }}</button></div>
    </div>
    <div class="cards items-list grid grid-cols-1 items-stretch gap-3 min-[521px]:grid-cols-2 min-[801px]:grid-cols-3">
      <article v-for="row in rows" :key="keyFor(row)" class="item rv-card flex min-w-0 flex-col gap-3 px-[18px] py-4" :class="kind === 'supplies' && 'min-[801px]:min-h-[158px]'">
        <header class="item-heading flex items-start justify-between gap-2.5">
          <div class="item-title min-w-0 flex-auto"><h2 class="m-0 inline font-serif text-xl leading-snug font-semibold [overflow-wrap:anywhere]">{{ formatValue(row.物品名) }}</h2><span class="item-quantity ml-2 inline-block text-[13px] whitespace-nowrap text-subtle">×{{ formatValue(row.数量) }} {{ formatValue(row.单位) }}</span></div>
          <span class="item-status max-w-[44%] flex-none rounded-full border border-pill-text/15 bg-pill px-2.5 py-0.5 text-center text-xs leading-[1.6] whitespace-pre-wrap text-pill-text">{{ formatValue(row.状态) }}</span>
        </header>
        <p class="item-description m-0 flex-1 text-[13.5px] leading-[1.72] whitespace-pre-wrap">{{ formatValue(row.说明) }}</p>
        <p v-if="kind === 'supplies'" class="item-location m-0 flex items-center gap-[7px] border-t border-sep pt-2.5 text-xs whitespace-pre-wrap text-subtle"><Icon name="location" class="size-[15px]" />{{ formatValue(fieldValue(row, '存放位置')) }}</p>
      </article>
      <p v-if="!rows.length" class="empty col-span-full p-5 text-subtle">{{ kind === 'supplies' ? '暂无房车物资记录' : '暂无随身物品记录' }}</p>
    </div>
  </div>
</template>
