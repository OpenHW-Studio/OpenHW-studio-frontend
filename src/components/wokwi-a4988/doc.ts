export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>A4988 Stepper Driver Reference | OpenHW Studio</title>
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
  .pin-type.input { background: #2c5282; color: #bee3f8; }
  .pin-type.power { background: #742a2a; color: #fff5f5; }
  .pin-type.output { background: #276749; color: #c6f6d5; }
  .code-block { background: #141824; border: 1px solid #2d3748; border-radius: 8px; padding: 20px 24px; font-family: 'Courier New', monospace; font-size: 13px; color: #e2e8f0; overflow-x: auto; margin-bottom: 20px; position: relative; }
  .copy-btn { position: absolute; top: 10px; right: 10px; background: #2d3748; border: none; color: #a0aec0; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
  .note { background: #2a2a1a; border-left: 4px solid #ecc94b; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 14px; color: #faf089; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 16px; }
  .try-btn:hover { background: #3182ce; }
</style>
</head>
<body>
<div class="content">
    <h1>A4988 Stepper Driver</h1>
    <p class="subtitle">A complete microstepping motor driver with built-in translator for easy control of bipolar stepper motors.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="100" height="150" viewBox="0 0 50 80">
          <rect x="0" y="0" width="50" height="80" fill="#c53030" rx="2"/>
          <rect x="12" y="25" width="26" height="26" fill="#111" rx="2"/>
          <circle cx="25" cy="65" r="5" fill="#4a5568" /> <!-- Potentiometer -->
          <rect x="23" y="60" width="4" height="10" fill="#2d3748" rx="1"/>
        </svg>
        <span style="font-size:11px;color:#4a5568;">A4988 Module</span>
      </div>
      <div class="component-info">
        <p>The A4988 translates simple STEP and DIR pulses from a microcontroller into the complex high-voltage phase signals required by a stepper motor.</p>
        <p><strong>Key Features:</strong> Supports five step resolutions (Full, 1/2, 1/4, 1/8, and 1/16) and features adjustable current limiting and over-temperature shutdown.</p>
        <div>
          <span class="tag">Stepper Control</span>
          <span class="tag">Microstepping</span>
          <span class="tag">8V - 35V Supply</span>
          <span class="tag">2A Max Output</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">STEP</span></td><td><span class="pin-type input">Input</span></td><td>Pulse HIGH to advance the motor one step.</td></tr>
      <tr><td><span class="pin-name">DIR</span></td><td><span class="pin-type input">Input</span></td><td>HIGH for CW, LOW for CCW rotation.</td></tr>
      <tr><td><span class="pin-name">VMOT</span></td><td><span class="pin-type power">Power</span></td><td>Motor Supply Voltage (8-35V).</td></tr>
      <tr><td><span class="pin-name">VDD</span></td><td><span class="pin-type power">Power</span></td><td>Logic Supply Voltage (3-5V).</td></tr>
      <tr><td><span class="pin-name">ENABLE</span></td><td><span class="pin-type input">Input</span></td><td>Active LOW. Leave open to enable by default.</td></tr>
    </table>

    <div class="note">💡 <strong>Wiring Tip:</strong> Connect RESET and SLEEP together to keep the driver active if you don't need manual control of these states.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>const int stepPin = 3; 
const int dirPin = 2; 

void setup() {
  pinMode(stepPin, OUTPUT); 
  pinMode(dirPin, OUTPUT);
}

void loop() {
  digitalWrite(dirPin, HIGH); // Set rotation direction
  
  // Rotate 200 steps (one full revolution)
  for(int x = 0; x < 200; x++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(500); 
    digitalWrite(stepPin, LOW);
    delayMicroseconds(500); 
  }
  delay(1000); // Wait a second
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Drive a NEMA 17 stepper motor using the A4988 and an Arduino Uno. Watch the motor rotate one full revolution in the simulation.</p>
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
  var code = \`const int stepPin = 3;\\nconst int dirPin = 2;\\n\\nvoid setup() {\\n  pinMode(stepPin, OUTPUT);\\n  pinMode(dirPin, OUTPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(dirPin, HIGH);\\n  for(int x = 0; x < 200; x++) {\\n    digitalWrite(stepPin, HIGH);\\n    delayMicroseconds(1000);\\n    digitalWrite(stepPin, LOW);\\n    delayMicroseconds(1000);\\n  }\\n  delay(1000);\\n  digitalWrite(dirPin, LOW);\\n  for(int x = 0; x < 200; x++) {\\n    digitalWrite(stepPin, HIGH);\\n    delayMicroseconds(1000);\\n    digitalWrite(stepPin, LOW);\\n    delayMicroseconds(1000);\\n  }\\n  delay(1000);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "a4988", type: "wokwi-a4988", x: 320, y: 50 },
      { id: "stepper", type: "wokwi-stepper-motor", x: 500, y: 0 }
    ],
    connections: [
      [ "uno:3", "a4988:STEP", "yellow", [] ],
      [ "uno:2", "a4988:DIR", "orange", [] ],
      [ "uno:5V", "a4988:VDD", "red", [] ],
      [ "uno:GND.1", "a4988:GND", "black", [] ],
      [ "a4988:1A", "stepper:A1", "blue", [] ],
      [ "a4988:1B", "stepper:A2", "blue", [] ],
      [ "a4988:2A", "stepper:B1", "purple", [] ],
      [ "a4988:2B", "stepper:B2", "purple", [] ],
      [ "a4988:VMOT", "uno:VIN", "red", [] ],
      [ "a4988:GND.2", "uno:GND.2", "black", [] ]
    ],
    code: code
  };

  var encoded = encodeURIComponent(JSON.stringify(payload));
  var localUrl = window.location.origin + "/simulator?circuit=" + encoded;
  window.open(localUrl, "_blank");
}
</script>
</body>
</html>
`;
