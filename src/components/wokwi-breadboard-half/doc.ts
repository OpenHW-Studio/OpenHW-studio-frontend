export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Half Breadboard Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
</style>
</head>
<body>
<div class="content">
    <h1>Half Breadboard</h1>
    <p class="subtitle">A half-sized solderless breadboard (400 tie-points).</p>

    <div class="component-preview">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <rect x="0" y="0" width="100" height="60" fill="#e2e8f0" rx="4"/>
        <rect x="5" y="5" width="90" height="2" fill="#e53e3e"/>
        <rect x="5" y="10" width="90" height="2" fill="#2b6cb0"/>
        
        <rect x="5" y="25" width="90" height="10" fill="#cbd5e0"/>
        
        <rect x="5" y="48" width="90" height="2" fill="#e53e3e"/>
        <rect x="5" y="53" width="90" height="2" fill="#2b6cb0"/>
      </svg>
      <div>
        <p>A smaller version of the standard breadboard, featuring 30 terminal columns (A-J) and standard power rails on the top and bottom. Ideal for smaller circuits.</p>
        <p>Like the full breadboard, the horizontal rails are for power distribution, and the vertical 5-hole columns connect components together.</p>
      </div>
    </div>
</div>
</body>
</html>
`;
