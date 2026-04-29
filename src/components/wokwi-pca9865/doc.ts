export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>PCA9865 PWM Breakout Reference | OpenHW Studio</title>
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
    <h1>16-Channel PWM Module (PCA9685/PCA9865)</h1>
    <p class="subtitle">An I2C-controlled PWM driver and servo controller breakout board.</p>

    <div class="component-preview">
      <svg width="160" height="80" viewBox="0 0 160 80">
        <rect x="0" y="0" width="160" height="80" fill="#2b6cb0" rx="4"/>
        <text x="80" y="45" fill="#e2e8f0" font-family="sans-serif" font-size="12" text-anchor="middle" font-weight="bold">PWM Breakout</text>
        
        <!-- Headers -->
        <rect x="0" y="20" width="5" height="40" fill="#111" rx="1"/>
        <rect x="155" y="20" width="5" height="40" fill="#111" rx="1"/>
        <rect x="25" y="60" width="115" height="15" fill="#111" rx="1"/>
      </svg>
      <div>
        <p>This module provides 16 channels of 12-bit PWM via an I2C connection, typically running at address 0x40. It's fully cascadable, allowing you to string together multiple modules to control up to 992 servos from just 2 data pins.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Logic power supply (3.3V or 5V).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Common logic and servo ground.</td></tr>
      <tr><td>SDA, SCL</td><td>Bidirectional</td><td>I2C Data and Clock lines.</td></tr>
      <tr><td>OE</td><td>Input</td><td>Output Enable (Active LOW). Disables all outputs when driven HIGH.</td></tr>
      <tr><td>V+ / V+_IN</td><td>Power</td><td>Servo power supply (up to 6V, handles high current).</td></tr>
      <tr><td>S0-S15</td><td>Output</td><td>PWM signal pins.</td></tr>
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
      { id: "pwm", type: "wokwi-pca9865", x: 300, y: 50 },
      { id: "ser", type: "wokwi-servo", x: 500, y: 0 }
    ],
    connections: [
      ["uno:5V", "pwm:VCC", "red", []],
      ["uno:5V", "pwm:V+_IN", "red", []],
      ["uno:GND", "pwm:GND", "black", []],
      ["uno:GND", "pwm:GND_IN", "black", []],
      ["uno:A4", "pwm:SDA", "green", []],
      ["uno:A5", "pwm:SCL", "yellow", []],
      ["pwm:S0", "ser:PWM", "green", []],
      ["pwm:V+0", "ser:V+", "red", []],
      ["pwm:G0", "ser:GND", "black", []]
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
