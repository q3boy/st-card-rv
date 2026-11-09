import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { npcText } from '../support/npc-profile';

const host = (page: Page) => page.locator('#npc-operation');

async function boot(page: Page, withVue = true, result?: { profile: string }, count = 1) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  if (withVue) await page.addScriptTag({ url: '/node_modules/vue/dist/vue.runtime.global.prod.js' });
  await page.evaluate(({ result, count }) => {
    const owner = window as any;
    const state: any = (owner.npcTest = {
      requests: [],
      pending: [],
      results: [],
      reads: [],
      cancelled: 0,
      initialResult: result,
    });
    owner.$ = (value: unknown) => {
      if (typeof value === 'function') owner.npcReady = Promise.resolve(value());
      return { one() {} };
    };
    owner.waitGlobalInitialized = async () => {};
    owner.getScriptId = () => 'rv-npc-test';
    owner.substitudeMacros = (text: string) => text.replaceAll('{{user}}', '玩家');
    owner.DVS = {
      register: async (registration: unknown) => {
        state.registration = registration;
        return () => {};
      },
    };
    owner.mountNpc = () => {
      const container = document.createElement('div');
      container.id = 'npc-operation';
      container.style.cssText = 'width:950px;max-width:calc(100% - 24px);margin:12px auto;';
      document.body.append(container);
      const abort = new AbortController();
      state.abort = abort;
      let dispose: () => void;
      const component = state.registration.preNarrativeUi[0].component;
      const context = {
        userInput: '请让我确认一位新旅人的资料。',
        params: { count },
        plotPlan: null,
        prompt: {
          userInput: () => '请让我确认一位新旅人的资料。',
          prevNarrative: () => '房车停在湖边，清晨刚刚开始。',
          historyNarrative: () => '',
          plotPlan: () => '',
          expand: (text: string) =>
            text
              .replaceAll('[[DVS_USER_INPUT]]', '请让我确认一位新旅人的资料。')
              .replaceAll('[[DVS_PREV_NARRATIVE]]', '房车停在湖边，清晨刚刚开始。')
              .replaceAll('[[DVS_PLOT_PLAN]]', ''),
        },
        worldbook: {
          getEntries: async (names: string[]) => {
            state.reads.push(names);
            return [
              {
                book: '不要输出这个标题',
                uid: 1,
                name: '[DVS:正文;可筛选]NPC生成机制',
                content: '[[DVS_FILTER:本轮需要新人]]\n按湖边情境准备一位旅人。',
                enabled: true,
                order: 97,
              },
              {
                book: '不要输出这个标题',
                uid: 2,
                name: '[DVS:正文;可筛选]人设生成',
                content: '[[dvs_filter:本轮需要人设]]\n使用人设分组 YAML 格式。',
                enabled: true,
                order: 98,
              },
            ];
          },
        },
        requestModel: (request: unknown) => {
          state.requests.push(request);
          return new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
        },
        complete: (result: unknown) => {
          state.results.push(JSON.parse(JSON.stringify(result)));
          abort.abort();
          dispose();
          container.remove();
          const saved = document.createElement('section');
          saved.id = 'npc-result';
          saved.style.cssText = 'width:950px;max-width:calc(100% - 24px);margin:12px auto;';
          document.body.append(saved);
          state.disposeResult = component.mountResult(saved, result);
        },
        cancel: () => {
          state.cancelled++;
          abort.abort();
          dispose();
          container.remove();
        },
        signal: abort.signal,
        ...(state.initialResult === undefined ? {} : { result: structuredClone(state.initialResult) }),
      };
      dispose = component.mount(container, context);
    };
    document.body.style.margin = '0';
    document.querySelector('#background')?.remove();
  }, { result, count });
  await page.addScriptTag({ url: '/.test-data/card-rv/build/DVS.js' });
  await page.evaluate(async () => {
    await (window as any).npcReady;
    (window as any).mountNpc();
  });
  if (withVue)
    await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(result ? 0 : 1);
  return errors;
}

async function respond(page: Page, text: string) {
  text = `<npc_list>\n${text}\n</npc_list>`;
  await page.evaluate(
    text => (window as any).npcTest.pending.shift().resolve({ content: text, finishReason: 'stop' }),
    text,
  );
}

test('缺少Vue只报告界面错误，原作者注册和已保存人设交接仍可用', async ({ page }) => {
  const errors = await boot(page, false);
  await expect(host(page).getByRole('alert')).toContainText('请更新酒馆助手后重开角色');
  const text = npcText();
  const prompt = await page.evaluate(
    text => (window as any).npcTest.registration.preNarrativeUi[0].component.toPrompt({ profile: text }),
    text,
  );
  expect(prompt.endsWith(text)).toBe(true);
  expect(await page.evaluate(() => typeof (window as any).npcTest.registration.preUpdate)).toBe('function');
  expect(await page.evaluate(() => (window as any).npcTest.requests)).toEqual([]);
  expect(errors).toEqual([]);
});

test('重新调整先展示已保存人设，点击再生成才带着原文请求模型', async ({ page }) => {
  const original = npcText();
  const errors = await boot(page, true, { profile: original });
  await expect(host(page).getByText('林清', { exact: true })).toBeVisible();
  await expect(host(page).getByRole('button', { name: '确认人设并继续' })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).npcTest.requests)).toEqual([]);
  expect(await page.evaluate(() => (window as any).npcTest.reads)).toEqual([]);
  await host(page).getByRole('textbox', {}).fill('保留姓名，更开朗');
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(1);
  const request = await page.evaluate(() => (window as any).npcTest.requests[0]);
  expect(request.messages[1].content).toContain(original);
  expect(request.messages[1].content).toContain('保留姓名，更开朗');
  const next = npcText('林清', { 性格设定: { 核心特质: '开朗', 行为模式: ['主动打招呼'] } });
  await respond(page, next);
  await host(page).getByRole('button', { name: '确认人设并继续' }).click();
  expect(await page.evaluate(() => (window as any).npcTest.results)).toEqual([{ profile: next }]);
  expect(errors).toEqual([]);
});

test('实际作者产物首次生成、修改、确认及独立只读摘要使用完整标签', async ({ page }) => {
  const errors = await boot(page);
  await expect(host(page).getByRole('button', { name: '确认人设并继续' })).toBeDisabled();
  await expect(host(page).getByText('林清', { exact: true })).toHaveCount(0);
  const first = npcText();
  await respond(page, first);
  await expect(host(page).locator('.edition')).toHaveText('候选 01');
  await host(page).getByRole('textbox', {}).fill('保留姓名，改穿蓝外套');
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect(host(page).getByRole('button', { name: '确认人设并继续' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(2);
  const request = await page.evaluate(() => (window as any).npcTest.requests[1]);
  expect(request.outputFormat).toBe('text');
  expect(request.messages[1].content).toContain(first);
  expect(request.messages[1].content).toContain('保留姓名，改穿蓝外套');
  expect(request.messages[1].content).toContain('房车停在湖边');
  expect(request.messages[1].content).not.toMatch(/DVS_FILTER|不要输出这个标题|DVS_DATA|\[\[DVS_/i);
  const next = npcText('林清', { 外貌特征: { 相貌: '齐肩黑发', 身材: '中等体态', 穿着: '蓝色外套' } });
  await respond(page, next);
  await expect(host(page).locator('.edition')).toHaveText('候选 02');
  await expect(host(page).locator('.profile-columns')).toBeVisible();
  await expect(host(page).getByRole('textbox', {})).toHaveValue('保留姓名，改穿蓝外套');
  await host(page).getByRole('button', { name: '确认人设并继续' }).click();
  await expect(host(page)).toHaveCount(0);
  const result = page.locator('#npc-result');
  await expect(result).toHaveText('林清 · 26岁 · 旅行摄影师');
  await expect(result.locator('details, .pill, .profile-head, .profile-nsfw')).toHaveCount(0);
  await expect(result.locator('.profile-columns')).toHaveCount(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(`.test-data/card-rv/browser/npc-summary-${width}.png`), fullPage: true });
  }
  await expect(result.getByRole('textbox')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).npcTest.results)).toEqual([{ profile: next }]);
  expect(await page.evaluate(() => (window as any).npcTest.requests.length)).toBe(2);
  expect(errors).toEqual([]);
});

test('首次失败可重试，再生成及格式失败保留原候选和要求', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).npcTest.pending.shift().reject(new Error('模拟连接失败')));
  await expect(host(page).getByRole('alert')).toContainText('模拟连接失败');
  await host(page).getByText('查看详情', { exact: true }).click();
  await expect(host(page).getByRole('alert')).toContainText('本次请求未取得 LLM 返回。');
  await expect(host(page).locator('.llm-raw-response')).toHaveCount(0);
  await expect(host(page).getByRole('button', { name: '确认人设并继续' })).toBeDisabled();
  await host(page).getByRole('button', { name: '再次尝试', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(2);
  expect(await page.evaluate(() => (window as any).npcTest.requests[1].messages[1].content)).not.toContain(
    '【当前已生成的角色信息】',
  );
  await respond(page, npcText());
  await host(page).getByRole('textbox', {}).fill('保留姓名');
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(3);
  await page.evaluate(() => (window as any).npcTest.pending.shift().reject(new Error('模拟再次请求失败')));
  await expect(host(page).getByRole('alert')).toContainText('模拟再次请求失败');
  await expect(host(page).locator('.edition')).toHaveText('候选 01');
  await expect(host(page).getByRole('textbox')).toHaveValue('保留姓名');
  await expect(host(page).getByRole('button', { name: '确认人设并继续' })).toBeEnabled();
  await host(page).getByRole('button', { name: '再次尝试', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(4);
  const invalidResponse = '<npc name="林清">\n基础信息:\n  姓名: 其他\n  年龄: 26\n</npc>';
  await respond(page, invalidResponse);
  await expect(host(page).getByRole('alert')).toContainText('基础信息中的姓名须与人设标签一致');
  await host(page).getByText('查看详情', { exact: true }).click();
  expect(await host(page).locator('.llm-raw-response').textContent()).toBe(`<npc_list>\n${invalidResponse}\n</npc_list>`);
  await expect(host(page).locator('.llm-raw-response').locator('npc')).toHaveCount(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(`.test-data/card-rv/browser/npc-error-${width}.png`), fullPage: true });
  }
  await expect(host(page).locator('.edition')).toHaveText('候选 01');
  await host(page).getByRole('button', { name: '再次尝试', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(5);
  await page.evaluate(() => (window as any).npcTest.pending.shift().reject(new Error('重试连接失败')));
  await expect(host(page).getByRole('alert')).toContainText('重试连接失败');
  await host(page).getByText('查看详情', { exact: true }).click();
  await expect(host(page).locator('.llm-raw-response')).toHaveCount(0);
  await expect(host(page).getByRole('alert')).toContainText('本次请求未取得 LLM 返回。');
  await host(page).getByRole('button', { name: '再次尝试', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(6);
  await respond(page, rename(npcText('周宁'), '林清'));
  await expect(host(page).locator('.edition')).toHaveText('候选 02');
  await expect(host(page).getByText('周宁', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('多轮调整只保留成功历史，关闭重开只预载已确认人设', async ({ page }) => {
  const errors = await boot(page);
  const first = npcText('林清');
  const second = npcText('周宁');
  const third = npcText('陈安');
  await respond(page, first);
  const input = host(page).getByRole('textbox', {});
  await input.fill('第一轮要求');
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(2);
  await respond(page, rename(second, '林清'));
  await expect(host(page).locator('.edition')).toHaveText('候选 02');
  await input.fill('失败的要求');
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(3);
  await page.evaluate(() => (window as any).npcTest.pending.shift().reject(new Error('模拟失败')));
  await expect(host(page).getByRole('alert')).toContainText('模拟失败');
  await input.fill('第二轮要求');
  await host(page).getByRole('button', { name: '再次尝试', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(4);
  const retry = await page.evaluate(() => (window as any).npcTest.requests[3].messages[1].content);
  expect(retry).toContain(`<message role="ai">\n${first}\n</message>\n<message role="user">\n第一轮要求\n</message>`);
  expect(retry).not.toContain('失败的要求');
  expect(retry).toContain(`<last_npc_data>\n${second}\n</last_npc_data>`);
  await respond(page, rename(third, '周宁'));
  await expect(host(page).locator('.edition')).toHaveText('候选 03');
  await input.fill('第三轮要求');
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(5);
  const request = await page.evaluate(() => (window as any).npcTest.requests[4].messages[1].content);
  expect(request).toContain(
    `<message role="ai">\n${first}\n</message>\n<message role="user">\n第一轮要求\n</message>\n<message role="ai">\n${second}\n</message>\n<message role="user">\n第二轮要求\n</message>`,
  );
  expect(request).toContain(`<last_npc_data>\n${third}\n</last_npc_data>`);
  await respond(page, third);
  await expect(host(page).getByText('本次没有人设变化。')).toBeVisible();
  await host(page).getByRole('button', { name: '确认人设并继续' }).click();
  expect(await page.evaluate(() => (window as any).npcTest.results)).toEqual([{ profile: third }]);
  await page.evaluate(() => {
    const owner = window as any;
    owner.npcTest.initialResult = owner.npcTest.results[0];
    owner.mountNpc();
  });
  await expect(host(page).getByText('陈安', { exact: true })).toBeVisible();
  await host(page).getByRole('button', { name: /^(按要求调整|重新生成).+/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(6);
  const reopened = await page.evaluate(() => (window as any).npcTest.requests[5].messages[1].content);
  expect(reopened).toContain('<messages>\n\n</messages>');
  expect(reopened).toContain(`<last_npc_data>\n${third}\n</last_npc_data>`);
  expect(reopened).not.toContain('第一轮要求');
  expect(reopened).not.toContain('第二轮要求');
  expect(errors).toEqual([]);
});

function rename(text: string, oldName: string) {
  return text.replace('">', `" oldname="${oldName}">`);
}

test('展开两位候选分别调整，保留输入，忽略组外人物并一次确认整组', async ({ page }) => {
  const errors = await boot(page, true, undefined, 2);
  const first = npcText('林夏');
  const second = npcText('林秋');
  await respond(page, [first, second].join('\n'));
  const cards = host(page).locator('.profile-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole('textbox')).toBeVisible();
  await expect(cards.nth(1).getByRole('textbox')).toBeHidden();
  const requirement = '保留姐姐，妹妹改名沈夏';
  await cards.nth(0).getByRole('textbox').fill(requirement);
  await cards.nth(1).locator('.profile-head').click();
  await cards.nth(1).getByRole('textbox').fill('让姐姐更开朗');
  if (!(await cards.nth(0).getByRole('textbox').isVisible())) await cards.nth(0).locator('.profile-head').click();
  await expect(cards.nth(0).getByRole('textbox')).toHaveValue(requirement);
  await cards.nth(0).getByRole('button', { name: '按要求调整林夏' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(2);
  const renamed = npcText('沈夏');
  const sister = npcText('林秋', { 背景设定: { 生活背景: '与妹妹沈夏旅行' } });
  await respond(page, [rename(renamed, '林夏'), sister, npcText('陈青')].join('\n'));
  await expect(cards).toHaveCount(2);
  await expect(cards.first().locator('.profile-head')).toContainText('沈夏');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(`.test-data/card-rv/browser/npc-multiple-${width}.png`), fullPage: true });
  }
  await host(page).getByRole('button', { name: '确认 2 位人设并继续' }).click();
  expect(await page.evaluate(() => (window as any).npcTest.results)).toEqual([{ profile: [renamed, sister].join('\n\n') }]);
  expect(errors).toEqual([]);
});

test('等待时取消卸载，晚到结果不交付，也不影响下一次独立实例', async ({ page }) => {
  const errors = await boot(page);
  await host(page).getByRole('button', { name: /关闭/ }).click();
  await expect(host(page)).toHaveCount(0);
  await page.evaluate(() => (window as any).mountNpc());
  await expect.poll(() => page.evaluate(() => (window as any).npcTest.requests.length)).toBe(2);
  await respond(page, npcText('旧候选'));
  await expect(host(page).getByText('旧候选', { exact: true })).toHaveCount(0);
  await respond(page, npcText('新候选'));
  await expect(host(page).getByText('新候选', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).npcTest.results)).toEqual([]);
  expect(await page.evaluate(() => (window as any).npcTest.cancelled)).toBe(1);
  expect(errors).toEqual([]);
});

for (const width of [1280, 390, 320]) {
  test(`${width}px 原型布局、全部字段及操作可见，保存界面截图`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = await boot(page);
    await respond(
      page,
      npcText('林清', {
        背景设定: { 生活背景: '用于核对长字段换行的中性测试资料。'.repeat(5), 当前处境: '湖边休整。' },
      }),
    );
    await expect(host(page).locator('.profile-nsfw dt')).toHaveCount(7);
    const layout = await host(page)
      .locator('.profile-columns')
      .evaluate(node => getComputedStyle(node).display);
    expect(layout).toBe(width > 650 ? 'grid' : 'flex');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host(page).getByRole('button', { name: '确认人设并继续' }).scrollIntoViewIfNeeded();
    await expect(host(page).getByRole('button', { name: /关闭/ })).toBeVisible();
    await expect(host(page).getByRole('button', { name: '确认人设并继续' })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    await page.screenshot({ path: resolve(`.test-data/card-rv/browser/npc-${width}.png`), fullPage: true });
    await host(page).getByRole('textbox', {}).fill('保留姓名，让性格更开朗');
    await page.screenshot({ path: resolve(`.test-data/card-rv/browser/npc-expanded-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
