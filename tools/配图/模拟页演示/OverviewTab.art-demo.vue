<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Overview } from '../data';
import Icon from './Icon.vue';

const props = defineProps<{ d: Overview; todName: string }>();
const rvKey = new URLSearchParams(location.search).get('rvstate') || 'expand'; // drive | park | expand
const todKey = ({ 清晨: 'dawn', 白天: 'day', 傍晚: 'dusk', 夜晚: 'night' } as Record<string, string>)[props.todName] || 'day';
const level = (p: number) => (p < 10 ? 'bad' : p < 30 ? 'warn' : 'ok');

/* 地图是截图占位：按原示意稿的裁切中心铺满容器 */
const wrap = ref<HTMLDivElement>();
const img = ref<HTMLImageElement>();
const fit = () => {
  const w = wrap.value, i = img.value;
  if (!w || !i || !i.naturalWidth) return;
  const W = w.clientWidth, H = w.clientHeight, cw = 942, ch = 427;
  const s = Math.max(W / cw, H / ch), iw = i.naturalWidth * s, ih = i.naturalHeight * s;
  const left = Math.min(0, Math.max(W - iw, W / 2 - (910 + cw / 2) * s));
  const top = Math.min(0, Math.max(H - ih, H / 2 - (430 + ch / 2) * s));
  Object.assign(i.style, { width: `${iw}px`, height: `${ih}px`, left: `${left}px`, top: `${top}px` });
};
let ro: ResizeObserver | undefined;
onMounted(() => { ro = new ResizeObserver(fit); if (wrap.value) ro.observe(wrap.value); });
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <div class="grid gap-3 @2xl:min-h-[690px] @2xl:grid-cols-[52fr_48fr]">
    <div class="flex min-w-0 flex-col gap-3">
      <!-- 场景卡 -->
      <article class="rv-card rv-scene flex flex-col gap-[9px] overflow-hidden px-4 py-3.5 @2xl:pr-[17px] @2xl:pl-5">
        <h2 class="rv-bar m-0 flex items-center gap-[9px] border-b border-sep pb-2.5 font-serif text-[22px] leading-snug font-semibold [--bar-x:-17px] @max-2xl:[--bar-x:-16px]">
          <Icon name="region" class="size-[26px] text-accent" />{{ d.area }}
        </h2>
        <p class="m-0 flex items-center gap-2.5 border-b border-sep pb-2.5 text-[13px]"><Icon name="location" class="size-5 text-tc" />{{ d.region }}</p>
        <div class="flex items-center gap-3"><Icon name="calendar" class="size-5 text-tc" />{{ d.date }}
          <em class="rounded-full border border-sep bg-(--chip) px-2.5 text-xs font-semibold text-tc not-italic">{{ todName }}</em>
        </div>
        <div class="flex items-center gap-3"><Icon name="time" class="size-[25px] text-tc" /><strong class="text-[44px] leading-[1.15] font-semibold text-tc">{{ d.time }}</strong></div>
        <div class="flex items-center gap-3 border-t border-sep pt-2.5"><Icon name="weather" class="size-8 text-tc" /><span>{{ d.weather }}</span></div>
      </article>
      <!-- 房车卡 -->
      <article class="rv-card rv-vehicle flex flex-auto flex-col overflow-hidden">
        <div class="px-4 pt-3.5 @2xl:px-[17px]">
          <h2 class="m-0 flex items-center gap-[9px] border-b border-(--vsep) pb-2.5 font-serif text-[22px] leading-snug font-semibold"><Icon name="rv" class="size-[26px] text-accent" />房车</h2>
          <div class="border-b border-(--vsep) py-2.5">
            <div v-for="r in d.res" :key="r.key" class="mb-[7px] grid grid-cols-[18px_28px_1fr_84px_36px] items-center gap-1.5 text-xs last:mb-0">
              <Icon :name="r.key" class="size-[18px] text-tc" /><span>{{ r.name }}</span>
              <span class="rv-track h-2.5 overflow-hidden rounded-[5px]"><i class="block h-full rounded-[5px]" :class="`lv-${level(r.pct)}`" :style="{ width: r.pct + '%' }" /></span>
              <span class="text-right whitespace-nowrap">{{ r.text }}</span>
              <span class="text-right text-[11px]" :class="{ ok: 'text-pos', warn: 'text-warn font-bold', bad: 'text-neg font-bold' }[level(r.pct)]">{{ r.pct }}%</span>
            </div>
          </div>
          <dl class="m-0 grid grid-cols-[auto_1fr] [&>*]:border-b [&>*]:border-(--vsep) [&>*]:py-[7px] [&>*:nth-last-child(-n+2)]:border-0">
            <dt class="flex gap-[9px] pr-4 font-semibold whitespace-nowrap"><Icon name="wrench" class="size-5 text-tc" />车况</dt><dd class="m-0">{{ d.rvState }}</dd>
            <dt class="flex gap-[9px] pr-4 font-semibold whitespace-nowrap"><Icon name="expansion" class="size-5 text-tc" />拓展状态</dt><dd class="m-0">{{ d.expand }}</dd>
            <dt class="flex gap-[9px] pr-4 font-semibold whitespace-nowrap"><Icon name="location" class="size-5 text-tc" />所在地点</dt><dd class="m-0">{{ d.rvPlace }}</dd>
          </dl>
        </div>
        <div class="mt-auto leading-none">
          <div class="relative w-full overflow-hidden" :style="{ aspectRatio: rvKey === 'expand' ? '1586 / 617' : '1586 / 562' }">
            <img :src="`/art/rv-${rvKey}-${todKey}.png`" alt="" class="absolute inset-0 block h-full w-full object-cover object-bottom [.theme-dark_&]:hidden" />
            <img :src="`/art/rv-${rvKey}-night.png`" alt="" class="absolute inset-0 hidden h-full w-full object-cover object-bottom [.theme-dark_&]:block" />
          </div>
        </div>
      </article>
    </div>

    <div class="flex min-w-0 flex-col gap-3">
      <!-- 地图卡 -->
      <article class="rv-card flex flex-none flex-col gap-2.5 overflow-hidden px-4 py-3.5 @2xl:pr-[15px] @2xl:pl-5">
        <div class="rv-bar flex items-center gap-[9px] border-b border-edge pb-2.5 font-serif text-[22px] leading-snug font-semibold [--bar-x:-16px] @2xl:[--bar-x:-20px]">
          <Icon name="location" class="size-[26px] text-accent" /><span>旅途地图</span>
          <button class="ml-auto cursor-pointer rounded-[7px] border border-edge bg-card px-2.5 py-1 font-sans text-xs font-normal text-ink">更改地图配置</button>
        </div>
        <div ref="wrap" class="relative h-[240px] overflow-hidden rounded-lg bg-[#E9E5D8] @2xl:h-[340px]">
          <img ref="img" src="/real1.webp" alt="" class="absolute max-w-none [filter:var(--map-filter)]" @load="fit" />
        </div>
        <div class="flex items-center gap-1.5 rounded-md bg-legend px-2.5 py-1 text-[13px]">
          <Icon name="person" class="size-5 text-tc" />主角<Icon name="rv" class="ml-2 size-5 text-tc" />房车
        </div>
      </article>
      <!-- 主角卡：只放文字 -->
      <article class="rv-card flex flex-auto flex-col overflow-hidden px-4 pt-3.5 @2xl:px-[17px]">
        <h2 class="m-0 flex items-center gap-[9px] border-b border-edge pb-2.5 font-serif text-[22px] leading-snug font-semibold"><Icon name="person" class="size-[26px] text-accent" />主角</h2>
        <dl class="m-0 grid grid-cols-[auto_1fr] [&>*]:border-b [&>*]:border-edge [&>*]:py-[5px] [&>*:nth-last-child(-n+2)]:border-0">
          <dt class="flex gap-[9px] pr-4 font-semibold whitespace-nowrap"><Icon name="location" class="size-5 text-tc" />当前位置</dt><dd class="m-0">{{ d.pPlace }}</dd>
          <dt class="flex gap-[9px] pr-4 font-semibold whitespace-nowrap"><Icon name="state" class="size-5 text-tc" />状态</dt><dd class="m-0">{{ d.pState }}</dd>
        </dl>
        <div class="mt-auto flex flex-wrap gap-x-7 gap-y-2 border-t border-edge pt-3 pb-3.5">
          <span class="flex items-center gap-2 font-semibold"><Icon name="coins" class="size-5 text-tc" />资金<b class="text-base text-accent">{{ d.money }}</b></span>
          <span class="flex items-center gap-2 font-semibold"><Icon name="fans" class="size-5 text-tc" />粉丝<b class="text-base text-accent">{{ d.fans }}</b></span>
        </div>
      </article>
    </div>
  </div>
</template>
