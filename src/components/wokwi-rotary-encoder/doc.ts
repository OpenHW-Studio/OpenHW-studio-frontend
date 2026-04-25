export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Rotary Encoder Reference | OpenHW Studio</title>
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
    <h1>Rotary Encoder</h1>
    <p class="subtitle">An electromechanical device that converts rotation into digital signals.</p>

    <div class="component-preview">
      <svg width="40" height="50" viewBox="0 0 40 50">
        <rect x="5" y="10" width="30" height="40" fill="#2d3748" rx="2"/>
        <circle cx="20" cy="10" r="8" fill="#a0aec0"/> <!-- shaft -->
        <!-- Pins -->
        <rect x="0" y="20" width="5" height="2" fill="#cbd5e0"/>
        <rect x="0" y="25" width="5" height="2" fill="#cbd5e0"/>
        <rect x="0" y="30" width="5" height="2" fill="#cbd5e0"/>
        <rect x="0" y="35" width="5" height="2" fill="#cbd5e0"/>
        <rect x="0" y="40" width="5" height="2" fill="#cbd5e0"/>
      </svg>
      <div>
        <p>Unlike a potentiometer, a rotary encoder can be rotated indefinitely. It outputs staggered square waves (quadrature encoding) on the CLK and DT pins. The microcontroller interprets these pulses to determine the direction and amount of rotation. Often includes an internal push button.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>CLK</td><td>Digital</td><td>Phase A output. Often connected to an interrupt pin.</td></tr>
      <tr><td>DT</td><td>Digital</td><td>Phase B output. Used with CLK to determine direction.</td></tr>
      <tr><td>SW</td><td>Digital</td><td>Internal switch output. Active low.</td></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (if module has pull-ups).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground.</td></tr>
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
      { id: "encoder", type: "wokwi-rotary-encoder", x: 250, y: 0 }
    ],
    connections: [
      ["uno:GND", "encoder:GND", "black", []],
      ["uno:5V", "encoder:VCC", "red", []],
      ["uno:2", "encoder:CLK", "green", []],
      ["uno:3", "encoder:DT", "yellow", []],
      ["uno:4", "encoder:SW", "blue", []]
    ],
    code: "volatile int count = 0;\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(2, INPUT_PULLUP);\n  pinMode(3, INPUT_PULLUP);\n  attachInterrupt(digitalPinToInterrupt(2), updateEncoder, CHANGE);\n}\nvoid loop() { delay(100); }\nvoid updateEncoder() {\n  int MSB = digitalRead(2); //MSB = most significant bit\n  int LSB = digitalRead(3); //LSB = least significant bit\n  int encoded = (MSB << 1) | LSB;\n  int sum  = (lastEncoded << 2) | encoded;\n  if(sum == 0b1101 || sum == 0b0100 || sum == 0b0010 || sum == 0b1011) count ++;\n  if(sum == 0b1110 || sum == 0b0111 || sum == 0b0001 || sum == 0b1000) count --;\n  lastEncoded = encoded;\n  Serial.println(count);\n}"
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
