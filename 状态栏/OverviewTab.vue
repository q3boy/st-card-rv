<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { rvArt } from './art';
import { formatValue, resourceRatio, type DisplayValue, type RvDisplayData } from './data';
import { resourceDisplay, resourceLevel, rvArtKind, timeOfDay } from './display';

const props = defineProps<{ data: RvDisplayData | null; dark: boolean }>();
const periodNames = { dawn: '清晨', day: '白天', dusk: '傍晚', night: '夜晚' } as const;
const world = computed<Record<string, DisplayValue>>(() => props.data?.world ?? {});
const protagonist = computed<Record<string, DisplayValue>>(() => props.data?.protagonist ?? {});
const vehicle = computed<Record<string, DisplayValue>>(() => props.data?.rv ?? {});
const period = computed(() => timeOfDay(world.value.日期时间));
const date = computed(() => (period.value ? String(world.value.日期时间).slice(0, 10) : formatValue(world.value.日期时间)));
const time = computed(() => (period.value ? String(world.value.日期时间).slice(11) : '—'));
const compact = (value: DisplayValue) =>
  typeof value === 'number' && value >= 1e8
    ? `${+(value / 1e8).toFixed(2)}亿`
    : typeof value === 'number' && value >= 1e4
      ? `${+(value / 1e4).toFixed(2)}万`
      : formatValue(value);
const art = computed(() => {
  const { kind, label } = rvArtKind(vehicle.value);
  return { kind, label, src: rvArt[kind][props.dark ? 'night' : (period.value ?? 'day')] };
});
const levelText = { ok: 'text-pos', warn: 'text-warn font-bold', bad: 'text-neg font-bold' } as const;
const resources = computed(() =>
  [...resourceDisplay].reverse().map(resource => {
    const ratio = resourceRatio(vehicle.value[resource.field], resource.capacity);
    return { ...resource, ratio, level: resourceLevel(ratio), percent: ratio === null ? '—' : `${Math.round(ratio * 100)}%` };
  }),
);
</script>

<template>
  <div class="overview grid gap-3 min-[651px]:min-h-[690px] min-[651px]:grid-cols-[52fr_48fr]">
    <div class="flex min-w-0 flex-col gap-3">
      <article class="scene rv-card rv-scene flex flex-col gap-[9px] overflow-hidden px-4 py-3.5 min-[651px]:pr-[17px] min-[651px]:pl-5">
        <h2 class="rv-bar m-0 flex items-center gap-[9px] border-b border-sep pb-2.5 font-serif text-[22px] leading-snug font-semibold [--bar-x:-16px] min-[651px]:[--bar-x:-17px]">
          <Icon name="region-mountains" class="size-[26px] text-accent" />{{ formatValue(world.区域) }}
        </h2>
        <p class="scene-location m-0 flex items-center gap-2.5 border-b border-sep pb-2.5 text-[13px]"><Icon name="location" class="size-5 text-tc" /><span>{{ ['国家', '省份', '城市'].map(key => formatValue(world[key])).join(' · ') }}</span></p>
        <div class="scene-date flex items-center gap-3"><Icon name="calendar" class="size-5 text-tc" /><span>{{ date }}</span>
          <em v-if="period" class="period-tag rounded-full border border-sep bg-(--chip) px-2.5 text-xs font-semibold text-tc not-italic">{{ periodNames[period] }}</em>
        </div>
        <div class="scene-time flex items-center gap-3"><Icon name="time" class="size-[25px] text-tc" /><strong class="text-[34px] leading-[1.15] font-semibold text-tc min-[651px]:text-[44px]">{{ time }}</strong></div>
        <div class="scene-weather flex items-center gap-3 border-t border-sep pt-2.5"><Icon name="weather" class="size-8 text-tc" /><span class="whitespace-pre-wrap">{{ formatValue(world.天气) }}</span></div>
      </article>
      <article class="vehicle rv-card rv-vehicle flex flex-auto flex-col overflow-hidden">
        <div class="px-4 pt-3.5 min-[651px]:px-[17px]">
          <h2 class="m-0 flex items-center gap-[9px] border-b border-(--vsep) pb-2.5 font-serif text-[22px] leading-snug font-semibold">
            <Icon name="rv" class="size-[26px] text-accent" />房车
            <span class="rv-art-label ml-auto rounded-full border border-sep bg-(--chip) px-2.5 font-sans text-xs leading-[1.6] font-semibold text-tc">{{ art.label }}</span>
          </h2>
          <div class="border-b border-(--vsep) py-2.5">
            <div v-for="resource in resources" :key="resource.field" class="resource mb-[7px] grid grid-cols-[18px_28px_minmax(20px,1fr)_84px_36px] items-center gap-1.5 text-xs last:mb-0">
              <Icon :name="resource.icon" class="size-[18px] text-tc" /><span>{{ resource.name }}</span>
              <span class="track rv-track h-2.5 overflow-hidden rounded-[5px]" :class="{ missing: resource.ratio === null }"><i class="block h-full rounded-[5px]" :class="resource.level && `lv-${resource.level}`" :style="{ width: (resource.ratio ?? 0) * 100 + '%' }" /></span>
              <span class="resource-value text-right whitespace-nowrap">{{ formatValue(vehicle[resource.field]) }} / {{ resource.capacity }} <small class="text-[10px] text-inherit">{{ resource.unit }}</small></span>
              <span class="resource-percent text-right text-[11px]" :class="resource.level ? levelText[resource.level] : 'text-subtle'">{{ resource.percent }}</span>
            </div>
          </div>
          <dl class="vehicle-rows m-0 grid grid-cols-[auto_minmax(0,1fr)] [&>*]:border-b [&>*]:border-(--vsep) [&>*]:py-[7px] [&>*:nth-last-child(-n+2)]:border-0">
            <dt class="flex gap-[9px] text-ink pr-4 font-semibold whitespace-nowrap"><Icon name="wrench" class="size-5 text-tc" />车况</dt><dd class="m-0 whitespace-pre-wrap">{{ formatValue(vehicle.状态) }}</dd>
            <dt class="flex gap-[9px] text-ink pr-4 font-semibold whitespace-nowrap"><Icon name="expansion" class="size-5 text-tc" />拓展状态</dt><dd class="m-0">{{ formatValue(vehicle.拓展状态) }}</dd>
            <dt class="flex gap-[9px] text-ink pr-4 font-semibold whitespace-nowrap"><Icon name="location" class="size-5 text-tc" />所在地点</dt><dd class="m-0 whitespace-pre-wrap">{{ formatValue(vehicle.所在地点) }}</dd>
          </dl>
        </div>
        <!-- 固定宽高比的窗口靠下对齐，裁去图片顶部的透明天空，车辆完整显示。 -->
        <div class="vehicle-art illustration-art pointer-events-none relative mt-auto w-full overflow-hidden leading-none" :class="art.kind === 'expand' ? 'aspect-[1586/617]' : 'aspect-[1586/562]'" aria-hidden="true">
          <img class="rv-image absolute bottom-0 left-0 block h-auto w-full max-w-none select-none" :data-art="art.kind" :src="art.src" alt="" draggable="false"/>
        </div>
      </article>
    </div>
    <div class="flex min-w-0 flex-col gap-3">
      <slot name="map"/>
      <article class="person rv-card flex flex-auto flex-col overflow-hidden px-4 pt-3.5 min-[651px]:px-[17px]">
        <h2 class="m-0 flex items-center gap-[9px] border-b border-edge pb-2.5 font-serif text-[22px] leading-snug font-semibold"><Icon name="person" class="size-[26px] text-accent" />主角</h2>
        <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] [&>*]:border-b [&>*]:border-edge [&>*]:py-[5px] [&>*:nth-last-child(-n+2)]:border-0">
          <dt class="flex gap-[9px] text-ink pr-4 font-semibold whitespace-nowrap"><Icon name="location" class="size-5 text-tc" />当前位置</dt><dd class="m-0 whitespace-pre-wrap">{{ formatValue(protagonist.当前位置) }}</dd>
          <dt class="flex gap-[9px] text-ink pr-4 font-semibold whitespace-nowrap"><Icon name="coffee" class="size-5 text-tc" />状态</dt><dd class="m-0 whitespace-pre-wrap">{{ formatValue(protagonist.状态) }}</dd>
        </dl>
        <div class="mt-auto flex flex-wrap gap-x-7 gap-y-2 border-t border-edge pt-3 pb-3.5">
          <span class="flex items-center gap-2 font-semibold"><Icon name="coins" class="size-5 text-tc" />资金<b class="capital text-base text-accent">{{ compact(protagonist.资金) }}<span v-if="typeof protagonist.资金 === 'number'">元</span></b></span>
          <span class="flex items-center gap-2 font-semibold"><Icon name="fans" class="size-5 text-tc" />粉丝<b class="text-base text-accent">{{ compact(protagonist.粉丝数量) }}</b></span>
        </div>
      </article>
    </div>
  </div>
</template>
