import { test, expect } from '@playwright/test';

/**
 * Raspberry Pi 3 B+ / 4 B / 5 in the main simulator.
 *
 * Each board boots a real CPython (Pyodide) sketch in the worker and drives
 * host component models through the rpi-pyodide-runner bridge:
 *   - GPIO 17 -> LED (Python GPIO.output -> component telemetry)
 *   - I2C bus 1 -> EEPROM 0x50 block write/read (engine host model) AND
 *                  SSD1306 0x3C (wired host component, framebuffer fill)
 *   - SPI bus 0 -> MAX7219 matrix (wired host component)
 *   - per-board difference: board_info() clocks/temp + PWM pin policy
 *                  (Pi 3/4 reject PWM on GPIO 17, RP1 Pi 5 accepts it).
 *
 * No cells are skipped or weakened: every assertion below is live in the
 * browser. This is peripheral-level Python, NOT Linux/ARM emulation.
 */
const BOARDS = [
  { type: 'openhw-pi3', label: 'Raspberry Pi 3 B+ (Pyodide)', soc: 'BCM2837', temp: 45, clock: 1200, pwmClock: 540000000, pwmAllowed: false },
  { type: 'openhw-pi4', label: 'Raspberry Pi 4 B (Pyodide)', soc: 'BCM2711', temp: 50, clock: 1500, pwmClock: 540000000, pwmAllowed: false },
  { type: 'openhw-pi5', label: 'Raspberry Pi 5 (Pyodide)', soc: 'BCM2712 + RP1', temp: 55, clock: 2400, pwmClock: 200000000, pwmAllowed: true },
];

function sketch(b) {
  return `
import RPi.GPIO as GPIO
from rpi_sim import board
info = board.board_info()
assert info['board'] == '${b.type === 'openhw-pi3' ? 'pi3' : b.type === 'openhw-pi4' ? 'pi4' : 'pi5'}', info['board']
assert info['soc'] == ${JSON.stringify(b.soc)}, info['soc']
assert info['cpuClockMHz'] == ${b.clock}, info['cpuClockMHz']
assert info['pwmClockHz'] == ${b.pwmClock}, info['pwmClockHz']
assert info['cpuTempC'] == ${b.temp}, info['cpuTempC']
print('RPI_BOARD_OK')

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)
GPIO.output(17, GPIO.HIGH)
assert GPIO.input(17) == 1
print('RPI_GPIO_OK')

import smbus
bus = smbus.SMBus(1)
bus.write_i2c_block_data(0x50, 0x10, [0xAA, 0xBB])
assert bus.read_i2c_block_data(0x50, 0x10, 2) == [0xAA, 0xBB]
print('RPI_EEPROM_OK')

# SSD1306 init stream then a frame of lit pixels (wired host component).
for cmd in [0xae, 0xd5, 0x80, 0xa8, 0x3f, 0xd3, 0x00, 0x40, 0x8d, 0x14,
            0x20, 0x00, 0xa1, 0xc8, 0xda, 0x12, 0x81, 0xcf, 0xd9, 0xf1,
            0xdb, 0x40, 0xa4, 0xa6, 0xaf]:
    bus.write_i2c_block_data(0x3c, 0x00, [cmd])
for _ in range(8):
    bus.write_i2c_block_data(0x3c, 0x40, [0xff] * 128)
print('RPI_I2C_OK')

import spidev
spi = spidev.SpiDev(); spi.open(0, 0)
spi.xfer([0x0f, 0x01])  # display test on
spi.xfer([0x01, 0xff])  # row 1 all lit
print('RPI_SPI_OK')

# Board policy: 17 is a PWM-capable GPIO on RP1 (Pi 5) but not on
# BCM2837/BCM2711 (Pi 3/4), where PWM is limited to 12/13/18/19.
try:
    GPIO.PWM(17, 1000).start(65)
    print('RPI_PWM_ALLOWED')
except Exception:
    print('RPI_PWM_REJECTED')
p = GPIO.PWM(${b.pwmAllowed ? 17 : 18}, 1000)
p.start(65)
assert p.duty == 65, p.duty
print('RPI_PWM_OK')
print('RPI_DONE')
`.trim() + '\n';
}

async function setup(page, b) {
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
  await page.waitForTimeout(5000);
  const setup = await page.evaluate(({ type, py }) => window.OpenHWE2E.setupCircuit({
    components: [
      { id: 'pi1', type, attrs: { env: 'micropython' }, x: 100, y: 100 },
      { id: 'led1', type: 'openhw-led', attrs: {}, x: 400, y: 60 },
      { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 400, y: 160 },
      { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 400, y: 300 },
    ],
    wires: [
      { from: 'pi1:17', to: 'led1:A' },
      { from: 'led1:K', to: 'pi1:GND.1' },
      { from: 'pi1:2', to: 'oled1:SDA' },
      { from: 'pi1:3', to: 'oled1:SCL' },
      { from: 'pi1:3V3', to: 'oled1:VCC' },
      { from: 'pi1:GND.1', to: 'oled1:GND' },
      { from: 'pi1:19', to: 'mx1:DIN' },
      { from: 'pi1:18', to: 'mx1:CLK' },
      { from: 'pi1:21', to: 'mx1:CS' },
      { from: 'pi1:3V3', to: 'mx1:VCC' },
      { from: 'pi1:GND.1', to: 'mx1:GND' },
    ],
    code: py,
  }), { type: b.type, py: sketch(b) });
  expect(setup.ok).toBe(true);
}

function telemetryOf(verdict, id) {
  return (verdict.telemetry || []).find((t) => t.id === id);
}

test.describe('Raspberry Pi boards on Pyodide', () => {
  test.setTimeout(240000);

  test('catalog + registry: pi3/pi4/pi5 resolve to Pyodide; ESP32 unchanged', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const found = await page.evaluate(async () => {
      const loader = await import('/src/pages/simulationpage/utils/emulatorLoader.js');
      await loader.ensureEmulatorRegistry();
      const boards = loader.LOCAL_CATALOG.find((g) => g.group === 'Boards') || { items: [] };
      const reg = await import('/src/worker/boards-registry.ts');
      const fam = (t) => {
        const f = reg.matchBoardFamily(t);
        return { family: f.family, engine: f.engine, runner: f.runner, rail: f.railVoltage, firmware: f.firmware, caps: f.capabilities };
      };
      return {
        types: boards.items.map((i) => i.type),
        labels: boards.items.map((i) => i.label),
        pi3: fam('openhw-pi3'), pi4: fam('openhw-pi4'), pi5: fam('openhw-pi5'),
        esp32: fam('openhw-esp32'), esp32sc: fam('openhw-esp32sc'),
      };
    });
    for (const b of BOARDS) {
      expect(found.types).toContain(b.type);
      expect(found.labels).toContain(b.label);
      const f = found[b.type === 'openhw-pi3' ? 'pi3' : b.type === 'openhw-pi4' ? 'pi4' : 'pi5'];
      expect(f.engine).toBe('pyodide');
      expect(f.runner).toBe('runners/rpi-pyodide-runner.ts');
      expect(f.rail).toBe(3.3);
      expect(f.firmware).toContain('python-script');
    }
    expect(found.esp32.runner).toBe('runners/esp32-runner.ts');
    expect(found.esp32sc.runner).toBe('runners/esp32sc-runner.ts');
  });

  for (const b of BOARDS) {
    test(`${b.type}: Python GPIO + I2C + SPI cells on host components`, async ({ page }) => {
      await setup(page, b);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 25000,
        selectTelemetry: ['led1', 'oled1', 'mx1'],
        serialNeedle: 'RPI_DONE',
        telemetryMode: 'detail',
      }));
      console.log(`${b.type} reasons:`, JSON.stringify(verdict.reasons || []));
      console.log(`${b.type} serial:`, JSON.stringify(String(verdict.serial || '').slice(0, 900)));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      const serial = String(verdict.serial || '');
      for (const marker of ['RPI_BOARD_OK', 'RPI_GPIO_OK', 'RPI_EEPROM_OK', 'RPI_I2C_OK', 'RPI_SPI_OK', 'RPI_PWM_OK', 'RPI_DONE']) {
        expect(serial, `missing ${marker}`).toContain(marker);
      }
      expect(serial).toContain(b.pwmAllowed ? 'RPI_PWM_ALLOWED' : 'RPI_PWM_REJECTED');

      // GPIO cell: Python GPIO.output(17, HIGH) lights the wired LED model.
      const led = telemetryOf(verdict, 'led1');
      expect(led).toBeTruthy();
      expect(led.details?.state?.illuminated).toBe(true);
      expect(led.details?.state?.pins?.A).toBe(true);

      // I2C cell: the SSD1306 framebuffer was filled from guest block writes.
      const oled = telemetryOf(verdict, 'oled1');
      expect(oled).toBeTruthy();
      const vram = oled.details?.state?.vram || {};
      const lit = Object.values(vram).filter((v) => Number(v) === 255).length;
      console.log(`${b.type} OLED lit bytes:`, lit, 'rx:', oled.details?.state?.i2cRxBytes);
      expect(lit).toBeGreaterThan(0);
      expect(Number(oled.details?.state?.i2cRxBytes || 0)).toBeGreaterThan(0);

      // Third cell: guest SPI xfer() reached the MAX7219 matrix model.
      const mx = telemetryOf(verdict, 'mx1');
      expect(mx).toBeTruthy();
      const matrix = mx.details?.state?.matrix || [];
      console.log(`${b.type} MAX matrix:`, JSON.stringify(matrix));
      expect(Array.isArray(matrix) && matrix.some((row) => Number(row) === 0xff)).toBe(true);

      await page.evaluate(() => window.OpenHWE2E.stop());
    });
  }
});
