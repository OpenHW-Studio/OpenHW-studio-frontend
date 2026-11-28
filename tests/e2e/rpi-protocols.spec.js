import { test, expect } from '@playwright/test';

/**
 * Raspberry Pi 3 B+ / 4 B / 5 — expanded peripheral cells.
 *
 * Every cell below is an observation OUTSIDE the Python guest:
 *   ADC      potentiometer wiper voltage → bridge.adc_set() → guest MCP3008
 *            readback changes after the host component value changes.
 *   UART     guest UART write → host USB-terminal model (rxCount/lastEcho);
 *            host SERIAL_INPUT → guest UART.read()/readline() exact bytes.
 *   1-Wire   host DS18B20 temperature → JS 1-Wire model → w1_gpio.read_temp().
 *   DHT22    host humidity/temperature → JS DHT waveform → Adafruit_DHT.read().
 *   NeoPixel guest pixel frame → host WS2812 framebuffer (onNeoPixelFrame).
 *   Servo    guest PWM frequency/duty → host servo pulse width → angle.
 *
 * The sketch defines rpi_poll(), which the runner calls every tick so these
 * host-side changes (delivered after boot via INTERACT / SERIAL_INPUT) are
 * observed with real guest read APIs. No cell is skipped except the camera
 * cell, whose precise reason is also recorded in boards-registry limits.
 */
const BOARDS = [
  { type: 'openhw-pi3', viH: '2', pull: 1800, bits: 10 },
  { type: 'openhw-pi4', viH: '2', pull: 1800, bits: 10 },
  // BCM2712/RP1: 2.1 V threshold, 50 kΩ pulls and a 12-bit ADC profile.
  { type: 'openhw-pi5', viH: '2.1', pull: 50000, bits: 12 },
];

function sketch() {
  return `
from rpi_sim import board, _bridge, onewire, uart as uartmod
from gpiozero import MCP3008
import w1_gpio, Adafruit_DHT
from Adafruit_NeoPixel import Adafruit_NeoPixel
import RPi.GPIO as GPIO

GPIO.setmode(GPIO.BCM)
adc = MCP3008(channel=5)
U = uartmod.UART()
initialAdc = adc.read()
print('RPI_ADC0:' + str(initialAdc))
el = _bridge.snapshot()['electrical']
print('RPI_ELEC:' + str(el['viH']) + ':' + str(el['pullUpOhms']))
U.write('HI-PI')
print('RPI_UART_TX_OK')
onewire.set_temperature(4, 22.5)
print('RPI_OW0:' + str(w1_gpio.read_temp(4)))
h0, t0 = Adafruit_DHT.read(22, 27)
print('RPI_DHT0:' + str(h0) + ':' + str(t0))
strip = Adafruit_NeoPixel(4, 12)
strip.fill(0xFF0000)
strip.show()
print('RPI_NEO_OK')
p = GPIO.PWM(19, 50)
p.start(7.5)  # 1500 us -> ~90 degrees on the host servo model
print('RPI_SERVO_PWM:7.5')
print('RPI_DONE')

seen = set()
def once(tag, text):
    if tag not in seen:
        seen.add(tag)
        print(text)

def rpi_poll():
    d = U.read(16)
    if d:
        once('uart', 'RPI_UART_RX:' + d)
    t = w1_gpio.read_temp(4)
    if abs(t - 22.5) > 0.1:
        once('ow', 'RPI_OW1:' + str(t))
    h, tc = Adafruit_DHT.read(22, 27)
    if abs(tc - t0) > 0.1:
        once('dht', 'RPI_DHT1:' + str(h) + ':' + str(tc))
    v = adc.read()
    if v != initialAdc:
        once('adc', 'RPI_ADC1:' + str(v))
`.trim() + '\n';
}

function components(type) {
  return [
    { id: 'pi1', type, attrs: { env: 'micropython' }, x: 60, y: 60 },
    { id: 'pot1', type: 'openhw-potentiometer', attrs: { value: 50 }, x: 400, y: 60 },
    { id: 'usb1', type: 'openhw-usb-device', attrs: {}, x: 400, y: 140 },
    { id: 'ds1', type: 'openhw-ds18b20', attrs: { temperature: 22.5 }, x: 400, y: 220 },
    { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 400, y: 300 },
    { id: 'neo1', type: 'openhw-neopixel-matrix', attrs: {}, x: 400, y: 380 },
    { id: 'servo1', type: 'openhw-servo', attrs: {}, x: 400, y: 440 },
  ];
}

const WIRES = [
  // Potentiometer: pin 1 = VCC rail, pin 2 = GND, SIG = wiper (ADC5).
  { from: 'pi1:3V3', to: 'pot1:1' },
  { from: 'pi1:GND.1', to: 'pot1:2' },
  { from: 'pot1:SIG', to: 'pi1:5' },
  { from: 'pi1:3V3', to: 'ds1:VCC' },
  { from: 'pi1:GND.1', to: 'ds1:GND' },
  { from: 'ds1:DQ', to: 'pi1:4' },
  { from: 'pi1:3V3', to: 'dht1:VCC' },
  { from: 'pi1:GND.1', to: 'dht1:GND' },
  { from: 'dht1:DATA', to: 'pi1:27' },
  { from: 'pi1:3V3', to: 'neo1:VCC' },
  { from: 'pi1:GND.1', to: 'neo1:GND' },
  { from: 'neo1:DIN', to: 'pi1:12' },
  { from: 'pi1:5V', to: 'servo1:V+' },
  { from: 'pi1:GND.1', to: 'servo1:GND' },
  { from: 'servo1:PWM', to: 'pi1:19' },
];

const EVENTS = [
  { compId: 'pot1', event: { type: 'input', value: 80 }, afterMs: 1500 },
  { compId: 'ds1', event: { type: 'temperature-change', value: 37.5 }, afterMs: 2200 },
  { compId: 'dht1', event: { type: 'temperature', value: 31.5 }, afterMs: 2900 },
  { compId: 'dht1', event: { type: 'humidity', value: 66 }, afterMs: 3000 },
];

async function runBoard(page, b) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/compile')) return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  page.on('pageerror', (err) => console.log(`${b.type} PAGEERROR:`, String(err).slice(0, 300)));
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const setup = await page.evaluate(({ type, py, comps, wires }) => window.OpenHWE2E.setupCircuit({
    components: comps, wires, code: py,
  }), { type: b.type, py: sketch(), comps: components(b.type), wires: WIRES });
  expect(setup.ok).toBe(true);

  const runP = page.evaluate((events) => window.OpenHWE2E.run({
    forMs: 14000,
    selectTelemetry: ['pot1', 'usb1', 'ds1', 'dht1', 'neo1', 'servo1'],
    serialNeedle: 'RPI_UART_RX:AB',
    telemetryMode: 'detail',
    events,
  }), EVENTS);
  // Host → guest serial after boot: the guest poll hook reads it with
  // UART.read() and prints the exact bytes.
  await page.waitForTimeout(9000);
  const injected = await page.evaluate(() => window.OpenHWE2E.serialInput('AB\n', 'pi1'));
  expect(injected.ok).toBe(true);
  const verdict = await runP;
  await page.evaluate(() => window.OpenHWE2E.stop());
  return verdict;
}

function telemetryOf(verdict, id) {
  return (verdict.telemetry || []).find((t) => t.id === id);
}

test.describe('Raspberry Pi peripheral translators', () => {
  test.setTimeout(240000);

  for (const b of BOARDS) {
    test(`${b.type}: ADC / UART / 1-Wire / DHT / NeoPixel / Servo cells`, async ({ page }) => {
      const verdict = await runBoard(page, b);
      console.log(`${b.type} reasons:`, JSON.stringify(verdict.reasons || []));
      console.log(`${b.type} serial:`, JSON.stringify(String(verdict.serial || '').slice(0, 700)));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      const serial = String(verdict.serial || '');
      for (const marker of [
        'RPI_ADC0:', 'RPI_UART_TX_OK', 'RPI_OW0:22.5', 'RPI_DHT0:50.0:23.5',
        'RPI_NEO_OK', 'RPI_SERVO_PWM:7.5', 'RPI_DONE', 'RPI_UART_RX:AB',
        'RPI_OW1:37.5', 'RPI_DHT1:66.0:31.5', 'RPI_ADC1:205',
      ]) {
        expect(serial, `missing ${marker}`).toContain(marker);
      }
      // Per-board ADC/electrical behaviour: Pi 3/4 ViH 2.0 V, 1.8 kΩ pull,
      // 10-bit model; RP1 Pi 5 ViH 2.1 V, 50 kΩ pull, 12-bit model.
      expect(serial).toContain(`RPI_ELEC:${b.viH}:${b.pull}`);

      // ADC: host potentiometer changed from 50% to 80%; the guest read
      // changed from its boot value to 205 (0.66 V on the 3.3 V rail).
      const pot = telemetryOf(verdict, 'pot1');
      expect(pot).toBeTruthy();
      expect(Number(pot.details?.state?.value)).toBe(80);
      // The runner publishes per-board conversion facts once, on the first
      // full-state analogue endpoint (the DHT component here).
      const dhtForMeta = telemetryOf(verdict, 'dht1');
      const meta = dhtForMeta?.details?.state?.rpiAdc;
      expect(meta).toBeTruthy();
      expect(meta.board).toBe(b.type === 'openhw-pi3' ? 'pi3' : b.type === 'openhw-pi4' ? 'pi4' : 'pi5');
      expect(meta.bits).toBe(b.bits);
      expect(Number(meta.viH)).toBe(Number(b.viH));
      expect(Number(meta.pullUpOhms)).toBe(b.pull);
      expect(Number(meta.channels?.['5']?.raw)).toBe(205);

      // UART: guest bytes reached the host terminal; host bytes were read
      // back by the guest with exact content and length.
      const usb = telemetryOf(verdict, 'usb1');
      expect(usb).toBeTruthy();
      expect(usb.details?.state?.enumState).toBe('enumerated');
      expect(Number(usb.details?.state?.rxCount)).toBe(5);
      expect(usb.details?.state?.lastEcho).toBe('HI-PI');

      // 1-Wire: host DS18B20 changed, guest w1_gpio saw the new value.
      const ds = telemetryOf(verdict, 'ds1');
      expect(ds).toBeTruthy();
      expect(Number(ds.details?.state?.temperature)).toBe(37.5);

      // DHT22: host temp/humidity changed, guest Adafruit_DHT saw them.
      const dht = telemetryOf(verdict, 'dht1');
      expect(dht).toBeTruthy();
      expect(Number(dht.details?.state?.temperature)).toBe(31.5);
      expect(Number(dht.details?.state?.humidity)).toBe(66);

      // NeoPixel: guest frame is in the host WS2812 framebuffer.
      const neo = telemetryOf(verdict, 'neo1');
      expect(neo).toBeTruthy();
      expect((neo.details?.state?.pixels || []).some((p) => Number(p) === 0xff0000)).toBe(true);

      // PWM servo: 50 Hz / 7.5 % → 1500 µs → ~93° on the host model.
      const servo = telemetryOf(verdict, 'servo1');
      expect(servo).toBeTruthy();
      const angle = Number(servo.details?.state?.angle);
      console.log(`${b.type} servo angle:`, angle);
      expect(angle).toBeGreaterThan(90);
      expect(angle).toBeLessThan(95);
    });

    test.skip(`${b.type}: picamera2 capture (no host camera model)`, () => {
      // boards-registry limit `camera-no-host-component`: the picamera2 shim
      // returns a deterministic in-memory test pattern and updates the
      // engine's camera state, but the studio has no wired host camera
      // component whose reaction a cell could assert. Not claimed.
    });
  }
});
