// Lane/f4-cov2 — OFFLINE F4 guest harness (node, no browser).
//
// WHY: the e2e cells are the DELIVERABLE (they are the matrix evidence),
// but each one costs 20-180 s of browser+wall time. This harness runs the
// SAME guest firmware on the SAME deployed engine bytes in node, so a
// sketch can be validated in seconds before it is burned through the
// browser.
//
// It uses the same pieces the runner uses:
//   * firmware: POST http://localhost:5000/api/compile (the same backend
//     the browser hits) with the board's FQBN -> base64 .bin
//   * engine:   npm glue node_modules/stm32f4-emu/site/vendor/stm32_periph_wasm.js
//               + the SERVED wasm public/wasm/stm32_periph_wasm_bg.wasm
//               + the vendored SVD public/vendor/board-engines/.../{svd}
//   * facade:  STM32F4._create({chip, bindings, svdXml, wasmInit, firmware,
//               uart_addr, enable_irqs:true}) — the runner's exact options
//
// Usage:
//   node tests/e2e/_probe-f4-guest.mjs <chip> <fqbn> <code-file> [steps] [uartAddr]
import { readFileSync } from 'fs';
import { STM32F4 } from 'stm32f4-emu/stm32f4';
import * as bindings from 'stm32f4-emu/vendor';

const ROOT = new URL('../../', import.meta.url);
const API = process.env.OPENHW_API || 'http://localhost:5000/api';

const chip = process.argv[2] || 'stm32f407';
const fqbn = process.argv[3] || 'STMicroelectronics:stm32:Disco:pnum=DISCO_F407VG';
const codeFile = process.argv[4];
const totalSteps = Number(process.argv[5] || 400) * 100000;
const uartAddr = Number(process.argv[6] || (chip === 'stm32f407' ? 0x40004400 : 0x40011000));

const SVD = {
  stm32f401: 'stm32f401.svd',
  stm32f407: 'stm32f407.svd',
  stm32f407ve: 'stm32f407.svd',
  stm32f411: 'stm32f411.svd',
  stm32f429: 'stm32f429.svd',
};

async function compile(code) {
  const res = await fetch(`${API}/compile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, fqbn, artifacts: ['bin', 'elf'], target: 'stm32f4' }),
  });
  if (!res.ok) throw new Error(`compile failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const art = data?.artifacts?.bin;
  if (!art) throw new Error(`no bin artifact: ${JSON.stringify(data).slice(0, 400)}`);
  const b64 = art.encoding === 'base64' ? art.data : Buffer.from(art.data, 'utf8').toString('base64');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

const code = readFileSync(codeFile, 'utf8');
const firmware = await compile(code);
console.log(`# compiled ${firmware.length} bytes for ${chip}`);

const wasmInit = new Uint8Array(readFileSync(new URL('public/wasm/stm32_periph_wasm_bg.wasm', ROOT)));
const svdXml = readFileSync(new URL(`public/vendor/board-engines/stm32f4-emu/site/vendor/${SVD[chip]}`, ROOT), 'utf8');

const emu = await STM32F4._create({
  chip,
  bindings,
  svdXml,
  wasmInit,
  firmware,
  uart_addr: uartAddr,
  enable_irqs: true,
});

let out = '';
// TX tap: the model emits the guest's TX on the USART instance the core
// actually uses (usart2 on the Disco F407, usart1 elsewhere) — the runner
// hooks both (stm32f4-runner.ts:1192/1203). Mirror that here.
const tx = [];
for (const name of ['usart1', 'usart2', 'usart3', 'usart6']) {
  try {
    const u = emu[name];
    if (u) u.onData = (b) => tx.push(String.fromCharCode(b & 0xff));
  } catch { /* ignore */ }
}
// ITM stimulus drain (the runner wires this: stm32f4-runner.ts:1913).
try { emu.onItmByte = (port, b) => tx.push(String.fromCharCode(b & 0xff)); } catch { /* ignore */ }
const CHUNK = 100000;
let last = null;
for (let done = 0; done < totalSteps; done += CHUNK) {
  // execute() is what the runner drives (stm32f4-runner.ts stepBudget);
  // step() is the raw CPU step and skips some peripheral servicing.
  last = typeof emu.execute === 'function' ? emu.execute(CHUNK) : emu.step(CHUNK);
  let chunk = '';
  try { chunk = String(emu._emu.drainUart() || ''); } catch { /* no uart */ }
  out += chunk;
  if (process.env.PROBE_VERBOSE) {
    console.log(`# step ${done} pc=${last?.pc} inst=${last?.instCount} uart=${JSON.stringify(chunk.slice(0, 80))}`);
  }
}
try { out += String(emu._emu.drainUart() || ''); } catch { /* no uart */ }
out += tx.join('');
if (process.env.PROBE_VERBOSE) {
  try { console.log('# regs', JSON.stringify(emu._emu.cpu?.get_regs?.() ?? null)); } catch { /* ignore */ }
}
console.log('----- SERIAL -----');
console.log(out);
console.log('----- END -----');
