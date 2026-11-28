import { test, expect } from '@playwright/test';

// Pico 2 RV32 (RP2350 Hazard3 / RISC-V) with REAL Arduino firmware.
//
// The matrix used to say "PARTIAL (fixed image only; Arduino RV32 blocked
// upstream)". That blocker is gone: the arduino-pico 6.0.0 core ships the
// RISC-V arch menu for rpipico2 (`arch=riscv`, toolchain pqt-gcc-riscv),
// the backend compiles it (HTTP 200 + UF2), and the engine boots the UF2
// on the RV32 arch (UF2 family 0xe48bff5a -> PICO_ARCH_RV32).
//
// What this cell proves:
//   * UART  — the guest's own bytes over UART0 reach the host.
//   * ADC   — two pots (50% on GP26 / 10% of full scale on GP27) are injected into the
//     engine ADC; the guest's analogRead pair must keep the 5:1 ratio.
//     The RATIO is asserted, not the absolute code: the RV32 ADC path
//     returns the injected 12-bit code shifted right by 2 (2048 -> 512),
//     so an absolute assertion would encode that divergence.
//
// NOT proven here (engine-side, see HANDOVER-LANE-pico-cov2.md):
//   * GPIO-out — digitalWrite(15,HIGH) leaves the engine's OUT latch at 0
//     (OE lands, the OUT write does not) -> no LED/ISR evidence.
//   * PWM — analogWrite() crashes the guest (PC jumps into SRAM 0x20000686).

const CODE = 'void setup(){Serial1.begin(115200);Serial1.println("RV32_UART:OK");}\n'
  + 'void loop(){int a=analogRead(26);int b=analogRead(27);Serial1.print("RV32_ADC:");Serial1.print(a);Serial1.print(":");Serial1.println(b);delay(500);}\n';

test.describe('Pico 2 RV32 (Arduino RISC-V firmware)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('RV32 Arduino sketch prints over UART and reads both ADC pots', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p21', type: 'openhw-pico-2', attrs: { arch: 'rv32' }, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: { value: 50 }, x: 450, y: 120 },
        { id: 'pot2', type: 'openhw-potentiometer', attrs: { value: 90 }, x: 450, y: 240 },
      ],
      wires: [
        { from: 'p21:GP26', to: 'pot1:SIG' },
        { from: 'p21:3V3', to: 'pot1:1' },
        { from: 'p21:GND', to: 'pot1:2' },
        { from: 'p21:GP27', to: 'pot2:SIG' },
        { from: 'p21:3V3', to: 'pot2:1' },
        { from: 'p21:GND', to: 'pot2:2' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'RV32_UART:OK', telemetryMode: 'detail',
    }));
    console.log('RV32 reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('RV32 serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);

    // UART: the guest's own bytes reached the host.
    expect(verdict.serial || '').toContain('RV32_UART:OK');

    // ADC: both pots are read; the ratio tracks the injected voltages
    // (50% vs 10% -> 5:1). The absolute code is NOT asserted (the RV32
    // ADC path returns the 12-bit code >> 2).
    const pairs = [...(verdict.serial || '').matchAll(/RV32_ADC:(\d+):(\d+)/g)]
      .map((m) => [Number(m[1]), Number(m[2])]);
    console.log('RV32 adc pairs:', JSON.stringify(pairs.slice(0, 8)));
    expect(pairs.length).toBeGreaterThan(0);
    const [a, b] = pairs[pairs.length - 1];
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a / b).toBeGreaterThan(3.5);
    expect(a / b).toBeLessThan(6.5);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
