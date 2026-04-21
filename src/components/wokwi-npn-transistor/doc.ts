export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NPN Transistor Reference | OpenHW Studio</title>
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
    <h1>NPN Transistor</h1>
    <p class="subtitle">A basic bipolar junction transistor used for switching and amplification.</p>

    <div class="component-preview">
      <svg width="20" height="30" viewBox="0 0 20 30">
        <path d="M 0 10 Q 10 -5 20 10 L 20 20 L 0 20 Z" fill="#2d3748"/>
        <!-- Pins -->
        <rect x="2" y="20" width="2" height="10" fill="#a0aec0"/>
        <rect x="9" y="20" width="2" height="10" fill="#a0aec0"/>
        <rect x="16" y="20" width="2" height="10" fill="#a0aec0"/>
      </svg>
      <div>
        <p>A conventional NPN transistor (e.g., 2N2222 or BC547). It acts like an electrically controlled switch: a small current flowing into the Base (B) allows a much larger current to flow from the Collector (C) to the Emitter (E).</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>E</td><td>Output</td><td>Emitter. Usually connected to ground in a switching circuit.</td></tr>
      <tr><td>B</td><td>Input</td><td>Base. Control pin. Must have a series resistor to limit current.</td></tr>
      <tr><td>C</td><td>Power/Input</td><td>Collector. Connected to the load (e.g., LED, motor).</td></tr>
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
      { id: "npn", type: "wokwi-npn-transistor", x: 250, y: 20 },
      { id: "led", type: "wokwi-led", x: 270, y: -40 },
      { id: "res1", type: "wokwi-resistor", x: 150, y: 40, attrs: { value: "1000" } },
      { id: "res2", type: "wokwi-resistor", x: 270, y: -10, attrs: { value: "220" } }
    ],
    connections: [
      ["uno:GND", "npn:E", "black", []],
      ["uno:3", "res1:1", "green", []],
      ["res1:2", "npn:B", "blue", []],
      ["npn:C", "res2:2", "yellow", []],
      ["res2:1", "led:C", "orange", []],
      ["led:A", "uno:5V", "red", []]
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
