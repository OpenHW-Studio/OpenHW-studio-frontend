export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Resistor Reference | OpenHW Studio</title>
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
  .pin-type.passive { background: #4a5568; color: #e2e8f0; }
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
    <h1>Resistor</h1>
    <p class="subtitle">A passive electronic component that implements electrical resistance as a circuit element. Used to limit current, divide voltages, and protect sensitive components.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="120" height="60" viewBox="0 0 100 40">
          <rect x="0" y="18" width="100" height="4" fill="#bbb" />
          <rect x="25" y="10" width="50" height="20" fill="#f4d03f" rx="4" />
          <rect x="35" y="10" width="4" height="20" fill="#cc0000" />
          <rect x="45" y="10" width="4" height="20" fill="#cc0000" />
          <rect x="55" y="10" width="4" height="20" fill="#804000" />
          <text x="50" y="8" fill="#fff" font-size="6" font-family="monospace" text-anchor="middle">Resistor</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Standard Axial Resistor</span>
      </div>
      <div class="component-info">
        <p>Resistors are essential in almost every electronic circuit. They obey Ohm's Law (V = I * R), meaning the voltage across them is proportional to the current flowing through them.</p>
        <p><strong>Color Code:</strong> Most resistors use colored bands to indicate their resistance value and tolerance. Common values for Arduino are 220Ω, 330Ω, 1kΩ, and 10kΩ.</p>
        <div>
          <span class="tag">Passive</span>
          <span class="tag">Non-polarized</span>
          <span class="tag">Ohm's Law</span>
          <span class="tag">Compact</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">p1</span></td><td><span class="pin-type passive">Passive</span></td><td>Terminal 1. Standard connection point (non-polarized).</td></tr>
      <tr><td><span class="pin-name">p2</span></td><td><span class="pin-type passive">Passive</span></td><td>Terminal 2. Standard connection point (non-polarized).</td></tr>
    </table>

    <div class="note">💡 <strong>Ohm's Law Calculation:</strong> R = V / I. For a 5V circuit and 20mA LED, R = (5-2)/0.02 = 150Ω. Use 220Ω for safety.</div>

    <h2>Wiring Diagram</h2>
    <div class="code-block" style="text-align:center;">
      <pre>[ Pin ] ----[ Resistor ]---- [ Component ] ---- GND</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Observe how changing the resistor value affects an LED's brightness in a real-time simulation.</p>
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
  var code = \`void setup() {\\n  pinMode(13, OUTPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(13, HIGH);\\n  delay(500);\\n  digitalWrite(13, LOW);\\n  delay(500);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "led1", type: "wokwi-led", x: 300, y: 150, attrs: { color: "green" } },
      { id: "r1", type: "wokwi-resistor", x: 300, y: 50, attrs: { value: "220" } }
    ],
    connections: [
      [ "uno:13", "r1:p1", "green", [] ],
      [ "r1:p2", "led1:A", "green", [] ],
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
