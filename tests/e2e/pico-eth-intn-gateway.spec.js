import { test, expect } from '@playwright/test';

// W5500 INTn interrupt path (openhw-pico-eth / openhw-pico-2-eth).
//
// The arduino-pico lwIP driver behaves in TWO different ways depending on
// the constructor's IRQ pin (LwipIntfDev::begin(), core 6.0.0):
//
//   eth(17, SPI)      -> intr = -1 : the driver registers a POLLED packet
//                        handler (__addEthernetPacketHandler) and RX is
//                        delivered by the lwIP timeout pump.
//   eth(17, SPI, 21)  -> intr = 21 : NO polled packet handler is
//                        registered at all; instead the driver arms a
//                        LEVEL-LOW GPIO interrupt on the W5500 INTn pin
//                        (attachInterruptParam(pin, _irq, LOW)) and RX is
//                        delivered ONLY through that interrupt
//                        (_irq -> lwip_callback -> handlePackets).
//
// So a DHCP lease in the IRQ configuration PROVES the INTn interrupt
// delivered the OFFER/ACK - there is no polled fallback to borrow.
//
// Guest-side evidence printed by the sketch (independent of the DHCP):
//   IRQ-COUNT=<n>     : IO_IRQ_BANK0 deliveries seen by the guest
//                       (our own shared NVIC handler on the same line the
//                       SDK uses for GPIO interrupts; it chains behind the
//                       SDK dispatcher and counts every delivery).
//   IRQ-INTN-LOW=<n>  : of those deliveries, how many saw INTn (GPIO21)
//                       still LOW (active-low, frame pending). Usually 0:
//                       the SDK handler drains the frame inside the same
//                       IRQ, so the line is already released by the time a
//                       later chain handler runs. Informational only.
//   IRQ-ARMED-PIN21=<0|1> : is GPIO21's LEVEL_LOW bit armed in PROC0_INTE?
//                       1 => the library armed the INTn interrupt,
//                       0 => the interrupt path was never armed (polled).
//   IRQ-ARMED-ANY=<m> : the OR of every PROC0_INTE register. In the IRQ
//                       cell only GPIO21_LEVEL_LOW is armed (1<<20), so
//                       EVERY IO_IRQ_BANK0 delivery came from INTn.
const CODE_IRQ = [
  '#include <W5500lwIP.h>',
  '#include <hardware/irq.h>',
  '#include <hardware/gpio.h>',
  '// W5500-EVB-Pico carrier: CSn=17, INTn=21 (RSTn=20 is engine-side).',
  'Wiznet5500lwIP eth(17, SPI, 21);',
  '// PROC0 interrupt-enable bits (SDK io_bank0_hw_t: irq_ctrl[0] = proc0,',
  '// 4 bits per pin: [edge_hi, edge_lo, level_hi, level_lo]).',
  'static uint32_t inteLevelLow(uint32_t pin) {',
  '  return io_bank0_hw->irq_ctrl[0].inte[pin / 8] & (1u << (4 * (pin % 8)));',
  '}',
  'static uint32_t inteAll() {',
  '  uint32_t m = 0;',
  '  for (uint i = 0; i < 4; i++) m |= io_bank0_hw->irq_ctrl[0].inte[i];',
  '  return m;',
  '}',
  'static volatile uint32_t g_irqCount = 0;',
  'static volatile uint32_t g_irqIntnLow = 0;',
  'static void extraGpioBank0Irq() {',
  '  g_irqCount++;',
  '  if (gpio_get(21) == 0) g_irqIntnLow++;',
  '}',
  'static unsigned long spin_until(unsigned long ms) {',
  '  unsigned long t0 = millis();',
  '  while (millis() - t0 < ms) { }',
  '  return millis();',
  '}',
  'void setup() {',
  '  Serial.begin(115200);',
  '  // Shared NVIC handler on the same IO_IRQ_BANK0 line the SDK uses for',
  '  // GPIO interrupts. Registered with the SDK default order priority so',
  '  // it chains behind the SDK dispatcher (a higher order priority makes',
  '  // this slot the chain head, which the SDK chain fixup then breaks -',
  '  // the guest then never acks the GPIO flag and spins in the IRQ).',
  '  irq_add_shared_handler(IO_IRQ_BANK0, extraGpioBank0Irq, GPIO_IRQ_CALLBACK_ORDER_PRIORITY);',
  '  spin_until(1000);',
  '  Serial.println("W5500IRQ-START");',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '}',
  'static bool reported = false;',
  'void loop() {',
  '  if (!reported && eth.connected()) {',
  '    reported = true;',
  '    Serial.print("W5500-IP=");',
  '    Serial.println(eth.localIP());',
  '    Serial.print("IRQ-COUNT="); Serial.println(g_irqCount);',
  '    Serial.print("IRQ-INTN-LOW="); Serial.println(g_irqIntnLow);',
  '    Serial.print("IRQ-ARMED-PIN21="); Serial.println(inteLevelLow(21) ? 1 : 0);',
  '    Serial.print("IRQ-ARMED-ANY="); Serial.println(inteAll());',
  '    Serial.println("W5500IRQ-DONE");',
  '  }',
  '  spin_until(500);',
  '}',
].join('\n');

// Control: same sketch, polled configuration (no IRQ pin). The library
// never arms GPIO21, so the guest must see zero interrupt deliveries -
// that is the difference the IRQ cell proves.
const CODE_POLLED = [
  '#include <W5500lwIP.h>',
  '#include <hardware/irq.h>',
  '#include <hardware/gpio.h>',
  '// Polled control: no IRQ pin -> the driver registers the polled',
  '// packet handler and never arms the INTn interrupt.',
  'Wiznet5500lwIP eth(17, SPI);',
  '// PROC0 interrupt-enable bits (SDK io_bank0_hw_t: irq_ctrl[0] = proc0,',
  '// 4 bits per pin: [edge_hi, edge_lo, level_hi, level_lo]).',
  'static uint32_t inteLevelLow(uint32_t pin) {',
  '  return io_bank0_hw->irq_ctrl[0].inte[pin / 8] & (1u << (4 * (pin % 8)));',
  '}',
  'static uint32_t inteAll() {',
  '  uint32_t m = 0;',
  '  for (uint i = 0; i < 4; i++) m |= io_bank0_hw->irq_ctrl[0].inte[i];',
  '  return m;',
  '}',
  'static volatile uint32_t g_irqCount = 0;',
  'static volatile uint32_t g_irqIntnLow = 0;',
  'static void extraGpioBank0Irq() {',
  '  g_irqCount++;',
  '  if (gpio_get(21) == 0) g_irqIntnLow++;',
  '}',
  'static unsigned long spin_until(unsigned long ms) {',
  '  unsigned long t0 = millis();',
  '  while (millis() - t0 < ms) { }',
  '  return millis();',
  '}',
  'void setup() {',
  '  Serial.begin(115200);',
  '  // Shared NVIC handler on the same IO_IRQ_BANK0 line the SDK uses for',
  '  // GPIO interrupts. Registered with the SDK default order priority so',
  '  // it chains behind the SDK dispatcher (a higher order priority makes',
  '  // this slot the chain head, which the SDK chain fixup then breaks -',
  '  // the guest then never acks the GPIO flag and spins in the IRQ).',
  '  irq_add_shared_handler(IO_IRQ_BANK0, extraGpioBank0Irq, GPIO_IRQ_CALLBACK_ORDER_PRIORITY);',
  '  spin_until(1000);',
  '  Serial.println("W5500POLL-START");',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '}',
  'static bool reported = false;',
  'void loop() {',
  '  if (!reported && eth.connected()) {',
  '    reported = true;',
  '    Serial.print("W5500-IP=");',
  '    Serial.println(eth.localIP());',
  '    Serial.print("IRQ-COUNT="); Serial.println(g_irqCount);',
  '    Serial.print("IRQ-INTN-LOW="); Serial.println(g_irqIntnLow);',
  '    Serial.print("IRQ-ARMED-PIN21="); Serial.println(inteLevelLow(21) ? 1 : 0);',
  '    Serial.print("IRQ-ARMED-ANY="); Serial.println(inteAll());',
  '    Serial.println("W5500POLL-DONE");',
  '  }',
  '  spin_until(500);',
  '}',
].join('\n');

test.describe('Pico-ETH W5500 INTn interrupt path', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('W5500 INTn(GPIO21) IRQ: DHCP OFFER/ACK delivered by the interrupt', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'w6300room1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'ethirq1', type: 'openhw-pico-eth', attrs: { tickMHz: '125' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE_IRQ);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, serialNeedle: 'W5500IRQ-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('INTN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('INTN serial:', (verdict.serial || '').slice(0, 2000));
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    // RX really arrived: the lease came from the gateway's DHCP server.
    expect(serial).toContain('ETH-BEGIN-OK');
    expect(serial).toContain('W5500-IP=192.168.4.');
    // The guest armed the INTn level-low interrupt on GPIO21 ...
    expect(serial).toContain('IRQ-ARMED-PIN21=1');
    // ... and nothing else in PROC0_INTE is armed (1<<20 = GPIO21
    // LEVEL_LOW), so every IO_IRQ_BANK0 delivery came from INTn.
    expect(serial).toContain('IRQ-ARMED-ANY=1048576');
    // ... and the guest's IO_IRQ_BANK0 line really fired with INTn low.
    expect(serial).toMatch(/IRQ-COUNT=[1-9]/);
    // NOTE: IRQ-INTN-LOW is informational only - the SDK's own handler
    // drains the frame inside the same IRQ, so a handler that runs later
    // in the chain already sees INTn released. The attribution comes from
    // IRQ-ARMED-ANY (only GPIO21_LEVEL_LOW is armed) instead.
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('W5500 polled control: no INTn interrupt is armed', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'w6300room1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'ethpoll1', type: 'openhw-pico-eth', attrs: { tickMHz: '125' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE_POLLED);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, serialNeedle: 'W5500POLL-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('POLL verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('POLL serial:', (verdict.serial || '').slice(0, 2000));
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    // Same DHCP outcome through the polled path ...
    expect(serial).toContain('ETH-BEGIN-OK');
    expect(serial).toContain('W5500-IP=192.168.4.');
    // ... but the interrupt path was never armed and never fired.
    expect(serial).toContain('IRQ-ARMED-PIN21=0');
    expect(serial).toContain('IRQ-ARMED-ANY=0');
    expect(serial).toContain('IRQ-COUNT=0');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
