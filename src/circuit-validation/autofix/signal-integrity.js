/**
 * Lightweight Signal Integrity Helpers for Phase 4 enhancements
 * Provides simple heuristics to detect high-speed nets and recommend fixes.
 */

export function detectHighSpeedNets(components, connections) {
  // Heuristic: nets with many connections or known high-speed components
  const netCount = Object.create(null);
  connections.forEach((c) => {
    const from = String(c.from || '');
    const to = String(c.to || '');
    netCount[from] = (netCount[from] || 0) + 1;
    netCount[to] = (netCount[to] || 0) + 1;
  });

  const candidateNets = Object.entries(netCount)
    .filter(([, cnt]) => cnt >= 3) // threshold
    .map(([net]) => net);

  // Also detect nets connected to components that often require SI (e.g., oscillator, USB, SPI)
  const siNets = new Set(candidateNets);
  components.forEach((comp) => {
    const t = String(comp.type || '').toLowerCase();
    if (/oscillator|usb|spi|i2s|sdram|mcu|fpga/.test(t)) {
      // assume pins named like MCU:PA0 etc — add all connections referencing comp.id
      connections.forEach((c) => {
        if (String(c.from || '').startsWith(`${comp.id}.`) || String(c.to || '').startsWith(`${comp.id}.`)) {
          siNets.add(String(c.from || ''));
          siNets.add(String(c.to || ''));
        }
      });
    }
  });

  return Array.from(siNets).filter(Boolean);
}

export function recommendSeriesTermination(netName) {
  return {
    type: 'series_termination',
    net: netName,
    suggestion: 'Add series termination resistor (22Ω-100Ω) near source to reduce ringing',
    confidence: 0.7,
  };
}

export function recommendTwistedPair(netName) {
  return {
    type: 'twisted_pair',
    net: netName,
    suggestion: 'For balanced differential signals, route as twisted pair and keep length matched',
    confidence: 0.65,
  };
}
