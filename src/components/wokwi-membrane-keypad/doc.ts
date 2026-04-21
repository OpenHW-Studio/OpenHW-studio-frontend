export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Membrane Keypad Reference | OpenHW Studio</title>
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
  .pin-type.row { background: #2c5282; color: #bee3f8; }
  .pin-type.col { background: #276749; color: #c6f6d5; }
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
    <h1>Membrane Keypad (4x4)</h1>
    <p class="subtitle">A 16-button matrix keypad for user input and data entry.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="100" height="120" viewBox="0 0 60 70">
          <rect x="0" y="0" width="60" height="60" fill="#2d3748" rx="2"/>
          <rect x="10" y="60" width="40" height="10" fill="#4a5568"/>
          <!-- Key grid -->
          <rect x="5" y="5" width="10" height="10" fill="#1a202c" rx="1"/>
          <rect x="20" y="5" width="10" height="10" fill="#1a202c" rx="1"/>
          <rect x="35" y="5" width="10" height="10" fill="#1a202c" rx="1"/>
          <rect x="50" y="5" width="10" height="10" fill="#1a202c" rx="1"/>
          <rect x="5" y="20" width="10" height="10" fill="#1a202c" rx="1"/>
          <rect x="20" y="20" width="10" height="10" fill="#1a202c" rx="1"/>
        </svg>
        <span style="font-size:11px;color:#4a5568;">4x4 Matrix Layout</span>
      </div>
      <div class="component-info">
        <p>This keypad uses an 8-pin matrix interface. By scanning 4 row pins and 4 column pins, a microcontroller can detect which of the 16 tactile buttons is being pressed.</p>
        <p><strong>Efficiency:</strong> This matrix design reduces the number of I/O pins required from 16 to just 8.</p>
        <div>
          <span class="tag">Digital Input</span>
          <span class="tag">Tactile</span>
          <span class="tag">8-Pin Interface</span>
          <span class="tag">Matrix Scanning</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">R1 - R4</span></td><td><span class="pin-type row">Row</span></td><td>Scanning Row pins 1 through 4.</td></tr>
      <tr><td><span class="pin-name">C1 - C4</span></td><td><span class="pin-type col">Col</span></td><td>Scanning Column pins 1 through 4.</td></tr>
    </table>

    <div class="note">💡 <strong>Hardware Tip:</strong> Most 4x4 matrix keypads feature a 2.54mm pitch female header, making them perfect for connecting to male jumper wires or breadboards.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>#include &lt;Keypad.h&gt;

const byte ROWS = 4; 
const byte COLS = 4; 
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {9, 8, 7, 6}; 
byte colPins[COLS] = {5, 4, 3, 2}; 

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

void setup(){
  Serial.begin(9600);
}

void loop(){
  char key = keypad.getKey();
  if (key){
    Serial.println(key);
  }
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the keypad matrix. Open the sample circuit to see how button presses are decoded and displayed in the Serial Monitor.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Keypad Circuit
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
  var code = \`#include <Keypad.h>\\n\\nconst byte ROWS = 4;\\nconst byte COLS = 4;\\nchar keys[ROWS][COLS] = {\\n  {'1','2','3','A'},\\n  {'4','5','6','B'},\\n  {'7','8','9','C'},\\n  {'*','0','#','D'}\\n};\\nbyte rowPins[ROWS] = {9, 8, 7, 6};\\nbyte colPins[COLS] = {5, 4, 3, 2};\\n\\nKeypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);\\n\\nvoid setup(){\\n  Serial.begin(9600);\\n  Serial.println("Keypad Initialized!");\\n}\\n\\nvoid loop(){\\n  char key = keypad.getKey();\\n  if (key){\\n    Serial.print("Pressed: ");\\n    Serial.println(key);\\n  }\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "pad", type: "wokwi-membrane-keypad", x: 300, y: 0 }
    ],
    connections: [
      [ "uno:9", "pad:R1", "red", [] ],
      [ "uno:8", "pad:R2", "red", [] ],
      [ "uno:7", "pad:R3", "red", [] ],
      [ "uno:6", "pad:R4", "red", [] ],
      [ "uno:5", "pad:C1", "green", [] ],
      [ "uno:4", "pad:C2", "green", [] ],
      [ "uno:3", "pad:C3", "green", [] ],
      [ "uno:2", "pad:C4", "green", [] ]
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

