export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NeoPixel Ring Reference | OpenHW Studio</title>
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
    <h1>NeoPixel Ring</h1>
    <p class="subtitle">A circular array of addressable WS2812B LEDs.</p>

    <div class="component-preview">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="35" fill="none" stroke="#2d3748" stroke-width="8"/>
        <!-- Some dots to simulate LEDs -->
        <circle cx="40" cy="10" r="2" fill="#cbd5e0"/>
        <circle cx="70" cy="40" r="2" fill="#cbd5e0"/>
        <circle cx="40" cy="70" r="2" fill="#cbd5e0"/>
        <circle cx="10" cy="40" r="2" fill="#cbd5e0"/>
      </svg>
      <div>
        <p>The NeoPixel ring is an aesthetically pleasing arrangement of addressable LEDs. The default is 16 pixels, but this can be customized via attributes. Extremely popular for wearables, status rings, and decorative lighting. Uses standard libraries like Adafruit_NeoPixel.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VDD</td><td>Power</td><td>Power supply (5V).</td></tr>
      <tr><td>VSS</td><td>Power</td><td>Ground.</td></tr>
      <tr><td>DIN</td><td>Input</td><td>Data In. Connect to microcontroller.</td></tr>
      <tr><td>DOUT</td><td>Output</td><td>Data Out. Connect to the DIN of another NeoPixel device.</td></tr>
    </table>
</div>
</body>
</html>
`;
