import { test, expect } from '@playwright/test';

// GD32 bring-up: second wave for all three GD32 board types. Verbatim
// mirror of the stm32f1-maple-cb-2 cells (SoftwareSerial TX/RX loopback on
// PB7->PB6, DS1307 RTC set/read over I2C1, DHT22 single-wire read on PB0,
// bxCAN silent loopback via guest MMIO): same F103-class silicon, same
// runner paths, identical pin shells — board ids only, no runner changes.
// NOTE: DHT paths are owned by a separate hunt; a GD32 DHT failure is
// reported as evidence, not debugged here.
const TYPES = [
  { tag: 'GC8', type: 'openhw-stm32-gd32f103c8' },
  { tag: 'GCB', type: 'openhw-stm32-gd32f103cb' },
  { tag: 'GRB', type: 'openhw-stm32-gd32f103rb' },
];

const SS_CODE = '#include <SoftwareSerial.h>\nSoftwareSerial soft(PB6,PB7);\nvoid setup(){Serial.begin(9600);Serial.println("SS_READY");soft.begin(9600);}\nvoid loop(){soft.write(83);delay(50);if(soft.available()){Serial.print("SS_RX:");Serial.println((char)soft.read());}delay(500);}\n';

const RTC_CODE = '#include <Wire.h>\n#include <RTClib.h>\nRTC_DS1307 rtc;\nvoid setup(){Serial.begin(9600);Serial.println("RTC_READY");Wire.begin();rtc.begin();rtc.adjust(DateTime(2026,10,7,12,0,0));}\nvoid loop(){DateTime n=rtc.now();Serial.print("RTC_NOW:");Serial.print(n.hour());Serial.print(":");Serial.print(n.minute());Serial.print(":");Serial.println(n.second());delay(1000);}\n';

const DHT_CODE = '#include <DHT.h>\n#define DHTPIN PB0\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("DHT_READ DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n';

const CAN_CODE = '#include <Arduino.h>\n// F1 bxCAN native loopback cell (Blue Pill): register-level driver, no lib.\n// CAN1 silent-loopback (LBKM+SILM): TX mailbox 0 -> own RX FIFO0 through\n// the accept-all filter. Proves MCR/MSR init, BTR, filters, TX completion\n// (TSR RQCP0) and RX FIFO (RF0R FMP0 + RI/RD regs) on real silicon regs.\n#define CAN1_BASE 0x40006400UL\n#define CAN_MCR   (*(volatile uint32_t*)(CAN1_BASE+0x00))\n#define CAN_MSR   (*(volatile uint32_t*)(CAN1_BASE+0x04))\n#define CAN_TSR   (*(volatile uint32_t*)(CAN1_BASE+0x08))\n#define CAN_RF0R  (*(volatile uint32_t*)(CAN1_BASE+0x0C))\n#define CAN_BTR   (*(volatile uint32_t*)(CAN1_BASE+0x1C))\n#define CAN_TI0R  (*(volatile uint32_t*)(CAN1_BASE+0x180))\n#define CAN_TDT0R (*(volatile uint32_t*)(CAN1_BASE+0x184))\n#define CAN_TDL0R (*(volatile uint32_t*)(CAN1_BASE+0x188))\n#define CAN_TDH0R (*(volatile uint32_t*)(CAN1_BASE+0x18C))\n#define CAN_RI0R  (*(volatile uint32_t*)(CAN1_BASE+0x1B0))\n#define CAN_RDT0R (*(volatile uint32_t*)(CAN1_BASE+0x1B4))\n#define CAN_RDL0R (*(volatile uint32_t*)(CAN1_BASE+0x1B8))\n#define CAN_RDH0R (*(volatile uint32_t*)(CAN1_BASE+0x1BC))\n#define CAN_FMR   (*(volatile uint32_t*)(CAN1_BASE+0x200))\n#define CAN_FS1R  (*(volatile uint32_t*)(CAN1_BASE+0x20C))\n#define CAN_FA1R  (*(volatile uint32_t*)(CAN1_BASE+0x21C))\n#define CAN_F0R1  (*(volatile uint32_t*)(CAN1_BASE+0x240))\n#define CAN_F0R2  (*(volatile uint32_t*)(CAN1_BASE+0x244))\n#define RCC_APB1ENR (*(volatile uint32_t*)0x4002101CUL)\n\nstatic bool canOk = false;\n\nstatic bool canInit() {\n  RCC_APB1ENR |= (1UL<<25);\n  CAN_MCR &= ~(1UL<<1); // leave sleep\n  CAN_MCR |= 0x1; // INRQ\n  unsigned long to = 0;\n  while (!(CAN_MSR & 0x1) && ++to < 200000) {} // INAK\n  if (!(CAN_MSR & 0x1)) return false;\n  CAN_BTR = (1UL<<31)|(1UL<<30)|(2UL<<20)|(11UL<<16)|3UL; // SILM+LBKM, ~560k\n  CAN_FMR |= 0x1; // FINIT\n  CAN_FS1R |= 0x1; // bank0 32-bit scale\n  // Exact-ID 32-bit mask for STDID 0x123 (textbook single-ID filter:\n  // STID compare on bits 31:21, IDE/RTR/EXID don\'t-care). Engine note:\n  // can.rs reads scale/mode crossed (FM1R<->FS1R vs RM0008), so this\n  // also lands as a 16-bit list hit on id2 — same bytes, both match.\n  CAN_F0R1 = (0x123UL<<21)|0x123UL; CAN_F0R2 = 0xFFE00000UL;\n  CAN_FA1R |= 0x1; // activate bank0\n  CAN_FMR &= ~0x1;\n  CAN_MCR &= ~0x1; // normal mode\n  to = 0;\n  while ((CAN_MSR & 0x1) && ++to < 200000) {}\n  return !(CAN_MSR & 0x1);\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("CAN_READY");\n  canOk = canInit();\n  Serial.println(canOk ? "CAN_INIT_OK" : "CAN_INIT_FAIL");\n}\n\nvoid loop() {\n  if (!canOk) { delay(2000); return; }\n  unsigned long to = 0;\n  while (!(CAN_TSR & (1UL<<26)) && ++to < 200000) {} // TME0\n  CAN_TI0R = (0x123UL<<21);\n  CAN_TDT0R = 8;\n  CAN_TDL0R = 0x03020100UL; CAN_TDH0R = 0x07060504UL;\n  CAN_TI0R |= 0x1; // TXRQ\n  to = 0;\n  while (!(CAN_TSR & 0x1) && ++to < 500000) {} // RQCP0\n  bool txok = (CAN_TSR & 0x1) != 0;\n  CAN_TSR = 0x1; // W1C RQCP0\n  to = 0;\n  while (!(CAN_RF0R & 0x3) && ++to < 500000) {} // FMP0\n  bool rxok = (CAN_RF0R & 0x3) != 0;\n  uint32_t id = 0, dlc = 0, d0 = 0, d1 = 0;\n  if (rxok) {\n    id = (CAN_RI0R>>21)&0x7FF;\n    dlc = CAN_RDT0R & 0xF;\n    d0 = CAN_RDL0R; d1 = CAN_RDH0R;\n    CAN_RF0R |= (1UL<<5); // RFOM0\n  }\n  Serial.print("CAN_LOOP TX:");\n  Serial.print(txok ? 1 : 0);\n  Serial.print(" RX:");\n  Serial.print(rxok ? 1 : 0);\n  Serial.print(" ID:");\n  Serial.print(id, HEX);\n  Serial.print(" DLC:");\n  Serial.print(dlc);\n  Serial.print(" D0:");\n  Serial.print(d0, HEX);\n  Serial.print(" D1:");\n  Serial.println(d1, HEX);\n  delay(2000);\n}\n';

test.describe('GD32 second wave (softserial/RTC/DHT/CAN)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type } of TYPES) {
    test(`SoftwareSerial loopback (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [
          { from: 'gd1:PB7', to: 'gd1:PB6' },
        ],
        code,
      }), { t: type, code: SS_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'SS_RX:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}SS reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('SS_RX:S');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`DS1307 set/read over I2C1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
          { id: 'rtc1', type: 'openhw-ds1307-rtc', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'gd1:PB7', to: 'rtc1:SDA' },
          { from: 'gd1:PB6', to: 'rtc1:SCL' },
          { from: 'gd1:SWD_3V3', to: 'rtc1:VCC' },
          { from: 'gd1:SWD_GND', to: 'rtc1:GND' },
        ],
        code,
      }), { t: type, code: RTC_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'RTC_NOW:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}RTC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const stamps = [...(verdict.serial || '').matchAll(/RTC_NOW:(\d+):(\d+):(\d+)/g)];
      expect(stamps.length).toBeGreaterThan(1);
      expect(Number(stamps[0][1])).toBe(12);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`DHT22 temp + humidity (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
          { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'gd1:PB0', to: 'dht1:DATA' },
          { from: 'gd1:3V3.1', to: 'dht1:VCC' },
          { from: 'gd1:GND.1', to: 'dht1:GND' },
        ],
        code,
      }), { t: type, code: DHT_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, selectTelemetry: ['dht1'], serialNeedle: 'DHT_READ', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}DHT reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const m = /DHT_T:([0-9.\-]+) DHT_H:([0-9.\-]+)/.exec(verdict.serial || '');
      console.log(`${tag}DHT values:`, m ? m.slice(1) : 'NONE');
      expect(m).toBeTruthy();
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`bxCAN silent loopback (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: CAN_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: 'CAN_LOOP', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}CAN verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const m = /CAN_LOOP TX:1 RX:1 ID:123 DLC:8 D0:3020100 D1:7060504/.exec(verdict.serial || '');
      console.log(`${tag}CAN exact:`, m ? 'YES' : 'NO');
      expect(m).toBeTruthy();
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
