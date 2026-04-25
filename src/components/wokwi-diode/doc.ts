export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Diode Reference | OpenHW Studio</title>
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
    <h1>Diode</h1>
    <p class="subtitle">A basic semiconductor device that allows current to flow in one direction only.</p>

    <div class="component-preview">
      <svg width="40" height="20" viewBox="0 0 40 20">
        <rect x="5" y="5" width="30" height="10" fill="#2d3748" rx="2"/>
        <line x1="28" y1="5" x2="28" y2="15" stroke="#cbd5e0" stroke-width="2"/>
        <line x1="0" y1="10" x2="5" y2="10" stroke="#a0aec0" stroke-width="2"/>
        <line x1="35" y1="10" x2="40" y2="10" stroke="#a0aec0" stroke-width="2"/>
      </svg>
      <div>
        <p>A standard rectifier diode (e.g., 1N4007 or 1N4148). The silver stripe denotes the cathode. Current flows from the anode to the cathode, but is blocked in the reverse direction.</p>
        <p>Often used in simulation as a flyback diode for motors to prevent voltage spikes, or for basic logic routing.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>A</td><td>Input</td><td>Anode (Positive). Current enters here.</td></tr>
      <tr><td>C</td><td>Output</td><td>Cathode (Negative). Denoted by the stripe. Current exits here.</td></tr>
    </table>
</div>
</body>
</html>
`;
