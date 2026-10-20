import { test, expect } from '@playwright/test';

// Pico-W DNS via the unified gateway (live): the guest joins the gateway
// room, gets a DHCP lease, then resolves a public name.
//
// Two resolvers exist for a guest in the VN:
//   192.168.4.1:53  the GATEWAY's own resolver (gVisor VN DNS server
//                    bound to GatewayIP, answers through the HOST
//                    resolver). Lives in the guest's own L2 domain.
//   8.8.8.8:53       the public resolver. Reachable from the VN only
//                    because the gVisor UDP forwarder dials it from the
//                    HOST - i.e. it depends on the host's internet path.
//
// The gateway lease used to advertise 8.8.8.8 ONLY (dhcp.go:
// `dnsIP := net.IPv4(8, 8, 8, 8)`), so every lease-based lookup left
// the VN. A guest with a STATIC IP (no lease) had NO resolver at all -
// that was the recorded 2026-10-15 gap (pico-wifi-lan.spec.js:
// hostByName returned 0). Both are fixed by pointing the guest at the
// gateway resolver:
//   - explicit WiFi.setDNS(192.168.4.1)  -> works on ANY gateway
//   - gateway lease carrying 192.168.4.1  -> needs the gateway patch
//     (branch lane/net-dns of openhw-unified-gateway), opt-in below.
//
// The guest also prints the resolver it actually uses (lwIP
// dns_getserver(0)), so the cell proves WHERE the answer came from.
//
// Requires the unified gateway (default ws://127.0.0.1:5030).
// The guest sketch. `useSetDns` decides whether the sketch explicitly
// points lwIP's resolver at the gateway (192.168.4.1) or relies on the
// DNS server advertised in the gateway's DHCP lease.
function sketch(useSetDns) {
  return [
    '#include <WiFi.h>',
    '#include <pico/cyw43_arch.h>',
    '#include <lwip/dns.h>',
    'void setup() {',
    '  Serial1.begin(115200);',
    '  delay(1000);',
    '  Serial1.println("DNS-START");',
    '  WiFi.begin("Pico-emuNet", "testpassword");',
    '  delay(8000);',
    '  Serial1.print("DNS-LINK="); Serial1.println(WiFi.status());',
    '  Serial1.print("DNS-IP="); Serial1.println(WiFi.localIP());',
    '  // Resolver lwIP will actually use (0.0.0.0 = none configured).',
    '  const ip_addr_t* ds = dns_getserver(0);',
    '  IPAddress dnsip(ds);',
    '  Serial1.print("DNS-SERVER="); Serial1.println(dnsip);',
    useSetDns ? '  WiFi.setDNS(IPAddress(192, 168, 4, 1));' : '  // (no setDNS: rely on the DHCP-advertised DNS server)',
    useSetDns ? '  Serial1.print("DNS-SERVER2="); Serial1.println(IPAddress(dns_getserver(0)));' : '',
    '  IPAddress ip;',
    '  int rc = 0;',
    '  for (int i = 0; i < 3 && !rc; i++) {',
    '    rc = WiFi.hostByName("example.com", ip);',
    '    if (!rc) { Serial1.print("DNS-RETRY:"); Serial1.println(i); delay(2000); }',
    '  }',
    '  Serial1.print("DNS-RC="); Serial1.println(rc);',
    '  Serial1.print("DNS-RESOLVED="); Serial1.println(ip);',
    '  Serial1.println("DNS-DONE");',
    '}',
    'void loop() { delay(5000); }',
  ].filter(Boolean).join('\n');
}

const CODE = sketch(true);
const CODE_NO_SETDNS = sketch(false);

test.describe('Pico-W DNS via unified gateway', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  async function resolve(page, code, label) {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'dnsroom1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico-w', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), code);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, serialNeedle: 'DNS-DONE', telemetryMode: 'detail',
    }));
    console.log(`DNS[${label}] verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log(`DNS[${label}] serial:`, (verdict.serial || '').slice(0, 1200));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    expect(serial).toContain('DNS-LINK=3');
    expect(serial).toContain('DNS-DONE');
    // Resolution: non-zero return code AND a real address (not 0.0.0.0,
    // not the 255.255.255.255 "unset" marker hostByName leaves on failure).
    const m = serial.match(/DNS-RC=(-?\d+)/);
    expect(m, 'DNS-RC missing from serial').toBeTruthy();
    expect(Number(m[1]), `DNS-RC=${m[1]} (hostByName failed)`).not.toBe(0);
    const ipm = serial.match(/DNS-RESOLVED=([0-9.]+)/);
    expect(ipm, 'DNS-RESOLVED missing from serial').toBeTruthy();
    const resolved = ipm[1];
    expect(resolved).not.toBe('0.0.0.0');
    expect(resolved).not.toBe('255.255.255.255');
    console.log(`DNS[${label}] resolved example.com ->`, resolved);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
    return resolved;
  }

  test('guest resolves example.com through the gateway resolver', async ({ page }) => {
    await resolve(page, CODE, 'setDNS');
  });

  // DHCP-carried DNS: the guest does NOT call setDNS — it must use the
  // DNS server advertised in the gateway's DHCP lease. Needs the gateway
  // patch that advertises the VN resolver (192.168.4.1), so it is
  // opt-in:
  //   DHCP_DNS=1 npx playwright test .../pico-wifi-dns.spec.js
  test('guest resolves example.com via the DHCP-advertised DNS server', async ({ page }) => {
    test.skip(!process.env.DHCP_DNS, 'needs the gateway patch that advertises 192.168.4.1 as DNS (DHCP_DNS=1)');
    await resolve(page, CODE_NO_SETDNS, 'dhcp');
  });
});
