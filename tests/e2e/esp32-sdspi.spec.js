import { test, expect } from '@playwright/test';

// ESP32 SD-SPI (DevKit VSPI -> openhw-sd-card): raw 512-byte block write
// (CMD24) + read-back (CMD17) with byte-exact compare. Same recipe as the
// F4 SD cell, re-pinned to VSPI (SCK 18 / MISO 19 / MOSI 23 / CS 5) over
// the shared SPI bridge (pollSpiTx buses 2/3). No SdFat: raw block-RW is
// the proven item. No runner change.
const CODE = '#include <SPI.h>\nuint8_t X(uint8_t b){return SPI.transfer(b);}\nuint8_t cmd(uint8_t i,uint32_t a,uint8_t c){X(0x40|i);X(a>>24);X(a>>16);X(a>>8);X(a);uint8_t r=X(c);for(int k=0;k<64&&r==0xFF;k++)r=X(0xFF);return r;}\nvoid setup(){Serial.begin(115200);Serial.println("SD_READY");pinMode(5,OUTPUT);digitalWrite(5,HIGH);SPI.begin();SPI.beginTransaction(SPISettings(250000,MSBFIRST,SPI_MODE0));digitalWrite(5,HIGH);for(int i=0;i<10;i++)X(0xFF);digitalWrite(5,LOW);X(0xFF);delay(5);\nuint8_t r=0xFF;for(int t=0;t<10&&r==0xFF;t++){r=cmd(0,0,0x95);if(r==0xFF){digitalWrite(5,HIGH);X(0xFF);digitalWrite(5,LOW);X(0xFF);}}Serial.print("R0:");Serial.println(r,HEX);\nr=cmd(8,0x1AA,0x87);Serial.print("R8:");Serial.println(r,HEX);for(int i=0;i<4;i++){Serial.print(X(0xFF),HEX);Serial.print(" ");}Serial.println("");\nfor(int t=0;t<100;t++){cmd(55,0,0xFF);r=cmd(41,0x40000000,0xFF);if(r==0)break;}Serial.print("R41:");Serial.println(r,HEX);\nr=cmd(58,0,0xFF);Serial.print("R58:");Serial.println(r,HEX);for(int i=0;i<4;i++)X(0xFF);digitalWrite(5,HIGH);X(0xFF);Serial.println("SD_INIT");\ndigitalWrite(5,LOW);r=cmd(24,1,0xFF);Serial.print("R24:");Serial.println(r,HEX);X(0xFF);X(0xFE);for(int i=0;i<512;i++)X(i&0xFF);X(0xFF);X(0xFF);uint8_t dr=0xFF;for(int k=0;k<64&&dr==0xFF;k++)dr=X(0xFF);Serial.print("DR:");Serial.println(dr,HEX);while(X(0xFF)==0)X(0xFF);digitalWrite(5,HIGH);X(0xFF);Serial.println("SD_WROTE");\ndigitalWrite(5,LOW);r=cmd(17,1,0xFF);Serial.print("R17:");Serial.println(r,HEX);uint8_t tok=0xFF;for(int k=0;k<1000&&tok==0xFF;k++)tok=X(0xFF);Serial.print("TOK:");Serial.println(tok,HEX);int bad=0;if(tok==0xFE){for(int i=0;i<512;i++){uint8_t b=X(0xFF);if(b!=(i&0xFF))bad++;}X(0xFF);X(0xFF);}else bad=9999;digitalWrite(5,HIGH);X(0xFF);Serial.print("SD_BAD:");Serial.println(bad);Serial.println("SD_DONE");}\nvoid loop(){delay(1000);}\n';

test.describe('ESP32 SD card (devkit VSPI)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('writes and reads back a raw block', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'sd1', type: 'openhw-sd-card', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:23', to: 'sd1:MOSI' },
        { from: 'esp1:19', to: 'sd1:MISO' },
        { from: 'esp1:18', to: 'sd1:SCK' },
        { from: 'esp1:5', to: 'sd1:CS' },
        { from: 'esp1:3V3', to: 'sd1:VCC' },
        { from: 'esp1:GND.1', to: 'sd1:GND' },
        { from: 'esp1:GND.2', to: 'sd1:CD' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['sd1'], serialNeedle: 'SD_DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPSD verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPSD serial:', (verdict.serial || '').slice(0, 500));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SD_BAD:0');
    expect(verdict.serial || '').toContain('SD_DONE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
