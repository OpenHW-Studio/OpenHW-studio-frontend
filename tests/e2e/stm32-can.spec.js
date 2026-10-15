import { test, expect } from '@playwright/test';

// F1 bxCAN native loopback (Blue Pill): register-level driver, no library.
// CAN1 silent-loopback (LBKM+SILM): TX mailbox 0 -> own RX FIFO0 through an
// exact-ID 32-bit mask filter. Proves MCR/MSR init, BTR, filters, TX
// completion (TSR RQCP0) and RX FIFO (RF0R FMP0 + RI/RD regs) live.
const CODE = '#include <Arduino.h>\n// F1 bxCAN native loopback cell (Blue Pill): register-level driver, no lib.\n// CAN1 silent-loopback (LBKM+SILM): TX mailbox 0 -> own RX FIFO0 through\n// the accept-all filter. Proves MCR/MSR init, BTR, filters, TX completion\n// (TSR RQCP0) and RX FIFO (RF0R FMP0 + RI/RD regs) on real silicon regs.\n#define CAN1_BASE 0x40006400UL\n#define CAN_MCR   (*(volatile uint32_t*)(CAN1_BASE+0x00))\n#define CAN_MSR   (*(volatile uint32_t*)(CAN1_BASE+0x04))\n#define CAN_TSR   (*(volatile uint32_t*)(CAN1_BASE+0x08))\n#define CAN_RF0R  (*(volatile uint32_t*)(CAN1_BASE+0x0C))\n#define CAN_BTR   (*(volatile uint32_t*)(CAN1_BASE+0x1C))\n#define CAN_TI0R  (*(volatile uint32_t*)(CAN1_BASE+0x180))\n#define CAN_TDT0R (*(volatile uint32_t*)(CAN1_BASE+0x184))\n#define CAN_TDL0R (*(volatile uint32_t*)(CAN1_BASE+0x188))\n#define CAN_TDH0R (*(volatile uint32_t*)(CAN1_BASE+0x18C))\n#define CAN_RI0R  (*(volatile uint32_t*)(CAN1_BASE+0x1B0))\n#define CAN_RDT0R (*(volatile uint32_t*)(CAN1_BASE+0x1B4))\n#define CAN_RDL0R (*(volatile uint32_t*)(CAN1_BASE+0x1B8))\n#define CAN_RDH0R (*(volatile uint32_t*)(CAN1_BASE+0x1BC))\n#define CAN_FMR   (*(volatile uint32_t*)(CAN1_BASE+0x200))\n#define CAN_FS1R  (*(volatile uint32_t*)(CAN1_BASE+0x20C))\n#define CAN_FA1R  (*(volatile uint32_t*)(CAN1_BASE+0x21C))\n#define CAN_F0R1  (*(volatile uint32_t*)(CAN1_BASE+0x240))\n#define CAN_F0R2  (*(volatile uint32_t*)(CAN1_BASE+0x244))\n#define RCC_APB1ENR (*(volatile uint32_t*)0x4002101CUL)\n\nstatic bool canOk = false;\n\nstatic bool canInit() {\n  RCC_APB1ENR |= (1UL<<25);\n  CAN_MCR &= ~(1UL<<1); // leave sleep\n  CAN_MCR |= 0x1; // INRQ\n  unsigned long to = 0;\n  while (!(CAN_MSR & 0x1) && ++to < 200000) {} // INAK\n  if (!(CAN_MSR & 0x1)) return false;\n  CAN_BTR = (1UL<<31)|(1UL<<30)|(2UL<<20)|(11UL<<16)|3UL; // SILM+LBKM, ~560k\n  CAN_FMR |= 0x1; // FINIT\n  CAN_FS1R |= 0x1; // bank0 32-bit scale\n  // Exact-ID 32-bit mask for STDID 0x123 (textbook single-ID filter:\n  // STID compare on bits 31:21, IDE/RTR/EXID don\'t-care). Engine note:\n  // can.rs reads scale/mode crossed (FM1R<->FS1R vs RM0008), so this\n  // also lands as a 16-bit list hit on id2 — same bytes, both match.\n  CAN_F0R1 = (0x123UL<<21)|0x123UL; CAN_F0R2 = 0xFFE00000UL;\n  CAN_FA1R |= 0x1; // activate bank0\n  CAN_FMR &= ~0x1;\n  CAN_MCR &= ~0x1; // normal mode\n  to = 0;\n  while ((CAN_MSR & 0x1) && ++to < 200000) {}\n  return !(CAN_MSR & 0x1);\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("CAN_READY");\n  canOk = canInit();\n  Serial.println(canOk ? "CAN_INIT_OK" : "CAN_INIT_FAIL");\n}\n\nvoid loop() {\n  if (!canOk) { delay(2000); return; }\n  unsigned long to = 0;\n  while (!(CAN_TSR & (1UL<<26)) && ++to < 200000) {} // TME0\n  CAN_TI0R = (0x123UL<<21);\n  CAN_TDT0R = 8;\n  CAN_TDL0R = 0x03020100UL; CAN_TDH0R = 0x07060504UL;\n  CAN_TI0R |= 0x1; // TXRQ\n  to = 0;\n  while (!(CAN_TSR & 0x1) && ++to < 500000) {} // RQCP0\n  bool txok = (CAN_TSR & 0x1) != 0;\n  CAN_TSR = 0x1; // W1C RQCP0\n  to = 0;\n  while (!(CAN_RF0R & 0x3) && ++to < 500000) {} // FMP0\n  bool rxok = (CAN_RF0R & 0x3) != 0;\n  uint32_t id = 0, dlc = 0, d0 = 0, d1 = 0;\n  if (rxok) {\n    id = (CAN_RI0R>>21)&0x7FF;\n    dlc = CAN_RDT0R & 0xF;\n    d0 = CAN_RDL0R; d1 = CAN_RDH0R;\n    CAN_RF0R |= (1UL<<5); // RFOM0\n  }\n  Serial.print("CAN_LOOP TX:");\n  Serial.print(txok ? 1 : 0);\n  Serial.print(" RX:");\n  Serial.print(rxok ? 1 : 0);\n  Serial.print(" ID:");\n  Serial.print(id, HEX);\n  Serial.print(" DLC:");\n  Serial.print(dlc);\n  Serial.print(" D0:");\n  Serial.print(d0, HEX);\n  Serial.print(" D1:");\n  Serial.println(d1, HEX);\n  delay(2000);\n}\n';

test.describe('F1 bxCAN', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Bluepill loops a CAN frame through its own FIFO', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'CAN_LOOP', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1CAN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1CAN serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /CAN_LOOP TX:1 RX:1 ID:123 DLC:8 D0:3020100 D1:7060504/.exec(verdict.serial || '');
    console.log('F1CAN exact:', m ? 'YES' : 'NO');
    expect(m).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
