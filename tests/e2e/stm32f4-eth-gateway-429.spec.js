import { test, expect } from '@playwright/test';

// F4 Ethernet via unified gateway (live, F429): sibling port of the F407
// DORA cell (stm32f4-eth-gateway.spec.js) — the owner's eth_dhcp_f429.bin
// (mirrored to public/firmware/f4 per repo convention; F429 needs its own
// build on the Keil SVD map — see engine NETWORKING.md §3) does bare-metal
// DORA through the on-chip MAC; the runner taps TX at create-time onTx,
// pumps frames to the gateway (:5030), and injects RX via ethInject with
// the link driven up at boot.
// Requires the net runner path (startF4NetLink/pumpF4NetLink/stopF4NetLink
// + irq_eth opt-in) and the gateway. STAGED: do not run until signaled.
// CODE is a placeholder sketch: the firmware attr bypasses Arduino compile.
const CODE = 'void setup() {}\nvoid loop() {}\n';

test.describe('F4 Ethernet gateway (F429)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('F429 DORA via gateway', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      // ethIrq=on: this IRQ-driven firmware needs IRQ61 delivery (its
      // ETH_IRQHandler owns the RX flags; polling needs it off).
      components: [
        { id: 'f429', type: 'openhw-stm32f429', attrs: { firmware: '/firmware/f4/eth_dhcp_f429.bin', ethIrq: 'on' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    // Long window: F4 runs below wall speed; DORA needs minutes.
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 480000, serialNeedle: '=== DHCP SUCCESS ===', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4ETH-429 verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4ETH-429 serial:', (verdict.serial || '').slice(0, 600));
    expect(verdict.pass).toBe(true);
    // Owner firmware zero-pads octets (192.168.004.005); pool advances
    // across runs/boards, so match the padded prefix, not a fixed IP.
    expect(verdict.serial || '').toContain('DHCP Offer: IP=192.168.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
