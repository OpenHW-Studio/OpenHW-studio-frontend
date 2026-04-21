export const doc = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>CD74HC4067 Reference | OpenHW Studio</title>
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
    <h1>16-Channel Mux (CD74HC4067)</h1>
    <p class="subtitle">A 16-channel analog/digital multiplexer/demultiplexer.</p>

    <div class="component-preview">
      <svg width="60" height="100" viewBox="0 0 60 100">
        <rect x="10" y="5" width="40" height="90" fill="#2d3748" rx="2" stroke="#63b3ed" stroke-width="1"/>
        <!-- Left pins: VCC, GND, EN, S0-S3, SIG -->
        <line x1="0" y1="10" x2="10" y2="10" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="20" x2="10" y2="20" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="30" x2="10" y2="30" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="45" x2="10" y2="45" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="55" x2="10" y2="55" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="65" x2="10" y2="65" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="75" x2="10" y2="75" stroke="#f6e05e" stroke-width="2"/>
        <line x1="0" y1="90" x2="10" y2="90" stroke="#f6e05e" stroke-width="2"/>

        <!-- Right pins: C0-C15 -->
        <line x1="50" y1="10" x2="60" y2="10" stroke="#f6e05e" stroke-width="2"/>
        <line x1="50" y1="15" x2="60" y2="15" stroke="#f6e05e" stroke-width="2"/>
        <!-- ... abbreviated visualization ... -->
        <line x1="50" y1="85" x2="60" y2="85" stroke="#f6e05e" stroke-width="2"/>
      </svg>
      <div>
        <p>The CD74HC4067 acts like a 16-position rotary switch, electronically controlled via 4 digital select pins (S0-S3). It can handle bidirectional analog and digital signals, making it perfect for connecting up to 16 sensors to a single analog pin on an Arduino.</p>
      </div>
    </div>

    <h2>Pin Reference</h2>
    <table class="pin-table">
      <tr><th>Pin</th><th>Type</th><th>Description</th></tr>
      <tr><td>VCC</td><td>Power</td><td>Power supply (2V to 6V).</td></tr>
      <tr><td>GND</td><td>Power</td><td>Ground reference.</td></tr>
      <tr><td>EN</td><td>Input</td><td>Enable pin (Active LOW). Must be low to use multiplexer.</td></tr>
      <tr><td>S0-S3</td><td>Input</td><td>Binary select pins (0000 = C0, 1111 = C15).</td></tr>
      <tr><td>SIG</td><td>Bidirectional</td><td>Common signal pin connected to the selected C channel.</td></tr>
      <tr><td>C0-C15</td><td>Bidirectional</td><td>16 independent channels.</td></tr>
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
      { id: "mux", type: "wokwi-cd74hc4067", x: 300, y: 0 }
    ],
    connections: [
      ["uno:5V", "mux:VCC", "red", []],
      ["uno:GND", "mux:GND", "black", []],
      ["uno:GND", "mux:EN", "black", []],
      ["uno:8", "mux:S0", "green", []],
      ["uno:9", "mux:S1", "green", []],
      ["uno:10", "mux:S2", "green", []],
      ["uno:11", "mux:S3", "green", []],
      ["uno:A0", "mux:SIG", "blue", []]
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
