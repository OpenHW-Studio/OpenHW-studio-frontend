export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>7-Segment Display Reference | OpenHW Studio</title>
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
    <h1>7-Segment Display</h1>
    <p class="subtitle">A multiplexed multi-digit 7-segment LED display, available in common cathode and common anode configurations.</p>

    <div class="component-preview">
      <svg width="260" height="70" viewBox="0 0 260 70">
        <rect x="0" y="5" width="260" height="60" fill="#cc0000" stroke="#ff4444" stroke-width="2" rx="4"/>
        <text x="130" y="45" fill="#fff" font-family="monospace" font-size="40" font-weight="bold" text-anchor="middle">88:88</text>
      </svg>
      <div style="margin-top: 15px;">
        <p>The 7-segment display allows you to display numbers and some letters. In multi-digit displays, segments (A-G) are shared, and "DIG" pins allow multiplexing to display different characters on each digit rapidly.</p>
        <p><strong>Attributes:</strong></p>
        <ul>
          <li><code>color</code>: LED Color (e.g., red, green, blue).</li>
          <li><code>common</code>: 'cathode' or 'anode'.</li>
          <li><code>digits</code>: Number of digits (1 to 4).</li>
        </ul>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Name</th><th>Description</th></tr>
      <tr><td>A - G</td><td>Segments</td><td>Controls the individual LED segments.</td></tr>
      <tr><td>DP</td><td>Decimal Point</td><td>Controls the decimal point LED.</td></tr>
      <tr><td>DIG1 - DIG4</td><td>Digit Select</td><td>Selects which digit is currently active. For Common Cathode, drive LOW to activate. For Common Anode, drive HIGH.</td></tr>
      <tr><td>COLON</td><td>Colon</td><td>Controls the center colon (if present).</td></tr>
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
      { id: "seg1", type: "wokwi-7segment", x: 250, y: 0, attrs: { color: "red", common: "cathode", digits: "1" } }
    ],
    connections: [
      ["uno:GND", "seg1:DIG1", "black", []],
      ["uno:2", "seg1:A", "green", []],
      ["uno:3", "seg1:B", "green", []]
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
