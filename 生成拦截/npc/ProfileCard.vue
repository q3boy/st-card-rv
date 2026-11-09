<script setup lang="ts">
import { PhUser, PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';
import { profileColumns, nsfwFields, type NpcProfile } from './profile';
defineProps<{ profile: NpcProfile; expanded: boolean; readonly?: boolean; version?: number }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <article class="rv-card profile-card">
    <button type="button" class="profile-head" :aria-expanded="expanded" @click="$emit('toggle')">
      <div class="od-row identity">
        <span class="avatar"><PhUser weight="fill" aria-hidden="true" /></span>
        <div class="identity-text">
          <div class="od-cluster name-line"><h2>{{ profile.name }}</h2><span v-if="profile.fields.昵称" class="nickname">{{ profile.fields.昵称 }}</span></div>
          <span class="identity-meta">{{ profile.age }}岁 · {{ profile.fields.身份 }}</span>
        </div>
      </div>
      <span class="disclosure"><PhCaretUp v-if="expanded" weight="fill" aria-hidden="true" /><PhCaretDown v-else weight="fill" aria-hidden="true" /><span class="sr-only">{{ expanded ? '收起' : '展开' }}完整人设</span></span>
    </button>
    <div v-if="expanded" class="profile-caption od-cluster"><span class="pill">{{ readonly ? '已确认' : '待你确认' }}</span><span v-if="!readonly" class="edition">候选 {{ String(version).padStart(2, '0') }}</span></div>
    <div v-if="expanded" class="profile-columns">
      <div v-for="(column, i) in profileColumns" :key="i" class="profile-column">
        <section v-for="group in column" :key="group.title" class="profile-group">
          <h3>{{ group.title }}</h3>
          <dl class="profile-fields"><template v-for="field in group.fields" :key="field"><dt>{{ field }}</dt><dd>{{ profile.fields[field] }}</dd></template></dl>
        </section>
      </div>
    </div>
    <section v-if="expanded" class="profile-nsfw" aria-label="NSFW信息">
      <h3>NSFW信息</h3>
      <dl class="profile-fields nsfw-fields"><template v-for="field in nsfwFields" :key="field"><dt>{{ field }}</dt><dd>{{ profile.fields[field] }}</dd></template></dl>
    </section>
    <slot v-if="expanded" />
  </article>
</template>
