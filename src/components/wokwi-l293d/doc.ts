export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>L293D Motor Driver Reference | OpenHW Studio</title>
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
  .pin-type.output { background: #276749; color: #c6f6d5; }
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
    <h1>L293D Motor Driver</h1>
    <p class="subtitle">A versatile dual H-bridge IC for driving DC motors and steppers.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="60" height="100" viewBox="0 0 30 50">
          <rect x="5" y="0" width="20" height="50" fill="#2d3748" rx="2"/>
          <path d="M 12 0 Q 15 5 18 0" fill="#2d3748" /> <!-- Notch -->
          <circle cx="10" cy="5" r="1.5" fill="#a0aec0"/> <!-- Pin 1 indicator -->
        </svg>
        <span style="font-size:11px;color:#4a5568;">DIP-16 Package</span>
      </div>
      <div class="component-info">
        <p>The L293D is an integrated circuit that allows you to control the direction and speed of two DC motors simultaneously. It uses an H-bridge configuration to flip the polarity of the output pins.</p>
        <p><strong>Power:</strong> Requires separate supplies for logic (VCC1, 5V) and motors (VCC2, 4.5V-36V).</p>
        <div>
          <span class="tag">Dual H-Bridge</span>
          <span class="tag">Bidirectional</span>
          <span class="tag">600mA per Channel</span>
          <span class="tag">PWM Compatible</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">EN1,2</span></td><td><span class="pin-type input">Input</span></td><td>Enable for Channel 1 & 2. Connect to PWM for speed control.</td></tr>
      <tr><td><span class="pin-name">IN1, IN2</span></td><td><span class="pin-type input">Input</span></td><td>Input control pins for Motor 1.</td></tr>
      <tr><td><span class="pin-name">OUT1, OUT2</span></td><td><span class="pin-type output">Output</span></td><td>Output terminals for Motor 1.</td></tr>
      <tr><td><span class="pin-name">VCC1</span></td><td><span class="pin-type power">Power</span></td><td>Logic supply (5V).</td></tr>
      <tr><td><span class="pin-name">VCC2</span></td><td><span class="pin-type power">Power</span></td><td>Motor supply voltage (up to 36V).</td></tr>
      <tr><td><span class="pin-name">GND</span></td><td><span class="pin-type power">Power</span></td><td>Heatsink and Ground pins.</td></tr>
    </table>

    <div class="note">💡 <strong>Speed Control:</strong> By applying a PWM signal to the Enable (EN) pins, you can precisely control the RPM of the connected motors.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>// Motor 1 connections
int enA = 9;
int in1 = 8;
int in2 = 7;

void setup() {
  pinMode(enA, OUTPUT);
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
}

void loop() {
  // Move Forward at 50% speed
  digitalWrite(in1, HIGH);
  digitalWrite(in2, LOW);
  analogWrite(enA, 127);
  delay(2000);
  
  // Stop
  digitalWrite(in1, LOW);
  digitalWrite(in2, LOW);
  delay(1000);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Control a DC motor using the L293D and an Arduino Uno. Open the workspace to see the H-bridge logic in action.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Motor Circuit
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
  var code = \`int enA = 9;\\nint in1 = 8;\\nint in2 = 7;\\n\\nvoid setup() {\\n  pinMode(enA, OUTPUT);\\n  pinMode(in1, OUTPUT);\\n  pinMode(in2, OUTPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(in1, HIGH);\\n  digitalWrite(in2, LOW);\\n  analogWrite(enA, 255);\\n  delay(2000);\\n  digitalWrite(in1, LOW);\\n  digitalWrite(in2, HIGH);\\n  delay(2000);\\n  digitalWrite(in1, LOW);\\n  digitalWrite(in2, LOW);\\n  delay(1000);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "l293d", type: "wokwi-l293d", x: 300, y: 50 },
      { id: "motor1", type: "wokwi-motor", x: 500, y: 50 }
    ],
    connections: [
      [ "uno:9", "l293d:EN1,2", "yellow", [] ],
      [ "uno:8", "l293d:IN1", "blue", [] ],
      [ "uno:7", "l293d:IN2", "blue", [] ],
      [ "l293d:OUT1", "motor1:1", "orange", [] ],
      [ "l293d:OUT2", "motor1:2", "orange", [] ],
      [ "uno:5V", "l293d:VCC1", "red", [] ],
      [ "uno:VIN", "l293d:VCC2", "red", [] ],
      [ "uno:GND.1", "l293d:GND1", "black", [] ]
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

