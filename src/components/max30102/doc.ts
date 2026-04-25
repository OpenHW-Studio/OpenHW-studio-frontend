export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MAX30102 Reference | OpenHW Studio</title>
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
</style>
</head>
<body>
<div class="content">
    <h1>MAX30102 Heart Rate Sensor</h1>
    <p class="subtitle">An optical pulse oximetry and heart-rate sensor module.</p>

    <div class="component-preview">
      <svg width="60" height="40" viewBox="0 0 60 40">
        <rect x="0" y="0" width="60" height="40" fill="#2d3748" rx="2"/>
        <rect x="25" y="15" width="10" height="10" fill="#111"/> <!-- Sensor eye -->
        <circle cx="5" cy="5" r="2" fill="#cbd5e0"/> <!-- Mounting hole -->
      </svg>
      <div>
        <p>The MAX30102 integrates internal LEDs, photodetectors, optical elements, and low-noise electronics with ambient light rejection. It communicates over I2C and is widely used for fitness and medical applications to measure heart rate and blood oxygen levels (SpO2) using optical reflection.</p>
        <p>It operates internally on 1.8V but breakout boards typically include a 3.3V or 5V regulator and level shifters.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VIN</td><td>Power</td><td>Power supply input.</td></tr>
      <tr><td>SDA</td><td>I2C</td><td>Serial Data Line. Connects to A4 on an Arduino Uno.</td></tr>
      <tr><td>SCL</td><td>I2C</td><td>Serial Clock Line. Connects to A5 on an Arduino Uno.</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>INT</td><td>Output</td><td>Interrupt output. Active low.</td></tr>
      <tr><td>IRD, RD</td><td>Digital</td><td>Additional LED control pins on some breakout boards. Often left unconnected.</td></tr>
    </table>
</div>
</body>
</html>
`;
