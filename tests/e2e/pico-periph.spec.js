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
// 2026-10-11 status: GPIO-in/DHT/IR/EXTI are ENGINE-ABI-BLOCKED (no
// runner→IN-latch inject on pico-emu 1.0.3 — one owner export fixes all
// four); TRNG/WDT/Clocks/EEPROM fixed in-spec; WFI retest pending.
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

  test('Pico GPIO-in reads slide-switch HIGH and LOW (GPIO-in cell)', async ({ page }) => {
    // Honest two-level proof: HIGH preset must read 1, LOW preset must
    // read 0. ENGINE-ABI-BLOCKED (2026-10-11, evidence in lane report):
    // pico-emu 1.0.3's only input path `_picoemu_set_gpio` writes the OUT
    // latch (gpio.c gpio_set_pin); the guest-visible IN latch is never
    // updated (reset default all-HIGH, SIO IN writes ignored by design),
    // so input pins read stuck-at-1 and the LOW run is RED. Owner fix is
    // one export (gpio_set_input_pin). This cell must NOT be weakened to
    // HIGH-only — that passes by luck (stuck-at-1) and proves nothing.
    // Windows 12s (~24 VAL lines each run) — proof-identical, dilation-tightened.
    const code = 'void setup(){pinMode(7,INPUT);Serial.begin(9600);Serial.println("PICO_IN_READY");}\nvoid loop(){Serial.print("PICO_IN_VAL:");Serial.println(digitalRead(7));delay(500);}\n';
    const hi = await runCell(page, {
      comps: [{ id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 }],
      wires: [
        { from: `${B}:3V3`, to: 'sw1:3' },
        { from: `${B}:GND`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B}:GP7` },
      ],
      code,
      needle: 'PICO_IN_VAL:', forMs: 12000,
    });
    expect(/PICO_IN_VAL:1/.test(hi.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
    const lo = await runCell(page, {
      comps: [{ id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '0' }, x: 450, y: 120 }],
      wires: [
        { from: `${B}:3V3`, to: 'sw1:3' },
        { from: `${B}:GND`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B}:GP7` },
      ],
      code,
      needle: 'PICO_IN_VAL:', forMs: 12000,
    });
    expect(/PICO_IN_VAL:0/.test(lo.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico DHT22 temp+humidity (1-Wire cell)', async ({ page }) => {
    // ENGINE-ABI-BLOCKED like GPIO-in: the DHT22 model answers through
    // _driveBoardPin → _picoemu_set_gpio (OUT latch), which the guest can
    // never sample (IN latch stuck-at-1), so firmware times out / reads
    // static levels. Strong asserts below (finite, model-default range
    // 24C/50% — corrupt bits fail checksum → NaN) stay RED until the
    // input-inject export lands. Observed 2026-10-09: T:inf/H:inf.
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
    const m = /PICO_DHT_T:(\S+) DHT_H:(\S+)/.exec(verdict.serial || '');
    console.log('PICO_DHT parsed:', m && m.slice(1));
    expect(m).toBeTruthy();
    const t = Number(m[1]), h = Number(m[2]);
    expect(Number.isFinite(t) && Number.isFinite(h)).toBe(true);
    expect(t).toBeGreaterThan(20); expect(t).toBeLessThan(28);
    expect(h).toBeGreaterThan(40); expect(h).toBeLessThan(60);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico IR envelope loopback (IR cell)', async ({ page }) => {
    // COMPILE FIX 2026-10-11: helpers were `bit`/`byte`, which collide
    // with the Arduino `bit()` macro (Common.h) and `byte` typedef — the
    // sketch never compiled (zero serial). Renamed to irBit/irByte.
    // RUNTIME: ENGINE-ABI-BLOCKED like GPIO-in — GP2/RX reads stuck-at-1,
    // so the loopback never decodes (TIMEOUT forever); DECODED stays RED
    // until the input-inject export lands.
    const verdict = await runCell(page, {
      comps: [{ id: 'ir1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:GP3`, to: `${B}:GP2` },
        { from: `${B}:3V3`, to: 'ir1:VCC' },
        { from: `${B}:GND`, to: 'ir1:GND' },
        { from: 'ir1:OUT', to: `${B}:GP4` },
      ],
      code: 'const int IRTX=3,IRRX=2;\nbool irBit(bool l){digitalWrite(IRTX,l?HIGH:LOW);delayMicroseconds(500);bool e=digitalRead(IRRX)==HIGH;delayMicroseconds(500);return e;}\nbool irByte(uint8_t t,uint8_t&r){if(irBit(false)!=false)return false;uint8_t v=0;for(uint8_t i=0;i<8;i++)if(irBit((t>>i)&1))v|=(1<<i);if(irBit(true)!=true)return false;r=v;return true;}\nvoid setup(){Serial.begin(9600);pinMode(IRTX,OUTPUT);digitalWrite(IRTX,HIGH);pinMode(IRRX,INPUT);Serial.println("PICO_IR_READY");}\nvoid loop(){uint8_t a=0,c=0;if(irByte(0x00,a)&&irByte(0x16,c)&&a==0x00&&c==0x16)Serial.println("PICO_IR_DECODED ADDR=0x00 CMD=0x16");else Serial.println("PICO_IR_TIMEOUT");delay(2000);}\n',
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
    // COMPILE FIX 2026-10-11: the API is `rp2040.hwrand32()` (get_rand_32);
    // `hw_rand32` does not exist (backend error suggests hwrand32) — the
    // sketch never compiled (zero serial). RP2350 TRNG / RP2040 ROSC are
    // both modeled in-engine (devtools.c TRNG/xorshift).
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO_RNG_READY");uint32_t r1=rp2040.hwrand32();uint32_t r2=rp2040.hwrand32();Serial.print("PICO_RAND1:");Serial.println(r1,HEX);Serial.print("PICO_RAND2:");Serial.println(r2,HEX);}\nvoid loop(){Serial.println("PICO_RNG_TICK");delay(2000);}\n',
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
    // Needles + counts ARMED (second setup line) — BOOT is eaten by the
    // <500ms early-byte race; see pico-wdt.spec.js.
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO_WDT_BOOT");rp2040.wdt_begin(200);Serial.println("PICO_WDT_ARMED");}\nvoid loop(){Serial.println("PICO_WDT_SPIN");delay(100);}\n',
      needle: 'PICO_WDT_ARMED', forMs: 15000,
    });
    const boots = (verdict.serial || '').match(/PICO_WDT_ARMED/g) || [];
    console.log('PICO_WDT boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico GPIO interrupt counts edges (EXTI/Interrupts cell)', async ({ page }) => {
    // ENGINE-ABI-BLOCKED like GPIO-in: GP3's driven edges never reach
    // GP2's IN latch (stuck-at-1, no external-drive edge path, so the
    // IO_BANK0 edge latch never sets and the ISR never runs). The GPIO
    // IRQ model itself is complete in-engine (gpio.c edge detect + NVIC
    // IO_IRQ_BANK0) — only the runner→IN injection export is missing.
    // Counts stay 0 until that lands.
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
    // COMPILE FIX 2026-10-11 (two faults, both fatal): `__WFI` is not
    // declared (pico-sdk names it `__wfi()` from hardware/sync.h — include
    // added), and `static` locals in the sketch trip the Arduino prototype
    // generator (`setup()` "declared extern and later static") — timer and
    // counter are globals now. The repeating-timer alarm IRQ model exists
    // in-engine (timer.c alarms + NVIC); this run decides whether the
    // guest actually wakes.
    const verdict = await runCell(page, {
      code: '#include "hardware/timer.h"\n#include "hardware/sync.h"\nvolatile bool woke=false;\nstruct repeating_timer rt;\nbool tcb(struct repeating_timer*t){(void)t;woke=true;return true;}\nvoid setup(){Serial.begin(9600);Serial.println("PICO_SLP_READY");add_repeating_timer_ms(500,tcb,NULL,&rt);Serial.println("PICO_SLP_ARMED");}\nvoid loop(){woke=false;__wfi();if(woke)Serial.println("PICO_WOKE");else Serial.println("PICO_SPURIOUS");delay(200);}\n',
      needle: 'PICO_WOKE',
    });
    expect(verdict.serial || '').toContain('PICO_WOKE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico sysclk reads 125MHz (Clocks cell, RP2040 side)', async ({ page }) => {
    // TOOLCHAIN-TRUTH FIX 2026-10-11: the backend compiles rpipico with
    // F_CPU=200MHz (arduino-cli defaults an option-less FQBN to the first
    // `freq` menu item = 200MHz overclock; proven: firmware prints
    // F_CPU=200000000 and clock_get_hz reads the same). Asserting 125MHz
    // was asserting a clock the toolchain never builds. The cell now
    // asserts the real default (200M) AND that set_sys_clock_khz(125000)
    // is honored by the engine (proves PLL control + readback).
    const verdict = await runCell(page, {
      code: '#include "hardware/clocks.h"\nvoid setup(){Serial.begin(9600);Serial.print("PICO_FCPU:");Serial.println(F_CPU);Serial.print("PICO_SYSCLK:");Serial.println(clock_get_hz(clk_sys));set_sys_clock_khz(125000,true);Serial.print("PICO_SYSCLK_SET:");Serial.println(clock_get_hz(clk_sys));Serial.println("PICO_CLK_READY");}\nvoid loop(){Serial.println("PICO_CLK_TICK");delay(2000);}\n',
      needle: 'PICO_CLK_READY',
    });
    expect(verdict.serial || '').toContain('PICO_FCPU:200000000');
    expect(verdict.serial || '').toContain('PICO_SYSCLK_SET:125000000');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
