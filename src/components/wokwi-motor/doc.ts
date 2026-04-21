export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>DC Motor Reference | OpenHW Studio</title>
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
    <h1>DC Motor</h1>
    <p class="subtitle">A basic DC motor that converts electrical energy to rotational motion.</p>

    <div class="component-preview">
      <svg width="100" height="50" viewBox="0 0 100 50">
        <rect x="20" y="5" width="60" height="40" fill="#a0aec0" rx="20"/>
        <rect x="80" y="20" width="20" height="10" fill="#718096"/>
      </svg>
      <div>
        <p>A simple brushed DC motor. Its rotation direction depends on the polarity of the voltage applied to its terminals, and its speed is proportional to the voltage level. To control direction and speed with a microcontroller, use an H-bridge driver like the L298N.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>1</td><td>Power</td><td>Terminal 1.</td></tr>
      <tr><td>2</td><td>Power</td><td>Terminal 2. Reversing polarity reverses rotation direction.</td></tr>
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
      { id: "motor", type: "wokwi-motor", x: 250, y: 50 },
      { id: "l293d", type: "wokwi-l293d", x: 150, y: 50 }
    ],
    connections: [
      ["uno:5V", "l293d:VCC1", "red", []],
      ["uno:5V", "l293d:VCC2", "red", []],
      ["uno:GND", "l293d:GND1", "black", []],
      ["uno:3", "l293d:EN1,2", "green", []],
      ["uno:4", "l293d:IN1", "blue", []],
      ["uno:5", "l293d:IN2", "purple", []],
      ["l293d:OUT1", "motor:1", "orange", []],
      ["l293d:OUT2", "motor:2", "yellow", []]
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
