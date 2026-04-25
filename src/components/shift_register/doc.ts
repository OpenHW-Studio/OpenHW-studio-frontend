export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>74HC595 Shift Register Reference | OpenHW Studio</title>
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
  .try-section { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 28px 32px; margin: 36px 0; }
  .try-btn { display: inline-flex; align-items: center; gap: 8px; background: #2b6cb0; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="content">
    <h1>74HC595 Shift Register</h1>
    <p class="subtitle">8-bit serial-in, parallel-out shift register.</p>

    <div class="component-preview">
      <svg width="120" height="180" viewBox="0 0 100 200">
        <rect x="20" y="10" width="60" height="180" rx="4" fill="#2d3748" stroke="#63b3ed" stroke-width="2"/>
        <path d="M45,10 A5,5 0 0,0 55,10" fill="none" stroke="#63b3ed" stroke-width="2"/>
        
        <!-- Left pins: SER, SRCLK, RCLK, OE, SRCLR -->
        <line x1="0" y1="30" x2="20" y2="30" stroke="#63b3ed" stroke-width="2"/><text x="25" y="34" fill="#a0aec0" font-size="10">SER</text>
        <line x1="0" y1="50" x2="20" y2="50" stroke="#63b3ed" stroke-width="2"/><text x="25" y="54" fill="#a0aec0" font-size="10">SRCLK</text>
        <line x1="0" y1="70" x2="20" y2="70" stroke="#63b3ed" stroke-width="2"/><text x="25" y="74" fill="#a0aec0" font-size="10">RCLK</text>
        <line x1="0" y1="90" x2="20" y2="90" stroke="#63b3ed" stroke-width="2"/><text x="25" y="94" fill="#a0aec0" font-size="10">OE</text>
        <line x1="0" y1="110" x2="20" y2="110" stroke="#63b3ed" stroke-width="2"/><text x="25" y="114" fill="#a0aec0" font-size="10">SRCLR</text>

        <!-- Right pins: Q0-Q7, Q7' -->
        <line x1="80" y1="20" x2="100" y2="20" stroke="#63b3ed" stroke-width="2"/><text x="60" y="24" fill="#a0aec0" font-size="10">Q0</text>
        <line x1="80" y1="40" x2="100" y2="40" stroke="#63b3ed" stroke-width="2"/><text x="60" y="44" fill="#a0aec0" font-size="10">Q1</text>
        <line x1="80" y1="60" x2="100" y2="60" stroke="#63b3ed" stroke-width="2"/><text x="60" y="64" fill="#a0aec0" font-size="10">Q2</text>
        <line x1="80" y1="80" x2="100" y2="80" stroke="#63b3ed" stroke-width="2"/><text x="60" y="84" fill="#a0aec0" font-size="10">Q3</text>
        <line x1="80" y1="100" x2="100" y2="100" stroke="#63b3ed" stroke-width="2"/><text x="60" y="104" fill="#a0aec0" font-size="10">Q4</text>
        <line x1="80" y1="120" x2="100" y2="120" stroke="#63b3ed" stroke-width="2"/><text x="60" y="124" fill="#a0aec0" font-size="10">Q5</text>
        <line x1="80" y1="140" x2="100" y2="140" stroke="#63b3ed" stroke-width="2"/><text x="60" y="144" fill="#a0aec0" font-size="10">Q6</text>
        <line x1="80" y1="160" x2="100" y2="160" stroke="#63b3ed" stroke-width="2"/><text x="60" y="164" fill="#a0aec0" font-size="10">Q7</text>
        <line x1="80" y1="180" x2="100" y2="180" stroke="#63b3ed" stroke-width="2"/><text x="60" y="184" fill="#a0aec0" font-size="10">Q7'</text>
      </svg>
      <div>
        <p>The 74HC595 is a fundamental building block for expanding the number of digital outputs available from a microcontroller. It requires only 3 pins (Data, Clock, Latch) to control 8 outputs.</p>
        <p>These chips can be cascaded by connecting the Q7' (Serial Out) of one chip to the SER (Data In) of the next, allowing control of 16, 24, 32, or more outputs using the same 3 microcontroller pins.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Name</th><th>Description</th></tr>
      <tr><td>vcc</td><td>Power</td><td>Power supply (3V to 5V).</td></tr>
      <tr><td>gnd</td><td>Ground</td><td>Ground reference.</td></tr>
      <tr><td>ser</td><td>Serial Input (DS)</td><td>Data input to the shift register.</td></tr>
      <tr><td>srclk</td><td>Shift Clock (SHCP)</td><td>On rising edge, the data in the shift register moves one step.</td></tr>
      <tr><td>rclk</td><td>Latch (STCP)</td><td>On rising edge, copies the shift register to the output pins.</td></tr>
      <tr><td>oe</td><td>Output Enable</td><td>Active LOW. When HIGH, outputs are disabled (high impedance).</td></tr>
      <tr><td>srclr</td><td>Clear</td><td>Active LOW. Clears the shift register when driven LOW.</td></tr>
      <tr><td>q0-q7</td><td>Outputs</td><td>8 parallel digital outputs.</td></tr>
      <tr><td>q7s</td><td>Serial Output (Q7')</td><td>Outputs the MSB for cascading to another 74HC595.</td></tr>
    </table>

    <div class="try-section">
      <h3>▶ Try it in the Simulator</h3>
      <button class="try-btn" onclick="openSimulator()">Open Sample Circuit</button>
    </div>
</div>

<script>
function openSimulator() {
  var payload = {
    board: "arduino-uno",
    components: [
      { id: "uno", type: "wokwi-arduino-uno", x: 0, y: 0 },
      { id: "sr0", type: "shift_register", x: 300, y: 0 }
    ],
    connections: [
      ["uno:5V", "sr0:vcc", "red", []],
      ["uno:GND", "sr0:gnd", "black", []],
      ["uno:11", "sr0:ser", "blue", []],
      ["uno:12", "sr0:rclk", "green", []],
      ["uno:13", "sr0:srclk", "yellow", []],
      ["uno:5V", "sr0:srclr", "red", []],
      ["uno:GND", "sr0:oe", "black", []]
    ],
    code: ""
  };
  var encoded = encodeURIComponent(JSON.stringify(payload));
  window.open("http://localhost:5173/simulator?circuit=" + encoded, "_blank");
}
</script>
</body>
</html>
`;
