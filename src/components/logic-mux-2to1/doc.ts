export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>2:1 Multiplexer Reference | OpenHW Studio</title>
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
    <h1>2:1 Multiplexer</h1>
    <p class="subtitle">A digital switch that routes one of two data inputs to a single output based on a select signal.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="120" height="100" viewBox="0 0 80 60">
          <polygon points="15,10 65,20 65,40 15,50" fill="#2d3748" stroke="#4a5568" stroke-width="2"/>
          <text x="28" y="35" fill="#fff" font-size="10" font-family="monospace">MUX</text>
          <line x1="5" y1="20" x2="15" y2="20" stroke="#a0aec0" stroke-width="2"/>
          <line x1="5" y1="40" x2="15" y2="40" stroke="#a0aec0" stroke-width="2"/>
          <line x1="65" y1="30" x2="75" y2="30" stroke="#a0aec0" stroke-width="2"/>
          <line x1="40" y1="45" x2="40" y2="55" stroke="#a0aec0" stroke-width="2"/>
          <text x="2" y="23" fill="#718096" font-size="6">D0</text>
          <text x="2" y="43" fill="#718096" font-size="6">D1</text>
          <text x="36" y="59" fill="#718096" font-size="6">SEL</text>
          <text x="70" y="28" fill="#718096" font-size="6">OUT</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Gate-Level Logic Mux</span>
      </div>
      <div class="component-info">
        <p>A 2-to-1 Multiplexer (MUX) acts as a digitally controlled selector. It chooses between two data inputs (D0, D1) and passes the selected one to the output (OUT).</p>
        <p><strong>Logic Rule:</strong> When SEL is LOW, OUT follows D0. When SEL is HIGH, OUT follows D1.</p>
        <div>
          <span class="tag">Digital Logic</span>
          <span class="tag">Switching</span>
          <span class="tag">Combinational</span>
          <span class="tag">Routing</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">D0</span></td><td><span class="pin-type digital">Input</span></td><td>Data Input 0. Selected when SEL = 0.</td></tr>
      <tr><td><span class="pin-name">D1</span></td><td><span class="pin-type digital">Input</span></td><td>Data Input 1. Selected when SEL = 1.</td></tr>
      <tr><td><span class="pin-name">SEL</span></td><td><span class="pin-type digital">Input</span></td><td>Select line. Chooses which input to route.</td></tr>
      <tr><td><span class="pin-name">OUT</span></td><td><span class="pin-type digital">Output</span></td><td>Digital output signal.</td></tr>
    </table>

    <div class="note">💡 <strong>Tip:</strong> You can chain multiple 2:1 MUX components to build larger 4:1 or 8:1 multiplexers.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>void setup() {
  pinMode(5, OUTPUT);  // Connect to D0
  pinMode(6, OUTPUT);  // Connect to D1
  pinMode(7, OUTPUT);  // Connect to SEL
  Serial.begin(115200);
}

void loop() {
  // Select D0 (which is HIGH)
  digitalWrite(5, HIGH); digitalWrite(6, LOW); digitalWrite(7, LOW);
  Serial.println("SEL=0 (D0 selected) -> OUT should be HIGH");
  delay(1000);

  // Select D1 (which is LOW)
  digitalWrite(7, HIGH);
  Serial.println("SEL=1 (D1 selected) -> OUT should be LOW");
  delay(1000);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the 2:1 MUX with an Arduino Uno and an LED. Watch how the SELECT line (Pin 7) switches the output between two different data sources.</p>
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
  var code = \`void setup() {\\n  pinMode(5, OUTPUT);\\n  pinMode(6, OUTPUT);\\n  pinMode(7, OUTPUT);\\n}\\n\\nvoid loop() {\\n  digitalWrite(5, HIGH);\\n  digitalWrite(6, LOW);\\n  digitalWrite(7, LOW);  // Select D0 (HIGH)\\n  delay(1000);\\n  digitalWrite(7, HIGH); // Select D1 (LOW)\\n  delay(1000);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "mux", type: "logic-mux-2to1", x: 300, y: 150 },
      { id: "led1", type: "wokwi-led", x: 450, y: 150, color: "red" }
    ],
    connections: [
      [ "uno:5", "mux:D0", "blue", [] ],
      [ "uno:6", "mux:D1", "blue", [] ],
      [ "uno:7", "mux:SEL", "orange", [] ],
      [ "mux:OUT", "led1:A", "green", [] ],
      [ "uno:GND.1", "led1:C", "black", [] ]
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
