export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Photodiode Reference | OpenHW Studio</title>
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
  .pin-type.anode { background: #1a365d; color: #63b3ed; }
  .pin-type.cathode { background: #742a2a; color: #fff5f5; }
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
    <h1>Photodiode</h1>
    <p class="subtitle">A semiconductor device that converts light into electrical current.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="60" height="60" viewBox="0 0 40 40">
          <circle cx="20" cy="15" r="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="2"/>
          <rect x="15" y="25" width="2" height="15" fill="#a0aec0"/>
          <rect x="23" y="25" width="2" height="15" fill="#a0aec0"/>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Light-Sensitive Diode</span>
      </div>
      <div class="component-info">
        <p>A photodiode generates a small current proportional to the light intensity. It is typically operated in reverse-bias mode for faster response and better linearity.</p>
        <p><strong>Operation:</strong> When light hits the junction, it creates electron-hole pairs, allowing a "photocurrent" to flow.</p>
        <div>
          <span class="tag">Light Sensor</span>
          <span class="tag">High Speed</span>
          <span class="tag">Analog Output</span>
          <span class="tag">Optical</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">A</span></td><td><span class="pin-type anode">Anode</span></td><td>Positive terminal.</td></tr>
      <tr><td><span class="pin-name">C</span></td><td><span class="pin-type cathode">Cathode</span></td><td>Negative terminal. Usually connected to VCC in reverse-bias.</td></tr>
    </table>

    <div class="note">💡 <strong>Measurement Tip:</strong> To measure light levels with an Arduino, connect the photodiode in series with a large resistor (e.g., 1MΩ) and measure the voltage across the resistor using an analog input.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  float voltage = sensorValue * (5.0 / 1023.0);
  Serial.print("Light Intensity (V): ");
  Serial.println(voltage);
  delay(200);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the photodiode responsiveness. Open the circuit to see how light intensity changes the analog reading on Pin A0.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Photodiode Circuit
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
  var code = \`void setup() {\\n  Serial.begin(9600);\\n}\\n\\nvoid loop() {\\n  int value = analogRead(A0);\\n  Serial.print("Light Level: ");\\n  Serial.println(value);\\n  delay(250);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "pd1", type: "wokwi-photodiode", x: 300, y: 100 },
      { id: "r1", type: "wokwi-resistor", x: 300, y: 200, attrs: { value: "1000000" } }
    ],
    connections: [
      [ "uno:GND.1", "pd1:A", "black", [] ],
      [ "pd1:C", "uno:A0", "green", [] ],
      [ "uno:A0", "r1:1", "green", [] ],
      [ "r1:2", "uno:5V", "red", [] ]
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

