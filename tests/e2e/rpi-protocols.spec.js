import { test, expect } from '@playwright/test';

/**
 * Raspberry Pi 3 B+ / 4 B / 5 — timed peripheral drivers.
 *
 * Every cell asserts an observation OUTSIDE the Python guest:
 *   ADC      host potentiometer voltage settles through the MNA sample/hold
 *            node; guest MCP3008 runs a real N-bit SAR and consumes virtual
 *            clock (acquisition + one period per comparison).
 *   UART     9600 8N1 framed TX/RX: exact bytes reach the host terminal,
 *            host SERIAL_INPUT bytes are read by the guest, bit-time clock
 *            advancement and a 16-byte FIFO overrun are asserted.
 *   1-Wire   guest drives reset/write/read slots as real GPIO edges; the
 *            host DS18B20 supplies presence + scratchpad bits at exact
 *            virtual microseconds; guest decodes the waveform.
 *   DHT22    guest drives an 18 ms start pulse; host supplies 80 us response
 *            and 26/70 us data bits; guest decodes the measured edge log.
 *   Camera   host `openhw-camera-module` supplies the frame that
 *            picamera2.capture_array()/capture_file() return (no internal
 *            test pattern), asserted by host checksum AND guest pixels.
 *
 * NeoPixel / servo / LED / I2C / SPI cells remain in rpi-boards.spec.js and
 * this spec; no cell is skipped. There is no Linux/ARM machine emulation.
 */
const BOARDS = [
  { type: 'openhw-pi3', viH: '2', pull: 1800, bits: 10, adcUs: 11 },
  { type: 'openhw-pi4', viH: '2', pull: 1800, bits: 10, adcUs: 11 },
  { type: 'openhw-pi5', viH: '2.1', pull: 50000, bits: 12, adcUs: 7 },
];
const FRAME = [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0];

function sketch() {
  return `
from gpiozero import MCP3008
from rpi_sim import uart as uartmod, _bridge
from picamera2 import Picamera2
import w1_gpio, Adafruit_DHT

adc = MCP3008(channel=5)
U = uartmod.UART()
cfg = U.configure(baudrate=9600, fifo_depth=16)
print('RPI_UART_CFG:' + str(cfg['baud']) + ':' + str(round(cfg['bitTimeUs'], 4)) + ':' + str(cfg['fifoDepth']))
t0 = _bridge.clock_us()
v0 = adc.read()
t1 = _bridge.clock_us()
print('RPI_ADC0:' + str(v0) + ':US:' + str(round(t1 - t0)) + ':CUS:' + str(adc.conversion_us) + ':V:' + str(adc.sample_hold_v))
t0 = _bridge.clock_us()
U.write('HI-PI')
t1 = _bridge.clock_us()
print('RPI_UART_TX_US:' + str(round(t1 - t0)) + ':ECHO:' + U.tx)
el = _bridge.snapshot()['electrical']
print('RPI_ELEC:' + str(el['viH']) + ':' + str(el['pullUpOhms']))
ow0 = w1_gpio.read_temp_timed(4)
print('RPI_OW0:' + str(ow0['temperature']) + ':RST:' + str(ow0['resetLowUs']) + ':PRE:' + str(ow0['presenceUs']) + ':SMP:' + str(ow0['sampleUs']) + ':RAW:' + str(ow0['raw']))
dht0 = Adafruit_DHT.read_timed(22, 27)
print('RPI_DHT0:' + str(dht0['humidity']) + ':' + str(dht0['temperature']) + ':START:' + str(dht0['startPulseUs']) + ':RESP:' + str(dht0['responseLowUs']))
cam = Picamera2()
cam.configure(cam.create_preview_configuration(main={'size': (2, 2), 'format': 'RGB888'}))
cam.start()
print('RPI_CAM_READY')
print('RPI_DONE')

observed = {}
def rpi_poll():
    if 'uart' not in observed:
        d = U.read(16)
        if d:
            observed['uart'] = True
            st = U.stats
            print('RPI_UART_RX:' + d + ':US:' + str(round(U.clock_us - t1)) + ':OV:' + str(st['rxOverrun']) + ':FE:' + str(st['framingErrors']))
    if 'ow' not in observed:
        ow = w1_gpio.read_temp_timed(4)
        if abs(ow['temperature'] - 37.5) < 0.1:
            observed['ow'] = True
            print('RPI_OW1:' + str(ow['temperature']) + ':RST:' + str(ow['resetLowUs']) + ':PRE:' + str(ow['presenceUs']) + ':SMP:' + str(ow['sampleUs']))
    if 'dht' not in observed:
        w = Adafruit_DHT.read_timed(22, 27)
        if abs(w['temperature'] - 31.5) < 0.1 and abs(w['humidity'] - 66.0) < 0.1:
            observed['dht'] = True
            print('RPI_DHT1:' + str(w['humidity']) + ':' + str(w['temperature']) + ':START:' + str(w['startPulseUs']) + ':RESP:' + str(w['responseLowUs']))
    if 'adc' not in observed:
        t0 = _bridge.clock_us()
        v = adc.read()
        dt = _bridge.clock_us() - t0
        if v == 205:
            observed['adc'] = True
            print('RPI_ADC1:205:US:' + str(round(dt)) + ':CUS:' + str(adc.conversion_us) + ':V:' + str(adc.sample_hold_v))
    if 'cam' not in observed:
        data = [int(x) for x in cam.capture_array().flatten()]
        if len(data) == 12 and sum(data) == 1275:
            observed['cam'] = True
            print('RPI_CAM:' + str(len(data)) + ':' + str(sum(data)) + ':' + ','.join(str(x) for x in data[:3]))
            print('RPI_CAM_FILE:' + str(cam.capture_file('/home/pyodide/frame.raw')))
    if 'ov' not in observed and U.stats['rxOverrun'] > 0:
        observed['ov'] = True
        got = U.read(16)
        st = U.stats
        print('RPI_UART_OV:' + str(len(got)) + ':' + str(st['rxOverrun']) + ':' + str(st['framingErrors']))
`.trim() + '\n';
}

function components(type) {
  return [
    { id: 'pi1', type, attrs: { env: 'micropython' }, x: 60, y: 60 },
    { id: 'pot1', type: 'openhw-potentiometer', attrs: { value: 50 }, x: 400, y: 60 },
    { id: 'usb1', type: 'openhw-usb-device', attrs: {}, x: 400, y: 140 },
    { id: 'ds1', type: 'openhw-ds18b20', attrs: { temperature: 22.5 }, x: 400, y: 220 },
    { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 400, y: 300 },
    { id: 'cam1', type: 'openhw-camera-module', attrs: { width: 2, height: 2 }, x: 400, y: 380 },
  ];
}

const WIRES = [
  { from: 'pi1:3V3', to: 'pot1:1' },
  { from: 'pi1:GND.1', to: 'pot1:2' },
  { from: 'pot1:SIG', to: 'pi1:5' },
  { from: 'pi1:3V3', to: 'ds1:VCC' },
  { from: 'pi1:GND.1', to: 'ds1:GND' },
  { from: 'ds1:DQ', to: 'pi1:4' },
  { from: 'pi1:3V3', to: 'dht1:VCC' },
  { from: 'pi1:GND.1', to: 'dht1:GND' },
  { from: 'dht1:DATA', to: 'pi1:27' },
];

const EVENTS = [
  { compId: 'pot1', event: { type: 'input', value: 80 }, afterMs: 1200 },
  { compId: 'ds1', event: { type: 'temperature-change', value: 37.5 }, afterMs: 1800 },
  { compId: 'dht1', event: { type: 'temperature', value: 31.5 }, afterMs: 2400 },
  { compId: 'dht1', event: { type: 'humidity', value: 66 }, afterMs: 2500 },
  { compId: 'cam1', event: { type: 'frame', value: FRAME }, afterMs: 3000 },
];

async function runBoard(page, b) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/compile')) return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
  page.on('pageerror', (err) => console.log(`${b.type} PAGEERROR:`, String(err).slice(0, 300)));
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const setup = await page.evaluate(({ comps, wires, py }) => window.OpenHWE2E.setupCircuit({
    components: comps, wires, code: py,
  }), { comps: components(b.type), wires: WIRES, py: sketch() });
  expect(setup.ok).toBe(true);

  const runP = page.evaluate(() => window.OpenHWE2E.run({
    forMs: 20000,
    selectTelemetry: ['pot1', 'usb1', 'ds1', 'dht1', 'cam1'],
    serialNeedle: 'RPI_CAM:',
    telemetryMode: 'detail',
  }));
  // Deterministic: wait for the guest boot needle BEFORE changing any host
  // component, so the boot baseline is 22.5 C / 23.5 C / 50 % / 0 code.
  let booted = false;
  for (let i = 0; i < 60; i++) {
    const snap = await page.evaluate(() => window.OpenHWE2E.snapshot());
    if (String(snap?.serialText || '').includes('RPI_DONE')) { booted = true; break; }
    await page.waitForTimeout(500);
  }
  expect(booted, 'guest boot needle RPI_DONE').toBe(true);

  for (const ev of EVENTS) {
    expect((await page.evaluate(({ id, event }) => window.OpenHWE2E.interact(id, event),
      { id: ev.compId, event: ev.event })).ok).toBe(true);
    await page.waitForTimeout(250);
  }
  expect((await page.evaluate(() => window.OpenHWE2E.serialInput('AB\n', 'pi1'))).ok).toBe(true);
  await page.waitForTimeout(1200);
  // 20 bytes into a 16-byte RX FIFO → exactly 4 overruns.
  expect((await page.evaluate(() => window.OpenHWE2E.serialInput('01234567890123456789', 'pi1'))).ok).toBe(true);
  const verdict = await runP;
  await page.evaluate(() => window.OpenHWE2E.stop());
  return verdict;
}

function telemetryOf(verdict, id) {
  return (verdict.telemetry || []).find((t) => t.id === id);
}

test.describe('Raspberry Pi timed peripheral drivers', () => {
  test.setTimeout(240000);

  for (const b of BOARDS) {
    test(`${b.type}: SAR ADC / framed UART / timed 1-Wire + DHT / host camera`, async ({ page }) => {
      const verdict = await runBoard(page, b);
      console.log(`${b.type} reasons:`, JSON.stringify(verdict.reasons || []));
      console.log(`${b.type} serial:`, JSON.stringify(String(verdict.serial || '').slice(0, 700)));
      console.log(`${b.type} states:`, JSON.stringify((verdict.telemetry || []).map(t => ({ id: t.id, state: t.details?.state })).map(x => ({ id: x.id, value: x.state?.value, temp: x.state?.temperature, hum: x.state?.humidity, cam: x.state?.frame, cap: x.state?.captures }))));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      const serial = String(verdict.serial || '');
      for (const marker of [
        'RPI_UART_CFG:9600:1041.6667:16', 'RPI_UART_TX_US:5208:ECHO:HI-PI',
        'RPI_ADC0:', 'RPI_OW0:22.5:RST:480:PRE:240:SMP:15:RAW:360',
        'RPI_DHT0:50.0:23.5:START:18000:RESP:80', 'RPI_CAM_READY', 'RPI_DONE',
        'RPI_UART_RX:AB', 'RPI_OW1:37.5:RST:480:PRE:240:SMP:15',
        'RPI_DHT1:66.0:31.5:START:18000:RESP:80', 'RPI_ADC1:205',
        'RPI_CAM:12:1275:255,0,0', 'RPI_CAM_FILE:12', 'RPI_UART_OV:16:4:0',
      ]) {
        expect(serial, `missing ${marker}`).toContain(marker);
      }
      // Virtual clock advanced by acquisition + (bits+1) SAR clock periods:
      // BCM boards 8 us acquisition -> 11 us; RP1 Pi 5 4 us -> 7 us.
      expect(serial).toContain(`RPI_ADC1:205:US:${b.adcUs}:CUS:3.4375:V:0.66`);
      // Per-board electrical facts remain visible from guest state.
      expect(serial).toContain(`RPI_ELEC:${b.viH}:${b.pull}`);

      // ADC: host pot value changed; guest SAR code == 205; metadata on the
      // host endpoint records the settled voltage and per-board profile.
      const pot = telemetryOf(verdict, 'pot1');
      expect(Number(pot?.details?.state?.value)).toBe(80);
      const dsMeta = telemetryOf(verdict, 'dht1')?.details?.state?.rpiAdc;
      expect(dsMeta).toBeTruthy();
      expect(dsMeta.bits).toBe(b.bits);
      expect(Number(dsMeta.viH)).toBe(Number(b.viH));
      expect(Number(dsMeta.pullUpOhms)).toBe(b.pull);
      expect(Number(dsMeta.channels?.['5']?.raw)).toBe(205);

      // UART: exact bytes both ways, 8N1 bit time, FIFO overrun counter.
      const usb = telemetryOf(verdict, 'usb1');
      expect(usb?.details?.state?.enumState).toBe('enumerated');
      expect(Number(usb.details.state.rxCount)).toBe(5);
      expect(usb.details.state.lastEcho).toBe('HI-PI');

      // Timed host sensors: host telemetry reacted, guest decoded the waveform.
      expect(Number(telemetryOf(verdict, 'ds1')?.details?.state?.temperature)).toBe(37.5);
      const dht = telemetryOf(verdict, 'dht1')?.details?.state;
      expect(Number(dht?.temperature)).toBe(31.5);
      expect(Number(dht?.humidity)).toBe(66);

      // Camera: host frame reached the guest through picamera2.
      const cam = telemetryOf(verdict, 'cam1');
      expect(cam).toBeTruthy();
      expect(cam.details.state.framePixels).toBe(4);
      expect(cam.details.state.checksum).toBe(1275);
      expect(Number(cam.details.state.captures)).toBeGreaterThan(0);
      expect(cam.details.state.frame).toEqual(FRAME);
    });
  }
});
