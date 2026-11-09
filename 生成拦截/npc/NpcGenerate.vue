<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { PhUsers, PhArrowClockwise, PhCircleNotch, PhWarningCircle, PhArrowRight, PhX } from '@phosphor-icons/vue';
import type { DvsPreNarrativeContext } from '../types';
import ProfileCard from './ProfileCard.vue';
import { hasNpcCount } from './count';
import { applyNpcAdjustment, parseInitialProfiles, parseNpcResult, type NpcProfile } from './profile';
import { requestNpc, resolveNpcRequirement, type NpcHistoryMessage } from './requests';

const props = defineProps<{ context: DvsPreNarrativeContext; substitute: (text: string) => string }>();

function createCard(profile: NpcProfile) {
  return { profile, requirement: '', version: 1, history: [] as NpcHistoryMessage[] };
}
const saved = props.context.result;
const cards = ref((saved === undefined ? [] : parseNpcResult(saved)).map(createCard));
const expanded = ref<number | undefined>(0);
const busy = ref(false);
const submitted = ref(false);
const error = ref('');
const detail = ref('');
const rawResponse = ref<string>();
const lastTarget = ref<number>();
const updateNotice = ref('');
let alive = true;

function initialCount() {
  const params = props.context.params;
  if (!hasNpcCount(params)) throw new Error('输入增强未提供有效的生成人数。');
  return params.count;
}

async function generate(index?: number) {
  if (busy.value || submitted.value || props.context.signal.aborted) return;
  const target = index === undefined ? undefined : cards.value[index];
  const input = resolveNpcRequirement(target?.requirement ?? '');
  lastTarget.value = index;
  busy.value = true;
  error.value = '';
  detail.value = '';
  updateNotice.value = '';
  rawResponse.value = undefined;
  try {
    const request = target ? {
      candidate: target.profile.text,
      others: cards.value.filter((_, i) => i !== index).map(card => card.profile.text),
      requirement: input,
      history: target.history,
    } : initialCount();
    const response = await requestNpc(props.context, request, props.substitute);
    if (!alive || props.context.signal.aborted) return;
    rawResponse.value = response.content;
    if (typeof request === 'number') {
      cards.value = parseInitialProfiles(response.content, request).map(createCard);
      expanded.value = 0;
    } else if (target) {
      const next = applyNpcAdjustment(response.content, cards.value.map(card => card.profile));
      target.history.push({ role: 'ai', content: target.profile.text }, { role: 'user', content: input });
      const changed: string[] = [];
      next.forEach((profile, i) => {
        const card = cards.value[i]!;
        if (card.profile.text !== profile.text) {
          card.profile = profile;
          card.version++;
          changed.push(profile.name);
        }
      });
      updateNotice.value = changed.length ? '已更新' + changed.join('、') + '的人设。' : '本次没有人设变化。';
    }
  } catch (cause) {
    if (!alive || props.context.signal.aborted) return;
    error.value = cause instanceof Error ? cause.message : String(cause);
    detail.value = cause instanceof Error ? cause.stack ?? cause.message : String(cause);
  } finally {
    if (alive) busy.value = false;
  }
}
function confirm() {
  if (busy.value || submitted.value || !cards.value.length || props.context.signal.aborted) return;
  submitted.value = true;
  props.context.complete({ profile: cards.value.map(card => card.profile.text).join('\n\n') });
}
onMounted(() => { if (!cards.value.length) void generate(); });
onBeforeUnmount(() => { alive = false; });
</script>

<template>
  <div class="handbook">
    <main class="book-content">
      <div class="section-heading od-row">
        <h2><span class="title-icon"><PhUsers weight="fill" aria-hidden="true" /></span>旅途新面孔</h2>
        <button class="close-button" type="button" aria-label="关闭" @click="context.cancel()"><PhX aria-hidden="true" /></button>
      </div>
      <ProfileCard v-for="(card, index) in cards" :key="index" :profile="card.profile" :expanded="expanded === index"
        :version="card.version" @toggle="expanded = expanded === index ? undefined : index">
        <div class="adjustment-card">
          <label :for="'npc-input-' + index" class="serif">调整要求</label>
          <textarea :id="'npc-input-' + index" v-model="card.requirement" :disabled="busy || submitted"
            rows="3" placeholder="例如：保留姓名，让性格更开朗"></textarea>
          <button class="secondary" type="button" :disabled="busy || submitted" @click="generate(index)">
            <PhCircleNotch v-if="busy && lastTarget === index" class="spin" aria-hidden="true" />
            <PhArrowClockwise v-else aria-hidden="true" />
            {{ (card.requirement.trim() ? '按要求调整' : '重新生成') + card.profile.name }}
          </button>
        </div>
      </ProfileCard>
      <section v-if="!cards.length" class="rv-card initial-state" role="status">
        <PhCircleNotch v-if="busy" class="spin" aria-hidden="true" />
        <p>{{ busy ? '正在生成人设，请稍等…' : '暂时没有可确认的人设。' }}</p>
      </section>
      <div v-if="busy && cards.length" class="request-status waiting od-row" role="status">
        <span class="waiting-dot"></span>正在根据生成要求整理新资料，原候选暂时保留…
      </div>
      <p v-if="updateNotice" class="request-status" role="status">{{ updateNotice }}</p>
      <div v-if="error" class="request-status error" role="alert">
        <div class="od-row"><PhWarningCircle weight="fill" aria-hidden="true" /><span>{{ error }}</span></div>
        <p v-if="cards.length" class="small">原候选和生成要求都还在。</p>
        <button type="button" class="text-button" :disabled="busy || submitted" @click="generate(lastTarget)">再次尝试<PhArrowClockwise aria-hidden="true" /></button>
        <details><summary>查看详情</summary><p class="small">错误信息</p><pre>{{ detail }}</pre><p class="small">原始 LLM 返回</p><pre v-if="rawResponse !== undefined" class="llm-raw-response">{{ rawResponse }}</pre><p v-else class="small">本次请求未取得 LLM 返回。</p></details>
      </div>
      <div class="flow-footer">
        <button class="primary" type="button" :disabled="busy || submitted || !cards.length" @click="confirm">
          {{ cards.length > 1 ? '确认 ' + cards.length + ' 位人设并继续' : '确认人设并继续' }}<PhArrowRight aria-hidden="true" />
        </button>
      </div>
    </main>
  </div>
</template>
