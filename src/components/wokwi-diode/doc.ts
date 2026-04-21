export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Diode Reference | OpenHW Studio</title>
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
  .pin-type.anode { background: #276749; color: #c6f6d5; }
  .pin-type.cathode { background: #742a2a; color: #fff5f5; }
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
    <h1>Diode</h1>
    <p class="subtitle">A basic semiconductor device that allows current to flow in one direction only.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="120" height="60" viewBox="0 0 40 20">
          <rect x="5" y="5" width="30" height="10" fill="#2d3748" rx="2"/>
          <line x1="28" y1="5" x2="28" y2="15" stroke="#cbd5e0" stroke-width="2"/>
          <line x1="0" y1="10" x2="5" y2="10" stroke="#a0aec0" stroke-width="2"/>
          <line x1="35" y1="10" x2="40" y2="10" stroke="#a0aec0" stroke-width="2"/>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Generic Rectifier Diode</span>
      </div>
      <div class="component-info">
        <p>A diode is a fundamental component that acts as a one-way valve for electricity. It allows current to flow from the Anode to the Cathode but blocks it in reverse.</p>
        <p><strong>Identification:</strong> The Cathode is typically marked with a stripe on the component body.</p>
        <div>
          <span class="tag">Passive</span>
          <span class="tag">One-Way</span>
          <span class="tag">Rectification</span>
          <span class="tag">0.7V Drop (Typical)</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">A</span></td><td><span class="pin-type anode">Anode</span></td><td>Positive terminal. Current enters here.</td></tr>
      <tr><td><span class="pin-name">C</span></td><td><span class="pin-type cathode">Cathode</span></td><td>Negative terminal (marked with stripe). Current exits here.</td></tr>
    </table>

    <div class="note">💡 <strong>Flyback Protection:</strong> Diodes are commonly used in parallel with inductive loads like motors and relays to prevent "inductive kickback" from damaging sensitive electronics.</div>

    <h2>Example Use Case</h2>
    <p style="margin-bottom: 16px;">A simple circuit to demonstrate rectification. The diode allows current to pass from the 5V source to the LED only when oriented correctly.</p>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>void setup() {
  pinMode(13, OUTPUT);
  // Pulse 5V through the diode circuit
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the basic rectification property. See how the LED lights up when the diode is forward-biased.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Diode Circuit
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
  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "d1", type: "wokwi-diode", x: 300, y: 100 },
      { id: "r1", type: "wokwi-resistor", x: 350, y: 100, attrs: { value: "330" } },
      { id: "led1", type: "wokwi-led", x: 450, y: 100, attrs: { color: "red" } }
    ],
    connections: [
      [ "uno:13", "d1:A", "green", [] ],
      [ "d1:C", "r1:1", "red", [] ],
      [ "r1:2", "led1:A", "red", [] ],
      [ "uno:GND.1", "led1:C", "black", [] ]
    ],
    code: "void setup() {\\n  pinMode(13, OUTPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(13, HIGH);\\n  delay(500);\\n  digitalWrite(13, LOW);\\n  delay(500);\\n}"
  };

  var encoded = encodeURIComponent(JSON.stringify(payload));
  var localUrl = window.location.origin + "/simulator?circuit=" + encoded;
  window.open(localUrl, "_blank");
}
</script>
</body>
</html>
`;

