import { test, expect } from '@playwright/test';

// F1 USB-FS device (bluepill) — STAGED: requires stm32-patches.md P2 (F1
// USB host driver) before it can pass. Narrow claim by design: the
// CONTROL PLANE only — bus reset, GET_DESCRIPTOR device/config/lang,
// SET_ADDRESS (deferred DADDR), SET_CONFIGURATION. No bulk echo (CDC
// data phase is a follow-up cell). Guest is a register-level CDC-ACM
// control endpoint (no Arduino USB stack exists for F1): RCC USBEN,
// BTABLE/PMA programming, CTRM+RESETM arm, ISTR poll, RESET handling,
// EP0 SETUP dispatch with 64B-chunked IN + status-OUT, STALL on unknown.
// The runner plays host (bus reset, setup injects, IN takes) and reports
// USB_HOST:PASS + sink state, mirroring the F4 USB cell's proof triangle:
// guest markers + host-observed bytes + liveOop sink.
const CODE = '#include <Arduino.h>\n#define USB_BASE 0x40005C00UL\n#define USB_EP0R (*(volatile uint32_t*)(USB_BASE+0x00))\n#define USB_EP1R (*(volatile uint32_t*)(USB_BASE+0x04))\n#define USB_CNTR (*(volatile uint32_t*)(USB_BASE+0x40))\n#define USB_ISTR (*(volatile uint32_t*)(USB_BASE+0x44))\n#define USB_DADDR (*(volatile uint32_t*)(USB_BASE+0x4C))\n#define USB_BTABLE (*(volatile uint32_t*)(USB_BASE+0x50))\n#define PMA_BASE 0x40006000UL\n#define RCC_APB1ENR (*(volatile uint32_t*)0x4002101CUL)\nstatic inline void pmaW(uint32_t o, uint16_t v){(*(volatile uint16_t*)(PMA_BASE+o))=v;}\nstatic inline uint16_t pmaR(uint32_t o){return (*(volatile uint16_t*)(PMA_BASE+o));}\nstatic inline void pmaWB(uint32_t o, uint8_t v){(*(volatile uint8_t*)(PMA_BASE+o))=v;}\nstatic inline uint8_t pmaRB(uint32_t o){return (*(volatile uint8_t*)(PMA_BASE+o));}\nstatic void pmaWrite(uint32_t w, const uint8_t *b, int n){for(int i=0;i<n;i++){pmaWB(w*2+(i>>1)*4+(i&1),b[i]);}}\nstatic void pmaRead(uint32_t w, uint8_t *b, int n){for(int i=0;i<n;i++){b[i]=pmaRB(w*2+(i>>1)*4+(i&1));}}\nstatic const uint8_t DEV_DESC[18]={0x12,0x01,0x00,0x02,0x02,0x00,0x00,0x40,0x83,0x04,0x40,0x57,0x00,0x02,0x01,0x02,0x00,0x01};\nstatic const uint8_t CFG_DESC[67]={0x09,0x02,0x43,0x00,0x02,0x01,0x00,0xC0,0x32,0x09,0x04,0x00,0x00,0x01,0x02,0x02,0x01,0x00,0x05,0x24,0x00,0x10,0x01,0x05,0x24,0x01,0x00,0x01,0x04,0x24,0x02,0x02,0x05,0x24,0x06,0x00,0x01,0x07,0x05,0x83,0x03,0x08,0x00,0x0A,0x09,0x04,0x01,0x00,0x02,0x0A,0x00,0x00,0x00,0x07,0x05,0x01,0x02,0x40,0x00,0x00,0x07,0x05,0x82,0x02,0x40,0x00,0x00};\nstatic const uint8_t LANG_DESC[4]={0x04,0x03,0x09,0x04};\nstatic void txValid(){ uint32_t e=USB_EP0R; uint32_t cur=(e>>4)&3UL; USB_EP0R=(e&0x8080UL)|0x0200UL|(((cur^3UL)&3UL)<<4); }\nstatic void stallEp0(){ uint32_t e=USB_EP0R; uint32_t rx=(e>>12)&3, tx=(e>>4)&3; USB_EP0R=(e&0x8080UL)|0x0200UL|(((rx^1)&3)<<12)|(((tx^1)&3)<<4); }\nstatic const uint8_t *txPtr=0; static int txLen=0; static int txOff=0; static uint8_t pendAddr=0; static uint8_t waitAddr=0;\nstatic void txChunk(int first){ (void)first;\n  int n=txLen-txOff; if(n>64)n=64;\n  pmaWrite(0x40, txPtr+txOff, n);\n  pmaW(4, (uint16_t)n);\n  txValid();\n  txOff+=n;\n}\n\nstatic void handleSetup(const uint8_t *s){\n  uint8_t bm=s[0], bq=s[1], wvL=s[2], wvH=s[3], wLen=s[6]|((uint16_t)s[7]<<8);\n  txPtr=0; txLen=0; txOff=0; waitAddr=0;\n  if(bm==0x80 && bq==0x06){\n    if(wvH==1){ txPtr=DEV_DESC; txLen=18; }\n    else if(wvH==2){ txPtr=CFG_DESC; txLen=67; }\n    else if(wvH==3 && wvL==0){ txPtr=LANG_DESC; txLen=4; }\n    if(txPtr){ if(txLen>wLen)txLen=wLen; txChunk(1); return; }\n    stallEp0(); return;\n  }\n  if(bm==0x00 && bq==0x05){ pendAddr=wvL; waitAddr=1; txPtr=(const uint8_t*)""; txLen=0; txOff=0; pmaW(4,0); txValid(); return; }\n  if(bm==0x00 && bq==0x09){ txPtr=(const uint8_t*)""; txLen=0; txOff=0; pmaW(4,0); txValid(); waitAddr=2; return; }\n  stallEp0();\n}\nvoid setup(){\n  Serial.begin(9600);\n  Serial.println("F1USB_READY");\n  RCC_APB1ENR |= (1UL<<23);\n  USB_BTABLE = 0;\n  pmaW(0, 0x40); pmaW(4, 0); pmaW(8, 0xC0); pmaW(12, 0x8800);\n  pmaW(16, 0x100); pmaW(20, 0); pmaW(24, 0x140); pmaW(28, 0x8800);\n  USB_CNTR = (1UL<<15)|(1UL<<10);\n  Serial.println("USB init done");\n}\nvoid loop(){\n  uint32_t istr = USB_ISTR;\n  if(istr & (1UL<<10)){\n    USB_ISTR &= ~(1UL<<10);\n    USB_EP0R = 0x3200UL;\n    USB_EP1R = 0x3001UL;\n    txPtr=0; txLen=0; txOff=0; waitAddr=0;\n    Serial.println("USBRST");\n  }\n  if(istr & (1UL<<15)){\n    uint32_t ep = istr & 0xFUL;\n    uint32_t dir = (istr>>4) & 1UL;\n    if(ep==0){\n      uint32_t ep0 = USB_EP0R;\n      if(dir && (ep0 & 0x0800UL)){\n        uint8_t s[8]; pmaRead(0xC0, s, 8);\n        USB_EP0R = 0x0280UL;\n        handleSetup(s);\n      } else if(!dir && (ep0 & 0x80UL)){\n        USB_EP0R = 0x8200UL;\n        if(txOff < txLen){ txChunk(0); }\n        if(txOff >= txLen && txLen > 0){ txPtr=0; txLen=0; txOff=0; }\n        if(waitAddr==1 && txLen==0){ USB_DADDR = 0x80UL|pendAddr; waitAddr=0; }\n        if(waitAddr==2 && txLen==0){ waitAddr=0; Serial.println("USB enum done"); }\n      } else if(dir){\n        USB_EP0R = 0x0280UL;\n      }\n    }\n  }\n}\n';

test.describe('F1 USB-FS control-plane enumeration (STAGED, needs P2)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('bus reset + descriptors + address + config', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'usb1', type: 'openhw-usb-device', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:5V', to: 'usb1:VCC' },
        { from: 'bp1:GND.1', to: 'usb1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['usb1'], serialNeedle: 'USB enum done', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1USB reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1USB serial head:', (verdict.serial || '').slice(0, 500));
    console.log('F1USB liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.usb1));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('USB init done');
    expect(verdict.serial || '').toContain('USBRST');
    expect(verdict.serial || '').toContain('USB enum done');
    expect(verdict.serial || '').toContain('USB_HOST:PASS');
    const sink = (verdict.liveOop || {}).usb1;
    expect(sink).toBeTruthy();
    expect(String(sink.enumState)).toBe('enumerated');
    expect(Number(sink.rxCount)).toBeGreaterThanOrEqual(80);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
