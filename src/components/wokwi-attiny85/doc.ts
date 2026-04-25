export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>ATtiny85 Reference | OpenHW Studio</title>
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
    <h1>ATtiny85 (Digispark)</h1>
    <p class="subtitle">A small 8-bit AVR microcontroller packaged on a Digispark-style board.</p>

    <div class="component-preview">
      <svg width="120" height="100" viewBox="0 0 120 100">
        <rect x="10" y="10" width="100" height="80" fill="#111" stroke="#333" stroke-width="2" rx="4"/>
        <text x="60" y="55" fill="#e2e8f0" font-family="sans-serif" font-size="12" text-anchor="middle" font-weight="bold">ATtiny85</text>
        <rect x="0" y="30" width="20" height="40" fill="#f6e05e"/> <!-- USB mock -->
      </svg>
      <div>
        <p>The ATtiny85 is a powerful but tiny microcontroller. The simulated version represents a Digispark board, which provides 6 I/O pins, 8 KB of flash memory, and 512 bytes of SRAM.</p>
        <p>It can be programmed using the Arduino IDE, though some standard libraries may not fit or be compatible.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>P0</td><td>I/O</td><td>Digital Pin 0 / AREF / MOSI / PWM / I2C SDA</td></tr>
      <tr><td>P1</td><td>I/O</td><td>Digital Pin 1 / MISO / PWM / Built-in LED</td></tr>
      <tr><td>P2</td><td>I/O</td><td>Digital Pin 2 / Analog In 1 / SCK / I2C SCL</td></tr>
      <tr><td>P3</td><td>I/O</td><td>Digital Pin 3 / Analog In 3 / USB+</td></tr>
      <tr><td>P4</td><td>I/O</td><td>Digital Pin 4 / Analog In 2 / PWM</td></tr>
      <tr><td>P5</td><td>I/O</td><td>Digital Pin 5 / Analog In 0 / RESET (Use with caution)</td></tr>
      <tr><td>5V</td><td>Power</td><td>5V regulated output (or input if USB is disconnected).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>VIN</td><td>Power</td><td>Voltage Input (7V-12V).</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "attiny85",
    components: [
      { id: "tiny", type: "wokwi-attiny85", x: 0, y: 0 }
    ],
    connections: [],
    code: "void setup() {\n  pinMode(1, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(1, HIGH);\n  delay(500);\n  digitalWrite(1, LOW);\n  delay(500);\n}\n"
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
