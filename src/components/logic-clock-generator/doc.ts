export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Clock Generator Reference | OpenHW Studio</title>
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
    <h1>Clock Generator</h1>
    <p class="subtitle">Adjustable Clock Generator. Outputs a continuous square wave.</p>

    <div class="component-preview">
      <svg width="120" height="80" viewBox="0 0 100 80">
        <rect x="10" y="10" width="60" height="60" fill="none" stroke="#63b3ed" stroke-width="2"/>
        <path d="M 20 40 L 30 40 L 30 25 L 50 25 L 50 55 L 70 55" fill="none" stroke="#63b3ed" stroke-width="2"/>
        <line x1="70" y1="40" x2="90" y2="40" stroke="#63b3ed" stroke-width="2"/>
      </svg>
      <div>
        <p>The Clock Generator produces a continuous square wave signal. It provides a timing reference used to synchronize sequential logic circuits like flip-flops, counters, and microcontrollers.</p>
        <p><strong>Attributes:</strong></p>
        <ul>
          <li><code>frequency</code>: Sets the clock speed. (Default: 10)</li>
          <li><code>units</code>: Sets the unit (Hz, KHz, MHz). (Default: KHz)</li>
        </ul>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>OUT</td><td>Output</td><td>Digital pulse output. Alternates HIGH and LOW based on frequency.</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the Clock Generator to drive an LED.</p>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "none",
    components: [
      { id: "clk1", type: "logic-clock-generator", x: 200, y: 150, attrs: { frequency: "1", units: "Hz" } },
      { id: "led1", type: "wokwi-led", x: 300, y: 150 }
    ],
    connections: [
      ["clk1:OUT", "led1:A", "green", []]
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
