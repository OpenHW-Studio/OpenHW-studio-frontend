export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>A4988 Stepper Driver Reference | OpenHW Studio</title>
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
    <h1>A4988 Stepper Driver</h1>
    <p class="subtitle">A microstepping driver for bipolar stepper motors with built-in translator.</p>

    <div class="component-preview">
      <svg width="50" height="80" viewBox="0 0 50 80">
        <rect x="0" y="0" width="50" height="80" fill="#c53030" rx="2"/>
        <rect x="15" y="30" width="20" height="20" fill="#111"/>
      </svg>
      <div>
        <p>The A4988 makes it extremely easy to drive a bipolar stepper motor. Instead of manually cycling through motor phases, you simply pulse the STEP pin telling the motor to move one step, while the DIR pin sets the direction. It also supports microstepping (1/2, 1/4, 1/8, and 1/16) via the MS1-MS3 pins.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VMOT, GND_MOT</td><td>Power</td><td>Motor power supply (8V-35V).</td></tr>
      <tr><td>VDD, GND_LOGIC</td><td>Power</td><td>Logic power supply (3V-5.5V).</td></tr>
      <tr><td>1A, 1B, 2A, 2B</td><td>Output</td><td>Connections to the bipolar stepper motor.</td></tr>
      <tr><td>STEP</td><td>Input</td><td>Pulsing HIGH advances the motor by one step.</td></tr>
      <tr><td>DIR</td><td>Input</td><td>HIGH for clockwise, LOW for counter-clockwise.</td></tr>
      <tr><td>MS1, MS2, MS3</td><td>Input</td><td>Microstepping configuration bits.</td></tr>
      <tr><td>ENABLE</td><td>Input</td><td>Active-low. Set HIGH to disable outputs.</td></tr>
      <tr><td>RESET, SLEEP</td><td>Input</td><td>Active-low control pins. Usually tied together if unused.</td></tr>
    </table>
</div>
</body>
</html>
`;
