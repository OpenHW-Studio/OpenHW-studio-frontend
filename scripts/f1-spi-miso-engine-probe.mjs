// ENGINE-LEVEL PROBE (node, repo-committed bytes — NOT the owner's live folder).
// Question: does the F1 engine deliver INJECTED MISO bytes to the guest, or
// does it ignore the injection queue when no SPI device is attached to the bus?
//
// Method: drive the SPI1 peripheral directly through the engine's own
// peripheral bus API (periph_write / periph_read) — no firmware needed:
//   SPI1_DR = 0x4001300C
//   1. write DR  -> the engine's SPI write handler runs
//   2. injectMiso(1, [0x42])
//   3. write DR  -> the guest's RX byte for THIS transfer
//   4. read  DR  -> the RX byte the guest would see
//
// Run:  node scripts/f1-spi-miso-engine-probe.mjs
import { createEmulator } from '../src/engines/stm32f1-emu/pkg/emulator.js';

const SPI1_DR = 0x4001300c;
const show = (tag, v) => console.log(`${tag}: 0x${(v >>> 0).toString(16).padStart(2, '0')}`);

async function probe(label, { withDevice }) {
  const opts = { chip: 'stm32f103c8' };
  if (withDevice) {
    opts.ext_devices = {
      spi_flash: [{
        peripheral: 'SPI1',
        jedec_id: '0xC84016',
        data: new Uint8Array(256).fill(0xA5),
        cs: 'PA4',
      }],
    };
    console.log(`[${label}] engine SPI flash attached on SPI1 (cs=PA4)`);
  } else {
    console.log(`[${label}] no engine SPI device attached`);
  }
  const emu = await createEmulator(opts);
  // Enable SPI1 (CR1 SPE) so the peripheral is in master mode.
  emu.periphWrite(0x40013000, 4, 0x0344);
  emu.periphWrite(SPI1_DR, 4, 0x9f);
  show(`[${label}] rx after 1st DR write`, emu.periphRead(SPI1_DR, 4));
  try { emu.spiInjectMiso(1, [0x42]); console.log(`[${label}] injected MISO 0x42 on channel 1`); }
  catch (e) { console.log(`[${label}] inject failed: ${e && e.message}`); }
  emu.periphWrite(SPI1_DR, 4, 0x00);
  show(`[${label}] rx after 2nd DR write (0x42 injected before it)`, emu.periphRead(SPI1_DR, 4));
  try { emu.spiInjectMiso(1, [0x43]); } catch { /* ignore */ }
  emu.periphWrite(SPI1_DR, 4, 0x00);
  show(`[${label}] rx after 3rd DR write (0x43 injected before it)`, emu.periphRead(SPI1_DR, 4));
  try { emu.close?.(); } catch { /* ignore */ }
  console.log('');
}

// JEDEC-ID read against the engine's OWN spi_flash (no injection at all):
// shows the native device ordering (write-then-read).
async function probeJedec() {
  const emu = await createEmulator({
    chip: 'stm32f103c8',
    ext_devices: { spi_flash: [{ peripheral: 'SPI1', jedec_id: '0xC84016', data: new Uint8Array(256).fill(0xA5), cs: 'PA4' }] },
  });
  emu.periphWrite(0x40013000, 4, 0x0344);
  console.log('[jedec] engine spi_flash, no injection (0xC84016 expected)');
  const bytes = [];
  for (const b of [0x9f, 0x00, 0x00, 0x00]) {
    emu.periphWrite(SPI1_DR, 4, b);
    bytes.push(emu.periphRead(SPI1_DR, 4));
  }
  console.log('[jedec] rx bytes:', bytes.map((b) => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  try { emu.close?.(); } catch { /* ignore */ }
}

await probe('no-device', { withDevice: false });
await probe('with-device', { withDevice: true });
await probeJedec();
