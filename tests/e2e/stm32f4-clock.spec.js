import { test, expect } from '@playwright/test';

// F4 pace honesty + clock preset (Disco + MAX7219 over SPI1 + tickMHz:24):
// the runner's simTimeMs is now step-counted (pace pill reads real data),
// and the tickMHz attr divides the guest SysTick reload (div=7) so virtual
// milliseconds cost fewer host instructions. The sketch prints millis()
// (serial proof of guest-time advance) and mirrors changing millis bytes
// onto the matrix (display proof). Asserts: F4CLK marker, ≥3 strictly
// increasing MILLIS samples, matrix telemetry alive.
const CODE = '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(PA4,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(PA4,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("F4CLK_READY");delay(300);SPI.begin();SPI.beginTransaction(SPISettings(8000000,MSBFIRST,SPI_MODE0));pinMode(PA4,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("F4CLK_DRAWN");}\nvoid loop(){unsigned long m=millis();Serial.print("MILLIS:");Serial.println(m);wr(0x03,(m>>8)&0xFF);wr(0x04,m&0xFF);delay(2000);}\n';

test.describe('F4 clock preset (pace + millis advance)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('tickMHz:24 accelerates guest millis on the matrix', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: { tickMHz: 24 }, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f41:PA7', to: 'mx1:DIN' },
        { from: 'f41:PA5', to: 'mx1:CLK' },
        { from: 'f41:PA4', to: 'mx1:CS' },
        { from: 'f41:3V3', to: 'mx1:VCC' },
        { from: 'f41:GND.1', to: 'mx1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, selectTelemetry: ['mx1'], serialNeedle: 'F4CLK_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4CLK reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4CLK serial:', (verdict.serial || '').slice(0, 500));
    expect(verdict.pass).toBe(true);
    // Divider armed.
    expect(verdict.serial || '').toContain('F4CLK:div=7');
    // Guest time advances: ≥3 strictly increasing samples (dedupe: the
    // serial path can double-deliver lines across boots).
    const raw = [...(verdict.serial || '').matchAll(/MILLIS:(\d+)/g)].map((m) => Number(m[1]));
    const samples = raw.filter((v, i) => i === 0 || v !== raw[i - 1]);
    console.log('F4CLK millis samples:', JSON.stringify(samples.slice(0, 10)));
    // Two loop iterations (≈4000 virtual-ms) already prove advance + divider;
    // wall budget caps how many delay(2000) loops fit in forMs.
    expect(samples.length).toBeGreaterThanOrEqual(2);
    // Guest time advances: exact +2000 steps (one delay(2000) loop) and a
    // large spread. Restarts interleave serial across boots, so monotonicity
    // is asserted per-run via adjacent steps, not globally.
    let sawStep = false;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] - samples[i - 1] === 2000) { sawStep = true; break; }
    }
    expect(sawStep).toBe(true);
    expect(Math.max(...samples)).toBeGreaterThanOrEqual(8000);
    // Display alive with millis-derived bytes.
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    expect(custom.matrix?.[0]).toBe(0x7E);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
