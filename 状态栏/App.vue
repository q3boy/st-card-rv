<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { BusinessDatabaseHandle } from '../types/sqlite-helper/sqlite-helper';
import type { DvsInjectFlags, DvsUpdateStatus } from '../types/sqlite-helper/dvs';
import { formatValue, resourceRatio, type DisplayValue, type RvDisplayData } from './data';
import { measureViewport, fitPosition, availableSize } from './geometry';
import { readAmapConfig, saveAmapConfig, AmapEnvError } from './env';
import { createAmapController } from './amap';
import OverviewTab from './OverviewTab.vue';
import CharactersTab from './CharactersTab.vue';
import ItemsTab from './ItemsTab.vue';
import Icon from './Icon.vue';
import Emblem from './Emblem.vue';
import contours from '../状态栏素材/图形/title-contours.svg';
import { resourceDisplay, timeOfDay } from './display';

const props = defineProps<{
  model: { data: RvDisplayData | null; message: string; error?: string; target: number; active: boolean; mapAvailable: boolean; updateStatus: DvsUpdateStatus };
  owner: Window;
  getChar: () => BusinessDatabaseHandle | null;
  getRole: () => unknown;
  regen: () => Promise<void>;
  inject: { get(): Promise<DvsInjectFlags>; set(flags: DvsInjectFlags): Promise<DvsInjectFlags> };
}>();
const expanded = ref(false), tab = ref('总览'), theme = ref('system'), systemDark = ref(false);
const regenerating = ref(false), regenError = ref('');
const updateBusy = computed(() => regenerating.value || props.model.updateStatus.phase !== 'idle');
const updateLabel = computed(() => props.model.updateStatus.phase === 'retrying'
  ? `等待重试（第 ${props.model.updateStatus.attempt + 1}/${props.model.updateStatus.maxAttempts} 次）`
  : updateBusy.value ? '正在更新变量…' : '重新更新变量');
const dark = computed(() => theme.value === 'dark' || theme.value === 'system' && systemDark.value);
const panel = ref<HTMLElement>(), small = ref<HTMLElement>(), mapContainer = ref<HTMLElement>();
const settings = ref(false), settingsBox = ref<HTMLElement>(), settingsClose = ref<HTMLButtonElement>(), settingsEntry = ref<HTMLButtonElement>();
const flags = ref<DvsInjectFlags | null>(null), flagsLoading = ref(false), flagsSaving = ref(false), flagsError = ref('');
const help = ref(false), helpBox = ref<HTMLElement>(), helpClose = ref<HTMLButtonElement>(), helpEntry = ref<HTMLButtonElement>();
const position = reactive({ small: { x: 0, y: 0 }, panel: { x: 0, y: 0 } });
const viewport = reactive({ left: 0, top: 0, width: 1, height: 1 });
const mapKey = ref(''), mapSec = ref(''), reveal = ref(false), editing = ref(true), saving = ref(false);
const envMessage = ref(''), envError = ref(''), needsReadback = ref(false), envBlocked = ref(false);
const envLoading = ref(false);
const mapMessage = ref(''), mapError = ref('');
let map: ReturnType<typeof createAmapController> | undefined;
let savedConfig: { key: string; securityJsCode: string } | null = null;
let alive = true, envSequence = 0, frame = 0, observer: ResizeObserver | undefined;
let media: MediaQueryList | undefined;
let initializedPosition = false, initializedPanel = false;
let envRequested = false;
let envMessageTimer: number | undefined;
type Drag = { id: number; element: HTMLElement; kind: 'small' | 'panel'; x: number; y: number; px: number; py: number; distance: number; moved: boolean };
let drag: Drag | undefined, consumeClick = false;
const data = computed(() => props.model.data);
const period = computed(() => timeOfDay(data.value?.world.日期时间));
const themeClass = computed(() => dark.value ? 'theme-dark' : `tod-${period.value ?? 'day'}`);
const world = computed<Record<string, DisplayValue>>(() => data.value?.world ?? {}), protagonist = computed<Record<string, DisplayValue>>(() => data.value?.protagonist ?? {}), vehicle = computed<Record<string, DisplayValue>>(() => data.value?.rv ?? {});
const barWidth = (value: DisplayValue, capacity: number) => `${(resourceRatio(value, capacity) ?? 0) * 100}%`;
const resources = resourceDisplay;
const smallDate = computed(() => {
  const value = world.value.日期时间;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return '—';
  return `${value.slice(5, 7)}.${value.slice(8, 10)} ${value.slice(11)}`;
});
const address = (location: unknown) => {
  if (location == null || location === '未知' || location === '') return '';
  return [...['国家', '省份', '城市', '区域'].map(key => world.value[key]), location].filter(value => value != null && value !== '未知' && value !== '').join(' ');
};

function measure() {
  frame = 0;
  if (!alive) return;
  Object.assign(viewport, measureViewport(props.owner));
  const element = expanded.value ? panel.value : small.value;
  if (!element) return;
  const size = availableSize(viewport);
  element.style.maxWidth = `${size.width}px`;
  element.style.maxHeight = `${size.height}px`;
  const rect = element.getBoundingClientRect(), kind = expanded.value ? 'panel' : 'small';
  if (!initializedPosition) { position.small.x = viewport.left + viewport.width - rect.width - 16; position.small.y = viewport.top + 72; initializedPosition = true; }
  if (expanded.value && !initializedPanel) { position.panel.x = position.small.x - 750; position.panel.y = position.small.y; initializedPanel = true; }
  const target = position[kind];
  Object.assign(target, fitPosition(target, rect, viewport));
  if (drag) { drag.x = target.x; drag.y = target.y; drag.px = lastPointer.x; drag.py = lastPointer.y; }
  map?.resize();
}
const lastPointer = { x: 0, y: 0 };
function scheduleMeasure() { if (alive && !frame) frame = props.owner.requestAnimationFrame(measure); }
function startDrag(event: PointerEvent, kind: 'small' | 'panel') {
  if (event.button !== 0 || help.value || settings.value || (kind === 'panel' && (event.target as Element).closest('button,input,select,a'))) return;
  const element = event.currentTarget as HTMLElement;
  consumeClick = false;
  lastPointer.x = event.clientX; lastPointer.y = event.clientY;
  drag = { id: event.pointerId, element, kind, x: position[kind].x, y: position[kind].y, px: event.clientX, py: event.clientY, distance: 0, moved: false };
  element.setPointerCapture(event.pointerId);
}
function moveDrag(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  drag.distance += Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
  lastPointer.x = event.clientX; lastPointer.y = event.clientY;
  if (drag.distance > 5) drag.moved = true;
  if (!drag.moved) return;
  position[drag.kind].x = drag.x + event.clientX - drag.px;
  position[drag.kind].y = drag.y + event.clientY - drag.py;
  scheduleMeasure();
}
function endDrag(event: PointerEvent, cancel = false) {
  if (!drag || drag.id !== event.pointerId) return;
  const current = drag; drag = undefined;
  consumeClick = current.moved || cancel;
  if (current.element.hasPointerCapture(event.pointerId)) current.element.releasePointerCapture(event.pointerId);
  measure();
}
function openPanel(event?: MouseEvent) {
  if (event?.detail && consumeClick) { consumeClick = false; return; }
  consumeClick = false; expanded.value = true;
}
async function regenerate() {
  if (updateBusy.value || !props.model.active) return;
  const target = props.model.target;
  regenerating.value = true; regenError.value = '';
  try { await props.regen(); }
  catch (error) {
    if (alive && target === props.model.target) regenError.value = error instanceof Error ? error.message : String(error);
  } finally { if (alive) regenerating.value = false; }
}
function syncMap() {
  map?.sync({ target: props.model.target, visible: props.model.active && props.model.mapAvailable && expanded.value && tab.value === '总览' && !editing.value,
    theme: dark.value ? 'dark' : 'light', protagonistAddress: props.model.mapAvailable ? address(protagonist.value.当前位置) : '', rvAddress: props.model.mapAvailable ? address(vehicle.value.所在地点) : '' });
}
async function loadEnv() {
  if (!alive) return;
  clearEnvMessage();
  const sequence = ++envSequence, role = props.getRole(), char = props.getChar();
  envLoading.value = true;
  map?.setConfig(null); envError.value = ''; envBlocked.value = false; needsReadback.value = false;
  try {
    const config = await readAmapConfig(char);
    if (!alive || sequence !== envSequence || role !== props.getRole()) return;
    mapKey.value = config?.key ?? ''; mapSec.value = config?.securityJsCode ?? '';
    editing.value = !config?.key || !config.securityJsCode;
    savedConfig = config;
    if (props.model.active) map?.setConfig(config); syncMap();
  } catch (error) {
    if (!alive || sequence !== envSequence || role !== props.getRole()) return;
    editing.value = true; envBlocked.value = true; envError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (alive && sequence === envSequence) envLoading.value = false;
  }
}
async function saveEnv() {
  if (saving.value || needsReadback.value || envBlocked.value) return;
  const sequence = ++envSequence, role = props.getRole(), char = props.getChar();
  saving.value = true; envError.value = ''; clearEnvMessage();
  try {
    const result = await saveAmapConfig(char, { key: mapKey.value, securityJsCode: mapSec.value });
    if (!alive || sequence !== envSequence || role !== props.getRole()) return;
    envMessage.value = result.message; editing.value = false;
    envMessageTimer = props.owner.setTimeout(() => { envMessage.value = ''; envMessageTimer = undefined; }, 5_000);
    savedConfig = result.config;
    if (props.model.active) map?.setConfig(result.config); syncMap();
  } catch (error) {
    if (!alive || sequence !== envSequence || role !== props.getRole()) return;
    envError.value = error instanceof Error ? error.message : String(error);
    needsReadback.value = error instanceof AmapEnvError && error.requiresReadback;
    envBlocked.value = error instanceof AmapEnvError && !error.canRetry;
  } finally { if (alive && sequence === envSequence) saving.value = false; }
}
function clearEnvMessage() {
  if (envMessageTimer !== undefined) props.owner.clearTimeout(envMessageTimer);
  envMessageTimer = undefined;
  envMessage.value = '';
}
async function showSettings() {
  settings.value = true; flags.value = null; flagsError.value = ''; flagsLoading.value = true;
  await nextTick(); settingsClose.value?.focus();
  try { const read = await props.inject.get(); if (alive && settings.value) flags.value = read; }
  catch (error) { if (alive && settings.value) flagsError.value = error instanceof Error ? error.message : String(error); }
  finally { if (alive) flagsLoading.value = false; }
}
async function closeSettings() { settings.value = false; await nextTick(); settingsEntry.value?.focus(); }
/** 剧情规划依赖输入增强：关闭输入增强时一并关闭剧情规划，重新开启输入增强不自动恢复。 */
async function changeFlag(name: keyof DvsInjectFlags, value: boolean) {
  if (!flags.value || flagsSaving.value) return;
  const next = { ...flags.value, [name]: value };
  if (name === 'filter' && !value) next.plot = false;
  flagsSaving.value = true; flagsError.value = '';
  try { const saved = await props.inject.set(next); if (alive) flags.value = saved; }
  catch (error) { if (alive) flagsError.value = error instanceof Error ? error.message : String(error); }
  finally { if (alive) flagsSaving.value = false; }
}
function settingsKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); void closeSettings(); }
  if (event.key !== 'Tab') return;
  const buttons = [...(settingsBox.value?.querySelectorAll<HTMLElement>('button,input:not(:disabled)') ?? [])];
  const root = settingsBox.value?.getRootNode() as ShadowRoot | undefined;
  const index = buttons.indexOf((root?.activeElement ?? props.owner.document.activeElement) as HTMLElement);
  const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
  event.preventDefault(); buttons[next]?.focus();
}
async function showHelp() { help.value = true; await nextTick(); helpClose.value?.focus(); }
async function closeHelp() { help.value = false; await nextTick(); helpEntry.value?.focus(); }
function helpKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); void closeHelp(); }
  if (event.key !== 'Tab') return;
  const buttons = [...(helpBox.value?.querySelectorAll<HTMLElement>('button,a[href],input,select') ?? [])];
  const root = helpBox.value?.getRootNode() as ShadowRoot | undefined;
  const index = buttons.indexOf((root?.activeElement ?? props.owner.document.activeElement) as HTMLElement);
  const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
  event.preventDefault(); buttons[next]?.focus();
}
watch([expanded, tab, dark, () => props.model.data, editing, () => props.model.mapAvailable], async () => { await nextTick(); scheduleMeasure(); syncMap(); });
watch([expanded, tab], () => {
  if (!expanded.value || tab.value !== '总览' || envRequested) return;
  envRequested = true;
  void loadEnv();
});
watch(() => props.model.target, () => { regenError.value = ''; map?.clear(props.model.target); syncMap(); }, { flush: 'sync' });
watch(() => props.model.updateStatus.phase, phase => { if (phase !== 'idle') regenError.value = ''; });
watch(() => props.model.mapAvailable, available => { if (!available) syncMap(); }, { flush: 'sync' });
watch(() => props.model.active, active => { if (active && !editing.value) map?.setConfig(savedConfig); else if (!active) map?.setConfig(null); syncMap(); });
watch(theme, value => { try { props.owner.localStorage.setItem('rv-card-statusbar-theme', value); } catch { /* 当前页面选择仍然有效。 */ } });
onMounted(async () => {
  media = props.owner.matchMedia('(prefers-color-scheme: dark)'); systemDark.value = media.matches;
  media.addEventListener('change', systemChanged);
  try { const saved = props.owner.localStorage.getItem('rv-card-statusbar-theme'); if (saved && ['system', 'light', 'dark'].includes(saved)) theme.value = saved; } catch { /* 使用系统主题。 */ }
  props.owner.addEventListener('resize', scheduleMeasure); props.owner.visualViewport?.addEventListener('resize', scheduleMeasure); props.owner.visualViewport?.addEventListener('scroll', scheduleMeasure);
  observer = new (props.owner as Window & typeof globalThis).ResizeObserver(scheduleMeasure);
  if (panel.value) observer?.observe(panel.value); if (small.value) observer?.observe(small.value);
  if (mapContainer.value) map = createAmapController({ container: mapContainer.value, onStatus: status => { if (alive) { mapMessage.value = status.message; mapError.value = status.detail ?? ''; } } });
  await nextTick(); measure();
});
function systemChanged(event: MediaQueryListEvent) { systemDark.value = event.matches; }
onUnmounted(() => {
  alive = false; ++envSequence; if (frame) props.owner.cancelAnimationFrame(frame);
  clearEnvMessage();
  observer?.disconnect(); media?.removeEventListener('change', systemChanged);
  props.owner.removeEventListener('resize', scheduleMeasure); props.owner.visualViewport?.removeEventListener('resize', scheduleMeasure); props.owner.visualViewport?.removeEventListener('scroll', scheduleMeasure);
  map?.dispose(); drag = undefined;
});
</script>

<template>
  <div class="rv-app" :class="[{ dark }, themeClass]">
    <button v-show="!expanded" ref="small" class="small panel" aria-label="打开旅行手册" :inert="help || settings || undefined"
      :style="{ left: position.small.x + 'px', top: position.small.y + 'px' }"
      @pointerdown="startDrag($event, 'small')" @pointermove="moveDrag" @pointerup="endDrag($event)" @pointercancel="endDrag($event, true)" @lostpointercapture="endDrag($event, true)" @click="openPanel">
      <time>{{ smallDate }}</time><strong>{{ formatValue(world.城市) }}</strong><span class="district">{{ formatValue(world.区域) }}</span>
      <span v-for="resource in resources" :key="resource.field" class="tiny-resource" :aria-label="resource.name + ' ' + formatValue(vehicle[resource.field])">
        <Icon :name="resource.icon"/><span class="track" :class="{ missing: resourceRatio(vehicle[resource.field], resource.capacity) === null }"><i :style="{ width: barWidth(vehicle[resource.field], resource.capacity) }"/></span>
      </span>
    </button>
    <section v-show="expanded" ref="panel" class="large panel" :inert="help || settings || undefined" aria-label="旅行手册"
      :style="{ left: position.panel.x + 'px', top: position.panel.y + 'px' }">
      <div class="rv-glow pointer-events-none absolute inset-0"/>
      <header class="drag-title" @pointerdown="startDrag($event, 'panel')" @pointermove="moveDrag" @pointerup="endDrag($event)" @pointercancel="endDrag($event, true)" @lostpointercapture="endDrag($event, true)">
        <div class="title-contours" :style="{ '--contours': `url(${contours})` }" aria-hidden="true"/><div class="book-title"><Emblem class="title-emblem" :period="period" :dark="dark"/><h1>旅行手册</h1></div>
        <div class="title-actions"><div class="theme-switch" role="group" aria-label="主题"><button v-for="option in [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]" :key="option.value" :aria-pressed="theme === option.value" @click="theme = option.value">{{ option.label }}</button></div><button class="regen" :disabled="updateBusy || !model.active" :title="model.active ? '重新请求变量模型，处理当前最新 AI 回复' : '等待角色卡 DVS 就绪后可用'" @click="regenerate">{{ updateLabel }}</button><button ref="settingsEntry" class="settings-button" aria-haspopup="dialog" @click="showSettings"><Icon name="gear"/>设置</button><button class="collapse-button" @click="expanded = false">收起</button></div>
      </header>
      <nav aria-label="旅行手册栏目"><button v-for="item in ['总览', '角色', '房车物资', '随身物品']" :key="item" :aria-pressed="tab === item" @click="tab = item">{{ item }}</button></nav>
      <main>
        <p v-if="model.message" class="notice" role="status">{{ model.message }}<details v-if="model.error"><summary>详细说明</summary><p>{{ model.error }}</p></details></p>
        <p v-if="regenError" class="notice error" role="alert">变量更新未完成：{{ regenError }}</p>
        <OverviewTab v-show="tab === '总览'" :data="data" :dark="dark">
          <template #map>
          <article class="map rv-card flex flex-none flex-col gap-2.5 overflow-hidden px-4 py-3.5 min-[651px]:pr-[15px] min-[651px]:pl-5">
            <div class="map-heading rv-bar border-b border-edge pb-2.5 [--bar-x:-16px] min-[651px]:[--bar-x:-20px]"><h2><Icon name="location"/>旅途地图</h2><button v-if="!editing" @click="editing = true; map?.setConfig(null)">更改地图配置</button></div>
            <p v-if="envLoading" role="status">正在读取地图配置…</p>
            <form v-show="editing && !envLoading" class="map-config" @submit.prevent="saveEnv">
              <p>填写高德地图信息后显示地图</p>
              <label>地图 Key<input v-model="mapKey" :type="reveal ? 'text' : 'password'" autocomplete="off" :disabled="saving"/></label>
              <label>安全密钥<input v-model="mapSec" :type="reveal ? 'text' : 'password'" autocomplete="off" :disabled="saving"/></label>
              <label class="reveal"><input v-model="reveal" type="checkbox"/>显示输入内容</label>
              <div class="form-actions"><button class="primary" :disabled="saving || needsReadback || envBlocked">{{ saving ? '正在写入…' : '保存并显示地图' }}</button><button ref="helpEntry" type="button" @click="showHelp">如何获取？</button></div>
              <button v-if="needsReadback || envBlocked" type="button" @click="loadEnv">重新读取已存配置</button>
            </form>
            <div v-show="!editing" ref="mapContainer" class="map-canvas h-[240px] min-[651px]:h-[340px]" aria-label="主角与房车地图"/>
            <p v-if="envMessage" class="subtle" role="status">{{ envMessage }}</p><p v-if="envError" class="error" role="alert">{{ envError }}</p>
            <template v-if="!editing"><p class="map-legend flex items-center gap-1.5 rounded-md bg-legend px-2.5 py-1 text-[13px]"><span><Icon name="traveller" purpose="map"/>主角</span><span><Icon name="rv" purpose="map"/>房车</span></p><p v-if="mapMessage" class="subtle">{{ mapMessage }}</p><details v-if="mapError"><summary>详细错误</summary><p>{{ mapError }}</p></details><button v-if="mapError" @click="map?.reload()">重新加载地图</button></template>
          </article>
          </template>
        </OverviewTab>
        <CharactersTab v-show="tab === '角色'" :rows="data?.characters ?? []" :reset-key="model.target" :dark="dark"/>
        <ItemsTab v-show="tab === '房车物资'" kind="supplies" :data="data" :reset-key="model.target"/>
        <ItemsTab v-show="tab === '随身物品'" kind="belongings" :data="data" :reset-key="model.target"/>

      </main>
    </section>
    <div v-if="settings" class="help-backdrop" :style="{ left: viewport.left + 'px', top: viewport.top + 'px', width: viewport.width + 'px', height: viewport.height + 'px' }" @keydown="settingsKey">
      <section ref="settingsBox" class="help-box settings-box card" role="dialog" aria-modal="true" aria-labelledby="rv-settings-title"><header><h2 id="rv-settings-title">设置</h2><button ref="settingsClose" @click="closeSettings">关闭</button></header><div class="help-content">
        <p v-if="flagsLoading" role="status">正在读取开关…</p>
        <p v-if="flagsError" class="error" role="alert">{{ flagsError }}</p>
        <template v-if="flags">
          <label class="setting-row"><input type="checkbox" role="switch" :checked="flags.filter" :disabled="flagsSaving" @change="changeFlag('filter', ($event.target as HTMLInputElement).checked)"/><span><b>输入增强</b><small>发送前整理你的输入，优化提示词</small></span></label>
          <label class="setting-row" :class="{ off: !flags.filter }"><input type="checkbox" role="switch" :checked="flags.plot" :disabled="flagsSaving || !flags.filter" @change="changeFlag('plot', ($event.target as HTMLInputElement).checked)"/><span><b>剧情规划</b><small>回复前先规划剧情走向，稳定正文生成。需先开启输入增强</small></span></label>
          <p class="subtle">
            开启输入增强后，每次发送消息会在生成正文前额外请求一次输入增强模型。<br/>
            如开启剧情规划，会在同一请求中额外完成剧情规划。<br/>
            模型和参数在 sqlite-helper 插件的 DVS 设置中配置。
          </p>
        </template>
      </div></section>
    </div>
    <div v-if="help" class="help-backdrop" :style="{ left: viewport.left + 'px', top: viewport.top + 'px', width: viewport.width + 'px', height: viewport.height + 'px' }" @keydown="helpKey">
      <section ref="helpBox" class="help-box card" role="dialog" aria-modal="true" aria-labelledby="rv-help-title"><header><h2 id="rv-help-title">如何获取</h2><button ref="helpClose" @click="closeHelp">关闭</button></header><div class="help-content">
        <p>这两项是高德地图的App信息，用来让这里显示地图。只需要申请一次，同一角色的其它聊天也能继续使用。</p>
        <p><b>所有信息都保存在你本地，不会发给除高德外任何服务。</b></p>
        <ol>
          <li>点击下面的「打开高德控制台」，登录或注册你的账号。</li>
          <li>找到「应用管理 → 我的应用」，创建一个应用，名字可以写「房车状态栏」。</li>
          <li>在应用中添加 Key。服务平台选「Web端（JS API）」。</li>
          <li>把页面上的「Key」复制到「地图 Key」输入框；把同一个 Key 对应的「安全密钥」（也可能写 securityJsCode）复制到「安全密钥」输入框。它们是两串不同的字符。</li>
          <li>如果要求填写可使用的网站地址／域名，按官方说明填写你访问酒馆的地址；从 localhost 换成局域网 IP 后，也要更新允许的地址。</li>
          <li>关闭说明，填好两项，点「保存并显示地图」。加载失败时检查是否复制完整、服务平台是否选对、访问地址是否允许。</li>
        </ol>
        <p>配置保存在当前角色数据库，不会发给剧情模型。地图加载和地点查询会向高德发出请求。导出或分享角色数据库前，应先去除自己的两项地图配置。</p>
        <div class="help-links">
          <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noopener noreferrer">打开高德控制台 ↗</a>
          <a href="https://lbs.amap.com/api/javascript-api-v2/prerequisites" target="_blank" rel="noopener noreferrer">官方说明 ↗</a>
          <a href="https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode" target="_blank" rel="noopener noreferrer">配置说明 ↗</a>
        </div>
      </div></section>
    </div>
  </div>
</template>

<style>
:host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
@layer components {
.rv-app {
  --body-font: "Microsoft YaHei", system-ui, sans-serif;
  --title-font: "Noto Serif SC", "Songti SC", SimSun, serif;
  font: 14px/1.6 var(--body-font); color: var(--text); font-variant-numeric: tabular-nums;
}
* { box-sizing: border-box; }
.rv-app * { scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; }
@supports selector(::-webkit-scrollbar) {
  .rv-app * { scrollbar-width: auto; scrollbar-color: auto; }
  .rv-app ::-webkit-scrollbar { width: 8px; height: 8px; }
  .rv-app ::-webkit-scrollbar-track, .rv-app ::-webkit-scrollbar-corner { background: transparent; }
  .rv-app ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); background-clip: padding-box; border: 2px solid transparent; border-radius: 999px; min-height: 28px; }
  .rv-app ::-webkit-scrollbar-thumb:hover, .rv-app ::-webkit-scrollbar-thumb:active { background-color: var(--scroll-thumb-hover); }
  .rv-app ::-webkit-scrollbar-button { display: none; }
}
button, input, select { font: inherit; color: inherit; }
button, a, input, select { pointer-events: auto; }
button, select { border: 1px solid var(--border); border-radius: 7px; background: var(--card-bg); padding: 6px 12px; cursor: pointer; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button:disabled { opacity: .55; cursor: wait; }
h1, h2, h3, p, dl { margin: 0; }
h1, h2 { font-family: var(--title-font); }
h2 { font-size: 22px; font-weight: 600; line-height: 1.4; }
h3 { font-size: 14px; margin-bottom: 6px; }
small, .subtle, dt { color: var(--subtle); }
.rv-icon { display: inline-block; width: 20px; height: 20px; vertical-align: middle; flex-shrink: 0; pointer-events: none; object-fit: contain; }
.panel { position: fixed; pointer-events: auto; background: var(--panel-bg); border: 2px solid var(--frame-border); border-radius: 14px; box-shadow: 0 4px 16px #17282124; overflow: hidden; }
.small { width: 130px; display: flex; flex-direction: column; align-items: stretch; gap: 5px; padding: 12px 15px; text-align: center; touch-action: none; user-select: none; overflow: auto; min-width: 0; background: var(--card-bg); }
.small time { font-size: 13px; letter-spacing: .01em; white-space: nowrap; }
.small strong { font-size: 19px; font-weight: 600; }
.district { font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; margin-bottom: 3px; }
.tiny-resource { display: flex; align-items: center; gap: 9px; }
.tiny-resource .rv-icon { width: 18px; height: 18px; }
.tiny-resource { color: var(--accent); }
.track { display: block; height: 6px; border-radius: 5px; background: var(--track); overflow: hidden; flex: 1; }
.track.missing { background: repeating-linear-gradient(90deg, var(--track) 0 4px, transparent 4px 7px); }
.track i { display: block; height: 100%; background: var(--resource-fill); border-radius: 5px; }
.large { width: 900px; height: 720px; display: flex; flex-direction: column; }
.drag-title { position: relative; user-select: none; display: flex; align-items: center; flex-wrap: wrap; gap: 9px 16px; padding: 17px 22px 15px;  flex-shrink: 0; touch-action: none; }
.title-contours { position: absolute; inset: 0 0 0 24%; width: 52%; pointer-events: none; background: var(--accent); opacity: .5;
  -webkit-mask-image: var(--contours), linear-gradient(90deg, transparent, #000 35%, #000 65%, transparent), linear-gradient(180deg, #000 55%, transparent);
  mask-image: var(--contours), linear-gradient(90deg, transparent, #000 35%, #000 65%, transparent), linear-gradient(180deg, #000 55%, transparent);
  -webkit-mask-size: cover, 100% 100%, 100% 100%; mask-size: cover, 100% 100%, 100% 100%; -webkit-mask-position: center; mask-position: center;
  -webkit-mask-composite: source-in, source-in; mask-composite: intersect, intersect; }
.dark .title-contours { opacity: .38; }
.book-title { position: relative; display: flex; align-items: center; gap: 12px; flex: 1 1 310px; min-width: 0; }
.title-emblem { width: 61px; height: 61px; flex: none; pointer-events: none; user-select: none; }
.book-title h1 { font-size: 30px; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
.title-actions { position: relative; display: flex; gap: 9px; align-items: center; flex-wrap: wrap; }
.collapse-button, .regen, .settings-button { flex-shrink: 0; font-size: 12px; }
.settings-button { display: inline-flex; align-items: center; gap: 4px; background: transparent; border-color: var(--edge); }
.settings-button .rv-icon { width: 14px; height: 14px; }
.setting-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; cursor: pointer; }
.setting-row.off { opacity: .55; cursor: not-allowed; }
.setting-row span { display: flex; flex-direction: column; gap: 2px; }
.setting-row input { width: auto; margin-top: 4px; accent-color: var(--accent); }
.settings-box { width: 440px; }
.regen { background: var(--soft); border-color: var(--accent); color: var(--tc); font-weight: 600; }
.collapse-button { background: transparent; border-color: var(--edge); color: var(--subtle); }
.theme-switch { display: flex; border: 1px solid var(--border); border-radius: 20px; padding: 2px; }
.theme-switch button { border: 0; background: transparent; border-radius: 18px; padding: 4px 14px; font-size: 12px; white-space: nowrap; }
.theme-switch button[aria-pressed=true] { background: var(--accent); color: var(--accent-text); }
nav { position: relative; display: flex; padding: 0 12px; flex-shrink: 0; border-top: 1px solid var(--sep); border-bottom: 1px solid var(--edge); }
nav button { flex: 1; min-width: 0; white-space: nowrap; border: 0; border-radius: 0; background: transparent; padding: 9px 8px; color: var(--text); border-bottom: 3px solid transparent; font-size: 15px; font-weight: 600; }
nav button[aria-pressed=true] { color: var(--accent); border-bottom-color: var(--accent); }
main { position: relative; padding: 13px 15px; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.notice { font-size: 12px; margin-bottom: 12px; background: var(--detail-bg); padding: 7px 10px; border-radius: 6px; }
.card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; min-width: 0; overflow-wrap: anywhere; }
dd { margin: 0; white-space: pre-wrap; min-width: 0; }
.empty { color: var(--subtle); padding: 20px; grid-column: 1/-1; }
.map-heading { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 10px; }
.map-heading h2 { display: flex; align-items: center; gap: 7px; font: 600 20px/1.4 var(--title-font); }
.map-heading button { font-size: 11px; padding: 3px 6px; }
.map-canvas { border-radius: 8px; overflow: hidden; background: var(--detail-bg); }
.map-canvas iframe { width: 100%; height: 100%; border: 0; display: block; }
.map-legend span { display: inline-flex; align-items: center; gap: 5px; }
.map-config { display: flex; flex-direction: column; gap: 7px; font-size: 12px; }
.map-config label:not(.reveal) { display: flex; flex-direction: column; gap: 3px; }
input:not([type=checkbox]) { min-width: 0; width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 5px; background: var(--detail-bg); }
.reveal { display: flex; gap: 5px; align-items: center; }
.form-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.form-actions button { font-size: 12px; padding: 5px 8px; }
.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.error { color: #ac4136; font-size: 12px; }
.dark .error { color: #f3ada0; }
details { font-size: 12px; overflow-wrap: anywhere; }
.help-backdrop { position: fixed; pointer-events: auto; background: #0c191c80; display: flex; align-items: center; justify-content: center; padding: 12px; z-index: 2; }
.help-box { width: 560px; max-width: 100%; max-height: 100%; display: flex; flex-direction: column; box-shadow: 0 12px 60px #0005; }
.help-box header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 15px 18px; flex-shrink: 0; border-bottom: 1px solid var(--border); }
.help-box header h2 { font: 600 18px/1.4 var(--body-font); }
.help-box header button { flex-shrink: 0; }
.help-content { overflow: auto; min-height: 0; padding: 16px 20px; font-size: 13px; }
.help-content p { margin-bottom: 12px; }
.help-content ol { padding-left: 20px; margin: 0 0 12px; list-style: decimal; }
.help-content li { margin-bottom: 9px; }
.help-links { display: flex; flex-wrap: wrap; gap: 12px; }
.help-links a { color: var(--accent); }
[inert] { pointer-events: none; }
@media (max-width: 650px) {
  .drag-title { padding: 10px 13px; gap: 6px; }
  .book-title h1 { font-size: 23px; }
  .title-emblem { width: 42px; height: 42px; }
  .book-title { gap: 8px; }
  .title-contours { display: none; }
  .title-actions { margin-left: auto; gap: 6px; }
  .theme-switch button { font-size: 11px; padding: 3px 10px; }
  .collapse-button, .regen, .settings-button { font-size: 11px; padding: 4px 7px; }
  nav { padding: 0 6px; }
  nav button { font-size: 13px; padding: 8px 4px; }
  main { padding: 10px; }
  .help-backdrop { padding: 8px; }
  .help-box header { padding: 10px; }
  .help-content { padding: 12px; }
}
@media (max-height: 350px) {
  .drag-title { padding: 6px 10px; }
  .title-emblem { width: 29px; height: 29px; }
  .book-title h1 { font-size: 19px; }
  nav button { padding: 5px 4px; }
}
}
</style>
