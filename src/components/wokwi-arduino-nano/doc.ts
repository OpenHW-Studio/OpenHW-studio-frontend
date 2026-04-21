export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Arduino Nano Reference | OpenHW Studio</title>
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
  .pin-type.digital { background: #1a365d; color: #63b3ed; }
  .pin-type.analog { background: #553c9a; color: #e9d8fd; }
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
    <h1>Arduino Nano</h1>
    <p class="subtitle">A small, complete, and breadboard-friendly board based on the ATmega328P. It has more or less the same functionality as the Uno but in a different package.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="180" height="80" viewBox="0 0 180 50">
          <rect x="0" y="0" width="180" height="50" fill="#0081a7" rx="4" />
          <rect x="5" y="10" width="30" height="30" fill="#000" rx="1" />
          <rect x="15" y="0" width="150" height="5" fill="#333" />
          <rect x="15" y="45" width="150" height="5" fill="#333" />
          <text x="90" y="30" fill="#fff" font-size="12" font-family="Arial" font-weight="bold" opacity="0.3" text-anchor="middle">ARDUINO NANO</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Nano Form Factor</span>
      </div>
      <div class="component-info">
        <p>The Arduino Nano is ideal for projects where space is at a premium. Unlike the Uno, it lacks a DC power jack and uses a Mini-B or Type-C USB cable.</p>
        <p><strong>Breadboard Friendly:</strong> Its DIP-package design (Dual In-line Package) allows it to be plugged directly into a standard breadboard.</p>
        <div>
          <span class="tag">ATmega328P</span>
          <span class="tag">Compact</span>
          <span class="tag">Breadboard Ready</span>
          <span class="tag">5V Logic</span>
        </div>
      </div>
    </div>

    <h2>Primary Pin Map</h2>
    <table class="pin-table">
      <tr><th>Category</th><th>Pins</th><th>Description</th></tr>
      <tr><td><span class="pin-type digital">Digital I/O</span></td><td>D0 – D13</td><td>Pins 3, 5, 6, 9, 10, 11 support PWM.</td></tr>
      <tr><td><span class="pin-type analog">Analog Input</span></td><td>A0 – A7</td><td>8 analog inputs (two more than the Uno).</td></tr>
      <tr><td><span class="pin-type power">Power</span></td><td>5V, 3V3, GND</td><td>Standard power rails.</td></tr>
      <tr><td><span class="pin-type power">System</span></td><td>RESET, VIN</td><td>Reset trigger and external voltage (up to 12V).</td></tr>
    </table>

    <div class="note">💡 <strong>Analog Tip:</strong> The Nano provides 8 analog inputs (A0-A7), while the Uno standard R3 only provides 6 (A0-A5).</div>

    <h2>Specifications</h2>
    <div style="column-count:2; font-size:14px; margin-bottom:24px;">
      <ul style="list-style:none; padding-left:0; color:#a0aec0;">
        <li>• Microcontroller: ATmega328P</li>
        <li>• Operating Voltage: 5V</li>
        <li>• Digital I/O Pins: 14</li>
        <li>• Analog Input Pins: 8</li>
        <li>• Flash Memory: 32 KB</li>
        <li>• SRAM: 2 KB</li>
        <li>• Clock Speed: 16 MHz</li>
        <li>• Form Factor: 18x45 mm</li>
      </ul>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Launch an Arduino Nano workspace. Standard breadboard-friendly layout pre-configured.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Workspace
      </button>
    </div>
</div>

<script>
function openSimulator() {
  var code = \`void setup() {\\n  Serial.begin(9600);\\n  Serial.println("Arduino Nano Ready!");\\n}\\n\\nvoid loop() {\\n}\\n\`;

  var payload = {
    board: "arduino_nano",
    components: [
      { id: "nano", type: "wokwi-arduino-nano", x: 0, y: 0 }
    ],
    connections: [],
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
