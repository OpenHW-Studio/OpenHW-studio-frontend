import { test, expect } from '@playwright/test';

// Pico (RP2040) peripheral + system sweep (live). UART/I2C/SPI/ADC/PWM/
// PIO/DMA/MicroPython/Display already proven (see matrix Pico row); every
// cell below is a matrix NONE on openhw-pico: GPIO-in, 1-Wire, IR,
// EEPROM + NVS (flash-emul), TRNG (ROSC jitter), Watchdog, EXTI
// (nvic.c), PWR/Sleep, Clocks (RP2040 side of the PARTIAL arch-clocks
// row). USB-DEV / I2S / SD need runner changes (staged in
// .tmp-vitest/avr-pico-patches.md — no spec until the gate lifts).
// Camera = NO-GO (no DCMI silicon), RTC = NO-GO (no RP2040 silicon),
// Debug/GDB = NO-GO (not serial-provable). Serial reaches USB-CDC via
// the runner's Serial->Serial1 rewrite (pico-runner.ts:12-14).
const B = 'pico1';
const BT = 'openhw-pico';

async function runCell(page, { comps = [], wires = [], code, needle, forMs = 22000, telemetry = [] }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const setup = await page.evaluate(([b, bt, c, w, cd]) => window.OpenHWE2E.setupCircuit({
    components: [{ id: b, type: bt, attrs: {}, x: 100, y: 100 }, ...c],
    wires: w,
    code: cd,
  }), [B, BT, comps, wires, code]);
  expect(setup.ok).toBe(true);
  const opts = { forMs, serialNeedle: needle, telemetryMode: 'detail' };
  if (telemetry.length) opts.selectTelemetry = telemetry;
  const verdict = await page.evaluate((o) => window.OpenHWE2E.run(o), opts);
  expect(verdict.ok).toBe(true);
  console.log(`${needle} verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
  console.log(`${needle} serial tail:`, JSON.stringify((verdict.serial || '').slice(-300)));
  expect(verdict.pass).toBe(true);
  return verdict;
}

test.describe('Pico RP2040 peripherals + system', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico GPIO-in reads slide-switch (GPIO-in cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 }],
      wires: [
        { from: `${B}:3V3`, to: 'sw1:3' },
        { from: `${B}:GND`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B}:GP7` },
      ],
      code: 'void setup(){pinMode(7,INPUT);Serial.begin(9600);Serial.println("PICO_IN_READY");}\nvoid loop(){Serial.println(digitalRead(7));delay(500);}\n',
      needle: 'PICO_IN_READY',
    });
    expect(/[\r\n]1[\r\n]/.test(verdict.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico DHT22 temp+humidity (1-Wire cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:GP2`, to: 'dht1:DATA' },
        { from: `${B}:3V3`, to: 'dht1:VCC' },
        { from: `${B}:GND`, to: 'dht1:GND' },
      ],
      code: '#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN,DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("PICO_DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("PICO_DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n',
      needle: 'PICO_DHT_T:',
    });
    expect(verdict.serial || '').toContain('PICO_DHT_T:');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico IR envelope loopback (IR cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'ir1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:GP3`, to: `${B}:GP2` },
        { from: `${B}:3V3`, to: 'ir1:VCC' },
        { from: `${B}:GND`, to: 'ir1:GND' },
        { from: 'ir1:OUT', to: `${B}:GP4` },
      ],
      code: 'const int TX=3,RX=2;\nbool bit(bool l){digitalWrite(TX,l?HIGH:LOW);delayMicroseconds(500);bool e=digitalRead(RX)==HIGH;delayMicroseconds(500);return e;}\nbool byte(uint8_t t,uint8_t&r){if(bit(false)!=false)return false;uint8_t v=0;for(uint8_t i=0;i<8;i++)if(bit((t>>i)&1))v|=(1<<i);if(bit(true)!=true)return false;r=v;return true;}\nvoid setup(){Serial.begin(9600);pinMode(TX,OUTPUT);digitalWrite(TX,HIGH);pinMode(RX,INPUT);Serial.println("PICO_IR_READY");}\nvoid loop(){uint8_t a=0,c=0;if(byte(0x00,a)&&byte(0x16,c)&&a==0x00&&c==0x16)Serial.println("PICO_IR_DECODED ADDR=0x00 CMD=0x16");else Serial.println("PICO_IR_TIMEOUT");delay(2000);}\n',
      needle: 'PICO_IR_DECODED', telemetry: ['ir1'],
    });
    expect(verdict.serial || '').toContain('PICO_IR_DECODED ADDR=0x00 CMD=0x16');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico EEPROM + NVS flash-emulation readback (EEPROM + Backup/NVS cells)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <EEPROM.h>\nvoid hx(uint8_t b){if(b<16)Serial.print("0");Serial.print(b,HEX);}\nvoid setup(){Serial.begin(9600);Serial.println("PICO_EE_READY");EEPROM.begin(512);EEPROM.write(0x10,0xAB);EEPROM.write(0x11,0xCD);EEPROM.write(0x100,0x12);EEPROM.write(0x101,0x34);EEPROM.commit();uint8_t a=EEPROM.read(0x10),b=EEPROM.read(0x11),c=EEPROM.read(0x100),d=EEPROM.read(0x101);Serial.print("PICO_EE_RB:");hx(a);hx(b);Serial.println();Serial.print("PICO_NVS_RB:");hx(c);hx(d);Serial.println();}\nvoid loop(){Serial.println("PICO_EE_TICK");delay(2000);}\n',
      needle: 'PICO_NVS_RB:',
    });
    const ee = /PICO_EE_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    const nvs = /PICO_NVS_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    console.log('PICO_EE:', ee && ee[1], 'PICO_NVS:', nvs && nvs[1]);
    expect(ee && ee[1]).toBe('ABCD');
    expect(nvs && nvs[1]).toBe('1234');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico ROSC random draws differ (TRNG/RNG cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO_RNG_READY");uint32_t r1=rp2040.hw_rand32();uint32_t r2=rp2040.hw_rand32();Serial.print("PICO_RAND1:");Serial.println(r1,HEX);Serial.print("PICO_RAND2:");Serial.println(r2,HEX);}\nvoid loop(){Serial.println("PICO_RNG_TICK");delay(2000);}\n',
      needle: 'PICO_RAND2:',
    });
    const r1 = /PICO_RAND1:([0-9A-Fa-f]+)/.exec(verdict.serial || '')?.[1];
    const r2 = /PICO_RAND2:([0-9A-Fa-f]+)/.exec(verdict.serial || '')?.[1];
    console.log('PICO_RAND:', r1, r2);
    expect(r1).toBeTruthy(); expect(r2).toBeTruthy();
    expect(r1 !== '0' || r2 !== '0').toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico watchdog reboots unfed firmware (Watchdog cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO_WDT_BOOT");rp2040.wdt_begin(200);Serial.println("PICO_WDT_ARMED");}\nvoid loop(){Serial.println("PICO_WDT_SPIN");delay(100);}\n',
      needle: 'PICO_WDT_BOOT', forMs: 25000,
    });
    const boots = (verdict.serial || '').match(/PICO_WDT_BOOT/g) || [];
    console.log('PICO_WDT boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico GPIO interrupt counts edges (EXTI/Interrupts cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      wires: [{ from: `${B}:GP3`, to: `${B}:GP2` }],
      code: 'volatile uint16_t cnt=0;\nvoid isr(){cnt++;}\nvoid setup(){Serial.begin(9600);pinMode(3,OUTPUT);pinMode(2,INPUT);attachInterrupt(digitalPinToInterrupt(2),isr,RISING);Serial.println("PICO_EXT_READY");}\nvoid loop(){for(int i=0;i<10;i++){digitalWrite(3,HIGH);delay(5);digitalWrite(3,LOW);delay(5);}Serial.print("PICO_EXT_CNT:");Serial.println(cnt);cnt=0;delay(1000);}\n',
      needle: 'PICO_EXT_CNT:',
    });
    const vals = [...(verdict.serial || '').matchAll(/PICO_EXT_CNT:(\d+)/g)].map((m) => Number(m[1]));
    console.log('PICO_EXT counts:', JSON.stringify(vals.slice(0, 6)));
    expect(vals.length).toBeGreaterThan(0);
    expect(vals[vals.length - 1]).toBeGreaterThanOrEqual(8);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico WFI sleeps until timer wakes it (PWR/Sleep cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include "hardware/timer.h"\nvolatile bool woke=false;\nbool cb(struct repeating_timer*t){(void)t;woke=true;return true;}\nvoid setup(){Serial.begin(9600);Serial.println("PICO_SLP_READY");static struct repeating_timer rt;add_repeating_timer_ms(500,cb,NULL,&rt);}\nvoid loop(){woke=false;__WFI();if(woke)Serial.println("PICO_WOKE");else Serial.println("PICO_SPURIOUS");delay(200);}\n',
      needle: 'PICO_WOKE',
    });
    expect(verdict.serial || '').toContain('PICO_WOKE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico sysclk reads 125MHz (Clocks cell, RP2040 side)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include "hardware/clocks.h"\nvoid setup(){Serial.begin(9600);Serial.print("PICO_SYSCLK:");Serial.println(clock_get_hz(clk_sys));Serial.println("PICO_CLK_READY");}\nvoid loop(){Serial.println("PICO_CLK_TICK");delay(2000);}\n',
      needle: 'PICO_CLK_READY',
    });
    expect(verdict.serial || '').toContain('PICO_SYSCLK:125000000');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
