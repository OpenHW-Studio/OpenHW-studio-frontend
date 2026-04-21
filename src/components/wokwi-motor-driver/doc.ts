export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>L298N Motor Driver Reference | OpenHW Studio</title>
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
    <h1>L298N Motor Driver</h1>
    <p class="subtitle">A dual H-bridge motor driver module capable of driving two DC motors.</p>

    <div class="component-preview">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <rect x="0" y="0" width="80" height="80" fill="#e53e3e" rx="4"/>
        <rect x="25" y="25" width="30" height="30" fill="#111"/> <!-- IC -->
        <rect x="10" y="0" width="60" height="10" fill="#2d3748"/> <!-- Connectors -->
        <rect x="10" y="70" width="60" height="10" fill="#2d3748"/>
      </svg>
      <div>
        <p>The L298N module is a high-power driver that can control the speed and direction of two DC motors simultaneously. It handles up to 2A per channel and supports motor supplies up to 46V. Speed is controlled by supplying a PWM signal to the Enable pins (ENA/ENB).</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>12V</td><td>Power</td><td>Motor power supply input (VMOT).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Common logic and motor ground.</td></tr>
      <tr><td>5V</td><td>Power / Output</td><td>5V logic power. Acts as an output if the onboard regulator is used.</td></tr>
      <tr><td>ENA, ENB</td><td>Input</td><td>PWM input for speed control of Motor A and B respectively.</td></tr>
      <tr><td>IN1, IN2</td><td>Input</td><td>Direction control inputs for Motor A.</td></tr>
      <tr><td>IN3, IN4</td><td>Input</td><td>Direction control inputs for Motor B.</td></tr>
      <tr><td>OUT1, OUT2</td><td>Output</td><td>Terminals to connect Motor A.</td></tr>
      <tr><td>OUT3, OUT4</td><td>Output</td><td>Terminals to connect Motor B.</td></tr>
    </table>
</div>
</body>
</html>
`;
