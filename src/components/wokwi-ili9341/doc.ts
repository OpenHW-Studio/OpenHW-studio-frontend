export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>ILI9341 TFT LCD Reference | OpenHW Studio</title>
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
    <h1>ILI9341 2.8" TFT LCD</h1>
    <p class="subtitle">A full-color SPI TFT graphical display module.</p>

    <div class="component-preview">
      <svg width="160" height="240" viewBox="0 0 160 240">
        <rect x="0" y="0" width="160" height="240" fill="#ce3333" rx="4"/> <!-- Red PCB -->
        <rect x="10" y="10" width="140" height="190" fill="#111" stroke="#333" stroke-width="2"/> <!-- Screen area -->
        
        <!-- Pins at bottom -->
        <rect x="40" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="50" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="60" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="70" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="80" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="90" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="100" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="110" y="235" width="4" height="5" fill="#f6e05e"/>
        <rect x="120" y="235" width="4" height="5" fill="#f6e05e"/>
      </svg>
      <div>
        <p>The ILI9341 is a popular 2.8-inch TFT LCD controller. It provides a 320x240 pixel full-color display and communicates with the microcontroller via an SPI interface.</p>
        <p>It's widely used with libraries like Adafruit_ILI9341 and Adafruit_GFX for drawing text, shapes, and images.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (typically 3.3V or 5V depending on module).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>CS</td><td>Input</td><td>Chip Select (Active LOW).</td></tr>
      <tr><td>RESET</td><td>Input</td><td>Hardware Reset (Active LOW).</td></tr>
      <tr><td>DC</td><td>Input</td><td>Data/Command toggle. HIGH for data, LOW for command.</td></tr>
      <tr><td>MOSI</td><td>Input</td><td>SPI Master Out Slave In (Data).</td></tr>
      <tr><td>SCK</td><td>Input</td><td>SPI Serial Clock.</td></tr>
      <tr><td>LED</td><td>Input/Power</td><td>Backlight control (Connect to VCC to turn on).</td></tr>
      <tr><td>MISO</td><td>Output</td><td>SPI Master In Slave Out (Data from display to MCU).</td></tr>
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
      { id: "lcd", type: "wokwi-ili9341", x: 300, y: -50 }
    ],
    connections: [
      ["uno:5V", "lcd:VCC", "red", []],
      ["uno:GND", "lcd:GND", "black", []],
      ["uno:10", "lcd:CS", "green", []],
      ["uno:9", "lcd:DC", "yellow", []],
      ["uno:8", "lcd:RESET", "purple", []],
      ["uno:11", "lcd:MOSI", "blue", []],
      ["uno:13", "lcd:SCK", "orange", []],
      ["uno:12", "lcd:MISO", "grey", []],
      ["uno:5V", "lcd:LED", "red", []]
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
