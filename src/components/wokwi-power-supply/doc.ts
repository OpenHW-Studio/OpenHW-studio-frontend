export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Power Supply Reference | OpenHW Studio</title>
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
    <h1>Power Supply</h1>
    <p class="subtitle">A configurable DC power supply for standalone circuits.</p>

    <div class="component-preview">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="0" y="0" width="60" height="60" fill="#2d3748" rx="4"/>
        <text x="30" y="35" fill="#f6e05e" font-weight="bold" text-anchor="middle">5.0V</text>
        <circle cx="5" cy="5" r="2" fill="#111"/>
        <circle cx="55" cy="5" r="2" fill="#111"/>
        <circle cx="5" cy="55" r="2" fill="#111"/>
        <circle cx="55" cy="55" r="2" fill="#111"/>
      </svg>
      <div>
        <p>The power supply provides a stable regulated DC voltage to the circuit without needing an MCU. You can configure the output voltage via the component attributes (e.g., to 3.3V, 5V, 9V, or 12V).</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>5V (or VCC)</td><td>Power</td><td>Positive voltage output (determined by the voltage attribute).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
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
      { id: "pwr", type: "wokwi-power-supply", x: 0, y: 0, attrs: { voltage: "5.0" } },
      { id: "led", type: "wokwi-led", x: 150, y: -20 },
      { id: "res", type: "wokwi-resistor", x: 150, y: 40, attrs: { value: "220" } }
    ],
    connections: [
      ["pwr:5V", "led:A", "red", []],
      ["led:C", "res:2", "green", []],
      ["res:1", "pwr:GND", "black", []]
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
