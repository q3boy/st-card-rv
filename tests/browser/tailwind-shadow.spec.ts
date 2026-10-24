import { expect, test, type Page } from '@playwright/test';

// 与产品相同：样式只放进 ShadowRoot，不写入文档头。
async function probe(page: Page, file: string) {
  await page.goto('/');
  const css = await (await page.request.get(`/.test-data/card-rv/build/${file}`)).text();
  return page.evaluate(text => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${text}</style><div id="border" class="border" style="width:20px;height:20px"></div><div id="shift" class="-translate-y-1/2" style="width:20px;height:20px"></div>`;
    const border = getComputedStyle(shadow.getElementById('border')!);
    const shift = getComputedStyle(shadow.getElementById('shift')!);
    return {
      documentSheets: document.styleSheets.length,
      borderStyle: border.borderTopStyle,
      borderWidth: border.borderTopWidth,
      translate: shift.translate,
    };
  }, css);
}
test('对照：未展开 @supports 的 Tailwind 输出在 ShadowRoot 内边框和位移都不生效', async ({ page }) => {
  const result = await probe(page, 'tailwind-probe-raw.css');
  expect(result.documentSheets).toBe(0);
  expect(result.borderStyle).toBe('none');
  expect(result.translate).toBe('none');
});
test('构建产出：只放进 ShadowRoot 时带 border 的元素边框可见、带位移的元素确实位移', async ({ page }) => {
  const result = await probe(page, 'tailwind-probe.css');
  expect(result.documentSheets).toBe(0);
  expect(result.borderStyle).toBe('solid');
  expect(result.borderWidth).toBe('1px');
  expect(result.translate).toBe('0px -50%');
});
