import { expect, test } from 'bun:test';

const source = await Bun.file('脚本/DVS.js').text();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => {
    resolve = finish;
  });
  return { promise, resolve };
}
function start(
  register: (options: unknown, lifetime: { signal: AbortSignal }) => Promise<() => void>,
  initialized: Promise<void> = Promise.resolve(),
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
  new Function('$', 'window', 'waitGlobalInitialized', 'getScriptId', 'DVS', source)(
    jquery,
    {},
    () => initialized,
    () => 'rv-author',
    { register },
  );
  return {
    get work() {
      return work;
    },
    close: () => close(),
  };
}
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
