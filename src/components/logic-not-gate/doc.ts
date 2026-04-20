export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NOT Gate Reference | OpenHW Studio</title>
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
  .truth-table { width: 100%; max-width: 300px; border-collapse: collapse; margin: 20px 0; }
  .truth-table th, .truth-table td { padding: 8px; border: 1px solid #2d3748; text-align: center; }
  .truth-table th { background: #1a1f2e; color: #63b3ed; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="content">
    <h1>NOT Gate (Inverter)</h1>
    <p class="subtitle">A fundamental digital logic gate. Output is the opposite of the input.</p>

    <div class="component-preview">
      <svg width="120" height="80" viewBox="0 0 90 50">
        <path d="M20,10 L50,25 L20,40 Z" fill="none" stroke="#63b3ed" stroke-width="2" />
        <circle cx="55" cy="25" r="5" fill="none" stroke="#63b3ed" stroke-width="2" />
        <line x1="0" y1="25" x2="20" y2="25" stroke="#63b3ed" stroke-width="2" />
        <line x1="60" y1="25" x2="90" y2="25" stroke="#63b3ed" stroke-width="2" />
      </svg>
      <div>
        <p>The NOT gate implements logical negation. It is used to invert control signals and in oscillation circuits.</p>
      </div>
    </div>

    <h2>Truth Table</h2>
    <table class="truth-table">
      <tr><th>A</th><th>OUT</th></tr>
      <tr><td>0</td><td>1</td></tr>
      <tr><td>1</td><td>0</td></tr>
    </table>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>IN</td><td>Input</td><td>Logic input.</td></tr>
      <tr><td>OUT</td><td>Output</td><td>Inverted output (NOT A).</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the NOT gate in real-time.</p>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "none",
    components: [
      { id: "not1", type: "logic-not-gate", x: 200, y: 150 }
    ],
    connections: [],
    code: ""
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
