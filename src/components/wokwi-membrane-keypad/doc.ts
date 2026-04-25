export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Membrane Keypad Reference | OpenHW Studio</title>
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
    <h1>Membrane Keypad (4x4)</h1>
    <p class="subtitle">A 16-button keypad arranged in a 4x4 matrix.</p>

    <div class="component-preview">
      <svg width="60" height="70" viewBox="0 0 60 70">
        <rect x="0" y="0" width="60" height="60" fill="#2d3748" rx="2"/>
        <!-- Matrix lines visually -->
        <rect x="10" y="60" width="40" height="10" fill="#4a5568"/>
        <!-- Keys -->
        <rect x="5" y="5" width="10" height="10" fill="#1a202c"/>
        <rect x="20" y="5" width="10" height="10" fill="#1a202c"/>
        <rect x="35" y="5" width="10" height="10" fill="#1a202c"/>
        <rect x="50" y="5" width="10" height="10" fill="#1a202c"/>
        <rect x="5" y="20" width="10" height="10" fill="#1a202c"/>
        <rect x="20" y="20" width="10" height="10" fill="#1a202c"/>
      </svg>
      <div>
        <p>This keypad uses a matrix to minimize the number of pins required. A 4x4 keypad has 16 buttons but only needs 8 pins (4 rows, 4 columns). To read it, the microcontroller rapidly drives one row LOW at a time and checks which column pins are pulled LOW by a button press.</p>
        <p>The standard <code>Keypad.h</code> library makes it incredibly easy to use.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>R1 - R4</td><td>Input/Output</td><td>Row pins 1 through 4.</td></tr>
      <tr><td>C1 - C4</td><td>Input/Output</td><td>Column pins 1 through 4.</td></tr>
    </table>
</div>
</body>
</html>
`;
