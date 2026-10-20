import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../..');

// The owner first-party nRF52833 engine (nrf52833-periph-wasm) ships as a
// wasm-bindgen pair: the JS glue and the .wasm MUST come from the same
// build — a mismatched pair misbinds the exported ABI and the board dies
// with a confusing "missing export" instead of a clear error.
//
// Canonical bytes = the owner's committed demo/pkg of the nrf52833-periph-wasm
// 0.2.0 freeze (owner commit 4a46800 "P164 OpenHW runner gear: PWM
// readback + injection recipes + fixtures + frozen bundle"). The crate
// source and demo/pkg were last touched by that same commit and the tree
// is clean, so the committed pkg IS the current source — no rebuild needed.
//
// md5 of the same bytes (the owner's numbers):
//   glue 112f7ab323f20ba324f47cd4774e2308
//   wasm d5a0e574319784def884edddb4fdcffd
const OWNER_PKG_SHA256 = {
  glue: '81507dc508e0f6331ca6ddf5c5091a8be6bdc419a47c9baf316fc22e0b2399e7',
  wasm: 'b448542935b962475146a3bd348d58c0dfecdc88f9ad4b3df58e34a4053e8557',
};

const GLUE_COPIES = [
  'src/worker/engines/microbit/nrf52833_periph_wasm.js',
  'public/vendor/board-engines/microbit/nrf52833_periph_wasm.js',
];
const WASM_COPIES = [
  'public/wasm/nrf52833_periph_wasm_bg.wasm',
  'public/vendor/board-engines/microbit/nrf52833_periph_wasm_bg.wasm',
];

// WebCrypto, not node:crypto: the vite alias maps node:crypto to the
// browser stub (it throws by design), and this test runs under vitest
// with that alias active.
async function sha256(file) {
  const buf = fs.readFileSync(file);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return Buffer.from(digest).toString('hex');
}

describe('micro:bit engine pair integrity (nrf52833-periph-wasm)', () => {
  test('every glue copy is the owner pkg build', async () => {
    for (const rel of GLUE_COPIES) {
      const file = path.join(frontendRoot, rel);
      assert.ok(fs.existsSync(file), `missing glue copy: ${rel}`);
      assert.equal(await sha256(file), OWNER_PKG_SHA256.glue, `glue copy drifted: ${rel}`);
    }
  });

  test('every wasm copy is the owner pkg build', async () => {
    for (const rel of WASM_COPIES) {
      const file = path.join(frontendRoot, rel);
      assert.ok(fs.existsSync(file), `missing wasm copy: ${rel}`);
      assert.equal(await sha256(file), OWNER_PKG_SHA256.wasm, `wasm copy drifted: ${rel}`);
    }
  });

  test('the deploy mirror exists so the vendor fallback resolves', () => {
    // The runner falls back to /vendor/board-engines/microbit/... in the
    // deployed app (node_modules is not served there).
    const dir = path.join(frontendRoot, 'public/vendor/board-engines/microbit');
    assert.ok(fs.existsSync(dir), 'deploy mirror missing');
    const files = fs.readdirSync(dir).sort();
    assert.deepEqual(files, ['nrf52833_periph_wasm.js', 'nrf52833_periph_wasm_bg.wasm']);
  });

  test('the glue exposes the exports the runner wires', () => {
    // Guard against a half-updated glue: every symbol the micro:bit
    // runner calls must exist in the shipped pair.
    const glue = fs.readFileSync(path.join(frontendRoot, GLUE_COPIES[0]), 'utf8');
    const exported = new Set();
    for (const m of glue.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/gm)) {
      exported.add(m[1]);
    }
    for (const m of glue.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) exported.add(name);
      }
    }
    const required = [
      'reset_state', 'init', 'initSync', 'WasmCpu',
      'get_uart_output', 'uart_rx_byte',
      'uarte_take_txdma', 'uarte_complete_txdma',
      'twim_take_txdma', 'twim_complete_txdma', 'twim_take_rxdma', 'twim_complete_rxdma',
      'saadc_take_result', 'saadc_complete_result',
      'nvmc_take_erase', 'nvmc_complete_erase',
      'gpio_read_output', 'gpio_set_input', 'gpio_read_dir', 'matrix_state',
      'periph_read', 'periph_write',
      'pwm_get_duty', 'pwm_get_freq_hz', 'pwm_observe_seq_word',
    ];
    for (const name of required) {
      assert.ok(exported.has(name), `glue is missing export ${name} (mismatched pair?)`);
    }
  });
});
