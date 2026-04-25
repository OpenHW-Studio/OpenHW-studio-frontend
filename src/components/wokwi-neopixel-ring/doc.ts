export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NeoPixel Ring Reference | OpenHW Studio</title>
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
  .pin-type.data { background: #2c5282; color: #bee3f8; }
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
    <h1>NeoPixel Ring</h1>
    <p class="subtitle">A circular arrangement of individually addressable WS2812B LEDs.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="100" height="100" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="35" fill="none" stroke="#2d3748" stroke-width="8"/>
          <circle cx="40" cy="10" r="2" fill="#cbd5e0"/>
          <circle cx="70" cy="40" r="2" fill="#cbd5e0"/>
          <circle cx="40" cy="70" r="2" fill="#cbd5e0"/>
          <circle cx="10" cy="40" r="2" fill="#cbd5e0"/>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Circular Addressable Array</span>
      </div>
      <div class="component-info">
        <p>The NeoPixel Ring is a highly popular component for creating circular visual effects. It uses the same WS2812B protocol as the matrix, allowing for complex color patterns using a single data pin.</p>
        <p><strong>Daisy Chaining:</strong> You can connect multiple rings together by connecting the DOUT of one ring to the DIN of the next.</p>
        <div>
          <span class="tag">Circular</span>
          <span class="tag">Low Wire Count</span>
          <span class="tag">Programmable</span>
          <span class="tag">Daisy-Chainable</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">DIN</span></td><td><span class="pin-type data">Data In</span></td><td>Signal input. Connect to microcontroller.</td></tr>
      <tr><td><span class="pin-name">DOUT</span></td><td><span class="pin-type data">Data Out</span></td><td>Data output for daisy-chaining.</td></tr>
      <tr><td><span class="pin-name">VDD</span></td><td><span class="pin-type power">Power</span></td><td>Power supply (5V).</td></tr>
      <tr><td><span class="pin-name">VSS</span></td><td><span class="pin-type power">Power</span></td><td>Ground.</td></tr>
    </table>

    <div class="note">💡 <strong>Design Tip:</strong> NeoPixel rings are perfect for building "Iron Man" style arc reactors, circular loading bars, or status indicators.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>#include &lt;Adafruit_NeoPixel.h&gt;

Adafruit_NeoPixel ring(16, 6, NEO_GRB + NEO_KHZ800);

void setup() {
  ring.begin();
}

void loop() {
  for(int i=0; i<16; i++) {
    ring.setPixelColor(i, ring.Color(150, 0, 150)); // Purple
    ring.show();
    delay(100);
    ring.setPixelColor(i, ring.Color(0, 0, 0));
  }
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Control a 16-pixel NeoPixel ring. Open the workspace to see a circular rainbow animation.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Ring Circuit
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
  var code = \`#include <Adafruit_NeoPixel.h>\\n\\n#define PIN 6\\n#define PIXELS 16\\n\\nAdafruit_NeoPixel ring(PIXELS, PIN, NEO_GRB + NEO_KHZ800);\\n\\nvoid setup() {\\n  ring.begin();\\n}\\n\\nvoid loop() {\\n  for(int i=0; i<PIXELS; i++) {\\n    ring.setPixelColor(i, ring.Color(0, 0, 150));\\n    ring.show();\\n    delay(50);\\n    ring.setPixelColor(i, ring.Color(0, 0, 0));\\n  }\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "rng", type: "wokwi-neopixel-ring", x: 300, y: 50, attrs: { pixels: "16" } }
    ],
    connections: [
      [ "uno:6", "rng:DIN", "blue", [] ],
      [ "uno:5V", "rng:VDD", "red", [] ],
      [ "uno:GND.1", "rng:VSS", "black", [] ]
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

