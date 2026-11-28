# pico-emu — RP2350 SHA-256: silicon CSR map + atomic aliases

**Patch file:** `pico-m33-sha256-csr-map.patch` (applies to the owner's
`include/devtools.h`, `src/devtools.c`, `src/membus.c`).

**Goal:** the RP2350 HASH accelerator must answer the canonical SDK
`pico_sha256_*` flow with the FIPS 180-4 digest.

## Root causes (file:line, owner tree @ `b83786f` + working-tree changes)

**(a) The CSR bit map contradicted silicon.**
`include/devtools.h:539-542` had `WDATA_RDY=bit0 / SUM_VLD=bit1 / START=bit31`.
RP2350 silicon (pico-sdk
`src/rp2350/hardware_regs/include/hardware/regs/sha256.h`) has
`START=bit0 / WDATA_RDY=bit1 / SUM_VLD=bit2 / ERR=bit4 / BSWAP=bit12`.
The SDK's `sha256_wait_valid_blocking()` polls `SUM_VLD` (bit 2) → the guest
spins forever → **no digest at all**.

**(b) The atomic aliases were collapsed.**
`src/membus.c:1515` called `sha256_write(addr & 0xFFF, val)`, which throws
away the RP2350 atomic-alias bits. The SDK's `hw_set_bits()` /
`hw_clear_bits()` (pico-sdk `hardware/address_mapped.h:135-147`) write the
**mask** to the *alias* register (`+0x1000` XOR, `+0x2000` SET, `+0x3000`
CLEAR — `hardware/regs/addressmap.h:19-21`), so the engine was receiving
"the new CSR value = mask" instead of "set/clear these bits".
Measured on the guest's three CSR writes (debug trace of the engine):

```
[SHACSR] val=00000010 -> (clear ERR bit)      -> engine set CSR = 0x10
[SHACSR] val=00001000 -> (set BSWAP bit)       -> engine set CSR = 0x1000
[SHACSR] val=00000001 -> (set START bit)       -> engine set CSR = 0x01
```

Every other CSR bit was destroyed, so **BSWAP was lost** — the digest came
out byte-swapped even when the guest got past the hang.

**(c) BSWAP was never honoured.**
`src/devtools.c` `sha256_write()` had the comment "BSWAP/DMA_SIZE accepted"
but `sha256_bswap` was a constant `1` — the SDK sets/clears it per
endianness (`hardware/sha256.h` `sha256_set_bswap`).

## The patch

* `include/devtools.h` — the silicon bit map (START=0, WDATA_RDY=1,
  SUM_VLD=2, ERR=4, BSWAP=12).
* `src/membus.c` — pass the alias bits to the model
  (`sha256_write(addr & 0x3FFFu, val)`).
* `src/devtools.c` — `sha256_write()` applies the alias semantics
  (XOR/SET/CLEAR), derives `sha256_bswap` from the resulting CSR, and
  `sha256_init()` keeps BSWAP across a START (a new checksum).

## Acceptance test (measured)

Firmware: the SDK's canonical API (`pico_sha256_start_blocking(&st,
SHA256_BIG_ENDIAN,false)` → `pico_sha256_update_blocking("abc")` →
`pico_sha256_finish()`), compiled for `rp2040:rp2040:rpipico2`.

**Unpatched (repo engine bytes, md5 `0c74dffe5f5458a9062e4f7a13197781`):**

```
PICO2_SHA_READY
PICO2_SHA_STARTRC:0
PICO2_SHA_WRITTEN
        <- no DIGEST: sha256_wait_valid_blocking() never returns
```

**Patched (engine built from the patched tree in /tmp, never in the engine
repo):**

```
PICO2_SHA_DIGEST:BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD
```

= FIPS 180-4 SHA-256("abc") — byte-exact.

End-to-end in this repo: `tests/e2e/pico2-periph.spec.js` (the SHA case) goes
green unchanged once the owner lands the patch.
