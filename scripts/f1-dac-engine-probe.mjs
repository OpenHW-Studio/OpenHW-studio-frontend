// ENGINE-LEVEL PROBE (node, repo-committed bytes) — F1 DAC.
// Question: does the PINNED F1 engine model the DAC block (0x40008000) for
// the chips this lane's boards use, and does a guest DHR write show up as a
// DAC output (DOR) + a dac_output event?
//
// Method: drive the peripheral bus directly (no firmware):
//   DAC_CR   = 0x40008000   (EN1 = bit 0)
//   DAC_DHR12R1 = 0x40008008
//   DAC_DOR1 = 0x4000802C
// Run: node scripts/f1-dac-engine-probe.mjs
import { createEmulator } from '../src/engines/stm32f1-emu/pkg/emulator.js';

const DAC_CR = 0x40008000;
const DAC_DHR12R1 = 0x40008008;
const DAC_DOR1 = 0x4000802c;
const show = (tag, v) => console.log(`${tag}: 0x${(v >>> 0).toString(16).padStart(8, '0')}`);

for (const chip of ['stm32f103c8', 'gd32f103c8']) {
  console.log(`--- chip ${chip} ---`);
  const emu = await createEmulator({ chip });
  let events = [];
  try {
    emu.onEvent?.((type, payload) => { events.push([type, payload]); });
  } catch { /* optional */ }
  try { emu.periphWrite(DAC_CR, 4, 1); } catch (e) { console.log('  CR write failed:', e && e.message); }
  try { emu.periphWrite(DAC_DHR12R1, 4, 0x123); } catch (e) { console.log('  DHR write failed:', e && e.message); }
  show('  DOR1 readback', emu.periphRead(DAC_DOR1, 4));
  show('  DHR12R1 readback', emu.periphRead(DAC_DHR12R1, 4));
  console.log('  events:', JSON.stringify(events).slice(0, 400));
  try { emu.close?.(); } catch { /* ignore */ }
}
