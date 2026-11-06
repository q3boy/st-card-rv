<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import { PhUsers, PhArrowClockwise, PhCircleNotch, PhWarningCircle, PhArrowRight } from '@phosphor-icons/vue';
import type { DvsPreNarrativeContext } from '../types';
import ProfileCard from './ProfileCard.vue';
import { parseNpcProfile, parseNpcResult, type NpcProfile } from './profile';
import { requestNpc, resolveNpcRequirement, type NpcHistoryMessage } from './requests';

const props = defineProps<{ context: DvsPreNarrativeContext; substitute: (text: string) => string }>();
const candidate = shallowRef<NpcProfile | undefined>(props.context.result === undefined ? undefined : parseNpcResult(props.context.result));
const requirement = ref('');
const history: NpcHistoryMessage[] = [];
const expanded = ref(true);
const version = ref(candidate.value ? 1 : 0);
const busy = ref(false);
const submitted = ref(false);
const error = ref('');
const detail = ref('');
const rawResponse = ref<string>();
let alive = true;

async function generate() {
  if (busy.value || submitted.value || props.context.signal.aborted) return;
  busy.value = true;
  error.value = '';
  detail.value = '';
  rawResponse.value = undefined;
  const previous = candidate.value;
  const input = resolveNpcRequirement(requirement.value);
  try {
    const response = await requestNpc(props.context, previous?.text, input, props.substitute, history);
    if (!alive || props.context.signal.aborted) return;
    rawResponse.value = response.content;
    const next = parseNpcProfile(response.content);
    if (previous) history.push({ role: 'ai', content: previous.text }, { role: 'user', content: input });
    candidate.value = next;
    version.value++;
    expanded.value = true;
  } catch (cause) {
    if (!alive || props.context.signal.aborted) return;
    error.value = cause instanceof Error ? cause.message : String(cause);
    detail.value = cause instanceof Error ? cause.stack ?? cause.message : String(cause);
  } finally {
    if (alive) busy.value = false;
  }
}
function confirm() {
  if (busy.value || submitted.value || !candidate.value || props.context.signal.aborted) return;
  submitted.value = true;
  props.context.complete({ profile: candidate.value.text });
}
onMounted(() => { if (!candidate.value) void generate(); });
onBeforeUnmount(() => { alive = false; });
</script>

<template>
  <div class="handbook">
    <main class="book-content">
      <div class="section-heading od-row"><h2><span class="title-icon"><PhUsers weight="fill" aria-hidden="true" /></span>旅途新面孔</h2></div>
      <ProfileCard v-if="candidate" :profile="candidate" :expanded="expanded" :version="version" @toggle="expanded = !expanded" />
      <section v-else class="rv-card initial-state"><PhCircleNotch v-if="busy" class="spin" weight="fill" aria-hidden="true" /><p>{{ busy ? '正在生成人设，请稍等…' : '暂时没有可确认的人设，请再次尝试。' }}</p></section>
      <details class="rv-card adjustment-card">
        <summary><span class="serif">生成要求</span><span class="muted small">可选</span></summary>
        <p class="helper">想让这位新朋友更合心意？写下想保留或调整的地方。</p>
        <textarea v-model="requirement" aria-label="生成要求" :disabled="busy || submitted || !candidate" rows="3" placeholder="例如：保留姓名，让性格更开朗"></textarea>
      </details>
      <div v-if="busy" class="request-status waiting od-row" role="status"><span class="waiting-dot"></span><span>{{ candidate ? '正在根据生成要求整理新资料，原候选暂时保留…' : '正在根据本轮情境整理人物资料…' }}</span></div>
      <div v-if="error" class="request-status error" role="alert">
        <div class="od-row"><PhWarningCircle weight="fill" aria-hidden="true" /><span>{{ error }}</span></div>
        <p v-if="candidate" class="small">原候选和生成要求都还在。</p>
        <button type="button" class="text-button" :disabled="busy || submitted" @click="generate">再次尝试<PhArrowClockwise weight="fill" aria-hidden="true" /></button>
        <details><summary>查看详情</summary><p class="small">错误信息</p><pre>{{ detail }}</pre><p class="small">原始 LLM 返回</p><pre v-if="rawResponse !== undefined" class="llm-raw-response">{{ rawResponse }}</pre><p v-else class="small">本次请求未取得 LLM 返回。</p></details>
      </div>
      <div class="flow-footer"><p class="flow-note">只有最终确认后，正文才会沿用这份人设。</p><div class="actions od-row"><button class="plain" type="button" @click="context.cancel()">取消</button><button class="secondary" type="button" :disabled="busy || submitted || !candidate" @click="generate"><PhCircleNotch v-if="busy" class="spin" weight="fill" aria-hidden="true" /><PhArrowClockwise v-else weight="fill" aria-hidden="true" />{{ busy ? '正在生成人设' : '重新生成人设' }}</button><button class="primary" type="button" :disabled="busy || submitted || !candidate" @click="confirm">确认人设并继续<PhArrowRight weight="fill" aria-hidden="true" /></button></div></div>
    </main>
  </div>
</template>
