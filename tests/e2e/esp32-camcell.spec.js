import { test, expect } from '@playwright/test';

// ESP32 camera cell (DevKit + esp32-emu OV2640 camera path): real esp-camera
// firmware (AI-Thinker pin map, QQVGA RGB565) against the in-worker OV2640
// SCCB model. Runner pump (esp32-camera-pump.ts) attaches the sensor +
// pulses VSYNC; the cell asserts the capture on serial only — there is no
// OV2640/framebuffer component model (openhw-esp32-cam is a UI-only shell,
// so no wires and no frame rendering). Shape mirrors esp32-dht22.spec.js:
// engine tap + thin runner pump + real firmware + human-senses assertion.
// NOTE (2026-10-07): guest-side VSYNC self-pulse was tried (GPIO25 output
// task beside a blocking fb_get) and does NOT trigger capture — only the
// host setPinInput(25) pump in esp32-camera-pump.ts delivers frame
// boundaries. The pump wiring snippet must be applied in esp32-runner.ts,
// or fb_get never returns and the board reset-loops.
const CODE = '#include "esp_camera.h"\n#include "esp_system.h"\n#define CAM_PIN_PWDN 32\n#define CAM_PIN_RESET -1\n#define CAM_PIN_XCLK 0\n#define CAM_PIN_SIOD 26\n#define CAM_PIN_SIOC 27\n#define CAM_PIN_D7 35\n#define CAM_PIN_D6 34\n#define CAM_PIN_D5 39\n#define CAM_PIN_D4 36\n#define CAM_PIN_D3 21\n#define CAM_PIN_D2 19\n#define CAM_PIN_D1 18\n#define CAM_PIN_D0 5\n#define CAM_PIN_VSYNC 25\n#define CAM_PIN_HREF 23\n#define CAM_PIN_PCLK 22\nvoid setup() {\n  Serial.begin(115200);\n  delay(200);\n  Serial.println("CAMCELL_EARLY");\n  Serial.printf("CAMCELL_RST=%d\\n", (int)esp_reset_reason());\n  Serial.printf("CAMCELL_HEAP=%u\\n", (unsigned)ESP.getFreeHeap());\n  Serial.println("CAMCELL_READY");\n  camera_config_t config;\n  config.ledc_channel = LEDC_CHANNEL_0;\n  config.ledc_timer = LEDC_TIMER_0;\n  config.pin_d0 = CAM_PIN_D0;\n  config.pin_d1 = CAM_PIN_D1;\n  config.pin_d2 = CAM_PIN_D2;\n  config.pin_d3 = CAM_PIN_D3;\n  config.pin_d4 = CAM_PIN_D4;\n  config.pin_d5 = CAM_PIN_D5;\n  config.pin_d6 = CAM_PIN_D6;\n  config.pin_d7 = CAM_PIN_D7;\n  config.pin_xclk = CAM_PIN_XCLK;\n  config.pin_pclk = CAM_PIN_PCLK;\n  config.pin_vsync = CAM_PIN_VSYNC;\n  config.pin_href = CAM_PIN_HREF;\n  config.pin_sccb_sda = CAM_PIN_SIOD;\n  config.pin_sccb_scl = CAM_PIN_SIOC;\n  config.pin_pwdn = CAM_PIN_PWDN;\n  config.pin_reset = CAM_PIN_RESET;\n  config.xclk_freq_hz = 20000000;\n  config.pixel_format = PIXFORMAT_RGB565;\n  config.frame_size = FRAMESIZE_QQVGA;\n  config.jpeg_quality = 12;\n  config.fb_count = 1;\n  config.fb_location = CAMERA_FB_IN_DRAM;\n  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;\n  esp_err_t err = esp_camera_init(&config);\n  Serial.printf("CAM_INIT=%d\\n", (int)err);\n  if (err != ESP_OK) { Serial.println("CAMCELL_RESULT=FAIL"); return; }\n  camera_fb_t *fb = NULL;\n  for (int attempt = 0; attempt < 40 && !fb; attempt++) {\n    fb = esp_camera_fb_get();\n    if (!fb) delay(200);\n  }\n  if (!fb) { Serial.println("CAM_FB=FAIL"); Serial.println("CAMCELL_RESULT=FAIL"); return; }\n  Serial.printf("CAM_FB=%u %u %u\\n", (unsigned)fb->len, (unsigned)fb->width, (unsigned)fb->height);\n  bool ok = (fb->len == 160 * 120 * 2) && (fb->width == 160) && (fb->height == 120);\n  for (uint32_t i = 0; ok && i < fb->len; i += 4096) {\n    if (fb->buf[i] != (uint8_t)(i & 0xFF)) ok = false;\n  }\n  if (ok && fb->buf[fb->len - 1] != (uint8_t)((fb->len - 1) & 0xFF)) ok = false;\n  Serial.print("CAM_DATA=");\n  Serial.println(ok ? "PASS" : "FAIL");\n  esp_camera_fb_return(fb);\n  Serial.print("CAMCELL_RESULT=");\n  Serial.println(ok ? "PASS" : "FAIL");\n}\nvoid loop() { delay(5000); }\n';

test.describe('ESP32 camera cell', () => {
  test.setTimeout(400000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32 captures QQVGA frame via OV2640 model', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/Esp32|ESP32|esp32|CAM_|camera|Camera|error|Error|wasm|WASM|abort|Aborted|failed|warn/i.test(t)) console.log('ESP-CAP:', t.slice(0, 300));
      } catch { /* ignore */ }
    });
    page.on('pageerror', (err) => console.log('ESP-PAGEERROR:', String(err).slice(0, 400)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 200000, selectTelemetry: [], serialNeedle: 'CAMCELL_RESULT=PASS', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('E32CAM verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('E32CAM serial head:', (verdict.serial || '').slice(0, 500));
    expect(verdict.pass).toBe(true);
    // Engine-proof: driver init OK, one full QQVGA RGB565 frame (38400 B,
    // 160x120), ramp bytes exact, cell PASS.
    expect(verdict.serial || '').toContain('CAM_INIT=0');
    expect(verdict.serial || '').toContain('CAM_FB=38400 160 120');
    expect(verdict.serial || '').toContain('CAM_DATA=PASS');
    expect(verdict.serial || '').toContain('CAMCELL_RESULT=PASS');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
