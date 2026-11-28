// Warm-up: boot the simulator page AND a real circuit repeatedly until the
// dependency optimizer is quiet. Vite discovers lazy worker chunks (the
// component registry pulls avr8js / 8086emu / the wasm glue) only when they
// are first imported; each discovery triggers "optimized dependencies
// changed. reloading" which kills a running cell with "execution context
// was destroyed". This script drives that discovery to completion BEFORE
// any real cell runs.
//
// Loop: attempt the boot; if the page navigated (context destroyed), wait
// for the reload and try again. Stop after N consecutive clean boots.
import { chromium } from '@playwright/test';

const url = process.env.WARM_URL || 'http://localhost:5174/simulator';
const CODE = 'void setup(){Serial.begin(9600);Serial.println("WARM");}\nvoid loop(){delay(500);}';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/optimiz|reload/i.test(t)) console.log('CONSOLE:', t.slice(0, 160));
});
await page.addInitScript(() => { window.localStorage.setItem('openhw-tour-completed', 'true'); });

let clean = 0;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const hasApi = await page.evaluate(() => !!window.OpenHWE2E);
    if (!hasApi) { console.log(`attempt ${attempt}: no OpenHWE2E`); continue; }
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), CODE);
    if (!setup || !setup.ok) { console.log(`attempt ${attempt}: setup failed`); continue; }
    const v = await page.evaluate(() => window.OpenHWE2E.run({ forMs: 5000, serialNeedle: 'WARM' }));
    console.log(`attempt ${attempt}: run pass=${v && v.pass} serial=${JSON.stringify((v && v.serial || '').slice(0, 60))}`);
    await page.evaluate(() => window.OpenHWE2E.stop());
    clean += 1;
    if (clean >= 2) { console.log('WARM: optimizer quiet'); break; }
  } catch (e) {
    clean = 0;
    console.log(`attempt ${attempt}: ${String(e && e.message || e).slice(0, 120)}`);
  }
  await page.waitForTimeout(6000);
}
await browser.close();
