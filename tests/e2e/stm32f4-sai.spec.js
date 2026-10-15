import { test, expect } from '@playwright/test';

// F4 SAI audio-bus loopback (F429) — narrow claim by design: the SAI model
// is a register stub on the shared PCM bus (no frame/slot/clock logic),
// so this cell proves the DATA PATH only: guest SAI_A_DR writes land in
// the model capture FIFO where the runner drains them. A real Arduino
// sketch writes a 1000..1015 ramp and prints its readback sum; the runner
// independently drains takeSpeakerSamples and reports the FIFO sum. The
// FIFO cannot be faked by guest serial, so matching sums are the proof.
const CODE = '#define SAI_BASE 0x40015800UL\n#define SAI_GCR (*(volatile uint32_t*)(SAI_BASE + 0x00))\n#define SAI_A_SR (*(volatile uint32_t*)(SAI_BASE + 0x18))\n#define SAI_A_DR (*(volatile uint32_t*)(SAI_BASE + 0x20))\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("SAI_READY");\n  SAI_GCR = 7;\n}\nvoid loop() {\n  unsigned long sum = 0;\n  for (int i = 0; i < 16; i++) {\n    SAI_A_DR = (unsigned long)(1000 + i);\n    sum += SAI_A_DR;\n  }\n  Serial.print("SAI_SUM:"); Serial.println(sum);\n  if (sum == 16120UL) Serial.println("SAI_TX_OK");\n  delay(3000);\n}\n';

test.describe('F4 SAI (audio-bus loopback)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest ramp lands in the capture FIFO', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, serialNeedle: 'SAI_TX_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('SAI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('SAI serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SAI_SUM:16120');
    // Runner-side FIFO proof: exact same 16 samples, host-observed.
    expect(verdict.serial || '').toContain('SAI_CAP:16:16120');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
