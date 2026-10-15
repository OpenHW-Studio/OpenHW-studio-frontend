// hal/protocol-frames.ts — protocol-lane record codec (plan §11.1).
//
// Fixed 32-byte records (same footprint as SAB telemetry records so they can
// land in a ring unmodified later) making protocol traffic visible as data:
// I2C/SPI/UART-frame/OneWire/PWM-settled/I2S summaries. Codec only — no
// layout change, no behavior change. Full frames stay on direct calls and
// messages; records carry summaries (address/count/first-last/duty).
//
// Layout (LE, 32 B):
//   +0  u16 busKind (PROTO_BUS_*)
//   +2  u16 flags (bit0 direction 1=read/device-to-master, bit1 ack/nack,
//       bit2 error, bit3 settled/stable)
//   +4  u32 address (I2C addr, SPI command/first byte, UART source hash,
//       OneWire ROM-cmd/function byte, PWM pin hash, I2S channel)
//   +8  f32 v0 (byte count, or dutyCycle for PWM)
//   +12 f32 v1 (last byte value, or frequencyHz for PWM)
//   +16 u32 cyclesLo | +20 u32 cyclesHi
//   +24 u32 wallMs
//   +28 u32 reserved (must be zero)

export const PROTO_RECORD_BYTES = 32;

export const PROTO_BUS_I2C = 1;
export const PROTO_BUS_SPI = 2;
export const PROTO_BUS_UART_FRAME = 3;
export const PROTO_BUS_ONEWIRE = 4;
export const PROTO_BUS_PWM_SETTLED = 5;
export const PROTO_BUS_I2S = 6;

export const PROTO_FLAG_READ = 1 << 0;
export const PROTO_FLAG_ACK = 1 << 1;
export const PROTO_FLAG_ERROR = 1 << 2;
export const PROTO_FLAG_SETTLED = 1 << 3;

export interface ProtocolRecord {
  bus: number;
  flags: number;
  address: number;
  v0: number;
  v1: number;
  cycles: number;
  wallMs: number;
}

export function encodeProtocolRecord(rec: ProtocolRecord): Uint8Array {
  const buf = new ArrayBuffer(PROTO_RECORD_BYTES);
  const u16 = new Uint16Array(buf, 0, 2);
  const u32 = new Uint32Array(buf);
  const f32 = new Float32Array(buf);
  u16[0] = rec.bus & 0xffff;
  u16[1] = rec.flags & 0xffff;
  u32[1] = rec.address >>> 0;
  f32[2] = Number(rec.v0) || 0;
  f32[3] = Number(rec.v1) || 0;
  const cycles = Math.max(0, Math.floor(Number(rec.cycles) || 0));
  u32[4] = cycles >>> 0;
  u32[5] = Math.floor(cycles / 4294967296) >>> 0;
  u32[6] = (Number(rec.wallMs) >>> 0) || 0;
  u32[7] = 0;
  return new Uint8Array(buf);
}

export function decodeProtocolRecord(bytes: ArrayLike<number> | ArrayBuffer | Uint8Array): ProtocolRecord | null {
  try {
    const u8 = bytes instanceof Uint8Array
      ? bytes
      : bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : Uint8Array.from(bytes as ArrayLike<number>);
    if (u8.length < PROTO_RECORD_BYTES) return null;
    const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + PROTO_RECORD_BYTES);
    const u16 = new Uint16Array(buf, 0, 2);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    return {
      bus: u16[0],
      flags: u16[1],
      address: u32[1] >>> 0,
      v0: f32[2],
      v1: f32[3],
      cycles: u32[4] + u32[5] * 4294967296,
      wallMs: u32[6] >>> 0,
    };
  } catch {
    return null;
  }
}

/** Convenience builders so producers never hand-pack fields. */
export function i2cRecord(address: number, byteCount: number, read: boolean, ack: boolean, cycles: number): Uint8Array {
  return encodeProtocolRecord({
    bus: PROTO_BUS_I2C, flags: (read ? PROTO_FLAG_READ : 0) | (ack ? PROTO_FLAG_ACK : 0),
    address: address & 0x7f, v0: byteCount, v1: 0, cycles, wallMs: Date.now(),
  });
}

export function pwmSettledRecord(pinHash: number, dutyCycle: number, frequencyHz: number, cycles: number): Uint8Array {
  return encodeProtocolRecord({
    bus: PROTO_BUS_PWM_SETTLED, flags: PROTO_FLAG_SETTLED,
    address: pinHash >>> 0, v0: dutyCycle, v1: frequencyHz, cycles, wallMs: Date.now(),
  });
}

/** SPI transaction summary: first byte = command, v0 = length, v1 = last byte. */
export function spiRecord(firstByte: number, byteCount: number, lastByte: number, cycles: number): Uint8Array {
  return encodeProtocolRecord({
    bus: PROTO_BUS_SPI, flags: 0,
    address: firstByte & 0xff, v0: byteCount, v1: lastByte & 0xff, cycles, wallMs: Date.now(),
  });
}

/** OneWire slot summary: function/ROM byte in address, v0 = bit count. */
export function onewireRecord(functionByte: number, bitCount: number, cycles: number): Uint8Array {
  return encodeProtocolRecord({
    bus: PROTO_BUS_ONEWIRE, flags: 0,
    address: functionByte & 0xff, v0: bitCount, v1: 0, cycles, wallMs: Date.now(),
  });
}
