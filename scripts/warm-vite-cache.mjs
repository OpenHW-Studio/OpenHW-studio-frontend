// Warm the lane's vite dep-optimizer cache: load /simulator repeatedly
// until vite stops discovering new deps (each discovery triggers a full
// page reload, which would kill any in-flight e2e cell).
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://127.0.0.1:5183/simulator';
const rounds = Number(process.argv[3] || 4);

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
for (let i = 0; i < rounds; i++) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
  } catch (e) {
    console.log(`warm round ${i}: ${String(e?.message || e).slice(0, 120)}`);
  }
  await ctx.close();
  console.log(`warm round ${i} done`);
}
await browser.close();
console.log('warmup complete');
