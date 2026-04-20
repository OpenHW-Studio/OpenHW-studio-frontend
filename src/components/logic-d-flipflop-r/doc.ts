export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>D Flip-Flop (Reset) Reference | OpenHW Studio</title>
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
  .truth-table { width: 100%; max-width: 500px; border-collapse: collapse; margin: 20px 0; }
  .truth-table th, .truth-table td { padding: 8px; border: 1px solid #2d3748; text-align: center; }
  .truth-table th { background: #1a1f2e; color: #63b3ed; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="content">
    <h1>D Flip-Flop (Reset)</h1>
    <p class="subtitle">Edge-triggered data flip-flop with active-HIGH asynchronous Reset.</p>

    <div class="component-preview">
      <svg width="120" height="100" viewBox="0 0 90 80">
        <rect x="15" y="10" width="60" height="60" fill="none" stroke="#63b3ed" stroke-width="2"/>
        <line x1="0" y1="22" x2="15" y2="22" stroke="#63b3ed" stroke-width="2"/>
        <text x="20" y="27" fill="#63b3ed" font-size="12" font-family="sans-serif">D</text>
        <line x1="0" y1="58" x2="15" y2="58" stroke="#63b3ed" stroke-width="2"/>
        <path d="M 15 53 L 25 58 L 15 63" fill="none" stroke="#63b3ed" stroke-width="2"/>
        
        <line x1="45" y1="70" x2="45" y2="80" stroke="#63b3ed" stroke-width="2"/>
        <text x="41" y="93" fill="#63b3ed" font-size="12" font-family="sans-serif">R</text>

        <line x1="75" y1="22" x2="90" y2="22" stroke="#63b3ed" stroke-width="2"/>
        <text x="60" y="27" fill="#63b3ed" font-size="12" font-family="sans-serif">Q</text>
        <line x1="75" y1="58" x2="90" y2="58" stroke="#63b3ed" stroke-width="2"/>
        <text x="50" y="63" fill="#63b3ed" font-size="12" font-family="sans-serif">Q\u0304</text>
      </svg>
      <div style="margin-top: 10px;">
        <p>This D flip-flop adds an asynchronous Reset (R) control. This input takes priority over the clock. When R is HIGH, Q becomes LOW immediately.</p>
      </div>
    </div>

    <h2>Truth Table</h2>
    <table class="truth-table">
      <tr><th>R</th><th>CLK</th><th>D</th><th>Q (Next)</th><th>Q\u0304 (Next)</th></tr>
      <tr><td>1</td><td>X</td><td>X</td><td>0</td><td>1</td></tr>
      <tr><td>0</td><td>↑ (Rising)</td><td>0</td><td>0</td><td>1</td></tr>
      <tr><td>0</td><td>↑ (Rising)</td><td>1</td><td>1</td><td>0</td></tr>
    </table>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>D</td><td>Input</td><td>Data input.</td></tr>
      <tr><td>CLK</td><td>Input</td><td>Clock input (rising-edge triggered).</td></tr>
      <tr><td>R</td><td>Input</td><td>Asynchronous Reset (Active HIGH forces Q=0).</td></tr>
      <tr><td>Q</td><td>Output</td><td>Output.</td></tr>
      <tr><td>Q\u0304</td><td>Output</td><td>Inverted output.</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "none",
    components: [
      { id: "dff1", type: "logic-d-flipflop-r", x: 300, y: 150 },
      { id: "clk1", type: "logic-clock-generator", x: 150, y: 170, attrs: { frequency: "1", units: "Hz" } },
      { id: "sw1", type: "wokwi-pushbutton", x: 150, y: 100 }
    ],
    connections: [
      ["sw1:1", "dff1:D", "green", []],
      ["clk1:OUT", "dff1:CLK", "blue", []]
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
