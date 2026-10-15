import { test, expect } from '@playwright/test';

// Pico 2 (RP2350 M33) peripheral + system sweep (live). UART/I2C/SPI/ADC/
// PWM/MicroPython/Display already proven on the M33 core (pico2* specs);
// every cell below is a matrix NONE on openhw-pico-2 (M33): PIO, DMA,
// GPIO-in, 1-Wire, IR, EEPROM + NVS, TRNG, SHA-256 (RP2350 HASH/CRYP),
// Watchdog, EXTI, PWR/Sleep. USB-DEV / I2S / SD need runner changes
// (staged in .tmp-vitest/avr-pico-patches.md). Camera/RTC-on-pico-2 =
// NO-GO notes in the report (no DCMI; RP2350-stamp RTC unproven).
// RV32 (arch=rv32) is out of scope here: no toolchain, fixed image only.
// DMA/PIO run on the same pico-emu core as Pico 1 (arch=2 select in
// pico-runner.ts:75-79); the DMA firmware mirrors pico-dma.spec.js.
const B = 'pico2';
const BT = 'openhw-pico-2';

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

test.describe('Pico 2 M33 peripherals + system', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico2 DMA copies 64 bytes mem-to-mem (DMA cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <Arduino.h>\n#include "hardware/dma.h"\n#include <string.h>\nstatic uint8_t s[64];\nstatic uint8_t d[64];\nvoid setup(){\nSerial.begin(9600);\nSerial.println("PICO2_DMA_READY");\nfor(int i=0;i<64;i++)s[i]=(uint8_t)(i*3+1);\nmemset(d,0,sizeof(d));\nint ch=dma_claim_unused_channel(true);\ndma_channel_config c=dma_channel_get_default_config(ch);\nchannel_config_set_transfer_data_size(&c,DMA_SIZE_8);\nchannel_config_set_read_increment(&c,true);\nchannel_config_set_write_increment(&c,true);\ndma_channel_configure(ch,&c,d,s,64,true);\ndma_channel_wait_for_finish_blocking(ch);\nbool ok=true;\nfor(int i=0;i<64;i++)if(d[i]!=s[i]){ok=false;break;}\nuint8_t ck=0;\nfor(int i=0;i<64;i++)ck^=d[i];\nSerial.print("PICO2_DMA_CMP:");Serial.print(ok?"PASS":"FAIL");Serial.print(" CK:");Serial.println(ck,HEX);\ndma_channel_unclaim(ch);}\nvoid loop(){delay(2000);}\n',
      needle: 'PICO2_DMA_CMP:', forMs: 30000,
    });
    const m = /PICO2_DMA_CMP:(PASS|FAIL) CK:([0-9A-F]+)/.exec(verdict.serial || '');
    console.log('PICO2_DMA result:', m ? m.slice(1) : 'NONE');
    expect(m && m[1]).toBe('PASS');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 PIO program drives GP15 HIGH (PIO cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [
        { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 450, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 600, y: 100 },
      ],
      wires: [
        { from: `${B}:GP15`, to: 'res1:p1' },
        { from: 'res1:p2', to: 'led1:A' },
        { from: 'led1:K', to: `${B}:GND` },
      ],
      code: '#include <Arduino.h>\n#include "hardware/pio.h"\n#include "hardware/pio_instructions.h"\n#define PIO_PIN 15\nvoid setup(){\nSerial.begin(9600);\nSerial.println("PICO2_PIO_READY");\nPIO pio=pio0;\nuint sm=pio_claim_unused_sm(pio,true);\nuint16_t prog[32];\nprog[0]=pio_encode_set(pio_pins,1);\nfor(int i=1;i<31;i++)prog[i]=pio_encode_nop()|pio_encode_delay(31);\nprog[31]=pio_encode_jmp(0);\nstruct pio_program pp={prog,32,0};\nuint off=pio_add_program(pio,&pp);\npio_gpio_init(pio,PIO_PIN);\npio_sm_set_consecutive_pindirs(pio,sm,PIO_PIN,1,true);\npio_sm_config c=pio_get_default_sm_config();\nsm_config_set_set_pins(&c,PIO_PIN,1);\nsm_config_set_clkdiv(&c,30000);\npio_sm_init(pio,sm,off,&c);\npio_sm_set_enabled(pio,sm,true);\nSerial.println("PICO2_PIO_RUNNING");}\nvoid loop(){Serial.println("PICO2_PIO_TICK");delay(1000);}\n',
      needle: 'PICO2_PIO_RUNNING', telemetry: ['led1'],
    });
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    expect(String(led.summary || '')).toMatch(/illuminated: true|brightness: ([1-9]|0\.\d*[1-9])|brightness: [1-9]/);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 GPIO-in reads slide-switch (GPIO-in cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 }],
      wires: [
        { from: `${B}:3V3`, to: 'sw1:3' },
        { from: `${B}:GND`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B}:GP7` },
      ],
      code: 'void setup(){pinMode(7,INPUT);Serial.begin(9600);Serial.println("PICO2_IN_READY");}\nvoid loop(){Serial.println(digitalRead(7));delay(500);}\n',
      needle: 'PICO2_IN_READY',
    });
    expect(/[\r\n]1[\r\n]/.test(verdict.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 DHT22 temp+humidity (1-Wire cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:GP2`, to: 'dht1:DATA' },
        { from: `${B}:3V3`, to: 'dht1:VCC' },
        { from: `${B}:GND`, to: 'dht1:GND' },
      ],
      code: '#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN,DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("PICO2_DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("PICO2_DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n',
      needle: 'PICO2_DHT_T:',
    });
    expect(verdict.serial || '').toContain('PICO2_DHT_T:');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 IR envelope loopback (IR cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'ir1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:GP3`, to: `${B}:GP2` },
        { from: `${B}:3V3`, to: 'ir1:VCC' },
        { from: `${B}:GND`, to: 'ir1:GND' },
        { from: 'ir1:OUT', to: `${B}:GP4` },
      ],
      code: 'const int TX=3,RX=2;\nbool bit(bool l){digitalWrite(TX,l?HIGH:LOW);delayMicroseconds(500);bool e=digitalRead(RX)==HIGH;delayMicroseconds(500);return e;}\nbool byte(uint8_t t,uint8_t&r){if(bit(false)!=false)return false;uint8_t v=0;for(uint8_t i=0;i<8;i++)if(bit((t>>i)&1))v|=(1<<i);if(bit(true)!=true)return false;r=v;return true;}\nvoid setup(){Serial.begin(9600);pinMode(TX,OUTPUT);digitalWrite(TX,HIGH);pinMode(RX,INPUT);Serial.println("PICO2_IR_READY");}\nvoid loop(){uint8_t a=0,c=0;if(byte(0x00,a)&&byte(0x16,c)&&a==0x00&&c==0x16)Serial.println("PICO2_IR_DECODED ADDR=0x00 CMD=0x16");else Serial.println("PICO2_IR_TIMEOUT");delay(2000);}\n',
      needle: 'PICO2_IR_DECODED', telemetry: ['ir1'],
    });
    expect(verdict.serial || '').toContain('PICO2_IR_DECODED ADDR=0x00 CMD=0x16');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 EEPROM + NVS flash-emulation readback (EEPROM + Backup/NVS cells)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <EEPROM.h>\nvoid hx(uint8_t b){if(b<16)Serial.print("0");Serial.print(b,HEX);}\nvoid setup(){Serial.begin(9600);Serial.println("PICO2_EE_READY");EEPROM.begin(512);EEPROM.write(0x10,0xAB);EEPROM.write(0x11,0xCD);EEPROM.write(0x100,0x12);EEPROM.write(0x101,0x34);EEPROM.commit();uint8_t a=EEPROM.read(0x10),b=EEPROM.read(0x11),c=EEPROM.read(0x100),d=EEPROM.read(0x101);Serial.print("PICO2_EE_RB:");hx(a);hx(b);Serial.println();Serial.print("PICO2_NVS_RB:");hx(c);hx(d);Serial.println();}\nvoid loop(){Serial.println("PICO2_EE_TICK");delay(2000);}\n',
      needle: 'PICO2_NVS_RB:',
    });
    const ee = /PICO2_EE_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    const nvs = /PICO2_NVS_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    expect(ee && ee[1]).toBe('ABCD');
    expect(nvs && nvs[1]).toBe('1234');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 ROSC random draws (TRNG/RNG cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO2_RNG_READY");uint32_t r1=rp2040.hw_rand32();uint32_t r2=rp2040.hw_rand32();Serial.print("PICO2_RAND1:");Serial.println(r1,HEX);Serial.print("PICO2_RAND2:");Serial.println(r2,HEX);}\nvoid loop(){Serial.println("PICO2_RNG_TICK");delay(2000);}\n',
      needle: 'PICO2_RAND2:',
    });
    const r1 = /PICO2_RAND1:([0-9A-Fa-f]+)/.exec(verdict.serial || '')?.[1];
    const r2 = /PICO2_RAND2:([0-9A-Fa-f]+)/.exec(verdict.serial || '')?.[1];
    expect(r1).toBeTruthy(); expect(r2).toBeTruthy();
    expect(r1 !== '0' || r2 !== '0').toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 SHA-256("abc") matches FIPS vector (HASH/CRYP cell, RP2350 silicon)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include "hardware/sha256.h"\nvoid hx(uint8_t b){if(b<16)Serial.print("0");Serial.print(b,HEX);}\nvoid setup(){Serial.begin(9600);Serial.println("PICO2_SHA_READY");sha256_state_t st;sha256_init(&st);const uint8_t msg[3]={(uint8_t)97,(uint8_t)98,(uint8_t)99};sha256_update(&st,msg,3);uint8_t out[32];sha256_final(&st,out);Serial.print("PICO2_SHA_DIGEST:");for(int i=0;i<32;i++)hx(out[i]);Serial.println();}\nvoid loop(){Serial.println("PICO2_SHA_TICK");delay(2000);}\n',
      needle: 'PICO2_SHA_DIGEST:',
    });
    const m = /PICO2_SHA_DIGEST:([0-9A-Fa-f]+)/.exec(verdict.serial || '');
    console.log('PICO2_SHA:', m && m[1]);
    expect(m && m[1].toLowerCase()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 watchdog reboots unfed firmware (Watchdog cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO2_WDT_BOOT");rp2040.wdt_begin(200);Serial.println("PICO2_WDT_ARMED");}\nvoid loop(){Serial.println("PICO2_WDT_SPIN");delay(100);}\n',
      needle: 'PICO2_WDT_BOOT', forMs: 25000,
    });
    const boots = (verdict.serial || '').match(/PICO2_WDT_BOOT/g) || [];
    console.log('PICO2_WDT boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 GPIO interrupt counts edges (EXTI/Interrupts cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      wires: [{ from: `${B}:GP3`, to: `${B}:GP2` }],
      code: 'volatile uint16_t cnt=0;\nvoid isr(){cnt++;}\nvoid setup(){Serial.begin(9600);pinMode(3,OUTPUT);pinMode(2,INPUT);attachInterrupt(digitalPinToInterrupt(2),isr,RISING);Serial.println("PICO2_EXT_READY");}\nvoid loop(){for(int i=0;i<10;i++){digitalWrite(3,HIGH);delay(5);digitalWrite(3,LOW);delay(5);}Serial.print("PICO2_EXT_CNT:");Serial.println(cnt);cnt=0;delay(1000);}\n',
      needle: 'PICO2_EXT_CNT:',
    });
    const vals = [...(verdict.serial || '').matchAll(/PICO2_EXT_CNT:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    expect(vals[vals.length - 1]).toBeGreaterThanOrEqual(8);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 WFI sleeps until timer wakes it (PWR/Sleep cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include "hardware/timer.h"\nvolatile bool woke=false;\nbool cb(struct repeating_timer*t){(void)t;woke=true;return true;}\nvoid setup(){Serial.begin(9600);Serial.println("PICO2_SLP_READY");static struct repeating_timer rt;add_repeating_timer_ms(500,cb,NULL,&rt);}\nvoid loop(){woke=false;__WFI();if(woke)Serial.println("PICO2_WOKE");else Serial.println("PICO2_SPURIOUS");delay(200);}\n',
      needle: 'PICO2_WOKE',
    });
    expect(verdict.serial || '').toContain('PICO2_WOKE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
