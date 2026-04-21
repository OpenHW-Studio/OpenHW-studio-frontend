export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MAX7219 Led Matrix Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
  h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 36px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #2d3748; }
  .pin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  .pin-table th { background: #1a1f2e; color: #63b3ed; padding: 10px 14px; text-align: left; border: 1px solid #2d3748; }
  .pin-table td { padding: 10px 14px; border: 1px solid #2d3748; color: #a0aec0; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="content">
    <h1>MAX7219 Dot Matrix</h1>
    <p class="subtitle">An 8x8 LED matrix display driven by the MAX7219 IC.</p>

    <div class="component-preview">
      <svg width="120" height="80" viewBox="0 0 120 80">
        <rect x="15" y="0" width="90" height="80" fill="#111" stroke="#333" stroke-width="2" rx="2"/>
        
        <!-- Left pins (In) -->
        <line x1="0" y1="20" x2="15" y2="20" stroke="#63b3ed" stroke-width="2"/><text x="18" y="24" fill="#a0aec0" font-size="8">VCC</text>
        <line x1="0" y1="30" x2="15" y2="30" stroke="#63b3ed" stroke-width="2"/><text x="18" y="34" fill="#a0aec0" font-size="8">GND</text>
        <line x1="0" y1="40" x2="15" y2="40" stroke="#63b3ed" stroke-width="2"/><text x="18" y="44" fill="#a0aec0" font-size="8">DIN</text>
        <line x1="0" y1="50" x2="15" y2="50" stroke="#63b3ed" stroke-width="2"/><text x="18" y="54" fill="#a0aec0" font-size="8">CS</text>
        <line x1="0" y1="60" x2="15" y2="60" stroke="#63b3ed" stroke-width="2"/><text x="18" y="64" fill="#a0aec0" font-size="8">CLK</text>

        <!-- Right pins (Out) -->
        <line x1="105" y1="20" x2="120" y2="20" stroke="#63b3ed" stroke-width="2"/>
        <line x1="105" y1="30" x2="120" y2="30" stroke="#63b3ed" stroke-width="2"/>
        <line x1="105" y1="40" x2="120" y2="40" stroke="#63b3ed" stroke-width="2"/>
        <line x1="105" y1="50" x2="120" y2="50" stroke="#63b3ed" stroke-width="2"/>
        <line x1="105" y1="60" x2="120" y2="60" stroke="#63b3ed" stroke-width="2"/>

        <!-- Dots -->
        <circle cx="30" cy="20" r="2" fill="#e53e3e"/>
        <circle cx="45" cy="30" r="2" fill="#e53e3e"/>
        <circle cx="60" cy="40" r="2" fill="#e53e3e"/>
        <circle cx="75" cy="50" r="2" fill="#e53e3e"/>
      </svg>
      <div>
        <p>The MAX7219 module simplifies driving an 8x8 matrix of 64 LEDs. It uses an SPI-like serial interface (DIN, CS, CLK) and handles the multiplexing automatically. Multiple modules can be daisy-chained together by connecting the output pins of one to the input pins of the next.</p>
        <p><strong>Attributes:</strong></p>
        <ul>
          <li><code>color</code>: LED Color (e.g., red, green, blue). Default is red.</li>
        </ul>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply input (5V).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>DIN</td><td>Input</td><td>Serial Data In.</td></tr>
      <tr><td>CS</td><td>Input</td><td>Chip Select (Load).</td></tr>
      <tr><td>CLK</td><td>Input</td><td>Serial Clock.</td></tr>
      <tr><td>VCC_OUT</td><td>Power</td><td>Target VCC for daisy-chaining.</td></tr>
      <tr><td>GND_OUT</td><td>Power</td><td>Target GND for daisy-chaining.</td></tr>
      <tr><td>DOUT</td><td>Output</td><td>Serial Data Out for daisy-chaining.</td></tr>
      <tr><td>CS_OUT</td><td>Output</td><td>Target CS for daisy-chaining.</td></tr>
      <tr><td>CLK_OUT</td><td>Output</td><td>Target CLK for daisy-chaining.</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "arduino-uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "matrix", type: "wokwi-max7219", x: 300, y: 0 }
    ],
    connections: [
      ["uno:5V", "matrix:VCC", "red", []],
      ["uno:GND", "matrix:GND", "black", []],
      ["uno:11", "matrix:DIN", "green", []],
      ["uno:10", "matrix:CS", "blue", []],
      ["uno:13", "matrix:CLK", "yellow", []]
    ],
    code: ""
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
