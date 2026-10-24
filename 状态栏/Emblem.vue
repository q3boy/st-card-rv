<script setup lang="ts">
import { computed, useId } from 'vue';
import type { TimeOfDay } from './display';

/* 徽记按时段逐一重绘：保留浅晕、山体、森林三层明暗，只换色相。深色模式另配一套。 */
const palettes: Record<TimeOfDay | 'dark', [string, string, string, string, string]> = {
  dawn: ['#E3DCEE', '#F2EDFA', '#B4A6CE', '#8B7CAE', '#6E5F93'],
  day: ['#EFE0BF', '#F9F1DE', '#CDA96A', '#AD8038', '#7E5822'],
  dusk: ['#F8DCC7', '#FEF0E4', '#D89B70', '#BD6A38', '#8E4520'],
  night: ['#D5DCEB', '#E9EDF7', '#9FAECB', '#6E7BA6', '#4A5680'],
  dark: ['#4A4136', '#2E2A25', '#7D6646', '#C99A57', '#9A733A'],
};
const props = defineProps<{ period: TimeOfDay | null; dark: boolean }>();
const id = useId();
const colors = computed(() => palettes[props.dark ? 'dark' : (props.period ?? 'day')]);
</script>

<template>
  <svg viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <linearGradient :id="`h${id}`" x2=".7" y2="1"><stop :stop-color="colors[0]" /><stop offset="1" :stop-color="colors[1]" /></linearGradient>
      <linearGradient :id="`f${id}`" x2=".5" y2="1"><stop :stop-color="colors[3]" /><stop offset="1" :stop-color="colors[4]" /></linearGradient>
    </defs>
    <path d="M10 80C17 28 35 10 59 10c26 0 45 27 51 71-32-8-70-8-100-1z" :fill="`url(#h${id})`" />
    <path d="m35 84 22-40q4-7 8 0l23 40z" :fill="colors[2]" />
    <g :fill="`url(#f${id})`">
      <path d="m27 82 15-28q5-8 9 0l15 28H56l12 19H21l11-19z" />
      <path d="m79 79 10-22q4-8 8 0l11 22h-7l12 22H76l10-22z" />
      <path d="m9 97 7-18q2-4 5 0l8 18h-5l7 16H4l9-16z" />
      <path d="M8 113c25 0 39-14 59-20 16-5 31-5 47 2l-5-9c-20-8-43-4-61 7-16 10-27 15-40 15z" />
    </g>
  </svg>
</template>
