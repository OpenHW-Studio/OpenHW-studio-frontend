export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>SSD1306 OLED Reference | OpenHW Studio</title>
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
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="content">
    <h1>SSD1306 OLED Display</h1>
    <p class="subtitle">A 128x64 pixel monochrome OLED display using the I2C interface.</p>

    <div class="component-preview">
      <svg width="150" height="140" viewBox="0 0 150 140">
        <rect x="0" y="20" width="150" height="120" fill="#2d3748" rx="4"/>
        <rect x="15" y="35" width="120" height="90" fill="#111" stroke="#333" stroke-width="2"/>
        <text x="75" y="80" fill="#63b3ed" font-family="monospace" font-size="16" text-anchor="middle">Hello World</text>
        
        <!-- Pins at top -->
        <rect x="50" y="5" width="5" height="15" fill="#f6e05e"/>
        <rect x="67" y="5" width="5" height="15" fill="#f6e05e"/>
        <rect x="84" y="5" width="5" height="15" fill="#f6e05e"/>
        <rect x="101" y="5" width="5" height="15" fill="#f6e05e"/>
      </svg>
      <div>
        <p>The SSD1306 is a very popular 0.96-inch monochrome OLED display. Due to its I2C interface, it requires only 2 data pins (SCL and SDA) to operate.</p>
        <p>It's commonly used with the Adafruit_SSD1306 library. Because it's an OLED, it doesn't require a backlight, which makes it very power efficient when displaying dark screens.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (3.3V or 5V depending on module).</td></tr>
      <tr><td>SCL</td><td>Input</td><td>I2C Clock line. Connects to A5 on Uno.</td></tr>
      <tr><td>SDA</td><td>Bidirectional</td><td>I2C Data line. Connects to A4 on Uno.</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "arduino-uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "oled", type: "wokwi-ssd1306-oled", x: 300, y: 0 }
    ],
    connections: [
      ["uno:5V", "oled:VCC", "red", []],
      ["uno:GND", "oled:GND", "black", []],
      ["uno:A5", "oled:SCL", "yellow", []],
      ["uno:A4", "oled:SDA", "green", []]
    ],
    code: ""
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
