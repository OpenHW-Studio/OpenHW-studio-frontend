export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>HC-SR04 Reference | OpenHW Studio</title>
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
  .pin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
  .pin-table th { background: #1a1f2e; color: #63b3ed; padding: 10px 14px; text-align: left; border: 1px solid #2d3748; }
  .pin-table td { padding: 10px 14px; border: 1px solid #2d3748; color: #a0aec0; }
  .pin-table tr:nth-child(even) td { background: #141824; }
  .pin-name { font-family: monospace; color: #68d391; font-weight: 600; }
  .pin-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
  .pin-type.input  { background: #1a365d; color: #63b3ed; }
  .pin-type.output { background: #1c3d27; color: #68d391; }
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
    <h1>Ultrasonic Sensor (HC-SR04)</h1>
    <p class="subtitle">Non-contact distance measurement module. Uses high-frequency sound waves to measure distances from 2cm up to 400cm with precise accuracy.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="150" height="100" viewBox="0 0 172.5 114">
          <rect x="0" y="0" width="172.5" height="114" fill="#1a5276" rx="4" />
          <circle cx="43.1" cy="57" r="35" fill="#333" stroke="#eee" stroke-width="2" />
          <circle cx="129.4" cy="57" r="35" fill="#333" stroke="#eee" stroke-width="2" />
          <circle cx="43.1" cy="57" r="28" fill="url(#eyeGradient)" />
          <circle cx="129.4" cy="57" r="28" fill="url(#eyeGradient)" />
          <defs>
            <radialGradient id="eyeGradient">
              <stop offset="0%" stop-color="#555" />
              <stop offset="100%" stop-color="#111" />
            </radialGradient>
          </defs>
          <g transform="translate(0, 0)">
              <rect x="71" y="96" width="4" height="15" fill="#bbb" />
              <rect x="80.6" y="96" width="4" height="15" fill="#bbb" />
              <rect x="90.2" y="96" width="4" height="15" fill="#bbb" />
              <rect x="99.8" y="96" width="4" height="15" fill="#bbb" />
          </g>
          <text x="86.25" y="15" fill="#fff" font-size="10" font-family="monospace" text-anchor="middle">HC-SR04</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Ultrasonic Distance Module</span>
      </div>
      <div class="component-info">
        <p>The HC-SR04 consists of an ultrasonic transmitter, a receiver, and a control circuit. It emits an 8-cycle 40kHz sonic burst and detects the reflected pulse.</p>
        <p>Trigger with a 10µs HIGH pulse. The module outputs a HIGH pulse on Echo whose duration represents the distance travel time.</p>
        <div>
          <span class="tag">2cm - 400cm</span>
          <span class="tag">15° Angle</span>
          <span class="tag">5V Supply</span>
          <span class="tag">Non-contact</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">VCC</span></td><td><span class="pin-type input">Input</span></td><td>+5V Power supply.</td></tr>
      <tr><td><span class="pin-name">TRIG</span></td><td><span class="pin-type input">Input</span></td><td>Trigger Input. Send a 10µs HIGH pulse to start measurement.</td></tr>
      <tr><td><span class="pin-name">ECHO</span></td><td><span class="pin-type output">Output</span></td><td>Echo Output. HIGH pulse length = (Time for sound pulse to return).</td></tr>
      <tr><td><span class="pin-name">GND</span></td><td><span class="pin-type input">Input</span></td><td>Ground connection.</td></tr>
    </table>

    <div class="note">💡 <strong>Distance Calculation:</strong> Distance (cm) = (Echo Time in µs) / 58</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  // Trigger measurement
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read Echo pulse width (in µs)
  long duration = pulseIn(ECHO_PIN, HIGH);

  // Convert to cm
  float distance = duration / 58.0;

  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  delay(500);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the HC-SR04 ultrasonic sensor with an Arduino Uno. Adjust the distance by clicking the sensor during simulation.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Sample Circuit
      </button>
    </div>
</div>

<script>
function copyCode(btn) {
  const pre = btn.nextElementSibling;
  navigator.clipboard.writeText(pre.innerText).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  });
}

function openSimulator() {
  var code = "const int TRIG_PIN = 9;\\nconst int ECHO_PIN = 10;\\n\\nvoid setup() {\\n  Serial.begin(9600);\\n  pinMode(TRIG_PIN, OUTPUT);\\n  pinMode(ECHO_PIN, INPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(TRIG_PIN, LOW);\\n  delayMicroseconds(2);\\n  digitalWrite(TRIG_PIN, HIGH);\\n  delayMicroseconds(10);\\n  digitalWrite(TRIG_PIN, LOW);\\n\\n  long duration = pulseIn(ECHO_PIN, HIGH);\\n  float distance = duration / 58.0;\\n\\n  Serial.print(\\"Distance: \\");\\n  Serial.print(distance);\\n  Serial.println(\\" cm\\");\\n\\n  delay(500);\\n}";

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "ultrasonic", type: "wokwi-hc-sr04", x: 250, y: 50, attrs: { distance: "80" } }
    ],
    connections: [
      [ "uno:9", "ultrasonic:TRIG", "green", [] ],
      [ "uno:10", "ultrasonic:ECHO", "yellow", [] ],
      [ "uno:5V", "ultrasonic:VCC", "red", [] ],
      [ "uno:GND.1", "ultrasonic:GND", "black", [] ]
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
