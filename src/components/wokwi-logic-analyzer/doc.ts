export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Logic Analyzer Reference | OpenHW Studio</title>
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
    <h1>8-Channel Logic Analyzer</h1>
    <p class="subtitle">A debugging tool to visualize digital signals over time.</p>

    <div class="component-preview">
      <svg width="50" height="30" viewBox="0 0 50 30">
        <rect x="0" y="0" width="50" height="30" fill="#111" rx="2"/>
        <text x="25" y="15" fill="#f6e05e" font-size="8" text-anchor="middle">ANALYZER</text>
        <!-- Bottom pins -->
        <rect x="5" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="10" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="15" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="20" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="25" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="30" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="35" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="40" y="30" width="2" height="3" fill="#f6e05e"/>
        <rect x="45" y="30" width="2" height="3" fill="#f6e05e"/>
      </svg>
      <div>
        <p>The Logic Analyzer records the digital state (HIGH or LOW) of up to 8 pins during the simulation. When the simulation is paused or stopped, you can download a VCD file containing the recorded signals, which can be viewed in tools like GTKWave or PulseView.</p>
        <p>It's invaluable for debugging protocols like SPI, I2C, UART, or complex timing issues.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>D0-D7</td><td>Input</td><td>Digital input channels to monitor.</td></tr>
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
      { id: "la", type: "wokwi-logic-analyzer", x: 250, y: -20 }
    ],
    connections: [
      ["uno:GND", "la:GND", "black", []],
      ["uno:13", "la:D0", "yellow", []],
      ["uno:TX", "la:D1", "green", []]
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
