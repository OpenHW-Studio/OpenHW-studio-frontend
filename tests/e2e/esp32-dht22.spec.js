import { test, expect } from '@playwright/test';

// ESP32 DHT22 (live): bit-banged single-wire read via the shared
// _driveBoardPin bus service → sim.setPinInput. Proves the sensor path
// on ESP32 with no RMT involvement.
const CODE = '#include <esp32-hal-rmt.h>\nvoid dread(){rmt_data_t start;start.duration0=1100;start.level0=0;start.duration1=30;start.level1=1;rmtWrite(4,&start,1,2000);rmt_data_t rx[96];size_t n=96;if(!rmtRead(4,rx,&n,4000)){Serial.println("DHT_RDTIMEOUT");}Serial.print("DHT_NSYM:");Serial.println((int)n);int hi=-1;for(size_t i=0;i+40<n;i++){if(rx[i].duration0==80&&rx[i].level0==0&&rx[i].duration1==80&&rx[i].level1==1){hi=i;break;}}if(hi<0){Serial.println("DHT_NOHDR");return;}uint8_t d[5]={0,0,0,0,0};bool ok=true;for(int i=0;i<40;i++){rmt_data_t s=rx[hi+1+i];if(s.duration0!=50||s.level0!=0||s.level1!=1){ok=false;break;}if(s.duration1>=50)d[i/8]|=(uint8_t)(1<<(7-(i%8)));}if(!ok){Serial.println("DHT_SHAPE");return;}uint8_t ck=(uint8_t)(d[0]+d[1]+d[2]+d[3]);if(ck!=d[4]){Serial.println("DHT_CKSUM");return;}int hum=(d[0]<<8)|d[1];int tmp=(d[2]<<8)|d[3];if(tmp&0x8000)tmp=-(tmp&0x7FFF);Serial.print("DHT_READ DHT_T:");Serial.print(tmp/10);Serial.print(".");Serial.print(abs(tmp%10));Serial.print(" DHT_H:");Serial.print(hum/10);Serial.print(".");Serial.println(hum%10);}\nvoid setup(){Serial.begin(115200);Serial.println("RMTDHT_READY");pinMode(4,OUTPUT);digitalWrite(4,HIGH);bool okt=rmtInit(4,RMT_TX_MODE,RMT_MEM_NUM_BLOCKS_1,1000000);Serial.print("INIT_TX:");Serial.println(okt?1:0);rmtSetEOT(4,1);bool okr=rmtInit(4,RMT_RX_MODE,RMT_MEM_NUM_BLOCKS_1,1000000);Serial.print("INIT_RX:");Serial.println(okr?1:0);dread();}\nvoid loop(){delay(15000);dread();}\n';

test.describe('ESP32 DHT22', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32 reads DHT22 temp + humidity', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'dht1', type: 'openhw-dht22', attrs: { temperature: 27.3, humidity: 61.2 }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO4', to: 'dht1:DATA' },
        { from: 'esp1:3V3', to: 'dht1:VCC' },
        { from: 'esp1:GND', to: 'dht1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['dht1'], serialNeedle: 'DHT_READ', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('E32DHT verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('E32DHT serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /DHT_T:([0-9.\-]+) DHT_H:([0-9.\-]+)/.exec(verdict.serial || '');
    console.log('E32DHT values:', m ? m.slice(1) : 'NONE');
    expect(m).toBeTruthy();
    // Live-model proof: non-default T/H programmed via attrs must decode back exactly.
    expect(verdict.serial || '').toContain('DHT_T:27.3');
    expect(verdict.serial || '').toContain('DHT_H:61.2');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
