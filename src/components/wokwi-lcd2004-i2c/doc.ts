export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>LCD 2004 (I2C) Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  a { color: #63b3ed; text-decoration: none; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
  .component-svg-wrap { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .component-info p { color: #a0aec0; font-size: 15px; margin-bottom: 16px; }
  .tag { display: inline-block; background: #1a2035; border: 1px solid #2d4a8a; color: #63b3ed; padding: 3px 10px; border-radius: 20px; font-size: 12px; margin-right: 6px; margin-bottom: 6px; }
  h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 36px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #2d3748; }
  .pin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  .pin-table th { background: #1a1f2e; color: #63b3ed; padding: 10px 14px; text-align: left; border: 1px solid #2d3748; }
  .pin-table td { padding: 10px 14px; border: 1px solid #2d3748; color: #a0aec0; }
  .pin-table tr:nth-child(even) td { background: #141824; }
  .pin-name { font-family: monospace; color: #68d391; font-weight: 600; }
  .pin-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
  .pin-type.input { background: #1a365d; color: #63b3ed; }
  .pin-type.power { background: #742a2a; color: #fff5f5; }
  .code-block { background: #141824; border: 1px solid #2d3748; border-radius: 8px; padding: 20px 24px; font-family: 'Courier New', monospace; font-size: 13px; color: #e2e8f0; overflow-x: auto; margin-bottom: 20px; position: relative; }
  .copy-btn { position: absolute; top: 10px; right: 10px; background: #2d3748; border: none; color: #a0aec0; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
  .note { background: #1a2a1a; border-left: 4px solid #68d391; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 14px; color: #9ae6b4; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 16px; }
  .try-btn:hover { background: #3182ce; }
</style>
</head>
<body>
<div class="content">
    <h1>LCD 2004 (I2C Interface)</h1>
    <p class="subtitle">A 20x4 character Liquid Crystal Display integrated with an I2C backpack. Only requires 2 data pins for communication instead of 6-10.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="200" height="130" viewBox="0 0 120 80">
          <rect x="0" y="0" width="120" height="80" fill="#2d3748" rx="2" />
          <rect x="10" y="10" width="100" height="60" fill="#1a365d" stroke="#63b3ed" stroke-width="2" />
          <rect x="15" y="15" width="90" height="50" fill="#2b6cb0" opacity="0.3" />
          <text x="60" y="45" fill="#fff" font-size="10" font-family="monospace" text-anchor="middle" opacity="0.8">OpenHW Studio</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">20x4 I2C Display</span>
      </div>
      <div class="component-info">
        <p>This module uses the PCF8574 expansion chip to allow communication via the I2C protocol. It is perfect for displaying sensor data, menus, and system status updates.</p>
        <p><strong>I2C Address:</strong> Most modules are pre-set to <code>0x27</code> or <code>0x3F</code>. In the simulator, the address is typically <code>0x27</code>.</p>
        <div>
          <span class="tag">I2C Protocol</span>
          <span class="tag">20x4 Characters</span>
          <span class="tag">Backlight Support</span>
          <span class="tag">PCF8574 Controller</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">GND</span></td><td><span class="pin-type power">Power</span></td><td>Ground reference.</td></tr>
      <tr><td><span class="pin-name">VCC</span></td><td><span class="pin-type power">Power</span></td><td>5V Power supply.</td></tr>
      <tr><td><span class="pin-name">SDA</span></td><td><span class="pin-type input">Data</span></td><td>Serial Data line. Connect to A4 (Uno) or 20 (Mega).</td></tr>
      <tr><td><span class="pin-name">SCL</span></td><td><span class="pin-type input">Clock</span></td><td>Serial Clock line. Connect to A5 (Uno) or 21 (Mega).</td></tr>
    </table>

    <div class="note">💡 <strong>Library Tip:</strong> Use the <code>LiquidCrystal_I2C</code> library for the easiest integration in your Arduino code.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>#include &lt;LiquidCrystal_I2C.h&gt;

LiquidCrystal_I2C lcd(0x27, 20, 4);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("OpenHW Studio");
  lcd.setCursor(0, 1);
  lcd.print("LCD 2004 Test");
}

void loop() {
  // Update data here
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the LCD with a pre-wired Arduino Uno circuit. See how the I2C interface simplifies your wiring significantly.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Sample Circuit
      </button>
    </div>
</div>

<script>
function copyCode(btn) {
  const pre = btn.nextElementSibling;
  navigator.clipboard.writeText(pre.textContent).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  });
}

function openSimulator() {
  var code = \`#include <Wire.h> \\n#include <LiquidCrystal_I2C.h>\\n\\nLiquidCrystal_I2C lcd(0x27, 20, 4);\\n\\nvoid setup() {\\n  lcd.init();\\n  lcd.backlight();\\n  lcd.print("LCD Ready!");\\n}\\n\\nvoid loop() {\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "lcd", type: "wokwi-lcd2004-i2c", x: 300, y: 100 }
    ],
    connections: [
      [ "uno:A4", "lcd:SDA", "green", [] ],
      [ "uno:A5", "lcd:SCL", "yellow", [] ],
      [ "uno:5V", "lcd:VCC", "red", [ "h10" ] ],
      [ "uno:GND.1", "lcd:GND", "black", [ "h-10" ] ]
    ],
    code: code
  };

  var encoded = encodeURIComponent(JSON.stringify(payload));
  var localUrl = "http://localhost:5173/simulator?circuit=" + encoded;
  window.open(localUrl, "_blank");
}
</script>
</body>
</html>
`;
