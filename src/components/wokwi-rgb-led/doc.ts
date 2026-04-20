export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>RGB LED Reference | OpenHW Studio</title>
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
    <h1>RGB LED (4-pin)</h1>
    <p class="subtitle">A classic 4-pin RGB (Red, Green, Blue) LED.</p>

    <div class="component-preview">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="15" r="10" fill="#fff" stroke="#cbd5e0" stroke-width="2"/>
        <rect x="5" y="30" width="2" height="10" fill="#a0aec0"/>
        <rect x="12" y="30" width="2" height="10" fill="#a0aec0"/> <!-- Common (longest) -->
        <rect x="19" y="30" width="2" height="10" fill="#a0aec0"/>
        <rect x="26" y="30" width="2" height="10" fill="#a0aec0"/>
      </svg>
      <div>
        <p>A simple multi-color LED. It contains 3 separate light-emitting diodes (Red, Green, Blue) with one common connection. By applying different PWM values (0-255 via <code>analogWrite()</code>) to the R, G, and B pins, you can mix the colors to produce millions of shades.</p>
        <p>By default, it functions as a <strong>Common Cathode</strong> LED (connect COM to GND and apply positive voltage to RGB). This can be changed in attributes to Common Anode.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>R</td><td>Input</td><td>Red color channel.</td></tr>
      <tr><td>COM</td><td>Power</td><td>Common terminal (Longest leg). Connect to GND for Cathode, or 5V for Anode.</td></tr>
      <tr><td>G</td><td>Input</td><td>Green color channel.</td></tr>
      <tr><td>B</td><td>Input</td><td>Blue color channel.</td></tr>
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
      { id: "rgb", type: "wokwi-rgb-led", x: 250, y: 0 },
      { id: "r_res", type: "wokwi-resistor", x: 150, y: 0, attrs: { value: "330" } },
      { id: "g_res", type: "wokwi-resistor", x: 150, y: 30, attrs: { value: "330" } },
      { id: "b_res", type: "wokwi-resistor", x: 150, y: 60, attrs: { value: "330" } }
    ],
    connections: [
      ["uno:GND", "rgb:COM", "black", []],
      ["uno:9", "r_res:1", "red", []],
      ["r_res:2", "rgb:R", "red", []],
      ["uno:10", "g_res:1", "green", []],
      ["g_res:2", "rgb:G", "green", []],
      ["uno:11", "b_res:1", "blue", []],
      ["b_res:2", "rgb:B", "blue", []]
    ],
    code: "void setup() {\n  pinMode(9, OUTPUT);\n  pinMode(10, OUTPUT);\n  pinMode(11, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(9, 255); analogWrite(10, 0); analogWrite(11, 0); delay(1000); // Red\n  analogWrite(9, 0); analogWrite(10, 255); analogWrite(11, 0); delay(1000); // Green\n  analogWrite(9, 0); analogWrite(10, 0); analogWrite(11, 255); delay(1000); // Blue\n}"
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
