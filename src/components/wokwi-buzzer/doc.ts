export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Buzzer Reference | OpenHW Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.7; padding: 48px 64px; }
  a { color: #63b3ed; text-decoration: none; }
  .content { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 36px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #718096; margin-bottom: 36px; border-bottom: 1px solid #2d3748; padding-bottom: 24px; }
  .component-preview { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 40px; background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 32px; }
  .component-svg-wrap { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .component-info p { color: #a0aec0; font-size: 15px; margin-bottom: 16px; }
  .tag { display: inline-block; background: #1a2035; border: 1px solid #2d4a8a; color: #63b3ed; padding: 3px 10px; border-radius: 20px; font-size: 12px; margin-right: 6px; margin-bottom: 6px; }
  h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 36px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #2d3748; }
  .pin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
  .pin-table th { background: #1a1f2e; color: #63b3ed; padding: 10px 14px; text-align: left; border: 1px solid #2d3748; }
  .pin-table td { padding: 10px 14px; border: 1px solid #2d3748; color: #a0aec0; }
  .pin-table tr:nth-child(even) td { background: #141824; }
  .pin-name { font-family: monospace; color: #68d391; font-weight: 600; }
  .pin-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
  .pin-type.digital { background: #1a365d; color: #63b3ed; }
  .pin-type.power { background: #742a2a; color: #fff5f5; }
  .code-block { background: #141824; border: 1px solid #2d3748; border-radius: 8px; padding: 20px 24px; font-family: 'Courier New', monospace; font-size: 13px; color: #e2e8f0; overflow-x: auto; margin-bottom: 20px; position: relative; }
  .copy-btn { position: absolute; top: 10px; right: 10px; background: #2d3748; border: none; color: #a0aec0; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
  .note { background: #1a2a1a; border-left: 4px solid #68d391; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 14px; color: #9ae6b4; }
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 16px; }
  .try-btn:hover { background: #3182ce; }
</style>
</head>
<body>
<div class="content">
    <h1>Buzzer</h1>
    <p class="subtitle">A piezoelectric buzzer that converts electrical signals into audible sound. Used for alarms, notifications, and simple melodies.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="80" height="100" viewBox="0 0 68 90">
          <circle cx="34" cy="35" r="30" fill="#222" stroke="#444" stroke-width="2" />
          <circle cx="34" cy="35" r="5" fill="#111" />
          <rect x="26" y="70" width="4" height="20" fill="#bbb" />
          <rect x="38" y="70" width="4" height="20" fill="#bbb" />
          <text x="34" y="8" fill="#fff" font-size="6" font-family="monospace" text-anchor="middle">BUZZER</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Piezo Buzzer</span>
      </div>
      <div class="component-info">
        <p>Buzzers are versatile output devices. In the simulator, they can produce tones using the Arduino <code>tone()</code> function or by manually toggling the digital pin at high frequencies.</p>
        <p><strong>Driven Types:</strong> Active buzzers sound when DC voltage is applied, while Passive buzzers (like this one) require an oscillating signal to produce sound.</p>
        <div>
          <span class="tag">Audio Output</span>
          <span class="tag">PWM Compatible</span>
          <span class="tag">Dynamic Pitch</span>
          <span class="tag">Compact</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td><span class="pin-name">1</span></td><td><span class="pin-type digital">Digital</span></td><td>Positive (+). Connect to a PWM or Digital pin.</td></tr>
      <tr><td><span class="pin-name">2</span></td><td><span class="pin-type power">Power</span></td><td>Negative (–). Connect to Ground (GND).</td></tr>
    </table>

    <div class="note">💡 <strong>Sound Tip:</strong> Use the <code>tone(pin, frequency, duration)</code> function in Arduino to play specific musical notes.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>const int BUZZER_PIN = 9;

void setup() {
  // No setup needed for tone()
}

void loop() {
  tone(BUZZER_PIN, 440); // Play A4 note
  delay(500);
  noTone(BUZZER_PIN);    // Stop sound
  delay(500);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Test the Buzzer with an Arduino Uno. Hear how different frequencies create different pitches in the interactive simulator.</p>
      <button class="try-btn" onclick="openSimulator()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Open Sample Circuit
      </button>
    </div>
</div>

<script>
function copyCode(btn) {
  const pre = btn.nextElementSibling;
  navigator.clipboard.writeText(pre.textContent).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  });
}

function openSimulator() {
  var code = \`void setup() {\\n}\\n\\nvoid loop() {\\n  tone(9, 1000);\\n  delay(200);\\n  noTone(9);\\n  delay(200);\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "bz1", type: "wokwi-buzzer", x: 300, y: 150 }
    ],
    connections: [
      [ "uno:9", "bz1:1", "red", [] ],
      [ "uno:GND.1", "bz1:2", "black", [] ]
    ],
    code: code
  };

  var encoded = encodeURIComponent(JSON.stringify(payload));
  var localUrl = "http://localhost:5173/simulator?circuit=" + encoded;
  window.open(localUrl, "_blank");
}
</script>
</body>
</html>
`;
