export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>LED Reference | OpenHW Studio</title>
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
    <h1>Light Emitting Diode (LED)</h1>
    <p class="subtitle">A semiconductor light source that emits light when current flows through it. LEDs are polarized and require a resistor to limit current.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="80" height="120" viewBox="0 0 38 70">
          <circle cx="19" cy="20" r="15" fill="#ef4444" />
          <rect x="18" y="35" width="2" height="30" fill="#bbb" />
          <rect x="23" y="35" width="2" height="30" fill="#bbb" />
          <text x="19" y="10" fill="#fff" font-size="6" font-family="monospace" text-anchor="middle">LED</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Standard 5mm LED</span>
      </div>
      <div class="component-info">
        <p>The LED (Light Emitting Diode) is the most basic output component. It converts electrical energy into light. Unlike incandescent bulbs, LEDs are energy-efficient and long-lasting.</p>
        <p><strong>Polarity:</strong> LEDs only allow current to flow in one direction. Connecting it backwards will not damage it (unless high voltage is used), but it will not light up.</p>
        <div>
          <span class="tag">Polarized</span>
          <span class="tag">Requires Resistor</span>
          <span class="tag">Multiple Colors</span>
          <span class="tag">PWM Compatible</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">A</span></td><td><span class="pin-type input">Input</span></td><td>Anode (+). Connect to positive voltage (via resistor).</td></tr>
      <tr><td><span class="pin-name">K</span></td><td><span class="pin-type input">Input</span></td><td>Cathode (-). Connect to Ground (GND).</td></tr>
    </table>

    <div class="note">💡 <strong>Pro Tip:</strong> Always use a 220Ω or 330Ω resistor in series with an LED on a 5V circuit to prevent it from burning out.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH); // Turn ON
  delay(1000);                // Wait 1 second
  digitalWrite(LED_PIN, LOW);  // Turn OFF
  delay(1000);                // Wait 1 second
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the LED with an Arduino Uno. See how it blinks using the standard "Blink" example.</p>
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
  var code = \`const int LED_PIN = 13;\\n\\nvoid setup() {\\n  pinMode(LED_PIN, OUTPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(LED_PIN, HIGH);\\n  delay(1000);\\n  digitalWrite(LED_PIN, LOW);\\n  delay(1000);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "led1", type: "wokwi-led", x: 300, y: 150, attrs: { color: "red" } },
      { id: "r1", type: "wokwi-resistor", x: 300, y: 50, attrs: { value: "220" } }
    ],
    connections: [
      [ "uno:13", "r1:1", "green", [] ],
      [ "r1:2", "led1:A", "green", [] ],
      [ "uno:GND.1", "led1:K", "black", [] ]
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
