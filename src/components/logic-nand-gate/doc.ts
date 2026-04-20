export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>NAND Gate Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
  h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 36px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #2d3748; }
  .truth-table { width: 100%; max-width: 300px; border-collapse: collapse; margin: 20px 0; }
  .truth-table th, .truth-table td { padding: 8px; border: 1px solid #2d3748; text-align: center; }
  .truth-table th { background: #1a1f2e; color: #63b3ed; }
  .try-btn { display: inline-flex; align-items: center; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; }
</style>
</head>
<body>
<div class="content">
    <h1>NAND Gate</h1>
    <p class="subtitle">Universal logic gate. Output is LOW (0) only when both inputs are HIGH (1).</p>
    <div class="component-preview">
      <svg width="120" height="80" viewBox="0 0 100 60">
        <path d="M10,10 L40,10 A20,20 0 0,1 40,50 L10,50 Z" fill="none" stroke="#63b3ed" stroke-width="2" />
        <circle cx="65" cy="30" r="5" fill="none" stroke="#63b3ed" stroke-width="2" />
        <line x1="0" y1="20" x2="10" y2="20" stroke="#63b3ed" stroke-width="2" />
        <line x1="0" y1="40" x2="10" y2="40" stroke="#63b3ed" stroke-width="2" />
        <line x1="70" y1="30" x2="100" y2="30" stroke="#63b3ed" stroke-width="2" />
      </svg>
      <p>The NAND gate is a universal gate, meaning any other logic function can be implemented using only NAND gates.</p>
    </div>
    <h2>Truth Table</h2>
    <table class="truth-table">
      <tr><th>A</th><th>B</th><th>OUT</th></tr>
      <tr><td>0</td><td>0</td><td>1</td></tr>
      <tr><td>0</td><td>1</td><td>1</td></tr>
      <tr><td>1</td><td>0</td><td>1</td></tr>
      <tr><td>1</td><td>1</td><td>0</td></tr>
    </table>
    <button class="try-btn" onclick="openSimulator()">Try in Simulator</button>
</div>
<script>
function openSimulator() {
  var payload = { board: "none", components: [{ id: "nand1", type: "logic-nand-gate", x: 200, y: 150 }], connections: [], code: "" };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
\`;
