export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Analog Joystick Reference | OpenHW Studio</title>
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
    <h1>Analog Joystick</h1>
    <p class="subtitle">A 2-axis thumb joystick with an integrated push button.</p>

    <div class="component-preview">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="5" y="5" width="50" height="50" fill="#2d3748" rx="4"/>
        <circle cx="30" cy="30" r="15" fill="#4a5568" stroke="#1a202c" stroke-width="2"/>
        <circle cx="30" cy="30" r="6" fill="#a0aec0"/>
      </svg>
      <div>
        <p>The analog joystick is essentially two potentiometers mounted at 90 degrees to each other. By reading the variable voltage using Analog inputs, your microcontroller can determine the X and Y coordinates. It also includes a push button switch that activates when the joystick is pressed down.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>GND</td><td>Power</td><td>Ground connection.</td></tr>
      <tr><td>5V</td><td>Power</td><td>5V supply voltage.</td></tr>
      <tr><td>VRX</td><td>Analog</td><td>X-axis analog voltage output. Value usually sits at ~512 when centered (10-bit ADC).</td></tr>
      <tr><td>VRY</td><td>Analog</td><td>Y-axis analog voltage output. Value usually sits at ~512 when centered (10-bit ADC).</td></tr>
      <tr><td>SW</td><td>Digital</td><td>Switch output. Connects to ground when pressed, so use a pull-up resistor.</td></tr>
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
      { id: "joy", type: "wokwi-analog-joystick", x: 250, y: 0 }
    ],
    connections: [
      ["uno:5V", "joy:5V", "red", []],
      ["uno:GND", "joy:GND", "black", []],
      ["uno:A0", "joy:VRX", "orange", []],
      ["uno:A1", "joy:VRY", "yellow", []],
      ["uno:2", "joy:SW", "blue", []]
    ],
    code: "void setup() {\n  Serial.begin(9600);\n  pinMode(2, INPUT_PULLUP);\n}\nvoid loop() {\n  Serial.print(\\"X: \\"); Serial.print(analogRead(A0));\n  Serial.print(\\" Y: \\"); Serial.print(analogRead(A1));\n  Serial.print(\\" SW: \\"); Serial.println(digitalRead(2));\n  delay(100);\n}"
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
