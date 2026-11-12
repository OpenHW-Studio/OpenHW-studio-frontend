import { test, expect } from '@playwright/test';

// Pico 2 ETH (M33/RP2350) 2-board LAN over W5500 (live): two
// openhw-pico-2-eth boards as Ethernet endpoints in ONE gateway room do a
// TCP client<->server echo. Mirrors the M0+ Pico W LAN cell
// (pico-wifi-lan.spec.js) with the W5500 path.
//
// Board:      openhw-pico-2-eth  ->  boards-registry.ts family 'pico_2_eth'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 -> arch 2/M33),
//             enables the W5500 on SPI (boardSpi attr, 0 default) and pumps
//             raw frames to the gateway (:5030) per tick; engine bytes come
//             from the owner folder (vite alias pico-emu/picoemu.wasm.js).
//             The guest runs the full arduino-pico lwIP stack over the
//             W5500 MACRAW socket (socket 0) - so TCP/IP is the GUEST's,
//             and the gateway VN only bridges L2 between the two boards.
// Attrs:      tickMHz '125' on BOTH boards - REQUIRED (same engine-side
//             quirk as the M0+ ETH cell and the M33 ETH DHCP cell): at the
//             200MHz arch default the guest outruns the wall DHCP timers
//             and begin() never returns. Engine-side quirk, flagged upstream.
// Addressing: static 192.168.4.20 (server) / .21 (client) via
//             eth.config() BEFORE eth.begin() (config() must precede
//             begin(), and a non-zero local IP turns DHCP off) - so the peer
//             IP is known to both ends without a discovery step.
// MAC:        both boards keep the ENGINE's default W5500 MAC (the
//             arduino-pico derives it from the engine's fixed Pico board id
//             -> 4E:55:30:31:02:01), i.e. they share one L2 identity, the
//             same situation as the green M0+ WiFi LAN cell (both Pico W
//             boards carry the CYW43's fixed DE:AD:BE:EF:CA:FE). The
//             boards stay separable at the IP layer (.20 / .21).
//             NOT using an explicit per-board eth.begin(mac): with
//             distinct W5500 SHARs the peer's ARP reply is never delivered
//             (the peer never even emits it - gateway log shows only its
//             own gratuitous ARP), so the client's connect() times out
//             (ECLI-CONN:0) - see the engine-side note in the matrix.
// Waits:      delay(), NOT a busy spin: the arduino-pico lwIP background
//             pump (ARP/timer processing) only runs while the sketch
//             yields. Under a busy spin the client's ARP request is never
//             emitted and connect() can only time out (observed: the
//             client sent ZERO frames to the gateway). The busy spin is
//             only needed on the DHCP path, where the library's own wait
//             loop drives the DORA.
// Room:       NETWORK_ROOM_CODE=netm33ethlan (own gateway room; the shared
//             :5030 gateway serves other lanes).
// Gateway:    both boards are bridged into ONE gVisor VN by the room -> the
//             ARP + TCP frames between the two guest MACs are gateway-side
//             evidence.
//
// NOTE: the loop body uses real newlines - single-line `(){static ...}`
// confuses the arduino prototype generator (extern/static mismatch).
const SERVER_CODE = [
  '#include <W5500lwIP.h>',
  'Wiznet5500lwIP eth(17, SPI);',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("ESRV-START");',
  '  eth.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '  Serial.print("ESRV-IP="); Serial.println(eth.localIP());',
  '  server.begin();',
  '  Serial.println("ESRV-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial.print("ESRV-RX:"); Serial.println(line);',
  '    client.print("ECHO:" + line + "\\n");',
  '    Serial.println("ESRV-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const CLIENT_CODE = [
  '#include <W5500lwIP.h>',
  'Wiznet5500lwIP eth(17, SPI);',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("ECLI-START");',
  '  eth.config(IPAddress(192, 168, 4, 21), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '  Serial.print("ECLI-IP="); Serial.println(eth.localIP());',
  '  WiFiClient client;',
  '  int conn = 0;',
  '  for (int i = 0; i < 20 && !conn; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41000)) conn = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial.print("ECLI-CONN:"); Serial.println(conn);',
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial.print("ECLI-RX:"); Serial.println(reply);',
  '    if (reply == "ECHO:HELLO-LAN") Serial.println("ECLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico 2 ETH (M33) LAN (2-board W5500 TCP via gateway)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('W5500 TCP echo in one gateway room', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 gateway serves other lanes).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netm33ethlan');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p2e_srv', type: 'openhw-pico-2-eth', attrs: { tickMHz: '125' }, x: 100, y: 100 },
        { id: 'p2e_cli', type: 'openhw-pico-2-eth', attrs: { tickMHz: '125' }, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), SERVER_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { p2e_cli: code },
    }), CLIENT_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'ECLI-LAN-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2ETHLAN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('P2ETHLAN serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    // Guest markers: both W5500 stacks came up on their static addresses
    // and the echo crossed the room.
    expect(verdict.serial || '').toContain('ETH-BEGIN-OK');
    expect(verdict.serial || '').toContain('ESRV-IP=192.168.4.20');
    expect(verdict.serial || '').toContain('ECLI-IP=192.168.4.21');
    expect(verdict.serial || '').toContain('ESRV-ECHOED');
    expect(verdict.serial || '').toContain('ECLI-RX:ECHO:HELLO-LAN');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
