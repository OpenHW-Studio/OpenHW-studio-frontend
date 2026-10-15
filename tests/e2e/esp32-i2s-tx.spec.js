import { test, expect } from '@playwright/test';

// ESP32 hardware-driven I2S TX → MAX98357 DAC (live): the ESP32 I2S
// peripheral streams 16-bit stereo frames (BCK 26 / WS 25 / DOUT 22); the
// runner's esp32-i2s-pump drains the engine I2S TX tap (armI2sTx +
// pollI2sTx DMA words) and feeds onI2SFrame, which drives OUT+/- analog +
// frame counters. Human-senses proof: non-zero audio frames decoded from
// real peripheral DMA (no bit-banging on ESP32). Same assertion shape as
// the green AVR cell in avr-i2s.spec.js.
const CODE = '#include <driver/i2s.h>\n\n#define I2S_BCK 26\n#define I2S_WS 25\n#define I2S_DOUT 22\n\nvoid sendFrame(uint16_t left, uint16_t right) {\n  uint16_t frame[2] = { left, right };\n  size_t written = 0;\n  i2s_write(I2S_NUM_0, (const char *)frame, sizeof(frame), &written, 1000 / portTICK_PERIOD_MS);\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  Serial.println("I2S_READY");\n  i2s_config_t cfg = {\n    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),\n    .sample_rate = 44100,\n    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,\n    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,\n    .communication_format = I2S_COMM_FORMAT_I2S,\n    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,\n    .dma_buf_count = 4,\n    .dma_buf_len = 64,\n    .use_apll = false,\n    .tx_desc_auto_clear = true\n  };\n  esp_err_t err = i2s_driver_install(I2S_NUM_0, &cfg, 0, NULL);\n  Serial.print("INSTALL:");\n  Serial.println(err == ESP_OK ? 1 : 0);\n  i2s_pin_config_t pins = {\n    .bck_io_num = I2S_BCK,\n    .ws_io_num = I2S_WS,\n    .data_out_num = I2S_DOUT,\n    .data_in_num = -1\n  };\n  i2s_set_pin(I2S_NUM_0, &pins);\n  for (int f = 0; f < 40; f++) {\n    sendFrame(0x4000, 0xC000);\n  }\n  Serial.println("I2S_FRAMES_SENT");\n}\n\nvoid loop() {\n  sendFrame(0x4000, 0xC000);\n  delay(50);\n}\n';

test.describe('ESP32 I2S TX (MAX98357)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32 I2S frames decode to DAC output', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'dac1', type: 'openhw-max98357', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:25', to: 'dac1:LRC' },
        { from: 'esp1:26', to: 'dac1:BCLK' },
        { from: 'esp1:22', to: 'dac1:DIN' },
        { from: 'esp1:3V3', to: 'dac1:VIN' },
        { from: 'esp1:GND', to: 'dac1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['dac1'], serialNeedle: 'I2S_FRAMES_SENT', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('E32I2S verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('E32I2S serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const dac = (verdict.telemetry || []).find((t) => t.id === 'dac1');
    console.log('DAC liveOop:', JSON.stringify((verdict.liveOop || {}).dac1 || {}).slice(0, 500));
    const st = (verdict.liveOop || {}).dac1 || {};
    const frames = Number(st.totalFrameCount || 0);
    console.log('E32I2S totalFrameCount:', frames, 'peak:', st.peakAmplitude);
    expect(frames).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
