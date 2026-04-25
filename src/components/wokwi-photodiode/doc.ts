export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Photodiode Reference | OpenHW Studio</title>
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
    <h1>Photodiode</h1>
    <p class="subtitle">A semiconductor device that converts light into an electrical current.</p>

    <div class="component-preview">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="15" r="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="2"/>
        <rect x="15" y="25" width="2" height="15" fill="#a0aec0"/>
        <rect x="23" y="25" width="2" height="15" fill="#a0aec0"/>
      </svg>
      <div>
        <p>A photodiode generates a small current proportional to the intensity of the light striking it. It is usually operated in reverse-bias mode. Like a standard diode, it has two pins: Anode and Cathode.</p>
        <p>When measuring with a microcontroller, a transimpedance amplifier or a simple pull-up/pull-down resistor is often required to convert the small current into a measurable voltage.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>A</td><td>Input</td><td>Anode. Used for measurement or ground connection.</td></tr>
      <tr><td>C</td><td>Power/Input</td><td>Cathode. Usually connected to a positive voltage in reverse-bias.</td></tr>
    </table>
</div>
</body>
</html>
`;
