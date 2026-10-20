import { test, expect } from '@playwright/test';

// Pico-2-W RV32 IPv6 via unified gateway (live): the owner's ping6 guest
// (mirrored to public/firmware per repo convention) does RS → RA (SLAAC)
// → NS/NA → ICMPv6 echo through the gateway's NDP/NAT64 stack and prints
// RA-OK + ECHO-REPLY. Runner wifi path is board-type based (arch-agnostic).
// Requires the gateway.
const CODE = 'void setup(){}\nvoid loop(){}\n';

test.describe('Pico-2-W RV32 IPv6 ping6 via gateway', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SLAAC + ICMPv6 echo via gateway', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p21', type: 'openhw-pico-2-w', attrs: { arch: 'rv32', firmware: '/firmware/wifi_ping6_rv32.uf2' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      // Needle is RA-OK (SLAAC addressing live). ECHO-REPLY needs a peer
      // at the guest's hardcoded target (fd00:4::64 in the owner rig);
      // the gateway answers NS only for its own addresses, so echo is
      // printed-but-unasserted here — see matrix IPv6 row.
      forMs: 300000, serialNeedle: 'RV32 PING6 RA-OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PING6 verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PING6 serial:', (verdict.serial || '').slice(0, 600));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('RV32 Ping6 Test Starting');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
