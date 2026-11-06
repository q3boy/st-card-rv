import { expect, test } from 'bun:test';
import { authorSource as source, authorGlobals } from '../support/author';
import type { DvsRegistration } from '../../types/sqlite-helper/dvs';
import { npcText } from '../support/npc-profile';
import { parse } from 'yaml';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => {
    resolve = finish;
  });
  return { promise, resolve };
}
function start(
  register: (options: DvsRegistration, lifetime: { signal: AbortSignal }) => Promise<() => void>,
  initialized: Promise<void> = Promise.resolve(),
  globals: object = authorGlobals,
) {
  let work!: Promise<void>, close!: () => void;
  const jquery = (value: unknown) => {
    if (typeof value === 'function') work = Promise.resolve(value());
    return {
      one(event: string, callback: () => void) {
        expect(event).toBe('pagehide');
        close = callback;
      },
    };
  };
  new Function('$', 'window', 'waitGlobalInitialized', 'getScriptId', 'DVS', 'globalThis', source)(
    jquery,
    {},
    () => initialized,
    () => 'rv-author',
    { register },
    globals,
  );
  return {
    get work() {
      return work;
    },
    close: () => close(),
  };
}
test('编译后的唯一作者注册接入NPC屏蔽和原文交接，卡片引用生成产物并启用拦截', async () => {
  let count = 0;
  let registration: DvsRegistration | undefined;
  const run = start(async options => {
    count++;
    registration = options;
    return () => {};
  });
  await run.work;
  expect(count).toBe(1);
  expect(registration!.preNarrativeUi).toHaveLength(1);
  const interaction = registration!.preNarrativeUi![0]!;
  expect(interaction.key).toBe('npc_generate');
  expect(interaction.buttonText).toBe('查看/重新生成NPC');
  expect(interaction.narrativeEntriesSkip).toEqual(['NPC生成机制', '人设生成']);
  const text = npcText();
  expect((await interaction.component.toPrompt({ profile: text })).endsWith(text)).toBe(true);
  expect(registration!.uniqueKeys.角色信息).toEqual(['姓名']);
  expect(registration!.virtualTables!.本轮结算).toBeDefined();
  const index = parse(await Bun.file('index.yaml').text());
  const script = index.扩展字段.酒馆助手.脚本库.find((item: { 名称: string }) => item.名称 === 'DVS');
  expect(script.文件.replaceAll('\\', '/')).toBe('脚本/DVS.bundle.js');
  expect(script.数据.dvs.exts.pre_narr_ui).toBe(true);
  run.close();
});

test('作者把当前页面的 signal 传给注册，关闭时中止', async () => {
  let signal!: AbortSignal;
  const run = start(async (_options, lifetime) => {
    signal = lifetime.signal;
    return () => {};
  });
  await run.work;
  expect(signal.aborted).toBe(false);
  run.close();
  expect(signal.aborted).toBe(true);
});

test('未加载Vue时仍能注册原结算回调及复用已保存人设，界面依赖不阻止原业务', async () => {
  let registration: DvsRegistration | undefined;
  const run = start(
    async options => {
      registration = options;
      return () => {};
    },
    Promise.resolve(),
    {},
  );
  await run.work;
  expect(typeof registration!.preUpdate).toBe('function');
  expect(registration!.uniqueKeys.房车信息).toEqual(['标识']);
  const text = npcText();
  expect((await registration!.preNarrativeUi![0]!.component.toPrompt({ profile: text })).endsWith(text)).toBe(true);
  run.close();
});
test('注册等待期间关闭立即中止 signal，不等待注册完成', async () => {
  const gate = deferred<() => void>();
  let signal!: AbortSignal;
  const run = start((_options, lifetime) => {
    signal = lifetime.signal;
    return gate.promise;
  });
  await Promise.resolve();
  run.close();
  expect(signal.aborted).toBe(true);
  gate.resolve(() => {});
  await run.work;
});
test('等待公共接口期间关闭，随后注册收到已中止的 signal', async () => {
  const gate = deferred<void>();
  let signal!: AbortSignal;
  const run = start(async (_options, lifetime) => {
    signal = lifetime.signal;
    return () => {};
  }, gate.promise);
  run.close();
  gate.resolve();
  await run.work;
  expect(signal.aborted).toBe(true);
});
test('旧页面关闭只中止旧 signal', async () => {
  const signals: AbortSignal[] = [];
  const register = async (_options: unknown, lifetime: { signal: AbortSignal }) => {
    signals.push(lifetime.signal);
    return () => {};
  };
  const old = start(register);
  await old.work;
  const current = start(register);
  await current.work;
  old.close();
  expect(signals.map(signal => signal.aborted)).toEqual([true, false]);
  current.close();
  expect(signals.map(signal => signal.aborted)).toEqual([true, true]);
});
