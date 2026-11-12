import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  PROTO_RECORD_BYTES,
  PROTO_BUS_I2C,
  PROTO_BUS_SPI,
  PROTO_BUS_UART_FRAME,
  PROTO_BUS_ONEWIRE,
  PROTO_BUS_PWM_SETTLED,
  PROTO_BUS_I2S,
  PROTO_FLAG_READ,
  PROTO_FLAG_ACK,
  PROTO_FLAG_ERROR,
  PROTO_FLAG_SETTLED,
  encodeProtocolRecord,
  decodeProtocolRecord,
  i2cRecord,
  pwmSettledRecord,
  spiRecord,
  onewireRecord,
} from '../../../src/worker/hal/protocol-frames.ts';

describe('protocol-lane record codec (plan §11.1)', () => {
  test('fixed 32-byte round-trip for every bus kind', () => {
    const cases = [
      { bus: PROTO_BUS_I2C, flags: PROTO_FLAG_ACK, address: 0x27, v0: 4, v1: 255, cycles: 16000, wallMs: 42 },
      { bus: PROTO_BUS_SPI, flags: 0, address: 0x9f, v0: 8, v1: 0xaa, cycles: 2 ** 33 + 7, wallMs: 43 },
      { bus: PROTO_BUS_UART_FRAME, flags: PROTO_FLAG_READ, address: 0x1234, v0: 12, v1: 65, cycles: 0, wallMs: 44 },
      { bus: PROTO_BUS_ONEWIRE, flags: PROTO_FLAG_ERROR, address: 0xcc, v0: 1, v1: 0, cycles: 480, wallMs: 45 },
      { bus: PROTO_BUS_PWM_SETTLED, flags: PROTO_FLAG_SETTLED, address: 0xdead, v0: 0.5, v1: 490.0, cycles: 9, wallMs: 46 },
      { bus: PROTO_BUS_I2S, flags: 0, address: 1, v0: 16, v1: 0, cycles: 10, wallMs: 47 },
    ];
    for (const rec of cases) {
      const bytes = encodeProtocolRecord(rec);
      assert.equal(bytes.length, PROTO_RECORD_BYTES);
      // Reserved word stays zero (forward-compat).
      const tail = new Uint32Array(bytes.buffer, bytes.byteOffset + 28, 1)[0];
      assert.equal(tail, 0);
      const back = decodeProtocolRecord(bytes);
      assert.ok(back);
      assert.equal(back.bus, rec.bus);
      assert.equal(back.flags, rec.flags);
      assert.equal(back.address, rec.address >>> 0);
      assert.ok(Math.abs(back.v0 - rec.v0) < 1e-6);
      assert.ok(Math.abs(back.v1 - rec.v1) < 1e-3);
      assert.equal(back.cycles, rec.cycles);
      assert.equal(back.wallMs, rec.wallMs);
    }
  });

  test('short buffers decode to null (never partial reads)', () => {
    assert.equal(decodeProtocolRecord(new Uint8Array(31)), null);
    assert.equal(decodeProtocolRecord([]), null);
  });

  test('convenience builders pack documented fields', () => {
    const i2c = decodeProtocolRecord(i2cRecord(0x3c, 5, true, true, 100));
    assert.equal(i2c.bus, PROTO_BUS_I2C);
    assert.ok(i2c.flags & PROTO_FLAG_READ);
    assert.ok(i2c.flags & PROTO_FLAG_ACK);
    assert.equal(i2c.address, 0x3c);
    assert.equal(i2c.v0, 5);
    const pwm = decodeProtocolRecord(pwmSettledRecord(77, 0.25, 1000, 200));
    assert.equal(pwm.bus, PROTO_BUS_PWM_SETTLED);
    assert.ok(pwm.flags & PROTO_FLAG_SETTLED);
    assert.ok(Math.abs(pwm.v0 - 0.25) < 1e-6);
  });

  test('SPI/OneWire builders match the AVR producer field packing', () => {
    // AVR SPI producer: address = first byte, v0 = length, v1 = last byte.
    const spi = decodeProtocolRecord(spiRecord(0x9f, 4, 0xaa, 16000));
    assert.equal(spi.bus, PROTO_BUS_SPI);
    assert.equal(spi.address, 0x9f);
    assert.equal(spi.v0, 4);
    assert.equal(spi.v1, 0xaa);
    assert.equal(spi.cycles, 16000);
    // OneWire producer: address = function byte, v0 = bit count.
    const ow = decodeProtocolRecord(onewireRecord(0xcc, 64, 480));
    assert.equal(ow.bus, PROTO_BUS_ONEWIRE);
    assert.equal(ow.address, 0xcc);
    assert.equal(ow.v0, 64);
  });
});
