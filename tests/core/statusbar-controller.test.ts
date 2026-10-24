import { expect, test } from 'bun:test';
import type { DvsState } from '../../types/sqlite-helper/dvs';
import { createStatusbarController, type RvReadTarget, type StatusbarReadState } from '../../状态栏/data';
import { gate } from '../support/database';

function setup() {
  let target: RvReadTarget = {
    character: 'rv',
    chatId: 'chat',
    chat: [],
    message: {},
    messageId: 2,
    swipeId: 0,
    fid: 'fixed',
  };
  let calls = 0,
    fail = false,
    pause: { entered: ReturnType<typeof gate>; release: ReturnType<typeof gate> } | undefined;
  const listeners = new Set<() => void | Promise<void>>(),
    views: StatusbarReadState[] = [];
  const dvs = {
    async getState(requested?: { messageId: number; swipeId?: number }) {
      expect(requested).toEqual({ messageId: target.messageId, swipeId: target.swipeId });
      const value = ++calls,
        paused = pause;
      pause = undefined;
      if (fail) throw new Error('当前读取失败');
      const waitForRead = async () => {
        if (paused) {
          paused.entered.release();
          await paused.release.promise;
        }
      };
      return {
        table() {
          return {
            async row() {
              await waitForRead();
              return { 城市: `city${value}` };
            },
            async rows() {
              await waitForRead();
              return [];
            },
          };
        },
      } as unknown as DvsState;
    },
    onUpdate(callback: () => void | Promise<void>) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
  const controller = createStatusbarController({
    dvs,
    captureTarget: () => target,
    getPlayerName: () => '玩家',
    publish: state => {
      views.push(state);
    },
  });
  return {
    controller,
    views,
    listeners,
    get calls() {
      return calls;
    },
    change(update: Partial<RvReadTarget>) {
      target = { ...target, ...update };
    },
    fail() {
      fail = true;
    },
    pause() {
      const next = { entered: gate(), release: gate() };
      pause = next;
      return next;
    },
  };
}
test('作者晚启动前不读取，重新注册只保留一次订阅，关闭清空', async () => {
  const s = setup();
  s.controller.requestRefresh();
  await s.controller.whenIdle();
  expect(s.calls).toBe(0);
  s.controller.authorReady();
  await s.controller.whenIdle();
  expect(s.calls).toBe(1);
  s.controller.authorReady();
  await s.controller.whenIdle();
  expect(s.listeners.size).toBe(1);
  s.controller.authorClosed();
  expect(s.views.at(-1)?.data).toBeNull();
  expect(s.listeners.size).toBe(0);
});
test('同聊天失败保留旧值，换聊天立即清空', async () => {
  const s = setup();
  s.controller.authorReady();
  await s.controller.whenIdle();
  const old = s.views.at(-1)!.data;
  s.fail();
  s.controller.requestRefresh();
  await s.controller.whenIdle();
  expect(s.views.at(-1)?.data).toBe(old);
  expect(s.views.at(-1)?.error).toBe('当前读取失败');
  expect(s.views.at(-1)?.message).toContain('显示上次已读取数据');
  s.change({ chatId: 'new', chat: [] });
  s.controller.chatChanged();
  expect(s.views.at(-1)?.data).toBeNull();
  await s.controller.whenIdle();
  expect(s.views.at(-1)?.data).toBeNull();
});
test('同批读取中多条通知合并，旧批结果不能发布', async () => {
  const s = setup(),
    paused = s.pause();
  s.controller.authorReady();
  await paused.entered.promise;
  for (let i = 0; i < 4; i++) s.controller.requestRefresh();
  expect(s.calls).toBe(1);
  paused.release.release();
  await s.controller.whenIdle();
  expect(s.calls).toBe(2);
  expect(s.views.filter(view => view.data !== null).map(view => view.data!.world.城市)).toEqual(['city2']);
});
test.each(['message', 'swipeId', 'fid'] as const)('最新目标 %s 改变，即使没有通知也丢弃旧结果并重读', async field => {
  const s = setup(),
    paused = s.pause();
  s.controller.authorReady();
  await paused.entered.promise;
  s.change(
    field === 'message' ? { message: {}, messageId: 3 } : field === 'swipeId' ? { swipeId: 1 } : { fid: 'changed' },
  );
  paused.release.release();
  await s.controller.whenIdle();
  expect(s.calls).toBe(2);
  expect(s.views.at(-1)?.data?.world.城市).toBe('city2');
  expect(s.views.some(view => view.data?.world.城市 === 'city1')).toBe(false);
});
test('查询已进入后切聊天，旧数据不挂载；dispose 后不再发布', async () => {
  const s = setup(),
    paused = s.pause();
  s.controller.authorReady();
  await paused.entered.promise;
  s.change({ chatId: 'new', chat: [] });
  s.controller.chatChanged();
  s.controller.dispose();
  const count = s.views.length;
  paused.release.release();
  await s.controller.whenIdle();
  expect(s.views.length).toBe(count);
  expect(s.views.at(-1)?.data).toBeNull();
  expect(s.listeners.size).toBe(0);
});
