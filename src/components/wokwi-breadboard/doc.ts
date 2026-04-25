export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Breadboard Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
</style>
</head>
<body>
<div class="content">
    <h1>Breadboard</h1>
    <p class="subtitle">A full-sized solderless breadboard for prototyping circuits.</p>

    <div class="component-preview">
      <svg width="200" height="60" viewBox="0 0 200 60">
        <rect x="0" y="0" width="200" height="60" fill="#e2e8f0" rx="4"/>
        <!-- Power rails mock -->
        <rect x="10" y="5" width="180" height="2" fill="#e53e3e"/>
        <rect x="10" y="10" width="180" height="2" fill="#2b6cb0"/>
        
        <!-- Terminal strips mock -->
        <rect x="10" y="25" width="180" height="10" fill="#cbd5e0"/>
        
        <!-- Power rails bottom -->
        <rect x="10" y="48" width="180" height="2" fill="#e53e3e"/>
        <rect x="10" y="53" width="180" height="2" fill="#2b6cb0"/>
      </svg>
      <div>
        <p>Breadboards are the fundamental tool for building and testing circuits without soldering.</p>
        <p><strong>Power Rails (Bus strips):</strong> The long horizontal strips on the top and bottom. Usually marked with red (+) and blue (-). These strips are connected horizontally across the entire board.</p>
        <p><strong>Terminal Strips:</strong> The two groups of vertical columns in the middle. The 5 holes in each vertical column (A-E or F-J) are connected electrically. Components inserted into the same column will be electrically joined.</p>
      </div>
    </div>
</div>
</body>
</html>
`;
