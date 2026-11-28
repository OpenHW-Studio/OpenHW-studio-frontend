import { test, expect } from '@playwright/test';

// Modbus RTU master<->slave across TWO Arduino Unos (live, real library).
// Link: SoftwareSerial (RX=11/TX=10) cross-wired between boards
//   uno1:10 -> uno2:11  (master TX -> slave RX)
//   uno2:10 -> uno1:11  (slave TX -> master RX)
// plus shared GND. Hardware Serial stays the needle/monitor path.
// Master (uno1) uses the REAL ModbusMaster Arduino library (v2.0.1,
// env-level) to read 2 holding registers from slave address 1.
// Slave (uno2) is a minimal hand-rolled Modbus RTU slave (addr 1,
// func 0x03, CRC-16/Modbus) serving known values:
//   reg0 = 43981 (0xABCD), reg1 = 12345 (0x3039).
// Proof: master prints MB_OK_43981_12345; slave prints SLV_SENT_43981_12345.
// NOTE: firmware was authored behind MASTER/SLAVE placeholders
// and injected via python3 (chr(92) backslash-safe escaping); hexdump-verified.
// committed file below carries the injected, hexdump-verified bytes.
const MASTER_CODE = '#include <ModbusMaster.h>\nModbusMaster node;\nvoid setup(){Serial.begin(9600);Serial.println("MB_MASTER_READY");node.begin(1,Serial);}\nvoid loop(){uint8_t rc=node.readHoldingRegisters(0,2);Serial.print("MB_RC=");Serial.println(rc);if(rc==ModbusMaster::ku8MBSuccess){uint16_t v0=node.getResponseBuffer(0);uint16_t v1=node.getResponseBuffer(1);Serial.print("MB_OK_");Serial.print(v0);Serial.print("_");Serial.println(v1);}delay(1500);}\n';
const SLAVE_CODE = 'const uint16_t REG0=43981;\nconst uint16_t REG1=12345;\nuint8_t sbuf[24];uint8_t slen=0;\nuint16_t mbcrc(uint8_t *b,uint8_t n){uint16_t c=0xFFFF;for(uint8_t i=0;i<n;i++){c^=b[i];for(uint8_t j=0;j<8;j++){if(c&1)c=(c>>1)^0xA001;else c>>=1;}}return c;}\nvoid setup(){Serial.begin(9600);Serial.println("MB_SLAVE_READY");}\nvoid loop(){while(Serial.available()>0&&slen<24){sbuf[slen++]=Serial.read();}bool progress=true;while(progress&&slen>=8){progress=false;int at=-1;for(int i=0;i+7<slen;i++){if(sbuf[i]==1&&sbuf[i+1]==0x03){uint16_t c=mbcrc(sbuf+i,6);uint16_t g=sbuf[i+6]|(((uint16_t)sbuf[i+7])<<8);if(c==g){at=i;break;}}}if(at<0){if(slen>16){for(int i=0;i<slen-8;i++)sbuf[i]=sbuf[i+8];slen-=8;progress=true;}break;}uint16_t st=(((uint16_t)sbuf[at+2])<<8)|sbuf[at+3];uint16_t qt=(((uint16_t)sbuf[at+4])<<8)|sbuf[at+5];if(st==0&&qt==2){uint8_t r[9];r[0]=1;r[1]=0x03;r[2]=4;r[3]=REG0>>8;r[4]=REG0&0xFF;r[5]=REG1>>8;r[6]=REG1&0xFF;uint16_t rc2=mbcrc(r,7);r[7]=rc2&0xFF;r[8]=rc2>>8;for(int i=0;i<9;i++)Serial.write(r[i]);Serial.println("SLV_GOT_FRAME");Serial.println("SLV_VALID_REQ");Serial.println("SLV_SENT_43981_12345");}int keep=slen-(at+8);for(int i=0;i<keep;i++)sbuf[i]=sbuf[at+8+i];slen=keep;progress=true;}delay(20);}\n';

test.describe('AVR Modbus RTU (two Unos, SoftwareSerial link)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('master reads holding regs from slave over SoftwareSerial', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'uno2', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 320 },
      ],
      wires: [
        { from: 'uno1:1', to: 'uno2:0' },
        { from: 'uno2:1', to: 'uno1:0' },
        { from: 'uno1:gnd_1', to: 'uno2:gnd_1' },
      ],
      code,
    }), MASTER_CODE);
    expect(setup.ok).toBe(true);
    expect(setup.wires).toBe(3);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { uno2: code },
    }), SLAVE_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, serialNeedle: 'MB_OK_43981_12345', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    const serial = verdict.serial || '';
    console.log('MODBUS verdict pass:', verdict.pass, 'reasons:', JSON.stringify(verdict.reasons || []));
    console.log('MODBUS serial lines:', verdict.serialLines);
    const rcLines = serial.split('\n').filter((l) => l.includes('MB_RC='));
    console.log('MODBUS MB_RC samples:', JSON.stringify(rcLines.slice(0, 10)));
    console.log('MODBUS serial tail:', JSON.stringify(serial.slice(-600)));
    expect(verdict.pass).toBe(true);
    expect(serial).toContain('MB_MASTER_READY');
    expect(serial).toContain('MB_SLAVE_READY');
    expect(serial).toContain('SLV_SENT_43981_12345');
    expect(serial).toContain('MB_OK_43981_12345');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
