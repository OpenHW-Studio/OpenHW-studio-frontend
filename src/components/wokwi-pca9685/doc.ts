export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>PCA9685 Servo Pi HAT Reference | OpenHW Studio</title>
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
    <h1>Servo Pi HAT (PCA9685)</h1>
    <p class="subtitle">A 16-channel, 12-bit PWM controller HAT designed for Raspberry Pi.</p>

    <div class="component-preview">
      <svg width="180" height="150" viewBox="0 0 180 150">
        <rect x="0" y="0" width="180" height="150" fill="#2d3748" rx="4"/>
        <text x="90" y="60" fill="#a0aec0" font-family="sans-serif" font-size="14" text-anchor="middle">PCA9685 HAT</text>
        
        <!-- Header pins mock -->
        <rect x="10" y="10" width="160" height="10" fill="#111" rx="1"/>
        
        <!-- Servo headers mock -->
        <rect x="20" y="120" width="120" height="20" fill="#111" rx="1"/>
      </svg>
      <div>
        <p>This HAT uses the PCA9685 chip, providing 16 channels of 12-bit PWM output strictly via I2C. It features a full Raspberry Pi GPIO header pass-through, but only connects to the SDA and SCL pins internally.</p>
        <p>It's generally used for controlling multiple servos or LEDs without utilizing precious PWM-capable GPIO pins on the main controller.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>SDA, SCL</td><td>Bidirectional</td><td>I2C Data and Clock lines.</td></tr>
      <tr><td>5V, 3.3V, GND</td><td>Power</td><td>Pi header power lines.</td></tr>
      <tr><td>V+_IN, GND_IN</td><td>Power</td><td>Dedicated external power for servos.</td></tr>
      <tr><td>S0-S15</td><td>Output</td><td>PWM signal lines for the 16 channels.</td></tr>
      <tr><td>V+0-15, G0-15</td><td>Power</td><td>Corresponding Voltage and Ground for each servo channel.</td></tr>
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
      { id: "hat", type: "wokwi-pca9685", x: 0, y: 0 }
    ],
    connections: [],
    code: ""
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
