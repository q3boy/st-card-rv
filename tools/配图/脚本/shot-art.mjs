// 按房车状态截图：node shot-art.mjs <drive|park|expand>  输出到 ./screenshots/
import { chromium } from '@playwright/test';
const st = process.argv[2] ?? 'expand';
const ids = ['overview-dawn', 'overview-day', 'overview-dusk', 'overview-night', 'overview-dark', 'n-overview-dawn', 'n-overview-dark'];
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1060, height: 1000 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(`http://localhost:5199/?rvstate=${st}`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
for (const id of ids) {
  await page.locator(`[data-shot="${id}"]`).screenshot({ path: `./screenshots/${st}-${id}.png` });
  console.log(st, id);
}
await b.close();
