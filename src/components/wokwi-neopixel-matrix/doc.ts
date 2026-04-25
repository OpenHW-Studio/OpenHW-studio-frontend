export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>WS2812B NeoPixel Matrix Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
  h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 36px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #2d3748; }
  .pin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  .pin-table th { background: #1a1f2e; color: #63b3ed; padding: 10px 14px; text-align: left; border: 1px solid #2d3748; }
  .pin-table td { padding: 10px 14px; border: 1px solid #2d3748; color: #a0aec0; }
</style>
</head>
<body>
<div class="content">
    <h1>WS2812B NeoPixel Matrix</h1>
    <p class="subtitle">An array of individually addressable RGB LEDs.</p>

    <div class="component-preview">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <rect x="0" y="0" width="40" height="40" fill="#2d3748" rx="2"/>
        <circle cx="10" cy="10" r="4" fill="#cbd5e0"/>
        <circle cx="30" cy="10" r="4" fill="#cbd5e0"/>
        <circle cx="10" cy="30" r="4" fill="#cbd5e0"/>
        <circle cx="30" cy="30" r="4" fill="#cbd5e0"/>
      </svg>
      <div>
        <p>The NeoPixel Matrix allows you to simulate a grid of WS2812B LEDs. You can customize the number of rows and columns (e.g., 8x8, 16x16) via the component attributes. These LEDs use a single-wire control protocol and are highly popular in Arduino projects for creating displays, animations, and mood lighting. You can use standard libraries like Adafruit_NeoPixel or FastLED to control it.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (5V). Needs a lot of current in real hardware!</td></tr>
      <tr><td>GND</td><td>Power</td><td>Common ground.</td></tr>
      <tr><td>DIN</td><td>Input</td><td>Data In. Connect to a digital pin on the microcontroller.</td></tr>
    </table>
</div>
</body>
</html>
`;
