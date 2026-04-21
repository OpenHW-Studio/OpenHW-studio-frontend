export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Mini Breadboard Reference | OpenHW Studio</title>
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
    <h1>Mini Breadboard</h1>
    <p class="subtitle">A mini solderless breadboard (170 tie-points).</p>

    <div class="component-preview">
      <svg width="60" height="40" viewBox="0 0 60 40">
        <rect x="0" y="0" width="60" height="40" fill="#e2e8f0" rx="4"/>
        <rect x="5" y="15" width="50" height="10" fill="#cbd5e0"/>
      </svg>
      <div>
        <p>A compact breadboard perfectly sized for very small projects or single IC prototyping. It features 17 columns (A-J).</p>
        <p><strong>Note:</strong> Unlike full and half-size breadboards, the mini breadboard does NOT have horizontal power rails. All connections must be made via the vertical 5-hole columns.</p>
      </div>
    </div>
</div>
</body>
</html>
`;
