<script setup lang="ts">
import { mapIcons, panelIcons, type RvIconName, type RvMapIconName } from './icons';
defineProps<{ name: RvIconName | RvMapIconName; purpose?: 'panel' | 'map' }>();
</script>

<template>
  <img v-if="purpose === 'map'" class="rv-icon" :data-icon="name" data-purpose="map" :src="mapIcons[name as RvMapIconName]" alt="" aria-hidden="true" :draggable="false"/>
  <component :is="panelIcons[name as RvIconName]" v-else class="rv-icon shrink-0" :data-icon="name" data-purpose="panel" weight="fill" aria-hidden="true"/>
</template>
