export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>L293D Motor Driver Reference | OpenHW Studio</title>
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
    <h1>Motor Driver (L293D)</h1>
    <p class="subtitle">A classic 16-pin dual H-bridge motor driver IC.</p>

    <div class="component-preview">
      <svg width="30" height="50" viewBox="0 0 30 50">
        <rect x="5" y="0" width="20" height="50" fill="#2d3748" rx="2"/>
        <path d="M 12 0 Q 15 5 18 0" fill="#2d3748" /> <!-- Notch -->
        <circle cx="10" cy="5" r="1.5" fill="#a0aec0"/> <!-- Pin 1 indicator -->
      </svg>
      <div>
        <p>The L293D is a standard IC designed to provide bidirectional drive currents up to 600mA at voltages from 4.5V to 36V. It can drive two DC motors or one bipolar stepper motor. The logic signals are independent of the motor supply voltage.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>EN1,2 / EN3,4</td><td>Input</td><td>Enable pins for channel pairs. Connect to PWM for speed control.</td></tr>
      <tr><td>IN1, IN2</td><td>Input</td><td>Direction pins for Motor 1 (OUT1/OUT2).</td></tr>
      <tr><td>IN3, IN4</td><td>Input</td><td>Direction pins for Motor 2 (OUT3/OUT4).</td></tr>
      <tr><td>OUT1, OUT2</td><td>Output</td><td>Terminals for Motor 1.</td></tr>
      <tr><td>OUT3, OUT4</td><td>Output</td><td>Terminals for Motor 2.</td></tr>
      <tr><td>VCC1</td><td>Power</td><td>Logic power supply (5V).</td></tr>
      <tr><td>VCC2</td><td>Power</td><td>Motor power supply.</td></tr>
      <tr><td>GND1-4</td><td>Power</td><td>Common ground connections and heat sink.</td></tr>
    </table>
</div>
</body>
</html>
`;
