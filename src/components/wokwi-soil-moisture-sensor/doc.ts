export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Soil Moisture Sensor Reference | OpenHW Studio</title>
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
    <h1>Soil Moisture Sensor</h1>
    <p class="subtitle">An analog sensor for measuring the volumetric water content in soil.</p>

    <div class="component-preview">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <path d="M 0 20 L 40 20 Q 50 20 50 30 L 50 60 Q 30 50 0 20" fill="#2d3748"/>
      </svg>
      <div>
        <p>This sensor measures moisture by detecting the resistance spanning across two exposed pads. Water is conductive, so more water implies less resistance. The analog output of the sensor provides a voltage representation of this resistance.</p>
        <p>In the simulation, you can click on the sensor to adjust the simulated moisture level slider.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (3.3V or 5V).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>SIG</td><td>Analog Output</td><td>Analog voltage indicating moisture level. Connect to an ADC pin like A0.</td></tr>
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
      { id: "soil", type: "wokwi-soil-moisture-sensor", x: 250, y: 0 }
    ],
    connections: [
      ["uno:5V", "soil:VCC", "red", []],
      ["uno:GND", "soil:GND", "black", []],
      ["uno:A0", "soil:SIG", "blue", []]
    ],
    code: "void setup() { Serial.begin(9600); }\nvoid loop() { int val = analogRead(A0); Serial.println(val); delay(200); }"
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
