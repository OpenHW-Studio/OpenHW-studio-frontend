export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Servo Motor Reference | OpenHW Studio</title>
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
  .pin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
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
    <h1>Servo Motor</h1>
    <p class="subtitle">A hobbyist servo motor that provides precise angular control (0–180°). Ideal for robotics and animated mechanical projects.</p>

    <div class="component-preview">
      <div class="component-svg-wrap">
        <svg width="180" height="130" viewBox="0 0 165 120">
          <rect x="10" y="10" width="145" height="100" fill="#2d3748" rx="4" />
          <circle cx="82" cy="60" r="30" fill="#4a5568" />
          <rect x="75" y="20" width="15" height="80" fill="#fff" rx="7.5" transform="rotate(45 82 60)" />
          <text x="82" y="115" fill="#fff" font-size="8" font-family="monospace" text-anchor="middle">SG90 SERVO</text>
        </svg>
        <span style="font-size:11px;color:#4a5568;">Standard SG90 Servo</span>
      </div>
      <div class="component-info">
        <p>Servos contain a DC motor, gear train, and control circuit. They interpret PWM pulses to move the horn to a specific angle. They are highly efficient and provide high torque in a small package.</p>
        <p><strong>Pulse Control:</strong> A pulse width of 1ms typically corresponds to 0°, 1.5ms to 90°, and 2ms to 180°.</p>
        <div>
          <span class="tag">Angular Position</span>
          <span class="tag">PWM Control</span>
          <span class="tag">5V Operating</span>
          <span class="tag">High Torque</span>
        </div>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Wire Color</th><th>Pin ID</th><th>Type</th><th>Description</th></tr>
      <tr><td><span style="color:#f56565;">Brown</span></td><td><span class="pin-name">GND</span></td><td><span class="pin-type power">Power</span></td><td>Ground reference.</td></tr>
      <tr><td><span style="color:#ed8936;">Red</span></td><td><span class="pin-name">V+</span></td><td><span class="pin-type power">Power</span></td><td>5V Supply voltage.</td></tr>
      <tr><td><span style="color:#ecc94b;">Orange</span></td><td><span class="pin-name">PWM</span></td><td><span class="pin-type digital">Signal</span></td><td>Control signal (PWM).</td></tr>
    </table>

    <div class="note">💡 <strong>Wiring Tip:</strong> Most hobby servos use Brown (GND), Red (VCC), and Orange (Signal) wiring schemes.</div>

    <h2>Example Code</h2>
    <div class="code-block">
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<pre>#include &lt;Servo.h&gt;

Servo myServo;

void setup() {
  myServo.attach(9);
}

void loop() {
  myServo.write(0);   // Move to 0 degrees
  delay(1000);
  myServo.write(90);  // Move to 90 degrees
  delay(1000);
  myServo.write(180); // Move to 180 degrees
  delay(1000);
}</pre>
    </div>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <p>Control a Servo motor using an Arduino Uno. Watch the horn sweep across its entire range of motion in real-time.</p>
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
  var code = \`#include <Servo.h>\\n\\nServo myservo;\\n\\nvoid setup() {\\n  myservo.attach(9);\\n}\\n\\nvoid loop() {\\n  for (int pos = 0; pos <= 180; pos += 1) {\\n    myservo.write(pos);\\n    delay(15);\\n  }\\n  for (int pos = 180; pos >= 0; pos -= 1) {\\n    myservo.write(pos);\\n    delay(15);\\n  }\\n}\`;

  var payload = {
    board: "arduino_uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "servo", type: "wokwi-servo", x: 300, y: 150 }
    ],
    connections: [
      [ "uno:9", "servo:PWM", "orange", [] ],
      [ "uno:5V", "servo:V+", "red", [] ],
      [ "uno:GND.1", "servo:GND", "black", [] ]
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
