export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>TM1637 Display Reference | OpenHW Studio</title>
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
    <h1>TM1637 Display</h1>
    <p class="subtitle">A 4-digit 7-segment display module driven by the TM1637 IC, requiring only 2 data pins.</p>

    <div class="component-preview">
      <svg width="120" height="50" viewBox="0 0 120 50">
        <rect x="0" y="0" width="120" height="50" fill="#2d3748" stroke="#63b3ed" stroke-width="2" rx="4"/>
        <rect x="25" y="10" width="90" height="30" fill="#bd0000"/>
        <text x="70" y="30" fill="#fff" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">12:34</text>
        
        <circle cx="10" cy="10" r="2" fill="#fff"/>
        <circle cx="10" cy="20" r="2" fill="#fff"/>
        <circle cx="10" cy="30" r="2" fill="#fff"/>
        <circle cx="10" cy="40" r="2" fill="#fff"/>
      </svg>
      <div>
        <p>The TM1637 module simplifies 7-segment displays by handling the multiplexing internally. It communicates using a 2-wire serial protocol (Clock and Data I/O), saving many GPIO pins on your microcontroller.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (3.3V to 5V).</td></tr>
      <tr><td>DIO</td><td>Data</td><td>Data I/O pin (bidirectional).</td></tr>
      <tr><td>CLK</td><td>Clock</td><td>Clock input for data synchronization.</td></tr>
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
      { id: "dsp1", type: "wokwi-tm1637-7segment", x: 250, y: 0 }
    ],
    connections: [
      ["uno:5V", "dsp1:VCC", "red", []],
      ["uno:GND", "dsp1:GND", "black", []],
      ["uno:2", "dsp1:DIO", "green", []],
      ["uno:3", "dsp1:CLK", "yellow", []]
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
