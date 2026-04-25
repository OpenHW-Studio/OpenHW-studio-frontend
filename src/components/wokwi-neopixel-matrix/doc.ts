export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>WS2812B NeoPixel Matrix Reference | OpenHW Studio</title>
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
    <h1>WS2812B NeoPixel Matrix</h1>
    <p class="subtitle">An array of individually addressable RGB LEDs for high-density visual displays.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="100" height="100" viewBox="0 0 40 40">
          <rect x="0" y="0" width="40" height="40" fill="#2d3748" rx="2"/>
          <circle cx="10" cy="10" r="4" fill="#cbd5e0"/>
          <circle cx="30" cy="10" r="4" fill="#cbd5e0"/>
          <circle cx="10" cy="30" r="4" fill="#cbd5e0"/>
          <circle cx="30" cy="30" r="4" fill="#cbd5e0"/>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Individually Addressable</span>
      </div>
      <div class="component-info">
        <p>A NeoPixel matrix is a grid of WS2812B LEDs, each containing its own integrated driver chip. This allows you to control the color and brightness of every LED using just a single data pin.</p>
        <p><strong>Configurability:</strong> In OpenHW Studio, you can adjust the rows and columns via component attributes to simulate any matrix size.</p>
        <div>
          <span class="tag">RGB Color</span>
          <span class="tag">Addressable</span>
          <span class="tag">Single-Wire</span>
          <span class="tag">Scaleable</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">DIN</span></td><td><span class="pin-type data">Data Input</span></td><td>Signal input. Connect to a digital pin.</td></tr>
      <tr><td><span class="pin-name">VCC</span></td><td><span class="pin-type power">Power</span></td><td>Power supply (5V).</td></tr>
      <tr><td><span class="pin-name">GND</span></td><td><span class="pin-type power">Power</span></td><td>Common ground.</td></tr>
    </table>

    <div class="note">💡 <strong>Power Warning:</strong> Large NeoPixel matrices consume significant current when many LEDs are white/bright. Use an external 5V supply in real hardware.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>#include &lt;Adafruit_NeoPixel.h&gt;

#define PIN 6
#define NUMPIXELS 64 // For an 8x8 matrix

Adafruit_NeoPixel matrix(NUMPIXELS, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  matrix.begin();
}

void loop() {
  matrix.setPixelColor(0, matrix.Color(255, 0, 0)); // Red
  matrix.show();
  delay(500);
  matrix.clear();
  matrix.show();
  delay(500);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Light up an 8x8 NeoPixel matrix. Open the circuit to see a simple test animation in the simulation.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Matrix Circuit
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
  var code = \`#include <Adafruit_NeoPixel.h>\\n\\n#define PIN 6\\n#define NUMPIXELS 64\\n\\nAdafruit_NeoPixel pixels(NUMPIXELS, PIN, NEO_GRB + NEO_KHZ800);\\n\\nvoid setup() {\\n  pixels.begin();\\n}\\n\\nvoid loop() {\\n  for(int i=0; i<NUMPIXELS; i++) {\\n    pixels.setPixelColor(i, pixels.Color(0, 150, 0));\\n    pixels.show();\\n    delay(50);\\n    pixels.setPixelColor(i, pixels.Color(0, 0, 0));\\n  }\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "mat", type: "wokwi-neopixel-matrix", x: 300, y: 0, attrs: { rows: "8", cols: "8" } }
    ],
    connections: [
      [ "uno:6", "mat:DIN", "blue", [] ],
      [ "uno:5V", "mat:VCC", "red", [] ],
      [ "uno:GND.1", "mat:GND", "black", [] ]
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

