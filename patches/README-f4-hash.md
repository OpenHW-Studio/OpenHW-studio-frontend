# F4 engine patches (HASH peripheral) — for the engine owner

These are **proposed changes to the F4 engine** (`stm32 F4/stm32-periph-wasm`),
found while proving the `stm32f4-sys` HASH cell. They are **not applied**
here: the engine repos are shared and read-only for this lane.

* Target file: `stm32-periph-wasm/src/peripherals/hash.rs`
* Target tree state: the owner's working copy as of 2026-10-20
  (`git apply --check` passes on that file — see "Apply" below).
* Measured against the **deployed** engine bytes that the e2e cells run:
  * glue `public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js` — md5 `19a9630175082fab610c8685e8aad7cb` (identical to npm `stm32f4-emu` 1.5.0)
  * wasm `public/wasm/stm32_periph_wasm_bg.wasm` — md5 `9455e31cdbb2295697db81e49ec4119e`
    (npm ships a different wasm, md5 `7ef32e3f38cc56a19a12581d91d21618`, with the same glue —
    **do not mix the two**; the measurements below are against `9455e31c`).

## What is already correct (no patch needed)

The deployed engine's HASH peripheral is good enough to prove SHA-256 and
SHA-1 end to end:

| fact | measured on the deployed wasm |
|---|---|
| ALGO encoding | `HASH_CR` bit 7 = ALGO0, bit 18 = ALGO1 → ALGO=00 SHA-1, 01 MD5, 10 SHA-256, 11 unimplemented |
| message convention | `HASH_DIN` takes the word **big-endian** |
| padding | standard FIPS 180-4 padding is applied to the pushed bytes (message-hash semantics) |
| status | `HASH_SR` @ `0x50060424`, DCIS = bit 1 |
| start | `HASH_STR` @ `0x50060408`, DCAL = bit 8, NBLW = bits 0..4 |
| digest, main bank | `HASH_HR0..4` @ `0x5006040C..0x5006041C` (HR5/HR6 alias IMR/SR on silicon, so only 5 words are in the main bank) |
| digest, alias bank | `HASH_HR0..7` @ `0x50060710..0x5006072C` (SVD base+0x310) — **the full 8-word SHA-256 digest is readable here** |

Verified digests (printed by the guest, matched against `sha256sum`/`sha1sum`):

```
SHA-256("")     = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
SHA-256("abcd") = 88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589
SHA-1("abcd")   = 81fe8bfe87576c3ecb22426f8e57847382917acf
```

## Patch 1 — `f4-hash-silicon-fixes.patch` (three silicon deviations)

1. **`HASH_CR.INIT` is modelled at bit 0; RM0090 puts it at bit 2.**
   Silicon firmware does `HASH_CR = HASH_CR | HASH_INIT` (0x4). The model
   only reacts to bit 0, so the message buffer is *not* cleared and the
   digest covers the concatenation of the old and the new message.
   The patch accepts bit 2 (RM0090) *and* keeps bit 0 working.

2. **`HASH_SR` writes SET `DINIS`/`DCIS`; on silicon they are rc_w1**
   (write 1 to clear). Firmware that acknowledges a flag
   (`HASH_SR = HASH_SR | DCIS`) re-asserted it and could never leave the
   completion path. The patch turns the write into a clear.

3. **The SHA-256 digest is mirrored into `HR0..HR3` only**, so the main
   bank's `HR4` (`0x5006041C`) reads 0 instead of digest word 4 — silicon
   has `HASH_HR0..HR4` in the main bank. The patch mirrors five words.
   (The full 8 words are only reachable through the alias bank at +0x310,
   which is where the e2e cell reads them, so the cell passes with or
   without this hunk.)

## Patch 2 — `f4-hash-completion-interrupt.patch` (drive-by)

`check_interrupt()` tests `self.sr & 0x08` (the SR BUSY bit) and
`self.cr & 0x20` (a `HASH_CR` bit that does not exist) instead of
`HASH_IMR.DCIE` (bit 1 of IMR @ `0x50060420`) and `HASH_SR.DCIS`.
**The HASH completion interrupt was therefore never raised.** Kept in a
separate patch because it changes interrupt behaviour and no e2e cell
depends on it.

## Apply

```bash
cd "<owner F4 repo>"
git apply --check patches/f4-hash-silicon-fixes.patch      # from the frontend lane
git apply        patches/f4-hash-silicon-fixes.patch
git apply        patches/f4-hash-completion-interrupt.patch   # optional, separate
```

Then rebuild the wasm (`wasm-pack`) and refresh the vendored bytes:
the frontend serves the glue from
`public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js`
and the wasm from `public/wasm/stm32_periph_wasm_bg.wasm`
(the runner fetches that pair — see `importEngine` in
`src/worker/runners/arm-runner-base.ts` and the `resolve.alias` entries in
`vite.config.js`).

## Repro (e2e, from the frontend lane)

```bash
cd <frontend lane>
export TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest
npx playwright test --config=playwright.agent.config.js tests/e2e/stm32f4-sys.spec.js --workers=1
```

The HASH cell (`HASH computes standard SHA-256 and SHA-1 digests`) passes on
the current engine bytes; with patch 1 applied it must still pass (the cell
reads the digest from the alias bank and asserts `HR0..HR3` of the main
bank, never `HR4`).
