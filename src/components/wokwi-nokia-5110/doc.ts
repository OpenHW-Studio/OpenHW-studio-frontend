export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Nokia 5110 Screen Reference | OpenHW Studio</title>
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
    <h1>Nokia 5110 LCD</h1>
    <p class="subtitle">An 84x48 pixel monochrome graphic LCD originally used in Nokia 5110 mobile phones.</p>

    <div class="component-preview">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <rect x="0" y="0" width="100" height="100" fill="#2d3748" rx="4"/>
        <rect x="10" y="10" width="80" height="50" fill="#9de65e" stroke="#333" stroke-width="1"/>
        <line x1="10" y1="18" x2="90" y2="18" stroke="#7ab548" stroke-width="1"/>
        <!-- Text representation on screen -->
        <text x="50" y="35" fill="#111" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">NOKIA</text>

        <!-- Pins -->
        <line x1="14" y1="70" x2="14" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="24" y1="70" x2="24" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="34" y1="70" x2="34" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="44" y1="70" x2="44" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="54" y1="70" x2="54" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="64" y1="70" x2="64" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="74" y1="70" x2="74" y2="90" stroke="#f6e05e" stroke-width="2"/>
        <line x1="84" y1="70" x2="84" y2="90" stroke="#f6e05e" stroke-width="2"/>
      </svg>
      <div>
        <p>The Nokia 5110 LCD uses the PCD8544 controller. It's a low-cost, low-power display perfect for simple graphics or text output using an SPI interface.</p>
        <p><strong>Note:</strong> Most Nokia 5110 modules operate strictly at 3.3V logic levels. Connecting to 5V microcontrollers like an Arduino Uno without logic level converters may damage the display or shorten its lifespan in real hardware, but is fine in simulation.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (3.3V).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>SCE</td><td>Input</td><td>Chip Enable (Active LOW).</td></tr>
      <tr><td>RST</td><td>Input</td><td>Reset (Active LOW).</td></tr>
      <tr><td>DC</td><td>Input</td><td>Data/Command (HIGH = Data, LOW = Command).</td></tr>
      <tr><td>DN</td><td>Input</td><td>Data In (MOSI).</td></tr>
      <tr><td>SCLK</td><td>Input</td><td>Serial Clock.</td></tr>
      <tr><td>LED</td><td>Input/Power</td><td>Backlight control.</td></tr>
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
      { id: "lcd", type: "wokwi-nokia-5110", x: 300, y: 0 }
    ],
    connections: [
      ["uno:3.3V", "lcd:VCC", "red", []],
      ["uno:GND", "lcd:GND", "black", []],
      ["uno:7", "lcd:SCLK", "yellow", []],
      ["uno:6", "lcd:DN", "green", []],
      ["uno:5", "lcd:DC", "blue", []],
      ["uno:4", "lcd:RST", "purple", []],
      ["uno:3", "lcd:SCE", "orange", []]
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
